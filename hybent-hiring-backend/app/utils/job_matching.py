"""Shared job-matching helpers used by both the manual "upload & create"
resume flow (app/routers/resumes.py) and the automated email-ingestion
pipeline (app/services/email_ingestion_service.py), so the two pipelines
never silently drift apart.
"""
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job

logger = logging.getLogger(__name__)


async def resolve_or_create_pool_job(
    db: AsyncSession,
    organization_id: uuid.UUID,
    title_hint: str | None,
    category_hint: str | None = None,
) -> Job:
    """No job was explicitly chosen for this candidate — find (or create) a
    "pool" designation Job by title so they have somewhere to land. Mirrors
    the manual upload flow's designation-pool behavior exactly."""
    new_title = (title_hint or category_hint or "Software Engineer").strip()

    existing_job_res = await db.execute(
        select(Job).where(Job.title.ilike(new_title), Job.organization_id == organization_id)
    )
    matched_job = existing_job_res.scalar_one_or_none()

    if not matched_job:
        matched_job = Job(
            organization_id=organization_id,
            title=new_title,
            status="pool",
            description=f"Designation pool for {new_title}",
            openings=0,
            job_type="full_time",
        )
        db.add(matched_job)
        await db.flush()
        logger.info(f"Automatically created new designation pool: '{new_title}' (ID: {matched_job.id})")

    return matched_job
