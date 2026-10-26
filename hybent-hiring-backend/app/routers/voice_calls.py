"""
AI Calls router (docs/voice-agent/PLAN.md §7, §7A).

GET    /v1/voice-calls/status                  is AI calling on for my org?
POST   /v1/voice-calls/prescreen               start AI pre-screens (1–50 candidates, one job)
POST   /v1/voice-calls/availability/slots      preview the open interview slots for a window
POST   /v1/voice-calls/availability            call a candidate to pick an interview slot
GET    /v1/voice-calls                         list (tab=queue|needs_action|history|all) + tab counts
GET    /v1/voice-calls/{id}                    detail: transcript, result
POST   /v1/voice-calls/{id}/cancel             stop further attempts
POST   /v1/voice-calls/{id}/override           HR's own decision over the AI recommendation
POST   /v1/voice-calls/{id}/resolve            mark a needs-action call as handled
GET    /v1/voice-calls/candidates/{id}         a candidate's calls (AI Call tab)
GET    /v1/voice-calls/interviews?ids=…        reminder / booking status per interview (Schedule page)
POST   /v1/voice-calls/candidates/{id}/consent HR records the candidate's consent
GET    /v1/voice-calls/jobs/{id}/config        a job's pre-screen setup
PUT    /v1/voice-calls/jobs/{id}/config
GET    /v1/voice-calls/settings                Settings → AI Calls
PUT    /v1/voice-calls/settings                (admin)
POST   /v1/voice-calls/callbacks               engine → us, HMAC-signed, no user auth
POST   /v1/voice-calls/actions                 engine → us mid-call (hold a slot, resend details), signed
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import and_, func, or_, select

from app.dependencies import DB, AdminUser, RecruiterUser
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.voice_call import VoiceCall
from app.schemas.response import APIResponse
from app.schemas.voice_call import (
    AvailabilityRequest,
    ConsentRequest,
    JobVoiceConfig,
    OverrideRequest,
    StartPrescreenRequest,
    StartResultOut,
    VoiceCallDetailOut,
    VoiceCallOut,
    VoiceSettingsUpdate,
)
from app.services import voice_calls as svc
from app.services import voice_scheduling
from app.services.activity_service import log_activity
from app.utils.permissions import NotificationType, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/voice-calls", tags=["ai-calls"])

Tab = Literal["queue", "needs_action", "history", "all"]

_NEEDS_ACTION = and_(
    VoiceCall.final.is_(True),
    VoiceCall.resolved_at.is_(None),
    or_(
        VoiceCall.outcome.in_(svc.NEEDS_ACTION_OUTCOMES),
        VoiceCall.use_case_outcome.in_(svc.NEEDS_ACTION_USE_CASE),
        VoiceCall.task_status == svc.FAILED_TO_START,
    ),
)
TAB_FILTERS = {
    "queue": VoiceCall.task_status.in_(svc.ACTIVE_STATUSES),
    "needs_action": _NEEDS_ACTION,
    # Reminders replaced by a reschedule were never dialed — not history.
    "history": and_(VoiceCall.final.is_(True),
                    or_(VoiceCall.task_status != "CANCELLED", VoiceCall.attempt_no > 0)),
}


async def _require_enabled(db, user) -> None:
    if not await svc.ai_calls_enabled(db, user.organization_id):
        raise HTTPException(status_code=403, detail="AI Calls are not enabled for your organization")


async def _get_call(db, user, call_id: uuid.UUID) -> VoiceCall:
    vc = await db.scalar(
        select(VoiceCall).where(VoiceCall.id == call_id, VoiceCall.organization_id == user.organization_id)
    )
    if vc is None:
        raise HTTPException(status_code=404, detail="AI call not found")
    return vc


async def _get_job(db, user, job_id: uuid.UUID) -> Job:
    job = await db.scalar(
        select(Job).where(Job.id == job_id, Job.organization_id == user.organization_id, Job.is_deleted.is_(False))
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def _get_candidate(db, user, candidate_id: uuid.UUID) -> Candidate:
    candidate = await db.scalar(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.organization_id == user.organization_id,
            Candidate.is_deleted.is_(False),
        )
    )
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


async def _with_names(db, calls: list[VoiceCall], schema=VoiceCallOut) -> list[dict]:
    cand_ids = {c.candidate_id for c in calls}
    job_ids = {c.job_id for c in calls if c.job_id}
    names = dict((await db.execute(select(Candidate.id, Candidate.full_name).where(Candidate.id.in_(cand_ids)))).all()) if cand_ids else {}
    titles = dict((await db.execute(select(Job.id, Job.title).where(Job.id.in_(job_ids)))).all()) if job_ids else {}
    return [
        {**schema.model_validate(c).model_dump(mode="json"),
         "candidate_name": names.get(c.candidate_id), "job_title": titles.get(c.job_id)}
        for c in calls
    ]


# ── Status & starting calls ──────────────────────────────────────────────────

@router.get("/status")
async def ai_calls_status(current_user: RecruiterUser, db: DB):
    return APIResponse.success(data={"enabled": await svc.ai_calls_enabled(db, current_user.organization_id)})


@router.post("/prescreen")
async def start_prescreen(body: StartPrescreenRequest, current_user: RecruiterUser, db: DB):
    await _require_enabled(db, current_user)
    job = await _get_job(db, current_user, body.job_id)
    org = await db.get(Organization, current_user.organization_id)
    ids = list(dict.fromkeys(body.candidate_ids))
    results = await svc.start_prescreen(db, current_user, org, job, ids)
    started = sum(1 for r in results if r.error is None)
    return APIResponse.success(
        message=f"{started} of {len(results)} AI pre-screen calls scheduled.",
        data=[StartResultOut(**r.__dict__).model_dump(mode="json") for r in results],
    )


# ── Availability calls (phase 2) ─────────────────────────────────────────────

def _availability_req(body: AvailabilityRequest) -> dict:
    return {
        "round": body.round,
        "mode": body.mode,
        "duration_min": body.duration_min,
        "location": body.location,
        "job_id": str(body.job_id) if body.job_id else None,
        "application_id": str(body.application_id) if body.application_id else None,
        "panelists": [{"user_id": str(p.user_id), "role": p.role} for p in body.panelists],
        "window": body.window.model_dump(),
    }


async def _check_panelists(db, user, body: AvailabilityRequest) -> None:
    ids = [p.user_id for p in body.panelists]
    if ids:
        from app.models.user import User
        found = await db.scalar(select(func.count()).select_from(User).where(
            User.id.in_(ids), User.organization_id == user.organization_id))
        if found != len(set(ids)):
            raise HTTPException(status_code=404, detail="Interviewer not found")


@router.post("/availability/slots")
async def preview_slots(body: AvailabilityRequest, current_user: RecruiterUser, db: DB):
    await _require_enabled(db, current_user)
    await _check_panelists(db, current_user, body)
    org = await db.get(Organization, current_user.organization_id)
    slots = await voice_scheduling.open_slots(
        db, org, body.window.model_dump(), body.duration_min, [str(p.user_id) for p in body.panelists])
    return APIResponse.success(data={"slots": slots, "timezone": org.timezone or "Asia/Kolkata"})


@router.post("/availability")
async def start_availability(body: AvailabilityRequest, current_user: RecruiterUser, db: DB):
    await _require_enabled(db, current_user)
    candidate = await _get_candidate(db, current_user, body.candidate_id)
    await _check_panelists(db, current_user, body)
    if body.job_id:
        await _get_job(db, current_user, body.job_id)
    org = await db.get(Organization, current_user.organization_id)
    try:
        vc = await voice_scheduling.start_availability(db, current_user, org, candidate, _availability_req(body))
    except svc.VoiceCallError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await db.commit()
    if vc.error:
        raise HTTPException(status_code=502, detail=vc.error)
    return APIResponse.success(message="Availability call scheduled.",
                               data=VoiceCallOut.model_validate(vc).model_dump(mode="json"))


# ── Listing & detail ─────────────────────────────────────────────────────────

@router.get("")
async def list_calls(
    current_user: RecruiterUser,
    db: DB,
    tab: Tab = "all",
    job_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    org_filter = VoiceCall.organization_id == current_user.organization_id
    q = select(VoiceCall).where(org_filter)
    if tab in TAB_FILTERS:
        q = q.where(TAB_FILTERS[tab])
    if job_id:
        q = q.where(VoiceCall.job_id == job_id)
    order = VoiceCall.next_attempt_at.asc().nulls_last() if tab == "queue" else VoiceCall.updated_at.desc()
    calls = list((await db.scalars(q.order_by(order).limit(limit).offset(offset))).all())

    counts = {}
    for name, cond in TAB_FILTERS.items():
        counts[name] = await db.scalar(select(func.count()).select_from(VoiceCall).where(org_filter, cond))
    return APIResponse.success(data={"items": await _with_names(db, calls), "counts": counts})


@router.get("/candidates/{candidate_id}")
async def candidate_calls(candidate_id: uuid.UUID, current_user: RecruiterUser, db: DB):
    candidate = await _get_candidate(db, current_user, candidate_id)
    calls = list((await db.scalars(
        select(VoiceCall).where(VoiceCall.candidate_id == candidate.id, VoiceCall.organization_id == current_user.organization_id)
        .order_by(VoiceCall.created_at.desc())
    )).all())
    return APIResponse.success(data={
        "calls": await _with_names(db, calls, VoiceCallDetailOut),
        "consent_at": candidate.ai_call_consent_at,
        "consent_source": candidate.ai_call_consent_source,
        "opted_out_at": candidate.ai_call_opted_out_at,
    })


@router.get("/interviews")
async def interview_status(current_user: RecruiterUser, db: DB, ids: str = Query(..., max_length=4000)):
    """For each interview: its reminder calls (newest status first) and whether
    the AI Agent booked it. Unknown or other orgs' ids are simply absent."""
    try:
        wanted = [uuid.UUID(i) for i in ids.split(",") if i.strip()][:200]
    except ValueError:
        raise HTTPException(status_code=422, detail="ids must be interview UUIDs")
    calls = (await db.scalars(
        select(VoiceCall).where(VoiceCall.organization_id == current_user.organization_id,
                                VoiceCall.interview_id.in_(wanted))
        .order_by(VoiceCall.created_at)
    )).all()
    out: dict[str, dict] = {}
    for c in calls:
        entry = out.setdefault(str(c.interview_id), {"booked_by_ai": False, "reminders": {}})
        if c.type == "AVAILABILITY":
            entry["booked_by_ai"] = True
        elif c.type == "REMINDER" and not (c.task_status == "CANCELLED" and c.attempt_no == 0):
            # The latest live call per reminder number wins (a reschedule replaces older ones).
            entry["reminders"][str(c.reminder_number)] = {
                "task_status": c.task_status, "outcome": c.outcome, "use_case_outcome": c.use_case_outcome,
                "next_attempt_at": c.next_attempt_at.isoformat() if c.next_attempt_at else None,
            }
    return APIResponse.success(data=out)


