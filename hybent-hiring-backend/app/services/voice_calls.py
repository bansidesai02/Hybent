"""
AI Calls — Hiring's side of the Hybent AI Agent (docs/voice-agent/PLAN.md §7).

    start_prescreen  checks a candidate can be called, records a VoiceCall,
                     asks the engine for a call task
    apply_callback   applies the engine's signed result to the VoiceCall,
                     bills the connected minutes, updates the candidate
                     profile and tells the recruiter

Availability and reminder calls live in voice_scheduling.

The engine never sees candidate data beyond what one call needs, and never
writes to this database: everything arrives through apply_callback.
"""
import hashlib
import hmac
import logging
import math
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.voice_call import OrgVoiceSettings, VoiceCall
from app.services.activity_service import log_activity
from app.services.ai_credit_service import AICreditsService

logger = logging.getLogger(__name__)

PRESCREEN = "PRESCREEN"
FEATURE = "ai_calls"   # AI credits feature name for call minutes
ACTIVE_STATUSES = ("SCHEDULED", "IN_CALL", "ANALYZING")
FAILED_TO_START = "FAILED_TO_START"
# Final outcomes HR has to follow up on (Spec §4.3, §4.6).
NEEDS_ACTION_OUTCOMES = (
    "HUMAN_REQUESTED", "NO_ANSWER", "BUSY", "UNREACHABLE", "VOICEMAIL",
    "INVALID_NUMBER", "WRONG_PERSON", "FAILED", "EXPIRED",
)
# Availability / reminder results that need a recruiter (Spec §6.6, §7.5).
NEEDS_ACTION_USE_CASE = (
    "SLOT_PROPOSED_NEEDS_APPROVAL", "CANDIDATE_NOT_INTERESTED",
    "RESCHEDULE_REQUESTED", "CANCELLED_BY_CANDIDATE", "UNSURE",
)
CALLBACK_MAX_AGE_SECONDS = 600
TITLE_MAX = 60   # longest company / job title copied from a spoken answer

DEFAULT_SETTINGS = {
    "window_start": "09:00",
    "window_end": "20:00",
    "max_attempts": 3,
    "retry_gap_minutes": 120,
    "default_language": "en",
    "communication_threshold_client_facing": 3.5,
    "communication_threshold_other": 3.0,
    "auto_update_profile": True,
    "recording_retention_days": 90,
    "reminder_calls": True,
}

OUTCOME_MESSAGES = {
    "COMPLETED": "finished the AI pre-screen",
    "PARTIAL": "finished part of the AI pre-screen",
    "NO_ANSWER": "didn't answer the AI call after every attempt",
    "BUSY": "was busy for every AI call attempt",
    "UNREACHABLE": "couldn't be reached by the AI call",
    "VOICEMAIL": "only reached voicemail on the AI call",
    "INVALID_NUMBER": "has an invalid phone number",
    "WRONG_PERSON": "— the AI call reached someone else",
    "HUMAN_REQUESTED": "asked to speak to a recruiter",
    "DECLINED": "isn't interested (AI call)",
    "OPTED_OUT": "asked not to receive AI calls",
    "EXPIRED": "couldn't be called before the deadline",
    "FAILED": "— the AI call failed",
}


AI_CALLS_FLAG = "ai_calls"   # Super Admin → client feature override


async def ai_calls_enabled(db: AsyncSession, organization_id) -> bool:
    """On when the engine is configured AND either the env turns it on for this
    org (AI_CALLS / AI_CALLS_ORGS) or a super admin switched the client on."""
    if not (settings.voice_api_key and settings.voice_callback_secret):
        return False
    if settings.ai_calls_enabled_for(organization_id):
        return True
    from app.models.super_admin import CompanyFeatureFlag
    return bool(await db.scalar(select(CompanyFeatureFlag.is_enabled).where(
        CompanyFeatureFlag.organization_id == organization_id, CompanyFeatureFlag.flag_key == AI_CALLS_FLAG)))


class VoiceCallError(Exception):
    """A candidate can't be called; the message is shown to the recruiter."""


# ── Settings ─────────────────────────────────────────────────────────────────

async def get_org_settings(db: AsyncSession, organization_id: uuid.UUID) -> dict:
    row = await db.get(OrgVoiceSettings, organization_id)
    return {**DEFAULT_SETTINGS, **(row.settings if row else {})}


