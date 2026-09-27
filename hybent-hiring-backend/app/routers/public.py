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
from app.services import supabase_storage_service
from app.utils.permissions import ApplicationStage, NotificationType, UserRole
from app.tasks.notifications import notify_organization_roles

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

CONTACT_EMAIL = "info@hybent.com"


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
    phone: str | None = Form(None),
    linkedin_url: str | None = Form(None),
    resume: UploadFile = File(...),
):
    """
    Public, unauthenticated job application — the destination of shareable
    "apply" links (e.g. attached to LinkedIn posts). Creates a standalone
    Candidate (no portal login) and an Application tied to this job; a
    recruiter can later invite the candidate to the portal separately.
    """
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
            source="linkedin",
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
    candidate.applied_job_title = job.title

    application = Application(
        organization_id=job.organization_id,
        job_id=job.id,
        candidate_id=candidate.id,
        stage=ApplicationStage.APPLIED,
        source="linkedin",
    )
    db.add(application)
    await db.commit()

    notify_organization_roles.delay(
        str(job.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.APPLICATION_RECEIVED,
        "New Job Application",
        f"{candidate.full_name} has applied to '{job.title}' via a shared application link.",
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