@router.post("/candidates/{candidate_id}/consent")
async def record_consent(candidate_id: uuid.UUID, body: ConsentRequest, current_user: RecruiterUser, db: DB):
    candidate = await _get_candidate(db, current_user, candidate_id)
    if candidate.ai_call_opted_out_at:
        raise HTTPException(status_code=409, detail="Candidate opted out of AI calls")
    candidate.ai_call_consent_at = datetime.now(timezone.utc)
    candidate.ai_call_consent_source = body.source
    await log_activity(db, current_user.organization_id, current_user.id, "ai_call.consent_recorded",
                       "candidate", str(candidate.id), {"source": body.source})
    await db.commit()
    return APIResponse.success(message="Consent recorded.")


@router.get("/settings")
async def get_settings(current_user: RecruiterUser, db: DB):
    return APIResponse.success(data=await svc.get_org_settings(db, current_user.organization_id))


@router.put("/settings")
async def update_settings(body: VoiceSettingsUpdate, current_user: AdminUser, db: DB):
    values = body.model_dump(exclude_none=True)
    merged = {**(await svc.get_org_settings(db, current_user.organization_id)), **values}
    if merged["window_start"] >= merged["window_end"]:
        raise HTTPException(status_code=422, detail="Calling window must end after it starts")
    saved = await svc.save_org_settings(db, current_user.organization_id, current_user.id, values)
    await log_activity(db, current_user.organization_id, current_user.id, "ai_call.settings_updated",
                       "organization", str(current_user.organization_id), values)
    await db.commit()
    return APIResponse.success(message="AI Call settings saved.", data=saved)