async def save_org_settings(db: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID, values: dict) -> dict:
    row = await db.get(OrgVoiceSettings, organization_id)
    if row is None:
        row = OrgVoiceSettings(organization_id=organization_id, settings={})
        db.add(row)
    row.settings = {**row.settings, **values}
    row.updated_by_id = user_id
    return {**DEFAULT_SETTINGS, **row.settings}


# ── Phone numbers ────────────────────────────────────────────────────────────

INDIA_TIMEZONES = {"Asia/Kolkata", "Asia/Calcutta"}


def to_e164(phone: str | None, org_timezone: str | None) -> str | None:
    """Stored numbers look like '+91 9664957351' or bare digits. A bare
    10-digit number is taken as Indian only when the org itself is in India."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if phone.strip().startswith("+") and 8 <= len(digits) <= 15:
        return "+" + digits
    if len(digits) == 10 and org_timezone in INDIA_TIMEZONES:
        return "+91" + digits
    return None


# ── Engine client ────────────────────────────────────────────────────────────

class EngineError(Exception):
    pass


async def _engine(method: str, path: str, json: dict | None = None) -> dict | None:
    try:
        async with httpx.AsyncClient(base_url=settings.voice_engine_url, timeout=15) as client:
            resp = await client.request(method, path, json=json, headers={"X-Voice-Key": settings.voice_api_key})
    except httpx.HTTPError as exc:
        raise EngineError(f"AI calling service unreachable ({type(exc).__name__})") from exc
    if resp.status_code == 409:
        raise EngineError("This number opted out of AI calls")
    if resp.status_code >= 400:
        raise EngineError(f"AI calling service error {resp.status_code}: {resp.text[:200]}")
    return resp.json() if resp.content else None


async def engine_create_task(payload: dict) -> dict:
    return await _engine("POST", "/v1/tasks", payload)


async def engine_cancel_task(task_id: uuid.UUID) -> None:
    await _engine("POST", f"/v1/tasks/{task_id}/cancel")


# ── Starting calls ───────────────────────────────────────────────────────────

def _criteria(job: Job, config: dict, org_settings: dict) -> dict:
    criteria = dict(config.get("criteria") or {})
    if "min_experience_years" not in criteria and job.min_experience_years:
        criteria["min_experience_years"] = job.min_experience_years
    if "communication_threshold" not in criteria:
        key = "communication_threshold_client_facing" if config.get("client_facing") else "communication_threshold_other"
        criteria["communication_threshold"] = org_settings[key]
    return criteria


def task_payload(
    vc: VoiceCall, org: Organization, candidate: Candidate, task_type: str, *, context: dict, org_settings: dict,
    schedule_at: datetime | None = None, expires_at: datetime | None = None,
) -> dict:
    """The engine task for one call (Plan §4.1). client_ref ties results back to `vc`."""
    return {
        "client_ref": f"hiring:{vc.id}",
        "type": task_type,
        "scope_id": str(org.id),
        "callee": {
            "name": candidate.full_name,
            "phone_e164": vc.phone_e164,
            "timezone": org.timezone or "Asia/Kolkata",
            "language_pref": vc.language,
        },
        "context": context,
        "consent": {
            "type": candidate.ai_call_consent_source or "UNKNOWN",
            "captured_at": candidate.ai_call_consent_at.isoformat(),
        },
        "schedule_at": schedule_at.isoformat() if schedule_at else None,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "config": {k: org_settings[k] for k in ("window_start", "window_end", "max_attempts", "retry_gap_minutes")}
        if task_type != "REMINDER" else {k: org_settings[k] for k in ("window_start", "window_end")},
    }


def build_prescreen_task(
    vc: VoiceCall, org: Organization, candidate: Candidate, job: Job, org_settings: dict
) -> dict:
    config = job.voice_call_config or {}
    context = {
        "company_name": org.name,
        "job": {
            "title": job.title,
            "skills": job.skills_required or [],
            "location": job.location,
            "client_facing": bool(config.get("client_facing")),
        },
        "criteria": _criteria(job, config, org_settings),
        "resume_summary": (candidate.summary or "")[:1500] or None,
        "currency": config.get("currency", "INR"),
    }
    if config.get("questions"):
        context["questions"] = config["questions"]
    return task_payload(vc, org, candidate, PRESCREEN, context=context, org_settings=org_settings)


async def send_to_engine(vc: VoiceCall, payload: dict) -> None:
    """Create the engine task; on failure the call is FAILED_TO_START (needs action)."""
    try:
        task = await engine_create_task(payload)
        vc.engine_task_id = uuid.UUID(task["id"])
        vc.task_status = task["status"]
        vc.next_attempt_at = _parse_dt(task.get("next_attempt_at"))
    except EngineError as exc:
        vc.task_status = FAILED_TO_START
        vc.final = True
        vc.error = str(exc)


async def _check_callable(db: AsyncSession, org: Organization, candidate: Candidate, job_id: uuid.UUID) -> str:
    """The callee's E.164 number, or VoiceCallError explaining why not."""
    if candidate.ai_call_opted_out_at:
        raise VoiceCallError("Candidate opted out of AI calls")
    if not candidate.ai_call_consent_at:
        raise VoiceCallError("No AI call consent recorded for this candidate")
    phone = to_e164(candidate.phone, org.timezone)
    if not phone:
        raise VoiceCallError("Phone number is missing or has no country code")
    active = await db.scalar(
        select(VoiceCall.id).where(
            VoiceCall.candidate_id == candidate.id,
            VoiceCall.job_id == job_id,
            VoiceCall.type == PRESCREEN,
            VoiceCall.task_status.in_(ACTIVE_STATUSES),
        )
    )
    if active:
        raise VoiceCallError("An AI pre-screen is already in progress for this job")
    return phone


