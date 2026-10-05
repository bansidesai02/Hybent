"""
Database access for the Screening Agent.

Kept apart from the graph nodes so the nodes stay plain logic and tests can
swap these functions for in-memory fakes (tests/agents/test_screening_graph.py).
Every query is scoped to the organization from the run's context.
"""
import uuid
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.screening_recommendation import ScreeningRecommendation
from app.utils.permissions import JobStatus

# Emails made up at intake when a resume had none — never evidence of a duplicate.
PLACEHOLDER_EMAIL_DOMAIN = "@hybent.temp"
MAX_JOBS = 50


def _candidate_view(c: Candidate) -> dict:
    parsed = c.parsed_data or {}
    return {
        "id": str(c.id),
        "full_name": c.full_name,
        "email": c.email,
        "phone": c.phone,
        "location": c.location,
        "current_title": c.current_title,
        "current_company": c.current_company,
        "years_experience": c.years_experience,
        "skills": list(c.skills or [])[:30],
        "summary": (c.summary or "")[:800],
        "notice_period_days": c.notice_period_days,
        "expected_ctc": c.expected_ctc,
        "pipeline_stage": c.pipeline_stage,
        "match_score": c.match_score,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        # The parts of the parsed resume the scorers and the prompt use.
        "parsed": {
            "current_title": parsed.get("current_title") or c.current_title,
            "experience": (parsed.get("experience") or [])[:5],
            "education": (parsed.get("education") or [])[:3],
            "projects": (parsed.get("projects") or [])[:4],
            "certifications": (parsed.get("certifications") or [])[:8],
        },
    }


async def load_candidate(db: AsyncSession, organization_id: uuid.UUID, candidate_id: str) -> Optional[dict]:
    c = (await db.execute(select(Candidate).where(
        Candidate.id == uuid.UUID(candidate_id),
        Candidate.organization_id == organization_id,
        Candidate.is_deleted.is_(False),
    ))).scalar_one_or_none()
    return _candidate_view(c) if c else None


async def already_screened(db: AsyncSession, organization_id: uuid.UUID, candidate_id: str) -> bool:
    """A re-queued or retried task must not screen the same candidate twice."""
    n = (await db.execute(select(func.count(ScreeningRecommendation.id)).where(
        ScreeningRecommendation.organization_id == organization_id,
        ScreeningRecommendation.candidate_id == uuid.UUID(candidate_id),
    ))).scalar()
    return bool(n)


async def find_duplicate(db: AsyncSession, organization_id: uuid.UUID, candidate: dict) -> Optional[dict]:
    """An older profile in the same org with the same real email or phone."""
    conds = []
    email = (candidate.get("email") or "").strip().lower()
    if email and not email.endswith(PLACEHOLDER_EMAIL_DOMAIN):
        conds.append(func.lower(Candidate.email) == email)
    if candidate.get("phone"):
        conds.append(Candidate.phone == candidate["phone"])  # stored normalised by the model
    if not conds:
        return None
    row = (await db.execute(
        select(Candidate.id, Candidate.full_name, Candidate.pipeline_stage)
        .where(
            Candidate.organization_id == organization_id,
            Candidate.id != uuid.UUID(candidate["id"]),
            Candidate.is_deleted.is_(False),
            or_(*conds),
        )
        .order_by(Candidate.created_at.asc())
        .limit(1)
    )).first()
    if not row:
        return None
    return {"id": str(row.id), "full_name": row.full_name, "pipeline_stage": row.pipeline_stage}


async def applied_job_ids(db: AsyncSession, organization_id: uuid.UUID, candidate_id: str) -> list[str]:
    rows = (await db.execute(select(Application.job_id).where(
        Application.organization_id == organization_id,
        Application.candidate_id == uuid.UUID(candidate_id),
    ))).scalars().all()
    return [str(j) for j in rows if j]


async def active_jobs(db: AsyncSession, organization_id: uuid.UUID) -> list[Job]:
    return list((await db.execute(
        select(Job).where(
            Job.organization_id == organization_id,
            Job.status == JobStatus.ACTIVE,
            Job.is_deleted.is_(False),
        ).order_by(Job.created_at.desc()).limit(MAX_JOBS)
    )).scalars().all())


async def save_recommendation(db: AsyncSession, organization_id: uuid.UUID, candidate_id: str, **fields) -> str:
    rec = ScreeningRecommendation(
        organization_id=organization_id,
        candidate_id=uuid.UUID(candidate_id),
        **fields,
    )
    db.add(rec)
    await db.commit()
    return str(rec.id)