@router.get("/jobs/{job_id}/config")
async def get_job_config(job_id: uuid.UUID, current_user: RecruiterUser, db: DB):
    job = await _get_job(db, current_user, job_id)
    return APIResponse.success(data=JobVoiceConfig.model_validate(job.voice_call_config or {}).model_dump(mode="json"))


@router.put("/jobs/{job_id}/config")
async def update_job_config(job_id: uuid.UUID, body: JobVoiceConfig, current_user: RecruiterUser, db: DB):
    job = await _get_job(db, current_user, job_id)
    job.voice_call_config = body.model_dump(mode="json", exclude_none=True)
    await log_activity(db, current_user.organization_id, current_user.id, "ai_call.job_config_updated",
                       "job", str(job.id), None)
    await db.commit()
    return APIResponse.success(message="AI pre-screen setup saved.", data=job.voice_call_config)


@router.get("/{call_id}")
async def get_call(call_id: uuid.UUID, current_user: RecruiterUser, db: DB):
    vc = await _get_call(db, current_user, call_id)
    [item] = await _with_names(db, [vc], VoiceCallDetailOut)
    return APIResponse.success(data=item)


@router.post("/{call_id}/cancel")
async def cancel(call_id: uuid.UUID, current_user: RecruiterUser, db: DB):
    vc = await _get_call(db, current_user, call_id)
    if vc.task_status not in svc.ACTIVE_STATUSES:
        raise HTTPException(status_code=409, detail="This call has already finished")
    try:
        await svc.cancel_call(db, vc, current_user)
    except svc.EngineError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    await db.commit()
    return APIResponse.success(message="Further attempts cancelled.", data=VoiceCallOut.model_validate(vc).model_dump(mode="json"))


