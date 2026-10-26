"""
AI Calls phase 2 — interview availability and reminder calls (Spec §6, §7).

Availability
    open_slots          HR's window minus the panelists' interviews and live holds
    start_availability  asks the engine to call the candidate with those slots
    hold_slot           mid-call action: lock the slot the candidate said yes to
                        (per-org advisory lock, so two calls can't take one slot)
    book_confirmed_slot on the final callback: create the interview exactly as
                        the Schedule screen does, then schedule its reminders

Reminders
    reminder_times      day before at 6 PM + 1 hour before, kept inside calling hours
    sync_reminders      cancel and recreate an interview's reminder calls whenever
                        it is created, rescheduled or cancelled
"""
import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.interview import Interview, InterviewPanelist
from app.models.organization import Organization
from app.models.user import User
from app.models.voice_call import VoiceCall, VoiceSlotHold
from app.services import voice_calls as vc_svc
from app.services.activity_service import log_activity
from app.services.ai_credit_service import AICreditsService
from app.services.interview_scheduling import get_job_role, schedule_interview
from app.utils.permissions import InterviewStatus

logger = logging.getLogger(__name__)

AVAILABILITY = "AVAILABILITY"
REMINDER = "REMINDER"
HOLD_MINUTES = 30            # an unconfirmed hold stops blocking after this
MIN_LEAD = timedelta(hours=2)  # never offer a slot sooner than this
MAX_SLOTS = 20               # enough choice without a long list read aloud
SAME_DAY_SKIP = timedelta(hours=3)  # Spec §7.2: closer than this, only the 1-hour reminder

MODE_TO_TYPE = {"VIDEO": "video", "PHONE": "phone", "IN_PERSON": "onsite"}
TYPE_TO_MODE = {"phone": "PHONE", "onsite": "IN_PERSON"}


# ── Slots ────────────────────────────────────────────────────────────────────

