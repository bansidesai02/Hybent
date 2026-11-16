"""SMS to candidates and interviewers: through your own Android phone (free,
the "SMS Gateway for Android" app) or MSG91 (India, DLT).

Every message is a DLT-approved template: in India a business SMS can only be
sent with a registered sender id (HYBENT) and a registered template, so the
text here mirrors what was registered, and each company stores the MSG91
template id it got for each one.

With no provider credentials configured the service runs in test mode: each message is
written to the SMS log (status "test") and nothing is sent.
"""

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.sms import SmsLog, SmsSettings, SmsStatus

logger = logging.getLogger(__name__)

MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/"


@dataclass(frozen=True)
class SmsEvent:
    key: str
    audience: str           # candidate | interviewer
    label: str              # shown in Settings
    text: str               # the registered template; {#var#} filled in order
    variables: tuple[str, ...]
    default_on: bool = True


EVENTS: dict[str, SmsEvent] = {e.key: e for e in [
    SmsEvent("application_received", "candidate", "Application received",
             "Hi {#var#}, we received your application for {#var#} at {#var#}. We will update you soon. - HYBENT",
             ("name", "job", "company")),
    SmsEvent("shortlisted", "candidate", "Shortlisted",
             "Hi {#var#}, you are shortlisted for {#var#}. Pick your interview time here: {#var#} - HYBENT",
             ("name", "job", "link")),
    SmsEvent("interview_scheduled", "candidate", "Interview booked",
             "Hi {#var#}, your interview for {#var#} is on {#var#}. Join: {#var#} - HYBENT",
             ("name", "job", "when", "link")),
    SmsEvent("interview_reminder", "candidate", "Interview reminder (1 day and 1 hour before)",
             "Reminder: your interview for {#var#} starts at {#var#}. Join: {#var#} - HYBENT",
             ("job", "when", "link")),
    SmsEvent("rejected", "candidate", "Not selected",
             "Hi {#var#}, thank you for applying to {#var#}. We have decided to move ahead with other candidates. All the best. - HYBENT",
             ("name", "company"), default_on=False),
    SmsEvent("offer_sent", "candidate", "Offer sent",
             "Hi {#var#}, congratulations! Your offer for {#var#} has been sent to your email. - HYBENT",
             ("name", "job")),
    SmsEvent("interviewer_new_interview", "interviewer", "New interview booked",
             "New interview: {#var#} for {#var#} on {#var#}. Join: {#var#} - HYBENT",
             ("candidate", "job", "when", "link")),
    SmsEvent("interviewer_reminder", "interviewer", "Interview reminder (1 hour before)",
             "Reminder: interview with {#var#} at {#var#}. Join: {#var#} - HYBENT",
             ("candidate", "when", "link")),
    SmsEvent("interviewer_feedback", "interviewer", "Feedback reminder",
             "Please give feedback for {#var#} ({#var#}): {#var#} - HYBENT",
             ("candidate", "job", "link")),
]}


def render(event: SmsEvent, values: dict[str, str]) -> str:
    out = event.text
    for name in event.variables:
        # DLT limits each variable to 30 characters.
        out = out.replace("{#var#}", (values.get(name) or "")[:30], 1)
    return out


def msisdn(phone: str | None) -> str | None:
    """Indian mobile in MSG91's format (91XXXXXXXXXX), or None."""
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10 and digits[0] in "6789":
        return "91" + digits
    if len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
        return digits
    if len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
        return "91" + digits[1:]
    return None


def event_settings(row: SmsSettings | None, key: str) -> dict:
    cfg = dict((row.events or {}).get(key) or {}) if row else {}
    cfg.setdefault("on", EVENTS[key].default_on)
    cfg.setdefault("template_id", "")
    return cfg


async def get_settings(db: AsyncSession, organization_id: uuid.UUID) -> SmsSettings | None:
    return await db.get(SmsSettings, organization_id)


