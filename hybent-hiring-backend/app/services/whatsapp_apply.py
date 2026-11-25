"""Apply for a job on WhatsApp.

A job's public apply page links to Hybent's WhatsApp with "Apply HB-xxxxxxxx"
(the first 8 characters of the job id). The bot then asks, one at a time, for
the same details as the apply form (name, email, current CTC, expected CTC,
notice period) and the resume file, and creates the candidate and application
exactly as the public apply form does. This is a fixed flow, not the model:
every applicant must give every field.

The WhatsApp number is proven by WhatsApp itself and the person chose to apply
here, so the candidate's number is stored as verified with updates switched on.
"""

import io
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, UploadFile
from sqlalchemy import cast, select
from sqlalchemy.types import String
from starlette.datastructures import Headers

from app.core.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.whatsapp import WaContactKind, WhatsAppContact
from app.services import resume_intake, whatsapp_service
from app.utils.permissions import ApplicationStage

logger = logging.getLogger(__name__)

JOB_CODE_RE = re.compile(r"\bHB-([0-9a-fA-F]{8})\b")
TTL = 24 * 3600
CANCEL_WORDS = {"cancel", "stop apply", "exit", "band karo", "cancel karo"}

STEPS = [
    ("name", "What's your *full name*?"),
    ("email", "Your *email address*? (We'll send interview updates there too.)"),
    ("current_ctc", "Your *current CTC*? (e.g. 4.5 LPA, or \"fresher\")"),
    ("expected_ctc", "Your *expected CTC*?"),
    ("notice", "Your *notice period*? (e.g. Immediate, 30 days)"),
    ("resume", "Last step: please send your *resume* as a PDF or Word file 📄"),
]
EXT_BY_MIME = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def job_code(job_id) -> str:
    return f"HB-{str(job_id)[:8]}"


def _key(contact: WhatsAppContact) -> str:
    return f"wa_apply:{contact.id}"


def _next_prompt(state: dict) -> str:
    for field, prompt in STEPS:
        if field not in state["data"]:
            return prompt
    return STEPS[-1][1]


async def _find_job(db, code: str):
    row = (await db.execute(
        select(Job, Organization.name)
        .join(Organization, Organization.id == Job.organization_id)
        .where(cast(Job.id, String).like(f"{code.lower()}%"), Job.status == "active", Job.is_deleted.is_(False))
        .limit(2)
    )).all()
    return row[0] if len(row) == 1 else None


async def start(db, r, contact: WhatsAppContact, text: str) -> str | None:
    """'Apply HB-xxxxxxxx' starts an application. None if no job code."""
    m = JOB_CODE_RE.search(text or "")
    if not m:
        return None
    found = await _find_job(db, m.group(1))
    if not found:
        return "Sorry, that job isn't open any more. Please check the company's careers page for current openings."
    job, org = found
    state = {"job_id": str(job.id), "title": job.title, "company": org, "data": {}}
    await r.set(_key(contact), json.dumps(state), ex=TTL)
    return (f"Great, let's apply for *{job.title}* at *{org}* 🙌\n"
            f"It takes 2 minutes. Send *cancel* anytime to stop.\n\n{_next_prompt(state)}")


async def pending(r, contact: WhatsAppContact) -> dict | None:
    raw = await r.get(_key(contact))
    return json.loads(raw) if raw else None


def _clean(value: str, limit: int) -> str:
    return " ".join((value or "").split())[:limit]


async def step(db, r, contact: WhatsAppContact, state: dict, text: str | None, message: dict) -> str:
    """Take the answer to the current question; ask the next, or finish."""
    if text and text.strip().lower() in CANCEL_WORDS:
        await r.delete(_key(contact))
        return "Okay, I've cancelled this application. You can start again from the job's apply page anytime."

    data = state["data"]
    field = next(f for f, _ in STEPS if f not in data)

    if field == "resume":
        doc = message.get("document") if message.get("type") == "document" else None
        if not doc:
            return "Please send your resume as a *PDF or Word file* (tap 📎 → Document)."
        reply = await _finish(db, r, contact, state, doc)
        return reply

    if not text or not text.strip():
        return _next_prompt(state)
    value = text.strip()
    if field == "name":
        value = _clean(value, 255)
        if len(value) < 2:
            return "Please send your full name."
    elif field == "email":
        try:
            value = validate_email(value, check_deliverability=False).normalized.lower()
        except EmailNotValidError:
            return "That email doesn't look right. Please send it again (e.g. name@gmail.com)."
    elif field in ("current_ctc", "expected_ctc"):
        value = _clean(value, 100)
    elif field == "notice":
        value = _clean(value, 50)
    data[field] = value
    await r.set(_key(contact), json.dumps(state), ex=TTL)
    return _next_prompt(state)


