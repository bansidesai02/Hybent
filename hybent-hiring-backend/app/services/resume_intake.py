"""
Resume intake for the candidate-facing application paths — the public apply
link and the candidate portal: check the file, store it, parse it into the
profile, and score the candidate against the job they applied to.

Both paths used to store the file and stop there, so a link or portal
applicant reached the recruiter with no parsed resume (no work experience on
their profile) and no match score. Recruiter uploads (routers/resumes.py) and
email ingestion keep their own flows.

Parsing and scoring never block an application: an applicant whose resume the
AI can't read, or who applies while the org is out of AI credits, is still
received — with the file attached for the recruiter, just unscored.
"""
import logging
from pathlib import Path

from fastapi import BackgroundTasks, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.services import supabase_storage_service
from app.services.ai import match_scorer, resume_parser
from app.services.ai.resume_rag import stage_candidate_resume_chunks
from app.services.ai_metering import ai_scope
from app.services.storage_service import ALLOWED_RESUME_TYPES, save_resume
from app.utils.permissions import JobStatus

logger = logging.getLogger(__name__)

RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}


async def read_resume_upload(file: UploadFile) -> bytes:
    """The upload's bytes, after the same type/size rules as a recruiter
    upload. Supabase storage has no type gate of its own, so without this a
    production applicant could attach any file at all."""
    content = await file.read()
    await file.seek(0)
    extension = Path(file.filename or "").suffix.lower()
    if not (ALLOWED_RESUME_TYPES.get(file.content_type or "") or extension in RESUME_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Please upload your resume as a PDF, DOC or DOCX file.")
    if not content:
        raise HTTPException(status_code=400, detail="The resume file is empty. Please choose another file.")
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(status_code=400, detail=f"Resume is too large (max {settings.max_file_size_mb}MB).")
    return content


async def store_resume(candidate: Candidate, file: UploadFile, content: bytes) -> None:
    """Production → Supabase Storage; local/Docker → Cloudinary (or local
    disk). The candidate must already have an id (flushed)."""
    if settings.use_supabase_resume_storage:
        candidate.resume_storage_path = await supabase_storage_service.upload_resume(
            file_content=content,
            organization_id=str(candidate.organization_id),
            candidate_id=str(candidate.id),
            original_filename=file.filename or "resume",
            content_type=file.content_type or "application/octet-stream",
        )
        candidate.resume_url = None  # Signed URLs are generated on-demand
        candidate.resume_filename = file.filename
    else:
        candidate.resume_url, candidate.resume_filename = await save_resume(file, str(candidate.organization_id))


def apply_parsed_resume(candidate: Candidate, parsed: dict) -> None:
    """Copy a parse_resume() result onto the profile. Resume-derived fields
    (skills, experience, title, summary) take the latest resume; contact
    details only fill gaps, since the applicant typed theirs in."""
    candidate.parsed_data = parsed
    if parsed.get("skills"):
        candidate.skills = parsed["skills"][:30]
    resume_parser.apply_experience_fields(candidate, parsed)

    # A resume whose header omits a current title/company still has them as
    # its latest experience entry — same fallback as recruiter upload.
    title, company = parsed.get("current_title"), parsed.get("current_company")
    experience = parsed.get("experience")
    if isinstance(experience, list) and experience and isinstance(experience[0], dict):
        title = title or experience[0].get("title")
        company = company or experience[0].get("company")
    if title:
        candidate.current_title = title
    if company:
        candidate.current_company = company
    if parsed.get("summary"):
        candidate.summary = parsed["summary"]

    for field in ("phone", "location", "linkedin_url", "github_url", "portfolio_url"):
        if parsed.get(field) and not getattr(candidate, field):
            setattr(candidate, field, parsed[field])


async def parse_into_profile(
    db: AsyncSession,
    candidate: Candidate,
    content: bytes,
    file: UploadFile,
    *,
    user_id=None,
    background_tasks: BackgroundTasks | None = None,
) -> bool:
    """Parse the resume onto the candidate. Returns whether it parsed."""
    try:
        # Charged to the org: a portal request runs in the candidate's own AI
        # scope, and candidates may not use AI themselves — without this every
        # portal parse was refused, as pre-screening's candidate calls were.
        async with ai_scope(candidate.organization_id):
            parsed = await resume_parser.parse_resume(
                content,
                file.content_type or "",
                file.filename or "",
                background_tasks=background_tasks,
                user_id=user_id,
                organization_id=candidate.organization_id,
            )
    except Exception as exc:  # not a resume, unreadable, out of credits, AI outage
        logger.warning(
            "Resume intake: could not parse %r for candidate %s (%s: %s); keeping the file unparsed",
            file.filename, candidate.id, type(exc).__name__, getattr(exc, "detail", exc),
        )
        return False

    apply_parsed_resume(candidate, parsed)
    try:
        async with db.begin_nested():
            await stage_candidate_resume_chunks(db, candidate)
    except Exception as exc:
        logger.warning("[RAG] Failed to stage resume chunks for candidate %s: %s", candidate.id, exc)
    return True


def job_has_requirements(job: Job) -> bool:
    """A job is scorable once it says what it needs: required skills or a
    requirements section. A catch-all like the careers page's "General
    Application" has neither, and a score against it would mean nothing."""
    return job.status != JobStatus.POOL and bool(job.skills_required or (job.requirements or "").strip())


async def score_application(
    candidate: Candidate,
    application: Application,
    job: Job,
    *,
    user_id=None,
    background_tasks: BackgroundTasks | None = None,
) -> float | None:
    """Score the candidate's parsed resume against the job and record it on
    the application and the profile (whose score tracks the latest job they
    were matched to, as the recruiter "add to pipeline" flow does)."""
    if not candidate.parsed_data or not job_has_requirements(job):
        return None
    try:
        async with ai_scope(candidate.organization_id):  # see parse_into_profile
            score, breakdown = await match_scorer.evaluate_candidate_match(
                candidate_data=candidate.parsed_data,
                candidate_skills=list(candidate.skills or candidate.parsed_data.get("skills") or []),
                years_experience=candidate.years_experience,
                job=job,
                background_tasks=background_tasks,
                user_id=user_id,
                organization_id=candidate.organization_id,
            )
    except Exception as exc:
        logger.warning("Resume intake: match scoring failed for candidate %s on job %s: %s", candidate.id, job.id, exc)
        return None
    if score is None:
        return None
    application.match_score = score
    candidate.match_score = score
    candidate.score_breakdown = breakdown
    return score
