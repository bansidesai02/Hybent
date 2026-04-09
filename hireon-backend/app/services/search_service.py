"""
Global search service.

Primary:  Elasticsearch multi-index search with fuzzy matching.
Fallback: PostgreSQL multi-field ILIKE search (used when ES is unavailable).

Both paths return the same response shape so the router stays unchanged.
"""
import uuid
import logging
from sqlalchemy import select, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.job import Job
from app.models.interview import Interview
from app.models.user import User
from app.services import elasticsearch_service as es_service

logger = logging.getLogger(__name__)


async def global_search(
    db: AsyncSession,
    organization_id: uuid.UUID,
    query: str,
    limit: int = 5,
) -> dict:
    """
    Run a global search across candidates, jobs, interviews, and users.

    Tries Elasticsearch first. Falls back to PostgreSQL ILIKE if ES is down.

    Returns a dict with keys: candidates, jobs, interviews, users, total.
    """

    # ── 1. Try Elasticsearch ────────────────────────────────────────────────
    try:
        es_results = await es_service.search_all(
            organization_id=str(organization_id),
            query=query,
            limit=limit,
        )
        if es_results is not None:
            logger.debug(f"[Search] ES returned {es_results['total']} results for '{query}'")
            return es_results
    except Exception as exc:
        logger.warning(f"[Search] ES search failed, falling back to PostgreSQL: {exc}")

    # ── 2. Fallback: PostgreSQL ILIKE ───────────────────────────────────────
    logger.info(f"[Search] Using PostgreSQL fallback for '{query}'")
    return await _pg_search(db, organization_id, query, limit)


async def _pg_search(
    db: AsyncSession,
    organization_id: uuid.UUID,
    query: str,
    limit: int,
) -> dict:
    """PostgreSQL-based search (original implementation, kept as fallback)."""
    q = f"%{query.strip()}%"

    # ── Candidates ──────────────────────────────────────────────────────────
    cand_stmt = (
        select(Candidate)
        .where(
            Candidate.organization_id == organization_id,
            or_(
                Candidate.full_name.ilike(q),
                Candidate.email.ilike(q),
                Candidate.current_title.ilike(q),
                Candidate.current_company.ilike(q),
                cast(Candidate.skills, String).ilike(q),
            ),
        )
        .limit(limit)
    )
    cand_rows = (await db.execute(cand_stmt)).scalars().all()

    candidates = [
        {
            "id": str(c.id),
            "type": "candidate",
            "title": c.full_name,
            "subtitle": c.current_title or c.email,
            "meta": c.current_company,
            "avatar_url": None,
            "pipeline_stage": c.pipeline_stage,
            "email": c.email,
        }
        for c in cand_rows
    ]

    # ── Jobs ─────────────────────────────────────────────────────────────────
    job_stmt = (
        select(Job)
        .where(
            Job.organization_id == organization_id,
            or_(
                Job.title.ilike(q),
                Job.location.ilike(q),
                Job.description.ilike(q),
                cast(Job.skills_required, String).ilike(q),
            ),
        )
        .limit(limit)
    )
    job_rows = (await db.execute(job_stmt)).scalars().all()

    jobs = [
        {
            "id": str(j.id),
            "type": "job",
            "title": j.title,
            "subtitle": j.location or j.job_type,
            "meta": j.status,
            "is_remote": j.is_remote,
        }
        for j in job_rows
    ]

    # ── Interviews ───────────────────────────────────────────────────────────
    ivw_stmt = (
        select(Interview, Candidate.full_name.label("candidate_name"))
        .join(Candidate, Interview.candidate_id == Candidate.id, isouter=True)
        .where(
            Interview.organization_id == organization_id,
            or_(
                Interview.title.ilike(q),
                Candidate.full_name.ilike(q),
                Interview.notes.ilike(q),
            ),
        )
        .limit(limit)
    )
    ivw_rows = (await db.execute(ivw_stmt)).all()

    interviews = [
        {
            "id": str(row.Interview.id),
            "type": "interview",
            "title": row.Interview.title,
            "subtitle": row.candidate_name or "Unknown Candidate",
            "meta": row.Interview.status,
            "scheduled_at": row.Interview.scheduled_at.isoformat() if row.Interview.scheduled_at else None,
        }
        for row in ivw_rows
    ]

    # ── Users (Team Members) ────────────────────────────────────────────────
    user_stmt = (
        select(User)
        .where(
            User.organization_id == organization_id,
            User.is_active == True,  # noqa: E712
            or_(
                User.full_name.ilike(q),
                User.email.ilike(q),
            ),
        )
        .limit(limit)
    )
    user_rows = (await db.execute(user_stmt)).scalars().all()

    users = [
        {
            "id": str(u.id),
            "type": "user",
            "title": u.full_name,
            "subtitle": u.role.title(),
            "meta": u.email,
            "avatar_url": u.avatar_url,
        }
        for u in user_rows
    ]

    return {
        "candidates": candidates,
        "jobs": jobs,
        "interviews": interviews,
        "users": users,
        "total": len(candidates) + len(jobs) + len(interviews) + len(users),
    }