async def _finish(db, r, contact: WhatsAppContact, state: dict, doc: dict) -> str:
    mime = (doc.get("mime_type") or "").split(";")[0]
    filename = doc.get("filename") or f"resume{EXT_BY_MIME.get(mime, '.pdf')}"
    try:
        content, mime2 = whatsapp_service.download_media(doc["id"], settings.max_file_size_bytes)
    except ValueError:
        return f"That file is too large (max {settings.max_file_size_mb} MB). Please send a smaller PDF."
    except Exception as e:
        logger.warning(f"[whatsapp-apply] media download failed: {e}")
        return "I couldn't download that file. Please send it again."
    upload = UploadFile(file=io.BytesIO(content), filename=filename,
                        headers=Headers({"content-type": mime or mime2}))
    try:
        content = await resume_intake.read_resume_upload(upload)
    except HTTPException as e:
        return str(e.detail)

    job = await db.get(Job, uuid.UUID(state["job_id"]))
    if not job or job.status != "active" or job.is_deleted:
        await r.delete(_key(contact))
        return "Sorry, this job just closed. Please check the company's careers page for other openings."
    d = state["data"]
    candidate = (await db.execute(select(Candidate).where(
        Candidate.email == d["email"], Candidate.organization_id == job.organization_id))).scalar_one_or_none()
    if candidate is None:
        candidate = Candidate(organization_id=job.organization_id, created_by_id=None, email=d["email"],
                              full_name=d["name"], source="whatsapp")
        db.add(candidate)
        await db.flush()
    else:
        already = (await db.execute(select(Application.id).where(
            Application.candidate_id == candidate.id, Application.job_id == job.id))).scalar()
        if already:
            await r.delete(_key(contact))
            return f"You've already applied for *{job.title}*. The company will update you here."

    now = datetime.now(timezone.utc)
    candidate.phone = contact.phone or f"+{contact.wa_id}"
    candidate.phone_verified_at = now
    candidate.sms_opt_in = True
    candidate.current_ctc = candidate.current_salary = d["current_ctc"]
    candidate.expected_ctc = candidate.expected_salary = d["expected_ctc"]
    candidate.notice_period_days = d["notice"]
    await resume_intake.store_resume(candidate, upload, content)
    candidate.applied_job_title = job.title
    await resume_intake.parse_into_profile(db, candidate, content, upload)

    application = Application(organization_id=job.organization_id, job_id=job.id, candidate_id=candidate.id,
                              stage=ApplicationStage.APPLIED, source="whatsapp")
    db.add(application)
    await resume_intake.score_application(candidate, application, job)
    contact.candidate_email = d["email"]
    contact.kind = WaContactKind.CANDIDATE
    await db.commit()
    await r.delete(_key(contact))

    try:
        from app.tasks.notifications import notify_organization_roles
        from app.tasks.screening import enqueue_screening
        from app.utils.permissions import NotificationType, UserRole
        enqueue_screening([candidate.id], job.organization_id)
        notify_organization_roles.delay(
            str(job.organization_id), [UserRole.ADMIN, UserRole.RECRUITER], NotificationType.APPLICATION_RECEIVED,
            "New Job Application", f"{candidate.full_name} has applied to '{job.title}' via WhatsApp.",
            {"candidate_id": str(candidate.id), "job_id": str(job.id)})
    except Exception as e:
        logger.warning(f"[whatsapp-apply] follow-up failed: {e}")

    first = d["name"].split(" ")[0]
    return (f"Done, {first}! ✅ Your application for *{job.title}* at *{state['company']}* is in.\n"
            "The company will update you here on WhatsApp. You can ask me anytime: *\"mera application status?\"*")
