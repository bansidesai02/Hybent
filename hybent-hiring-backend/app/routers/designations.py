import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.dependencies import DB, get_current_user, require_recruiter
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobOut
from app.schemas.response import APIResponse
from app.services.activity_service import log_activity
from app.utils.permissions import JobStatus


router = APIRouter(prefix="/v1/designations", tags=["designations"])


class DesignationOrderItem(BaseModel):
    designation_id: uuid.UUID
    display_order: int = Field(ge=0)


class DesignationOrderUpdate(BaseModel):
    items: list[DesignationOrderItem]


class DesignationReorderUpdate(BaseModel):
    designation_ids: list[uuid.UUID]


async def _designation_counts(db: DB, organization_id: uuid.UUID) -> dict[str, int]:
    from app.models.application import Application
    from app.utils.category import extract_all_categories
    from sqlalchemy import or_

    jobs = (await db.execute(
        select(Job.id, Job.title).where(
            Job.organization_id == organization_id,
            Job.status == JobStatus.POOL,
        )
    )).all()

    designation_counts = {}
    for job_id, job_title in jobs:
        if not job_title:
            continue
        job_categories = extract_all_categories(job_title)
        or_conds = [
            Candidate.applied_job_title.ilike(f"%{job_title}%"),
            Candidate.current_title.ilike(f"%{job_title}%"),
            Candidate.applications.any(Application.job_id == job_id)
        ]
        for cat in job_categories:
            or_conds.append(Candidate.applied_job_title.ilike(f"%{cat}%"))
            or_conds.append(Candidate.current_title.ilike(f"%{cat}%"))

        count = (await db.execute(
            select(func.count(Candidate.id)).where(
                Candidate.organization_id == organization_id,
                or_(*or_conds),
            )
        )).scalar() or 0
        designation_counts[job_title] = count

    return designation_counts


async def _designation_rows(db: DB, organization_id: uuid.UUID) -> list[dict]:
    jobs = (await db.execute(
        select(Job)
        .where(Job.organization_id == organization_id, Job.status == JobStatus.POOL)
        .order_by(Job.display_order.asc(), Job.created_at.asc(), Job.id.asc())
    )).scalars().all()
    counts = await _designation_counts(db, organization_id)

    items: list[dict] = []
    for index, job in enumerate(jobs):
        if job.display_order is None:
            job.display_order = index
        item = JobOut.model_validate(job).model_dump()
        item["candidate_count"] = counts.get(job.title, 0)
        items.append(item)
    return items


@router.get("")
async def list_designations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
):
    items = await _designation_rows(db, current_user.organization_id)
    total_candidates = (await db.execute(
        select(func.count(Candidate.id)).where(Candidate.organization_id == current_user.organization_id)
    )).scalar() or 0
    designation_counts = await _designation_counts(db, current_user.organization_id)

    return APIResponse.success(
        message="Designations retrieved successfully.",
        data={
            "items": items,
            "designation_counts": designation_counts,
            "total_candidates": total_candidates,
        },
    )


@router.get("/order")
async def get_designation_order(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
):
    items = await _designation_rows(db, current_user.organization_id)
    return APIResponse.success(
        message="Designation order retrieved successfully.",
        data=[
            {
                "designation_id": item["id"],
                "display_order": item["display_order"],
            }
            for item in items
        ],
    )


@router.put("/order")
async def update_designation_order(
    payload: DesignationOrderUpdate,
    current_user: Annotated[User, Depends(require_recruiter)],
    db: DB,
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Designation order cannot be empty")

    ids = [item.designation_id for item in payload.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Duplicate designation IDs are not allowed")

    rows = (await db.execute(
        select(Job).where(
            Job.organization_id == current_user.organization_id,
            Job.status == JobStatus.POOL,
            Job.id.in_(ids),
        )
    )).scalars().all()
    jobs_by_id = {job.id: job for job in rows}
    if len(jobs_by_id) != len(ids):
        raise HTTPException(status_code=404, detail="One or more designations were not found")

    for item in payload.items:
        job = jobs_by_id[item.designation_id]
        job.display_order = item.display_order
        job.updated_at = datetime.now(timezone.utc)

    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="REORDER",
        resource_type="designation",
        resource_id=None,
        details={
            "items": [
                {"id": str(item.designation_id), "display_order": item.display_order}
                for item in payload.items[:100]
            ]
        },
    )
    await db.commit()

    return APIResponse.success(
        message="Designation order updated successfully.",
        data={
            "items": await _designation_rows(db, current_user.organization_id),
            "designation_counts": await _designation_counts(db, current_user.organization_id),
            "total_candidates": (await db.execute(
                select(func.count(Candidate.id)).where(Candidate.organization_id == current_user.organization_id)
            )).scalar() or 0,
        },
    )


@router.put("/reorder")
async def reorder_designations(
    payload: DesignationReorderUpdate,
    current_user: Annotated[User, Depends(require_recruiter)],
    db: DB,
):
    return await update_designation_order(
        DesignationOrderUpdate(
            items=[
                DesignationOrderItem(designation_id=designation_id, display_order=index)
                for index, designation_id in enumerate(payload.designation_ids)
            ]
        ),
        current_user,
        db,
    )


@router.delete("/{designation_id}")
async def delete_designation(
    designation_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_recruiter)],
    db: DB,
):
    """Delete a Talent DB designation. Only `pool` jobs: open positions are
    never touched here. Candidates stay in the database, just unassigned."""
    from sqlalchemy import delete
    from app.routers.jobs import invalidate_jobs_cache

    job = (await db.execute(
        select(Job).where(
            Job.id == designation_id,
            Job.organization_id == current_user.organization_id,
            Job.status == JobStatus.POOL,
        )
    )).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Designation not found")

    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="DELETE",
        resource_type="designation",
        resource_id=str(designation_id),
        details={"title": job.title},
    )
    # The database clears candidates' designation_id (SET NULL) and drops the
    # pool placeholder applications (CASCADE).
    await db.execute(delete(Job).where(Job.id == designation_id))
    await db.commit()
    invalidate_jobs_cache(current_user.organization_id)

    return APIResponse.success(
        message="Designation deleted successfully.",
        data={
            "items": await _designation_rows(db, current_user.organization_id),
            "designation_counts": await _designation_counts(db, current_user.organization_id),
            "total_candidates": (await db.execute(
                select(func.count(Candidate.id)).where(Candidate.organization_id == current_user.organization_id)
            )).scalar() or 0,
        },
    )