@dataclass
class StartResult:
    candidate_id: uuid.UUID
    voice_call_id: uuid.UUID | None = None
    error: str | None = None


async def start_prescreen(
    db: AsyncSession, user, org: Organization, job: Job, candidate_ids: list[uuid.UUID]
) -> list[StartResult]:
    await AICreditsService.check_credits_available(db, org.id, FEATURE, user.id)
    org_settings = await get_org_settings(db, org.id)
    candidates = {
        c.id: c
        for c in (
            await db.scalars(
                select(Candidate).where(
                    Candidate.id.in_(candidate_ids),
                    Candidate.organization_id == org.id,
                    Candidate.is_deleted.is_(False),
                )
            )
        ).all()
    }
    results: list[StartResult] = []
    for cid in candidate_ids:
        candidate = candidates.get(cid)
        if candidate is None:
            results.append(StartResult(cid, error="Candidate not found"))
            continue
        try:
            phone = await _check_callable(db, org, candidate, job.id)
        except VoiceCallError as exc:
            results.append(StartResult(cid, error=str(exc)))
            continue

        vc = VoiceCall(
            organization_id=org.id,
            candidate_id=cid,
            job_id=job.id,
            created_by_id=user.id,
            type=PRESCREEN,
            phone_e164=phone,
            language=org_settings["default_language"],
        )
        db.add(vc)
        await db.flush()
        await send_to_engine(vc, build_prescreen_task(vc, org, candidate, job, org_settings))
        results.append(StartResult(cid, voice_call_id=vc.id, error=vc.error))
        await log_activity(
            db, org.id, user.id, "ai_call.started", "candidate", str(cid),
            {"voice_call_id": str(vc.id), "job_id": str(job.id), "type": PRESCREEN, "error": vc.error},
            broadcast=False,
        )
        await db.commit()
    return results


async def cancel_call(db: AsyncSession, vc: VoiceCall, user) -> None:
    if vc.engine_task_id and vc.task_status in ACTIVE_STATUSES:
        await engine_cancel_task(vc.engine_task_id)
    if vc.task_status == "SCHEDULED":
        vc.task_status = "CANCELLED"
        vc.final = True
        vc.next_attempt_at = None
    await log_activity(db, vc.organization_id, user.id, "ai_call.cancelled", "candidate", str(vc.candidate_id),
                       {"voice_call_id": str(vc.id)}, broadcast=False)


# ── Callbacks from the engine ────────────────────────────────────────────────

def verify_signature(timestamp: str | None, signature: str | None, body: bytes, now: float | None = None) -> bool:
    if not (timestamp and signature and settings.voice_callback_secret):
        return False
    try:
        age = abs((now or time.time()) - int(timestamp))
    except ValueError:
        return False
    if age > CALLBACK_MAX_AGE_SECONDS:
        return False
    mac = hmac.new(settings.voice_callback_secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256)
    return hmac.compare_digest("sha256=" + mac.hexdigest(), signature)


