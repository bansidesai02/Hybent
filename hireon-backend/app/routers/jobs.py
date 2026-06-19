import uuid
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, BackgroundTasks
from app.dependencies import DB, get_current_user, require_recruiter, require_admin
from app.models.user import User
from typing import Annotated
from app.models.job import Job
from app.models.application import Application
from app.models.candidate import Candidate
from app.schemas.job import JobCreate, JobUpdate, JobOut
from app.utils.pagination import paginate
from app.services.resume_parser import parse_jd
from app.services.storage_service import save_jd, read_file_bytes
from app.services.activity_service import log_activity
from app.schemas.response import APIResponse
from app.services import elasticsearch_service as es_service

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


def invalidate_jobs_cache(org_id):
    pass

@router.get("")
async def list_jobs(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    include_pool: bool = False,
):
    query = select(Job).where(Job.organization_id == current_user.organization_id)

    from app.utils.permissions import JobStatus
    if status:
        query = query.where(Job.status == status)
    elif not include_pool:
        query = query.where(Job.status != JobStatus.POOL)
        
    if search:
        from sqlalchemy import cast, String as SAString
        query = query.where(
            Job.title.ilike(f"%{search}%")
            | Job.description.ilike(f"%{search}%")
            | Job.location.ilike(f"%{search}%")
            | cast(Job.skills_required, SAString).ilike(f"%{search}%")
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    jobs = (await db.execute(query.offset((page - 1) * limit).limit(limit))).scalars().all()

    # Attach application counts
    job_ids = [j.id for j in jobs]
    count_result = await db.execute(
        select(Application.job_id, func.count(Application.id))
        .where(Application.job_id.in_(job_ids))
        .group_by(Application.job_id)
    )
    counts = {str(row[0]): row[1] for row in count_result.all()}

    # Attach re-engage counts from talent pool
    job_titles = [j.title for j in jobs]
    re_engage_counts = {}
    if job_titles:
        re_engage_result = await db.execute(
            select(Candidate.applied_job_title, func.count(Candidate.id))
            .where(
                Candidate.organization_id == current_user.organization_id,
                Candidate.match_score.isnot(None),
                Candidate.applied_job_title.in_(job_titles)
            )
            .group_by(Candidate.applied_job_title)
        )
        re_engage_counts = {str(row[0]): row[1] for row in re_engage_result.all()}

    items = []
    for j in jobs:
        job_dict = JobOut.model_validate(j).model_dump()
        job_dict["application_count"] = counts.get(str(j.id), 0)
        job_dict["re_engage_count"] = re_engage_counts.get(j.title, 0)
        items.append(job_dict)

    return APIResponse.success(message="Jobs retrieved successfully.", data=paginate(items, total, page, limit))


@router.post("", response_model=JobOut, status_code=201)
async def create_job(data: JobCreate, current_user: Annotated[User, Depends(require_recruiter)], db: DB, background_tasks: BackgroundTasks):
    from app.utils.permissions import JobStatus
    create_data = data.model_dump()
    provided_display_order = create_data.pop("display_order", None)
    if data.status == JobStatus.POOL:
        max_order = (await db.execute(
            select(func.coalesce(func.max(Job.display_order), -1)).where(
                Job.organization_id == current_user.organization_id,
                Job.status == JobStatus.POOL,
            )
        )).scalar() or -1
        next_display_order = provided_display_order if provided_display_order is not None else int(max_order) + 1
    else:
        next_display_order = provided_display_order if provided_display_order is not None else 0

    job = Job(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        display_order=next_display_order,
        **create_data,
    )
    db.add(job)
    await db.flush()
    
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="CREATE",
        resource_type="job",
        resource_id=str(job.id),
        details={"title": job.title}
    )
    
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(es_service.index_job, job)
    # Auto-create talent pool category if this is a real job
    from app.utils.permissions import JobStatus
    from app.utils.category import extract_core_category
    if job.status != JobStatus.POOL:
        core_cat = extract_core_category(job.title)
        
        # Check if pool exists
        res = await db.execute(
            select(Job).where(
                Job.organization_id == current_user.organization_id,
                Job.status == JobStatus.POOL,
                Job.title.ilike(core_cat)
            )
        )
        if not res.scalar_one_or_none():
            pool_job = Job(
                organization_id=current_user.organization_id,
                created_by_id=current_user.id,
                title=core_cat,
                description=core_cat,
                status=JobStatus.POOL,
                job_type='full_time',
                openings=0
            )
            db.add(pool_job)
            await db.commit()

    invalidate_jobs_cache(current_user.organization_id)
    return APIResponse.success(message="Job successfully created.", data=JobOut.model_validate(job), status_code=201)


@router.post("/parse-jd")
async def parse_jd_endpoint(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    file: UploadFile = File(...),
):
    """Parses a JD document and returns structured details via AI."""
    # Read file bytes directly before saving
    file_bytes = await file.read()
    await file.seek(0)

    # 1. Save the JD file so we have a URL for viewing
    jd_url, jd_filename = await save_jd(file, str(current_user.organization_id))
    
    # 2. Extract contents for AI parsing
    content_type = file.content_type or ""
    try:
        # Keep original parsing logic intact
        parsed_data = await parse_jd(
            file_bytes, 
            content_type,
            background_tasks=background_tasks,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        
        # Add the URL and filename to the response
        parsed_data["jd_url"] = jd_url
        parsed_data["jd_filename"] = jd_filename
        return APIResponse.success(message="Job description parsed successfully.", data=parsed_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse JD: {str(e)}")


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: uuid.UUID, current_user: Annotated[User, Depends(get_current_user)], db: DB):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == current_user.organization_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return APIResponse.success(message="Job retrieved successfully.", data=JobOut.model_validate(job))


@router.put("/{job_id}", response_model=JobOut)
async def update_job(job_id: uuid.UUID, data: JobUpdate, current_user: Annotated[User, Depends(require_admin)], db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == current_user.organization_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    old_status = job.status
    changed_fields = list(data.model_dump(exclude_unset=True, exclude_none=True).keys())
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        if hasattr(value, "value"):
            value = value.value
        setattr(job, field, value)
    from app.utils.permissions import JobStatus
    if job.status == JobStatus.POOL and old_status != JobStatus.POOL and (job.display_order is None or job.display_order == 0):
        max_order = (await db.execute(
            select(func.coalesce(func.max(Job.display_order), -1)).where(
                Job.organization_id == current_user.organization_id,
                Job.status == JobStatus.POOL,
            )
        )).scalar() or -1
        job.display_order = int(max_order) + 1
    await db.flush()
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="UPDATE",
        resource_type="job",
        resource_id=str(job_id),
        details={"title": job.title, "fields": changed_fields[:5]}
    )
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(es_service.index_job, job)
    invalidate_jobs_cache(current_user.organization_id)
    return APIResponse.success(message="Job updated successfully.", data=JobOut.model_validate(job))


@router.delete("/{job_id}")
async def delete_job(job_id: uuid.UUID, current_user: Annotated[User, Depends(require_admin)], db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == current_user.organization_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Log before deletion so we can capture the job title
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="DELETE",
        resource_type="job",
        resource_id=str(job_id),
        details={"title": job.title}
    )
    await db.delete(job)
    await db.commit()
    background_tasks.add_task(es_service.delete_from_index, "hireon_jobs", str(job_id))
    invalidate_jobs_cache(current_user.organization_id)
    return APIResponse.success(message="Job deleted successfully.")
