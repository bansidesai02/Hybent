import asyncio
import html
import logging
import uuid

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.schemas.demo import ContactRequest, DemoRequest
from app.services.email_service import send_demo_request_email, send_email
from app.schemas.response import APIResponse

from app.dependencies import DB
from app.models.organization import Organization
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.application import Application
from app.schemas.job import JobPublicOut
from app.core.config import settings
from app.services import supabase_storage_service
from app.services.storage_service import save_resume
from app.utils.permissions import ApplicationStage, NotificationType, UserRole
from app.tasks.notifications import notify_organization_roles

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

CONTACT_EMAIL = "info@hybent.com"

# Where a shared apply link was opened from. Links were built for LinkedIn
# posts, so anything missing or unknown is recorded as LinkedIn.
PUBLIC_APPLY_SOURCES = {"linkedin", "careers_page"}


async def _get_active_job_or_404(db: DB, org_slug: str, job_id: uuid.UUID) -> Job:
    org = (await db.execute(
        select(Organization).where(Organization.slug == org_slug)
    )).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = (await db.execute(
        select(Job)
        .where(
            Job.id == job_id,
            Job.organization_id == org.id,
            Job.status == "active",
            Job.is_deleted == False,  # noqa: E712
        )
        .options(selectinload(Job.organization))
    )).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="This job is no longer accepting applications.")
    return job


@router.get("/jobs/{org_slug}/{job_id}")
async def get_public_job(org_slug: str, job_id: uuid.UUID, db: DB):
    """Public, unauthenticated job view — used by the shareable apply link."""
    job = await _get_active_job_or_404(db, org_slug, job_id)
    return APIResponse.success(message="Job retrieved.", data=JobPublicOut.model_validate(job))