def _parse_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


async def find_call(db: AsyncSession, payload: dict) -> VoiceCall | None:
    ref = payload.get("client_ref") or ""
    if ref.startswith("hiring:"):
        try:
            vc = await db.get(VoiceCall, uuid.UUID(ref.split(":", 1)[1]), with_for_update=True)
            if vc:
                return vc
        except ValueError:
            pass
    if payload.get("task_id"):
        return await db.scalar(
            select(VoiceCall).where(VoiceCall.engine_task_id == uuid.UUID(payload["task_id"])).with_for_update()
        )
    return None


def _is_stale(vc: VoiceCall, payload: dict) -> bool:
    """Deliveries can arrive out of order; never let an older attempt win."""
    attempt = int(payload.get("attempt_no") or 0)
    if attempt < vc.attempt_no:
        return True
    return attempt == vc.attempt_no and vc.final and not payload.get("final")


async def apply_callback(db: AsyncSession, payload: dict) -> VoiceCall | None:
    vc = await find_call(db, payload)
    if vc is None:
        logger.warning("voice callback for unknown call %s", payload.get("client_ref"))
        return None
    if _is_stale(vc, payload):
        return vc

    if payload.get("task_id") and not vc.engine_task_id:
        vc.engine_task_id = uuid.UUID(payload["task_id"])
    vc.task_status = payload.get("task_status") or vc.task_status
    vc.outcome = payload.get("status")
    vc.attempt_no = int(payload.get("attempt_no") or vc.attempt_no)
    vc.final = bool(payload.get("final"))
    vc.next_attempt_at = _parse_dt(payload.get("next_attempt_at"))

    call = payload.get("call") or {}
    await charge_call(db, vc, int(payload.get("attempt_no") or 0), call.get("duration_sec"))
    if call.get("transcript"):  # an attempt that reached a person
        vc.started_at = _parse_dt(call.get("started_at"))
        vc.duration_sec = call.get("duration_sec")
        vc.language_detected = call.get("language")
        vc.audio_quality = call.get("audio_quality")
        vc.transcript = call["transcript"]
        vc.recording_url = call.get("recording_url")
    vc.callback_at = _parse_dt(call.get("callback_at"))

    result = payload.get("result")
    if result:
        vc.result = result
        vc.summary_text = result.get("summary_text") or None
        vc.decision = (result.get("recommendation") or {}).get("decision")

    candidate = await db.get(Candidate, vc.candidate_id)
    if vc.outcome == "OPTED_OUT" and candidate and not candidate.ai_call_opted_out_at:
        candidate.ai_call_opted_out_at = datetime.now(timezone.utc)

    if result and vc.type != PRESCREEN:
        use_case = (result.get("structured_data") or {}).get("result") or {}
        vc.use_case_outcome = use_case.get("outcome")
        if vc.final:
            from app.services import voice_scheduling
            if vc.type == "AVAILABILITY":
                await voice_scheduling.book_confirmed_slot(db, vc, use_case)
            elif vc.type == "REMINDER":
                await voice_scheduling.apply_reminder_result(db, vc, use_case)
    elif vc.final and vc.type == "AVAILABILITY":
        from app.services import voice_scheduling
        await voice_scheduling.book_confirmed_slot(db, vc, {})   # releases the call's holds

    changes = {}
    if vc.type == PRESCREEN and vc.final and result and candidate and vc.profile_updated_at is None:
        org_settings = await get_org_settings(db, vc.organization_id)
        if org_settings["auto_update_profile"]:
            changes = update_profile_from_answers(candidate, (result.get("structured_data") or {}).get("answers") or {})
            if changes:
                vc.profile_updated_at = datetime.now(timezone.utc)

    await log_activity(
        db, vc.organization_id, None, "ai_call.final" if vc.final else "ai_call.attempt", "candidate",
        str(vc.candidate_id),
        {"voice_call_id": str(vc.id), "type": vc.type, "outcome": vc.outcome, "attempt_no": vc.attempt_no,
         "decision": vc.decision, "use_case_outcome": vc.use_case_outcome, "profile_changes": changes or None,
         "source": "AI pre-screen" if changes else None},
        broadcast=False,
    )
    return vc


