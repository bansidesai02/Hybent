from fastapi import APIRouter, Query
from sqlalchemy import select, desc
from app.dependencies import DB, CurrentUser
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/v1/activities", tags=["activities"])

# Only HR-relevant resource types shown on HR dashboard
HR_RESOURCE_TYPES = {"job", "candidate", "interview", "offer", "application"}

@router.get("")
async def list_activities(
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(20, gt=0, le=100)
):
    """Recent HR-related activities for the organisation (excludes admin/auth events)."""
    # Base query: filter by organization and HR resource types
    query = (
        select(AuditLog, User.full_name.label("user_name"))
        .outerjoin(User, AuditLog.user_id == User.id)
        .where(
            AuditLog.organization_id == current_user.organization_id,
            AuditLog.resource_type.in_(HR_RESOURCE_TYPES),
        )
    )

    # STRICT ISOLATION: Recruiters only see their own activity
    # Admins see everything in the organization
    if current_user.role == "recruiter":
        query = query.where(AuditLog.user_id == current_user.id)

    result = await db.execute(
        query.order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    
    activities = result.all()

    return [
        {
            "id": str(a.AuditLog.id),
            "action": a.AuditLog.action,
            "resource_type": a.AuditLog.resource_type,
            "resource_id": a.AuditLog.resource_id,
            "details": a.AuditLog.details,
            "created_at": a.AuditLog.created_at.isoformat(),
            "user_id": str(a.AuditLog.user_id) if a.AuditLog.user_id else None,
            "user_name": a.user_name,
        }
        for a in activities
    ]