def provider_live() -> bool:
    """Credentials for the chosen provider are configured (else test mode)."""
    if settings.sms_provider == "msg91":
        return bool(settings.msg91_auth_key)
    return bool(settings.android_sms_username and settings.android_sms_password)


def needs_template_ids() -> bool:
    """MSG91 sends DLT templates by id; the Android phone sends plain text."""
    return settings.sms_provider == "msg91"


def _send_msg91(template_id: str, to: str, event: SmsEvent, values: dict[str, str]) -> str:
    """Send one SMS; returns MSG91's request id. Raises on failure."""
    recipient = {"mobiles": to}
    for i, name in enumerate(event.variables, start=1):
        recipient[f"var{i}"] = (values.get(name) or "")[:30]
    r = httpx.post(
        MSG91_FLOW_URL,
        headers={"authkey": settings.msg91_auth_key, "accept": "application/json", "content-type": "application/json"},
        json={"template_id": template_id, "short_url": "0", "recipients": [recipient]},
        timeout=15,
    )
    data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if r.status_code >= 400 or data.get("type") == "error":
        raise RuntimeError(data.get("message") or f"HTTP {r.status_code}")
    return str(data.get("message") or "")[:100]


def _send_android(to: str, body: str) -> str:
    """Hand one SMS to the Android phone (SMS Gateway for Android app),
    which sends it from its own SIM. Returns the app's message id."""
    r = httpx.post(
        settings.android_sms_url,
        auth=(settings.android_sms_username, settings.android_sms_password),
        json={"message": body, "phoneNumbers": [f"+{to}"]},
        timeout=20,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"Phone gateway HTTP {r.status_code}: {r.text[:200]}")
    try:
        return str(r.json().get("id") or "")[:100]
    except Exception:
        return ""


async def _sent_today(db: AsyncSession, organization_id: uuid.UUID) -> int:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return await db.scalar(
        select(func.count(SmsLog.id)).where(
            SmsLog.organization_id == organization_id,
            SmsLog.status == SmsStatus.SENT,
            SmsLog.created_at >= start,
        )
    ) or 0


async def send(
    db: AsyncSession, organization_id: uuid.UUID, key: str, phone: str | None, values: dict[str, str], *,
    recipient_name: str | None = None, candidate_id: uuid.UUID | None = None,
    interview_id: uuid.UUID | None = None, force: bool = False,
) -> SmsLog | None:
    """Send one SMS event if the company has SMS and this event switched on.
    Returns the log row, or None when SMS / the event is off. `force` skips
    the on/off check (the Settings "send test" button)."""
    event = EVENTS[key]
    row = await get_settings(db, organization_id)
    cfg = event_settings(row, key)
    if not force and not (row and row.enabled and cfg["on"]):
        return None

    log = SmsLog(
        organization_id=organization_id, event=key, audience=event.audience, recipient_name=recipient_name,
        phone=phone, body=render(event, values), status=SmsStatus.SKIPPED,
        candidate_id=candidate_id, interview_id=interview_id,
    )
    to = msisdn(phone)
    if not to:
        log.error = "No Indian mobile number" if phone else "No phone number"
    elif not provider_live():
        log.status = SmsStatus.TEST
        logger.info(f"[sms:test] {key} → {to}: {log.body}")
    elif needs_template_ids() and not cfg["template_id"]:
        log.error = "No MSG91 template id set for this message"
    elif await _sent_today(db, organization_id) >= settings.sms_daily_limit:
        log.error = f"Daily SMS limit reached ({settings.sms_daily_limit})"
    else:
        try:
            if needs_template_ids():
                log.provider_ref = _send_msg91(cfg["template_id"], to, event, values)
            else:
                log.provider_ref = _send_android(to, log.body)
            log.status = SmsStatus.SENT
        except Exception as e:
            log.status = SmsStatus.FAILED
            log.error = str(e)[:500]
            logger.warning(f"[sms] {key} → {to} failed: {e}")
    db.add(log)
    await db.commit()
    return log
