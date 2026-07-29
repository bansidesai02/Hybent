import uuid
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.schemas.application import ApplicationOut, ApplicationCreate, StageUpdate, NotesUpdate
from app.utils.pagination import paginate
from app.schemas.response import APIResponse
from app.tasks.notifications import notify_candidate_stage_change

router = APIRouter(prefix="/v1/applications", tags=["applications"])

async def _get_application(application_id: uuid.UUID, org_id: uuid.UUID, db) -> Application:
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.organization_id == org_id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


async def _enrich_application(app: Application, db) -> dict:
    """Add candidate and job data to application dict."""
    d = ApplicationOut.model_validate(app).model_dump()
    from sqlalchemy.orm.attributes import instance_state
    state = instance_state(app)

    if "candidate" in state.unloaded:
        cand = (await db.execute(select(Candidate).where(Candidate.id == app.candidate_id))).scalar_one_or_none()
    else:
        cand = app.candidate

    if "job" in state.unloaded:
        job = (await db.execute(select(Job).where(Job.id == app.job_id))).scalar_one_or_none()
    else:
        job = app.job

    if cand:
        from app.schemas.candidate import CandidateOut
        d["candidate"] = CandidateOut.model_validate(cand).model_dump()
    if job:
        from app.schemas.job import JobOut
        d["job"] = JobOut.model_validate(job).model_dump()
    return d


@router.get("")
async def list_applications(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    job_id: uuid.UUID | None = None,
    stage: str | None = None,
):
    query = select(Application).where(Application.organization_id == current_user.organization_id)
    
    # Isolation: Recruiters only see applications for their own jobs
    # Isolation: Recruiters see applications for their own jobs OR their own candidates
    if current_user.role == "recruiter":
        query = query.join(Job).outerjoin(Candidate, Application.candidate_id == Candidate.id).where(
            (Job.created_by_id == current_user.id) | (Candidate.created_by_id == current_user.id)
        )
    if job_id:
        query = query.where(Application.job_id == job_id)
    if stage:
        query = query.where(Application.stage == stage)

    query = query.options(
        joinedload(Application.candidate),
        joinedload(Application.job)
    )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    apps = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()
    items = [await _enrich_application(a, db) for a in apps]
    return APIResponse.success(message="Applications retrieved successfully.", data=paginate(items, total, page, limit))



@router.post("", response_model=dict, status_code=201)
async def create_application(data: ApplicationCreate, current_user: RecruiterUser, db: DB):
    # Validate candidate and job belong to org
    cand = (await db.execute(
        select(Candidate).where(
            Candidate.id == uuid.UUID(data.candidate_id),
            Candidate.organization_id == current_user.organization_id,
        )
    )).scalar_one_or_none()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = (await db.execute(
        select(Job).where(
            Job.id == uuid.UUID(data.job_id),
            Job.organization_id == current_user.organization_id,
        )
    )).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Prevent duplicate
    dup = (await db.execute(
        select(Application).where(
            Application.candidate_id == uuid.UUID(data.candidate_id),
            Application.job_id == uuid.UUID(data.job_id),
        )
    )).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=409, detail="Application already exists")

    app = Application(
        organization_id=current_user.organization_id,
        job_id=uuid.UUID(data.job_id),
        candidate_id=uuid.UUID(data.candidate_id),
        source=data.source,
    )
    db.add(app)
    await db.flush()

    # Automatically calculate match score
    try:
        from app.services.match_scorer import evaluate_candidate_match
        import logging
        logger = logging.getLogger(__name__)
        score, breakdown = await evaluate_candidate_match(
            candidate_data=cand.parsed_data or {},
            candidate_skills=cand.skills or [],
            years_experience=cand.years_experience,
            job=job,
        )
        cand.match_score = score
        cand.score_breakdown = breakdown
        app.match_score = score
        db.add(cand)
        db.add(app)
        await db.flush()
    except Exception as e:
        logger.error(f"Auto-scoring failed: {e}")

    return APIResponse.success(message="Application created successfully.", data=await _enrich_application(app, db))


@router.get("/{application_id}")
async def get_application(application_id: uuid.UUID, current_user: CurrentUser, db: DB):
    app = await _get_application(application_id, current_user.organization_id, db)
    return APIResponse.success(message="Application retrieved successfully.", data=await _enrich_application(app, db))


@router.patch("/{application_id}/stage")
async def update_stage(application_id: uuid.UUID, data: StageUpdate, current_user: RecruiterUser, db: DB):
    from datetime import datetime, timezone
    app = await _get_application(application_id, current_user.organization_id, db)
    app.stage = data.stage
    app.stage_changed_at = datetime.now(timezone.utc)
    
    # Synchronize candidate's pipeline_stage
    cand = (await db.execute(select(Candidate).where(Candidate.id == app.candidate_id))).scalar_one_or_none()
    if cand:
        cand.pipeline_stage = data.stage
        db.add(cand)
        notify_candidate_stage_change.delay(
            str(cand.user_id) if cand.user_id else None,
            str(cand.id),
            data.stage,
            str(current_user.organization_id)
        )
    
    if data.rejection_reason:
        app.rejection_reason = data.rejection_reason
    return APIResponse.success(message="Application stage updated successfully.", data=await _enrich_application(app, db))


@router.patch("/{application_id}/notes")
async def update_notes(application_id: uuid.UUID, data: NotesUpdate, current_user: RecruiterUser, db: DB):
    app = await _get_application(application_id, current_user.organization_id, db)
    app.recruiter_notes = data.recruiter_notes
    return APIResponse.success(message="Notes updated successfully.")