def _hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def window_starts(window: dict, duration_min: int, tz: ZoneInfo, now: datetime) -> list[datetime]:
    """Every slot start inside HR's window, stepping by the interview length
    (rounded up to 30 minutes), from at least MIN_LEAD from now."""
    step = timedelta(minutes=max(30, -(-duration_min // 30) * 30))
    day_start, day_end = _hhmm(window["day_start"]), _hhmm(window["day_end"])
    d, last = date.fromisoformat(window["from_date"]), date.fromisoformat(window["to_date"])
    out = []
    while d <= last:
        if not (window.get("weekdays_only", True) and d.weekday() >= 5):
            t = datetime.combine(d, day_start, tzinfo=tz)
            end = datetime.combine(d, day_end, tzinfo=tz)
            while t + timedelta(minutes=duration_min) <= end:
                if t >= now + MIN_LEAD:
                    out.append(t)
                t += step
        d += timedelta(days=1)
    return out


def _overlaps(a_start: datetime, a_min: int, b_start: datetime, b_min: int) -> bool:
    return a_start < b_start + timedelta(minutes=b_min) and b_start < a_start + timedelta(minutes=a_min)


async def busy_for(db: AsyncSession, org_id: uuid.UUID, panelist_ids: list[str], start: datetime, end: datetime,
                   exclude_call_id: uuid.UUID | None = None) -> list[tuple[datetime, int]]:
    """(start, minutes) the panelists are already committed to: their interviews
    plus other calls' live holds."""
    ids = [uuid.UUID(str(p)) for p in panelist_ids]
    busy: list[tuple[datetime, int]] = []
    if ids:
        rows = (await db.execute(
            select(Interview.scheduled_at, Interview.duration_minutes)
            .join(InterviewPanelist, InterviewPanelist.interview_id == Interview.id)
            .where(
                Interview.organization_id == org_id,
                InterviewPanelist.user_id.in_(ids),
                Interview.status == InterviewStatus.SCHEDULED,
                Interview.scheduled_at < end,
                Interview.scheduled_at > start - timedelta(hours=12),
            )
        )).all()
        busy += [(r[0], r[1] or 60) for r in rows]
    fresh = datetime.now(timezone.utc) - timedelta(minutes=HOLD_MINUTES)
    q = select(VoiceSlotHold).where(
        VoiceSlotHold.organization_id == org_id,
        VoiceSlotHold.status == "HELD",
        VoiceSlotHold.created_at > fresh,
        VoiceSlotHold.start_at < end,
    )
    if exclude_call_id:
        q = q.where(VoiceSlotHold.voice_call_id != exclude_call_id)
    wanted = {str(p) for p in panelist_ids}
    for hold in (await db.scalars(q)).all():
        if not wanted or wanted & {str(p) for p in hold.panelist_ids}:
            busy.append((hold.start_at, hold.duration_min))
    return busy


async def open_slots(db: AsyncSession, org: Organization, window: dict, duration_min: int,
                     panelist_ids: list[str], now: datetime | None = None) -> list[str]:
    tz = ZoneInfo(org.timezone or "Asia/Kolkata")
    now = now or datetime.now(timezone.utc)
    starts = window_starts(window, duration_min, tz, now)
    if not starts:
        return []
    busy = await busy_for(db, org.id, panelist_ids, starts[0], starts[-1] + timedelta(minutes=duration_min))
    free = [s for s in starts if not any(_overlaps(s, duration_min, b, m) for b, m in busy)]
    return [s.isoformat() for s in free[:MAX_SLOTS]]


# ── Starting an availability call ────────────────────────────────────────────

async def start_availability(db: AsyncSession, user, org: Organization, candidate: Candidate, req: dict) -> VoiceCall:
    """req: round, mode, duration_min, location, application_id, job_title,
    panelists [{user_id, role}], window {...}. Raises VoiceCallError."""
    if not candidate.ai_call_consent_at or candidate.ai_call_opted_out_at:
        raise vc_svc.VoiceCallError("Candidate opted out of AI calls" if candidate.ai_call_opted_out_at
                                    else "No AI call consent recorded for this candidate")
    phone = vc_svc.to_e164(candidate.phone, org.timezone)
    if not phone:
        raise vc_svc.VoiceCallError("Phone number is missing or has no country code")
    active = await db.scalar(select(VoiceCall.id).where(
        VoiceCall.candidate_id == candidate.id, VoiceCall.type == AVAILABILITY,
        VoiceCall.task_status.in_(vc_svc.ACTIVE_STATUSES)))
    if active:
        raise vc_svc.VoiceCallError("An availability call is already in progress for this candidate")

    panelist_ids = [p["user_id"] for p in req.get("panelists", [])]
    slots = await open_slots(db, org, req["window"], req["duration_min"], panelist_ids)
    if not slots:
        raise vc_svc.VoiceCallError("No free interview slots in that window")
    await AICreditsService.check_credits_available(db, org.id, vc_svc.FEATURE, user.id)

    org_settings = await vc_svc.get_org_settings(db, org.id)
    job_title = req.get("job_title") or await get_job_role(db, req.get("application_id"), candidate.id)
    vc = VoiceCall(
        organization_id=org.id, candidate_id=candidate.id, job_id=req.get("job_id"), created_by_id=user.id,
        type=AVAILABILITY, phone_e164=phone, language=org_settings["default_language"],
        request={**req, "job_title": job_title, "slots": slots},
    )
    db.add(vc)
    await db.flush()
    payload = vc_svc.task_payload(
        vc, org, candidate, AVAILABILITY,
        context={
            "company_name": org.name,
            "job": {"title": job_title},
            "interview": {"round": req["round"], "mode": req["mode"], "duration_min": req["duration_min"],
                          "location": req.get("location")},
            "slots": slots,
            "expected_minutes": 3,
        },
        org_settings=org_settings,
    )
    await vc_svc.send_to_engine(vc, payload)
    await log_activity(db, org.id, user.id, "ai_call.started", "candidate", str(candidate.id),
                       {"voice_call_id": str(vc.id), "type": AVAILABILITY, "slots": len(slots), "error": vc.error},
                       broadcast=False)
    return vc


# ── Mid-call actions from the engine ─────────────────────────────────────────

async def hold_slot(db: AsyncSession, vc: VoiceCall, start_iso: str) -> dict:
    """Lock `start_iso` for this call, or say it's gone and offer the next free ones."""
    req = vc.request or {}
    slots: list[str] = req.get("slots") or []
    if start_iso not in slots:
        return {"ok": False, "alternatives": slots[:3]}
    # One org at a time: two calls confirming the same slot can't both win.
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"voice-slots:{vc.organization_id}"})
    start = datetime.fromisoformat(start_iso)
    duration = int(req["duration_min"])
    panelist_ids = [p["user_id"] for p in req.get("panelists", [])]

    mine = (await db.scalars(select(VoiceSlotHold).where(
        VoiceSlotHold.voice_call_id == vc.id, VoiceSlotHold.status == "HELD"))).all()
    if any(h.start_at == start for h in mine):
        return {"ok": True}

    now = datetime.now(timezone.utc)
    busy = await busy_for(db, vc.organization_id, panelist_ids, start - timedelta(hours=12),
                          start + timedelta(minutes=duration), exclude_call_id=vc.id)
    if start < now or any(_overlaps(start, duration, b, m) for b, m in busy):
        later = [datetime.fromisoformat(s) for s in slots if datetime.fromisoformat(s) > now and s != start_iso]
        all_busy = await busy_for(db, vc.organization_id, panelist_ids, now,
                                  max(later, default=now) + timedelta(minutes=duration), exclude_call_id=vc.id)
        free = [s.isoformat() for s in later if not any(_overlaps(s, duration, b, m) for b, m in all_busy)]
        return {"ok": False, "alternatives": free[:3]}

    for h in mine:  # the candidate changed their mind mid-call
        h.status = "RELEASED"
    db.add(VoiceSlotHold(organization_id=vc.organization_id, voice_call_id=vc.id, start_at=start,
                         duration_min=duration, panelist_ids=panelist_ids))
    return {"ok": True}


async def resend_details(db: AsyncSession, vc: VoiceCall) -> dict:
    """Re-send the interview invite (link or address) to the candidate."""
    if not vc.interview_id:
        return {"ok": False}
    interview = await db.get(Interview, vc.interview_id)
    candidate = await db.get(Candidate, vc.candidate_id)
    org = await db.get(Organization, vc.organization_id)
    if not (interview and candidate and org):
        return {"ok": False}
    from app.services.email_service import send_interview_invite
    tz = ZoneInfo(org.timezone or "Asia/Kolkata")
    send_interview_invite(
        candidate_email=candidate.email,
        candidate_name=candidate.full_name,
        round_name=interview.title,
        job_role=await get_job_role(db, interview.application_id, candidate.id),
        company_name=org.name,
        scheduled_at=interview.scheduled_at.astimezone(tz).strftime("%B %d, %Y at %I:%M %p"),
        meeting_link=interview.meeting_link,
        duration_minutes=interview.duration_minutes,
        interview_type=interview.interview_type,
        org_logo_url=org.logo_url,
    )
    await log_activity(db, org.id, None, "ai_call.details_resent", "interview", str(interview.id),
                       {"voice_call_id": str(vc.id)}, broadcast=False)
    return {"ok": True}


# ── Final results ────────────────────────────────────────────────────────────

async def _scheduler_for(db: AsyncSession, vc: VoiceCall) -> User | None:
    if vc.created_by_id:
        user = await db.get(User, vc.created_by_id)
        if user and user.is_active:
            return user
    return await db.scalar(select(User).where(
        User.organization_id == vc.organization_id, User.role == "admin", User.is_active.is_(True)).limit(1))


async def book_confirmed_slot(db: AsyncSession, vc: VoiceCall, result: dict) -> Interview | None:
    """SLOT_CONFIRMED -> the interview, booked from the call's live hold."""
    holds = (await db.scalars(select(VoiceSlotHold).where(
        VoiceSlotHold.voice_call_id == vc.id, VoiceSlotHold.status == "HELD"))).all()
    if result.get("outcome") != "SLOT_CONFIRMED" or vc.interview_id:
        for h in holds:
            h.status = "RELEASED"
        return None
    start = datetime.fromisoformat(result["confirmed_slot"]["start"])
    hold = next((h for h in holds if h.start_at == start), None)
    scheduler = await _scheduler_for(db, vc)
    candidate = await db.get(Candidate, vc.candidate_id)
    if hold is None or scheduler is None or candidate is None:
        vc.use_case_outcome = "SLOT_PROPOSED_NEEDS_APPROVAL"   # HR books it by hand
        logger.warning("voice: confirmed slot without a live hold for call %s", vc.id)
        return None
    req = vc.request or {}
    interview, _ = await schedule_interview(
        db,
        scheduler=scheduler,
        candidate=candidate,
        title=req.get("round", "Interview"),
        interview_type=MODE_TO_TYPE.get(req.get("mode", "VIDEO"), "video"),
        scheduled_at=start,
        duration_minutes=int(req["duration_min"]),
        location=req.get("location"),
        notes="Booked by the Hybent AI Agent after the candidate confirmed this slot on a call.",
        application_id=uuid.UUID(req["application_id"]) if req.get("application_id") else None,
        panelists=[(p["user_id"], p.get("role")) for p in req.get("panelists", [])],
    )
    hold.status = "USED"
    for h in holds:
        if h is not hold:
            h.status = "RELEASED"
    vc.interview_id = interview.id
    await sync_reminders(db, interview)
    return interview


async def apply_reminder_result(db: AsyncSession, vc: VoiceCall, result: dict) -> None:
    if result.get("outcome") == "CONFIRMED" and vc.interview_id:
        interview = await db.get(Interview, vc.interview_id)
        if interview:
            interview.is_confirmed = True


# ── Reminders ────────────────────────────────────────────────────────────────

def reminder_times(start: datetime, now: datetime, tz: ZoneInfo, window_start: str, window_end: str) -> list[tuple[int, datetime]]:
    """[(reminder_number, when)] for an interview at `start` (Spec §7.2)."""
    ws, we = _hhmm(window_start), _hhmm(window_end)
    local = start.astimezone(tz)
    out: list[tuple[int, datetime]] = []

    if start - now >= SAME_DAY_SKIP:
        r1 = datetime.combine(local.date() - timedelta(days=1), time(18, 0), tzinfo=tz)
        # Outside calling hours -> the nearest allowed time earlier that day.
        if r1.time() >= we:
            r1 = datetime.combine(r1.date(), we, tzinfo=tz) - timedelta(minutes=30)
        elif r1.time() < ws:
            r1 = datetime.combine(r1.date(), ws, tzinfo=tz)
        if r1 > now:
            out.append((1, r1))

    r2 = local - timedelta(hours=1)
    # Never outside calling hours, even for reminders (Spec §4.4).
    if r2 > now and ws <= r2.time() < we:
        out.append((2, r2))
    return out


async def cancel_reminders(db: AsyncSession, interview_id: uuid.UUID) -> None:
    calls = (await db.scalars(select(VoiceCall).where(
        VoiceCall.interview_id == interview_id, VoiceCall.type == REMINDER,
        VoiceCall.task_status.in_(vc_svc.ACTIVE_STATUSES)))).all()
    for call in calls:
        if call.engine_task_id:
            try:
                await vc_svc.engine_cancel_task(call.engine_task_id)
            except vc_svc.EngineError:
                logger.warning("voice: couldn't cancel reminder %s in the engine", call.id)
        if call.task_status == "SCHEDULED":
            call.task_status = "CANCELLED"
            call.final = True
            call.next_attempt_at = None


async def sync_reminders(db: AsyncSession, interview: Interview) -> list[VoiceCall]:
    """Throw away the interview's pending reminder calls and schedule fresh
    ones for its current time — so a reschedule never leaves a stale reminder."""
    await cancel_reminders(db, interview.id)
    now = datetime.now(timezone.utc)
    if interview.status != InterviewStatus.SCHEDULED or interview.scheduled_at <= now:
        return []
    if not await vc_svc.ai_calls_enabled(db, interview.organization_id):
        return []
    org_settings = await vc_svc.get_org_settings(db, interview.organization_id)
    if not org_settings.get("reminder_calls", True):
        return []
    candidate = await db.get(Candidate, interview.candidate_id)
    org = await db.get(Organization, interview.organization_id)
    if not (candidate and org) or not candidate.ai_call_consent_at or candidate.ai_call_opted_out_at:
        return []
    phone = vc_svc.to_e164(candidate.phone, org.timezone)
    if not phone:
        return []

    tz = ZoneInfo(org.timezone or "Asia/Kolkata")
    job_title = await get_job_role(db, interview.application_id, candidate.id)
    scheduler = await db.get(User, interview.scheduled_by_id)
    created = []
    for number, when in reminder_times(interview.scheduled_at, now, tz,
                                       org_settings["window_start"], org_settings["window_end"]):
        vc = VoiceCall(
            organization_id=org.id, candidate_id=candidate.id, interview_id=interview.id,
            created_by_id=interview.scheduled_by_id, type=REMINDER, reminder_number=number,
            phone_e164=phone, language=org_settings["default_language"],
        )
        db.add(vc)
        await db.flush()
        payload = vc_svc.task_payload(
            vc, org, candidate, REMINDER,
            context={
                "company_name": org.name,
                "job": {"title": job_title},
                "interview": {
                    "round": interview.title,
                    "start": interview.scheduled_at.astimezone(tz).isoformat(),
                    "duration_min": interview.duration_minutes,
                    "mode": TYPE_TO_MODE.get(interview.interview_type, "VIDEO"),
                    "meeting_link_sent": bool(interview.meeting_link),
                    "address": interview.location,
                    "contact_person": scheduler.full_name if scheduler else None,
                },
                "reminder_number": number,
                "expected_minutes": 1,
            },
            org_settings=org_settings,
            schedule_at=when,
            expires_at=interview.scheduled_at,
        )
        await vc_svc.send_to_engine(vc, payload)
        created.append(vc)
    return created


async def sync_reminders_safely(db: AsyncSession, interview: Interview) -> None:
    """Reminders must never break scheduling: failures are logged, not raised."""
    try:
        async with db.begin_nested():
            await sync_reminders(db, interview)
    except Exception:
        logger.exception("voice: couldn't sync reminders for interview %s", interview.id)
