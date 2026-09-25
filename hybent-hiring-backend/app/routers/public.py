import uuid

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.schemas.demo import DemoRequest
from app.services.email_service import send_demo_request_email
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
        send_demo_request_email(
            first_name=request.first_name,
            last_name=request.last_name,
            work_email=request.work_email,
            company_name=request.company_name,
            team_size=request.team_size,
            monthly_hires=request.monthly_hires,
            hiring_challenge=request.hiring_challenge
        )
        return APIResponse.success(message="Demo request submitted successfully. We will get back to you soon!")
    except Exception as e:
        return APIResponse.error(message=f"Failed to submit demo request: {str(e)}", status_code=500)
