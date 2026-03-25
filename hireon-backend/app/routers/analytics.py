import uuid
from fastapi import APIRouter, Query
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.services import analytics_service

router = APIRouter(prefix="/v1/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(current_user: RecruiterUser, db: DB):
    user_id = current_user.id if current_user.role == "recruiter" else None
    return await analytics_service.get_overview(current_user.organization_id, db, user_id=user_id)


@router.get("/funnel")
async def funnel(
    current_user: RecruiterUser,
    db: DB,
    job_id: uuid.UUID | None = Query(default=None),
):
    user_id = current_user.id if current_user.role == "recruiter" else None
    return await analytics_service.get_funnel(current_user.organization_id, job_id, db, user_id=user_id)


@router.get("/score-distribution")
async def score_distribution(current_user: RecruiterUser, db: DB):
    # Depending on preference, this could also be user-isolated. 
    # For now, let's keep it consistent with the overview.
    user_id = current_user.id if current_user.role == "recruiter" else None
    return await analytics_service.get_score_distribution(current_user.organization_id, db)


@router.get("/interviewer-performance")
async def interviewer_performance(current_user: RecruiterUser, db: DB):
    # Performance is usually an HR-wide report, keeping it org-wide unless requested.
    return await analytics_service.get_interviewer_performance(current_user.organization_id, db)
