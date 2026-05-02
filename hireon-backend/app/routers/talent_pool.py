"""
Talent pool: browse all candidates, filter by skills/tags, re-engage.
"""
import uuid
from fastapi import APIRouter, Query
from sqlalchemy import select, func, cast, String
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.models.candidate import Candidate
from app.schemas.candidate import CandidateOut
from app.utils.pagination import paginate
from app.services.activity_service import log_activity
from app.schemas.response import APIResponse

from sqlalchemy.orm import selectinload

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
    job_title: str | None = None,   # Filter by active job title
    status: str | None = None,
    created_by_id: str | None = None,
    job_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    from app.models.application import Application

    query = select(Candidate).where(Candidate.organization_id == current_user.organization_id).options(selectinload(Candidate.created_by))

    if job_id and job_id != "all":
        query = query.join(Application, Application.candidate_id == Candidate.id).where(Application.job_id == job_id)

    if created_by_id and created_by_id != "all":
        query = query.where(Candidate.created_by_id == created_by_id)

    if date_from:
        try:
            from datetime import datetime, timezone
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.where(Candidate.created_at >= dt_from)
        except (ValueError, TypeError):
            pass

    if date_to:
        try:
            from datetime import datetime, timezone, timedelta
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            if dt_to.hour == 0 and dt_to.minute == 0:
                dt_to = dt_to + timedelta(days=1)
            query = query.where(Candidate.created_at < dt_to)
        except (ValueError, TypeError):
            pass

    status = (status or "").strip().lower() or None
    if status:
        STATUS_STAGE_MAP = {
            "in_review":   ["applied", None, "screening", "", "needs_review"],
            "shortlisted": ["pre_screening_selected"],
            "scheduled":   [
                "technical_round", "technical_round_selected", "practical_round",
                "practical_round_selected", "hr_round", "hr_round_selected",
                "management_round", "management_round_selected",
                "techno_functional", "techno_functional_selected"
            ],
            "rejected":    [
                "rejected", "pre_screening_rejected", "technical_round_rejected",
                "practical_round_rejected", "hr_round_rejected", "technical_round_back_out",
                "practical_round_back_out", "management_round_rejected", "techno_functional_rejected"
            ]
        }
        stages = STATUS_STAGE_MAP.get(status)
        if stages is not None:
            if None in stages:
                from sqlalchemy import or_
                non_null_stages = [s for s in stages if s is not None]
                query = query.where(or_(Candidate.pipeline_stage.in_(non_null_stages), Candidate.pipeline_stage.is_(None)))
            else:
                query = query.where(Candidate.pipeline_stage.in_(stages))

    if search:
        from sqlalchemy import cast, String as SAString
        query = query.where(
            Candidate.full_name.ilike(f"%{search}%")
            | Candidate.email.ilike(f"%{search}%")
            | Candidate.current_title.ilike(f"%{search}%")
            | Candidate.current_company.ilike(f"%{search}%")
            | cast(Candidate.skills, SAString).ilike(f"%{search}%")
            | cast(Candidate.tags, SAString).ilike(f"%{search}%")
        )
    if skill:
        query = query.where(Candidate.skills.contains([skill]))
    if tag:
        query = query.where(Candidate.tags.contains([tag]))
    if min_experience is not None:
        query = query.where(Candidate.years_experience >= min_experience)
    if job_title:
        # Match candidates whose applied_job_title or current_title matches the selected job
        query = query.where(
            Candidate.applied_job_title.ilike(f"%{job_title}%")
            | Candidate.current_title.ilike(f"%{job_title}%")
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    items = (await db.execute(
        query.order_by(Candidate.match_score.desc().nulls_last()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    def transform_candidate(c: Candidate):
        d = CandidateOut.model_validate(c).model_dump()
        if c.created_by:
            d["created_by_name"] = c.created_by.full_name
            d["created_by_id"] = str(c.created_by.id)
        return d

    return APIResponse.success(message="Talent pool retrieved.", data=paginate([transform_candidate(c) for c in items], total, page, limit))


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

    return APIResponse.success(message="Talent stats retrieved.", data={
        "total_candidates": total_candidates,
        "re_matched_count": re_matched_count,
        "avg_hire_time": avg_hire_time
    })


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
        return APIResponse.success(message="Suggested matches retrieved.", data=[])

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
            .options(selectinload(Candidate.created_by))
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
                "skills": candidate.skills[:8] if candidate.skills else [],
                "avatar_url": None,
                "created_by_name": candidate.created_by.full_name if candidate.created_by else "Admin"
            })
            
        if job_suggestions:
            results.append({
                "job_id": str(job.id),
                "job_title": job.title,
                "candidates": job_suggestions
            })

    return APIResponse.success(message="Suggested matches retrieved.", data=results)


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
        await log_activity(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action="UPDATE",
            resource_type="candidate",
            resource_id=str(candidate_id),
            details={"name": candidate.full_name, "added_tag": tag}
        )
        await db.commit()
    return APIResponse.success(message="Tag added.", data={"tags": candidate.tags})