@router.post("/{call_id}/override")
async def override(call_id: uuid.UUID, body: OverrideRequest, current_user: RecruiterUser, db: DB):
    vc = await _get_call(db, current_user, call_id)
    if not vc.decision:
        raise HTTPException(status_code=409, detail="This call has no AI recommendation to override")
    vc.hr_override = {
        "decision": body.decision, "note": body.note,
        "by": str(current_user.id), "by_name": current_user.full_name,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await log_activity(db, current_user.organization_id, current_user.id, "ai_call.override", "candidate",
                       str(vc.candidate_id), {"voice_call_id": str(vc.id), "ai": vc.decision, "hr": body.decision})
    await db.commit()
    return APIResponse.success(message="Decision saved.", data=VoiceCallOut.model_validate(vc).model_dump(mode="json"))


@router.post("/{call_id}/resolve")
async def resolve(call_id: uuid.UUID, current_user: RecruiterUser, db: DB):
    vc = await _get_call(db, current_user, call_id)
    vc.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return APIResponse.success(message="Marked as handled.")


# ── Engine callbacks ─────────────────────────────────────────────────────────

def _notify(vc: VoiceCall, candidate_name: str) -> None:
    note = svc.notification_for(vc, candidate_name)
    if note is None:
        return
    title, message = note
    data = {"candidate_id": str(vc.candidate_id), "voice_call_id": str(vc.id)}
    try:
        from app.tasks.notifications import notify_organization_roles, send_system_notification
        if vc.created_by_id:
            send_system_notification.delay(str(vc.created_by_id), str(vc.organization_id),
                                           NotificationType.AI_CALL, title, message, data)
        else:
            notify_organization_roles.delay(str(vc.organization_id), [UserRole.ADMIN, UserRole.RECRUITER],
                                            NotificationType.AI_CALL, title, message, data)
    except Exception:  # a notification must never lose the call result
        logger.exception("voice: notification failed for call %s", vc.id)


async def _signed_json(request: Request) -> dict:
    body = await request.body()
    if not svc.verify_signature(request.headers.get("X-Voice-Timestamp"),
                                request.headers.get("X-Voice-Signature"), body):
        raise HTTPException(status_code=401, detail="Invalid signature")
    try:
        return json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")


@router.post("/actions", include_in_schema=False)
async def engine_action(request: Request, db: DB):
    """Mid-call questions from the agent; the candidate is on the line, so be quick."""
    payload = await _signed_json(request)
    vc = await svc.find_call(db, payload)
    if vc is None:
        return {"ok": False}
    action = payload.get("action")
    if action == "hold_slot" and vc.type == voice_scheduling.AVAILABILITY:
        answer = await voice_scheduling.hold_slot(db, vc, str(payload.get("start", "")))
    elif action == "resend_details":
        answer = await voice_scheduling.resend_details(db, vc)
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    await db.commit()
    return answer


@router.post("/callbacks", include_in_schema=False)
async def engine_callback(request: Request, db: DB):
    payload = await _signed_json(request)

    vc = await svc.apply_callback(db, payload)
    candidate_name = None
    if vc is not None:
        candidate_name = await db.scalar(select(Candidate.full_name).where(Candidate.id == vc.candidate_id))
    await db.commit()
    if vc is not None and payload.get("final"):
        _notify(vc, candidate_name or "Candidate")
    # 200 even for unknown calls: retrying would never make them known.
    return {"ok": True}