async def charge_call(db: AsyncSession, vc: VoiceCall, attempt_no: int, duration_sec: int | None) -> None:
    """Bill a connected attempt to AI credits, per started minute, once."""
    if not duration_sec or attempt_no <= vc.billed_attempt_no:
        return
    minutes = math.ceil(duration_sec / 60)
    await AICreditsService.charge(
        db,
        organization_id=vc.organization_id,
        user_id=vc.created_by_id,
        feature=FEATURE,
        provider="hybent-voice",
        model=f"voice-call-{vc.type.lower()}",
        cost_usd=minutes * settings.voice_cost_per_minute_usd,
        duration_ms=duration_sec * 1000,
    )
    vc.billed_attempt_no = attempt_no


async def sync_reminders_safely(db: AsyncSession, interview) -> None:
    """Re-plan an interview's reminder calls after it's created, moved or cancelled."""
    from app.services import voice_scheduling
    await voice_scheduling.sync_reminders_safely(db, interview)


def _money(value: dict) -> str:
    if value.get("currency") == "INR":
        return f"{value['value'] / 100_000:g} LPA"
    return f"{value.get('currency', '')} {value['value']:,}".strip()


def update_profile_from_answers(candidate: Candidate, answers: dict) -> dict:
    """Write clear answers onto the profile (Spec §5.10). Returns {field: [old, new]}.
    UNCLEAR / DECLINED_TO_SHARE / unparsed answers are left for HR."""
    updates: dict[str, object] = {}
    exp = answers.get("total_experience_years")
    if isinstance(exp, (int, float)):
        updates["years_experience"] = float(exp)
        updates["experience_years"] = f"{exp:g}"
    rel = answers.get("relevant_experience_years")
    if isinstance(rel, (int, float)):
        updates["relevant_experience"] = f"{rel:g} yrs"
    for answer_key, field in (("current_company", "current_company"), ("current_role", "current_title")):
        value = answers.get(answer_key)
        # A long answer — or a role followed by ", I build…" — is a description,
        # not a name or title; leave it for HR to read in the call result.
        if not isinstance(value, str) or value in ("UNCLEAR", "DECLINED_TO_SHARE") or len(value) > TITLE_MAX:
            continue
        if field == "current_title" and "," in value:
            continue
        updates[field] = value
    for answer_key, fields in (("current_ctc", ("current_ctc", "current_salary")),
                               ("expected_ctc", ("expected_ctc", "expected_salary"))):
        value = answers.get(answer_key)
        if isinstance(value, dict) and value.get("value"):
            for field in fields:
                updates[field] = _money(value)
    notice = answers.get("notice_period_days")
    if isinstance(notice, int):
        updates["notice_period_days"] = str(notice)

    changes = {}
    for field, new in updates.items():
        old = getattr(candidate, field)
        if old != new:
            changes[field] = [old, new]
            setattr(candidate, field, new)
    return changes


USE_CASE_MESSAGES = {
    "SLOT_CONFIRMED": "confirmed an interview slot — it's booked",
    "SLOT_PROPOSED_NEEDS_APPROVAL": "asked for an interview time that needs your approval",
    "CANDIDATE_NOT_INTERESTED": "is no longer interested (availability call)",
    "CONFIRMED": "confirmed they'll attend the interview",
    "RESCHEDULE_REQUESTED": "asked to reschedule the interview",
    "CANCELLED_BY_CANDIDATE": "can't attend the interview",
    "UNSURE": "isn't sure they can attend the interview",
}


def notification_for(vc: VoiceCall, candidate_name: str) -> tuple[str, str] | None:
    """(title, message) for a final outcome, or None when nothing is worth a ping."""
    if not vc.final or vc.outcome is None:
        return None
    if vc.type != PRESCREEN and vc.use_case_outcome in USE_CASE_MESSAGES:
        # A confirmed reminder is good news nobody needs pinged about.
        if vc.use_case_outcome == "CONFIRMED":
            return None
        return "AI Call", f"{candidate_name} {USE_CASE_MESSAGES[vc.use_case_outcome]}."
    action = OUTCOME_MESSAGES.get(vc.outcome)
    if not action:
        return None
    decision = {"RECOMMEND_NEXT_ROUND": " — recommended for the next round",
                "HOLD": " — on hold", "NOT_RECOMMENDED": " — not recommended"}.get(vc.decision or "", "")
    return "AI Call", f"{candidate_name} {action}{decision}."