@router.post("/jobs/{org_slug}/{job_id}/apply", status_code=201)
async def apply_to_public_job(
    org_slug: str,
    job_id: uuid.UUID,
    db: DB,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    linkedin_url: str | None = Form(None),
    current_ctc: str = Form(...),
    expected_ctc: str = Form(...),
    notice_period: str = Form(...),
    resume: UploadFile = File(...),
    source: str | None = Form(None),
):
    """
    Public, unauthenticated job application — the destination of shareable
    "apply" links (e.g. attached to LinkedIn posts). Creates a standalone
    Candidate (no portal login) and an Application tied to this job; a
    recruiter can later invite the candidate to the portal separately.
    """
    # Sized to their columns (phone 50, LinkedIn 500, CTC 100, notice period
    # 50). Everything is required except the LinkedIn profile.
    phone, linkedin_url = phone.strip(), (linkedin_url or "").strip() or None
    current_ctc, expected_ctc, notice_period = (
        current_ctc.strip(), expected_ctc.strip(), notice_period.strip()
    )
    if not phone:
        raise HTTPException(status_code=400, detail="Please fill in your phone number.")
    if not 7 <= sum(ch.isdigit() for ch in phone) <= 15 or len(phone) > 50:
        raise HTTPException(status_code=400, detail="Please enter a valid phone number.")
    if linkedin_url and ("linkedin.com/" not in linkedin_url.lower() or len(linkedin_url) > 500):
        raise HTTPException(status_code=400, detail="Please enter a valid LinkedIn profile link.")
    if not (current_ctc and expected_ctc and notice_period):
        raise HTTPException(
            status_code=400,
            detail="Please fill in your current CTC, expected CTC and notice period.",
        )
    if len(current_ctc) > 100 or len(expected_ctc) > 100 or len(notice_period) > 50:
        raise HTTPException(status_code=400, detail="CTC or notice period is too long.")
    if source not in PUBLIC_APPLY_SOURCES:
        source = "linkedin"

    job = await _get_active_job_or_404(db, org_slug, job_id)
    email = email.strip().lower()

    candidate = (await db.execute(
        select(Candidate).where(
            Candidate.email == email,
            Candidate.organization_id == job.organization_id,
        )
    )).scalar_one_or_none()

    if not candidate:
        candidate = Candidate(
            organization_id=job.organization_id,
            created_by_id=None,
            email=email,
            full_name=full_name,
            phone=phone,
            linkedin_url=linkedin_url,
            source=source,
        )
        db.add(candidate)
        await db.flush()
    else:
        existing_application = (await db.execute(
            select(Application).where(
                Application.candidate_id == candidate.id,
                Application.job_id == job.id,
            )
        )).scalar_one_or_none()
        if existing_application:
            raise HTTPException(status_code=409, detail="You have already applied to this job.")

    # Kept current on a returning candidate too — what they enter now is the
    # latest they have told us. The *_salary columns mirror the CTC ones, as
    # the candidate update endpoint keeps them.
    candidate.phone = phone
    if linkedin_url:  # optional — a blank one must not wipe a profile we already have
        candidate.linkedin_url = linkedin_url
    candidate.current_ctc = candidate.current_salary = current_ctc
    candidate.expected_ctc = candidate.expected_salary = expected_ctc
    candidate.notice_period_days = notice_period

    # Production → Supabase Storage; local/Docker → Cloudinary (or local disk)
    if settings.use_supabase_resume_storage:
        file_content = await resume.read()
        storage_path = await supabase_storage_service.upload_resume(
            file_content=file_content,
            organization_id=str(job.organization_id),
            candidate_id=str(candidate.id),
            original_filename=resume.filename or "resume",
            content_type=resume.content_type or "application/octet-stream",
        )
        candidate.resume_storage_path = storage_path
        candidate.resume_url = None
        candidate.resume_filename = resume.filename
    else:
        url, original_name = await save_resume(resume, str(job.organization_id))
        candidate.resume_url = url
        candidate.resume_filename = original_name
    candidate.applied_job_title = job.title

    application = Application(
        organization_id=job.organization_id,
        job_id=job.id,
        candidate_id=candidate.id,
        stage=ApplicationStage.APPLIED,
        source=source,
    )
    db.add(application)
    await db.commit()

    notify_organization_roles.delay(
        str(job.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.APPLICATION_RECEIVED,
        "New Job Application",
        f"{candidate.full_name} has applied to '{job.title}' via "
        + ("the careers page." if source == "careers_page" else "a shared application link."),
        {"candidate_id": str(candidate.id), "job_id": str(job.id)},
    )

    return APIResponse.success(message="Application received. The hiring team will be in touch.")

@router.post("/demo-request")
async def demo_request(request: DemoRequest):
    """Handle public demo requests from the landing page."""
    try:
        sent = await asyncio.to_thread(
            send_demo_request_email,
            first_name=request.first_name,
            last_name=request.last_name,
            work_email=request.work_email,
            company_name=request.company_name,
            team_size=request.team_size,
            monthly_hires=request.monthly_hires,
            hiring_challenge=request.hiring_challenge,
        )
    except Exception:
        logger.exception("Demo request email failed.")
        sent = False
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="We couldn't submit your request. Please try again, or email info@hybent.com.",
        )
    return APIResponse.success(message="Demo request submitted successfully. We will get back to you soon!")


@router.post("/contact")
async def contact(request: ContactRequest):
    """The hybent.com/contact form: emails the message to the Hybent team."""
    if request.website:
        # Honeypot filled in: a bot. Look successful so it doesn't retry.
        logger.info("Contact form honeypot triggered; message dropped.")
        return APIResponse.success(message="Thanks. We have your message and will reply within one business day.")

    optional = [
        ("Phone", request.phone),
        ("Company", request.company),
        ("Country", request.country),
        ("Location", request.location),
        ("How they heard about us", request.referrer),
    ]
    details = "".join(
        f"<tr><td style=\"padding:4px 16px 4px 0;color:#70757a\">{label}</td><td>{html.escape(value)}</td></tr>"
        for label, value in optional if value
    )
    email = html.escape(request.email)
    body = (
        f"<p><b>{html.escape(request.name)}</b> &lt;<a href=\"mailto:{email}\">{email}</a>&gt; "
        "sent a message from hybent.com/contact.</p>"
        + (f"<table>{details}</table>" if details else "")
        + f"<p style=\"white-space:pre-wrap\">{html.escape(request.message)}</p>"
        f"<p><a href=\"mailto:{email}\">Reply to {html.escape(request.name)}</a></p>"
    )
    subject = f"Contact form: {request.name}" + (f" ({request.company})" if request.company else "")
    sent = await asyncio.to_thread(send_email, CONTACT_EMAIL, subject, body)
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="We couldn't send your message. Please email info@hybent.com directly.",
        )
    return APIResponse.success(message="Thanks. We have your message and will reply within one business day.")
