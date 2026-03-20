"""
Talent pool: browse all candidates, filter by skills/tags, re-engage.
"""
import uuid
from fastapi import APIRouter, Query
from sqlalchemy import select, func
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.models.candidate import Candidate
from app.schemas.candidate import CandidateOut
from app.utils.pagination import paginate

router = APIRouter(prefix="/v1/talent-pool", tags=["talent_pool"])


@router.get("")
async def list_talent_pool(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    skill: str | None = None,
    tag: str | None = None,
    min_experience: int | None = None,
):
    query = select(Candidate).where(Candidate.organization_id == current_user.organization_id)

    if search:
        query = query.where(
            Candidate.full_name.ilike(f"%{search}%")
            | Candidate.email.ilike(f"%{search}%")
            | Candidate.current_title.ilike(f"%{search}%")
        )
    if skill:
        query = query.where(Candidate.skills.contains([skill]))
    if tag:
        query = query.where(Candidate.tags.contains([tag]))
    if min_experience is not None:
        query = query.where(Candidate.years_experience >= min_experience)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    items = (await db.execute(
        query.order_by(Candidate.match_score.desc().nulls_last()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    return paginate([CandidateOut.model_validate(c).model_dump() for c in items], total, page, limit)


@router.get("/stats")
async def get_talent_stats(current_user: CurrentUser, db: DB):
    """
    Get KPIs for the talent database.
    """
    from app.models.application import Application
    from sqlalchemy import select, func

    total_candidates = (await db.execute(
        select(func.count(Candidate.id)).where(Candidate.organization_id == current_user.organization_id)
    )).scalar() or 0

    # Re-matched: Candidates who have at least one application
    re_matched_count = (await db.execute(
        select(func.count(func.distinct(Application.candidate_id))).where(
            Application.organization_id == current_user.organization_id
        )
    )).scalar() or 0

    # Avg hire from DB (placeholder logic: 2.1d as in reference or based on actual hired applications)
    # real logic would compute delta between candidate created_at and application created_at for hired ones
    avg_hire_time = "2.1d" 

    return {
        "total_candidates": total_candidates,
        "re_matched_count": re_matched_count,
        "avg_hire_time": avg_hire_time
    }


@router.get("/suggested-matches")
async def get_suggested_matches(current_user: CurrentUser, db: DB):
    """
    Get candidates from the pool who explicitly applied for or are mapped to current active jobs.
    Uses pre-calculated match_score and applied_job_title instead of LLM re-evaluations.
    """
    from app.models.job import Job
    from app.utils.permissions import JobStatus

    # Get active jobs
    jobs_res = await db.execute(
        select(Job).where(
            Job.organization_id == current_user.organization_id,
            Job.status == JobStatus.ACTIVE
        ).order_by(Job.created_at.desc()).limit(3)
    )
    active_jobs = jobs_res.scalars().all()

    if not active_jobs:
        return []

    results = []
    for job in active_jobs:
        # Use simple statically saved scores and strict title mapping
        cands_res = await db.execute(
            select(Candidate)
            .where(
                Candidate.organization_id == current_user.organization_id,
                Candidate.applied_job_title == job.title,
                Candidate.match_score.isnot(None)
            )
            .order_by(Candidate.match_score.desc().nulls_last())
            .limit(5)
        )
        candidates = cands_res.scalars().all()

        job_suggestions = []
        for candidate in candidates:
            job_suggestions.append({
                "id": str(candidate.id),
                "full_name": candidate.full_name,
                "current_title": candidate.current_title,
                "years_experience": candidate.years_experience,
                "match_score": candidate.match_score,
                "skills": candidate.skills[:3] if candidate.skills else [],
                "avatar_url": None
            })
            
        if job_suggestions:
            results.append({
                "job_id": str(job.id),
                "job_title": job.title,
                "candidates": job_suggestions
            })

    return results


@router.post("/{candidate_id}/tag")
async def add_tag(candidate_id: uuid.UUID, tag: str, current_user: RecruiterUser, db: DB):
    from fastapi import HTTPException
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.organization_id == current_user.organization_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if tag not in candidate.tags:
        candidate.tags = [*candidate.tags, tag]
    return {"tags": candidate.tags}
