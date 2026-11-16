"""Automatic SMS to candidates and interviewers.

Each task looks the facts up itself and asks sms_service to send; whether a
message actually goes out depends on the company's SMS settings."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import desc, select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import AsyncSessionLocal, run_async
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview, InterviewPanelist
from app.models.job import Job
from app.models.offer import Offer
from app.models.organization import Organization
from app.models.user import User
from app.services import sms_service
from app.utils.permissions import InterviewStatus

logger = logging.getLogger(__name__)

SHORTLIST_STAGES = {"pre_screening_selected"}
REJECTION_STAGES = {
    "rejected", "pre_screening_rejected", "technical_round_rejected", "practical_round_rejected",
    "techno_functional_rejected", "management_round_rejected", "hr_round_rejected",
}


def _when(dt: datetime, tz_name: str | None) -> str:
    try:
        tz = ZoneInfo(tz_name or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    return dt.astimezone(tz).strftime("%d %b, %I:%M %p")


async def _job_title(db, candidate: Candidate, application_id=None) -> str:
    q = select(Job.title).join(Application, Application.job_id == Job.id)
    if application_id:
        q = q.where(Application.id == application_id)
    else:
        q = q.where(Application.candidate_id == candidate.id).order_by(desc(Application.created_at))
    title = (await db.execute(q.limit(1))).scalar_one_or_none()
    return title or candidate.current_title or "the role"


# ── Candidate events ──────────────────────────────────────────────────────

async def _candidate_event(candidate_id: str, key: str):
    async with AsyncSessionLocal() as db:
        c = await db.get(Candidate, uuid.UUID(candidate_id))
        if not c:
            return
        org = await db.get(Organization, c.organization_id)
        values = {
            "name": (c.full_name or "").split(" ")[0] or "there",
            "job": await _job_title(db, c),
            "company": org.name if org else "us",
            "link": settings.frontend_url,
        }
        await sms_service.send(db, c.organization_id, key, c.phone, values,
                               recipient_name=c.full_name, candidate_id=c.id)


@celery_app.task
def sms_application_received(candidate_id: str):
    run_async(_candidate_event(candidate_id, "application_received"))


@celery_app.task
def sms_stage_change(candidate_id: str, stage: str):
    if stage in SHORTLIST_STAGES:
        run_async(_candidate_event(candidate_id, "shortlisted"))
    elif stage in REJECTION_STAGES:
        run_async(_candidate_event(candidate_id, "rejected"))


async def _offer_sent(offer_id: str):
    async with AsyncSessionLocal() as db:
        offer = await db.get(Offer, uuid.UUID(offer_id))
        app = await db.get(Application, offer.application_id) if offer else None
        c = await db.get(Candidate, app.candidate_id) if app else None
        if not c:
            return
        await sms_service.send(
            db, c.organization_id, "offer_sent", c.phone,
            {"name": (c.full_name or "").split(" ")[0], "job": offer.position_title or await _job_title(db, c, app.id)},
            recipient_name=c.full_name, candidate_id=c.id,
        )


@celery_app.task
def sms_offer_sent(offer_id: str):
    run_async(_offer_sent(offer_id))


# ── Interview events ──────────────────────────────────────────────────────

async def _interview_context(db, interview: Interview):
    c = await db.get(Candidate, interview.candidate_id)
    org = await db.get(Organization, interview.organization_id)
    panel = (await db.execute(
        select(User).join(InterviewPanelist, InterviewPanelist.user_id == User.id)
        .where(InterviewPanelist.interview_id == interview.id)
    )).scalars().all()
    job = await _job_title(db, c, interview.application_id) if c else interview.title
    return c, org, list(panel), {
        "name": ((c.full_name if c else "") or "").split(" ")[0],
        "candidate": c.full_name if c else "the candidate",
        "job": job,
        "when": _when(interview.scheduled_at, org.timezone if org else None),
        "link": interview.meeting_link or interview.location or "check your email",
    }


async def _interview_sms(interview_id: str, candidate_key: str | None, interviewer_key: str | None):
    async with AsyncSessionLocal() as db:
        iv = await db.get(Interview, uuid.UUID(interview_id))
        if not iv or iv.status == InterviewStatus.CANCELLED:
            return
        c, org, panel, values = await _interview_context(db, iv)
        if candidate_key and c:
            await sms_service.send(db, iv.organization_id, candidate_key, c.phone, values,
                                   recipient_name=c.full_name, candidate_id=c.id, interview_id=iv.id)
        if interviewer_key:
            for u in panel:
                await sms_service.send(db, iv.organization_id, interviewer_key, u.phone, values,
                                       recipient_name=u.full_name, candidate_id=c.id if c else None,
                                       interview_id=iv.id)


@celery_app.task
def sms_interview_scheduled(interview_id: str):
    run_async(_interview_sms(interview_id, "interview_scheduled", "interviewer_new_interview"))


async def _feedback(interview_id: str, user_id: str):
    async with AsyncSessionLocal() as db:
        iv = await db.get(Interview, uuid.UUID(interview_id))
        user = await db.get(User, uuid.UUID(user_id))
        if not iv or not user:
            return
        c, org, _, values = await _interview_context(db, iv)
        values["link"] = f"{settings.frontend_url.rstrip('/')}/hiring"
        await sms_service.send(db, iv.organization_id, "interviewer_feedback", user.phone, values,
                               recipient_name=user.full_name, candidate_id=c.id if c else None, interview_id=iv.id)


@celery_app.task
def sms_feedback_reminder(interview_id: str, user_id: str):
    run_async(_feedback(interview_id, user_id))


async def _reminders():
    """1 day and 1 hour before each interview: candidate (both) and
    interviewers (1 hour). Each stamp is set once, so nothing repeats."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        upcoming = (await db.execute(
            select(Interview).where(
                Interview.status == InterviewStatus.SCHEDULED,
                Interview.scheduled_at > now,
                Interview.scheduled_at <= now + timedelta(hours=24),
            )
        )).scalars().all()
        ids_24h, ids_1h = [], []
        for iv in upcoming:
            left = iv.scheduled_at - now
            if left <= timedelta(hours=1) and iv.sms_reminder_1h_sent_at is None:
                iv.sms_reminder_1h_sent_at = now
                iv.sms_reminder_24h_sent_at = iv.sms_reminder_24h_sent_at or now
                ids_1h.append(str(iv.id))
            elif left > timedelta(hours=1) and iv.sms_reminder_24h_sent_at is None:
                iv.sms_reminder_24h_sent_at = now
                ids_24h.append(str(iv.id))
        await db.commit()
    for iid in ids_24h:
        await _interview_sms(iid, "interview_reminder", None)
    for iid in ids_1h:
        await _interview_sms(iid, "interview_reminder", "interviewer_reminder")
    if ids_24h or ids_1h:
        logger.info(f"[sms] reminders: {len(ids_24h)} day-before, {len(ids_1h)} hour-before")


@celery_app.task
def send_interview_sms_reminders():
    run_async(_reminders())
