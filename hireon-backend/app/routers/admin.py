"""
Admin-only endpoints: audit logs, org settings, team management.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Query
from sqlalchemy import select, func, or_
from app.dependencies import DB, AdminUser
from app.models.audit_log import AuditLog
from app.models.user import User
from app.utils.pagination import paginate
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/audit-logs")
async def list_audit_logs(
    current_user: AdminUser,
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    resource_type: str | None = None,
    search: str | None = None,      # filter by user name (partial, case-insensitive)
    date_from: str | None = None,   # ISO date e.g. 2025-01-01
    date_to: str | None = None,     # ISO date e.g. 2025-12-31
):
    # Base query joining User so we can filter by user name
    query = (
        select(AuditLog, User.full_name.label("user_name"), User.role.label("user_role"))
        .outerjoin(User, AuditLog.user_id == User.id)
        .where(AuditLog.organization_id == current_user.organization_id)
    )

    if action:
        query = query.where(AuditLog.action == action.upper())
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%"))
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.where(AuditLog.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            # Include the full end date by going to end of day
            from datetime import timedelta
            dt_to = dt_to + timedelta(days=1)
            query = query.where(AuditLog.created_at < dt_to)
        except ValueError:
            pass

    query = query.order_by(AuditLog.created_at.desc())

    # Count total for pagination
    count_query = select(func.count()).select_from(
        select(AuditLog)
        .outerjoin(User, AuditLog.user_id == User.id)
        .where(AuditLog.organization_id == current_user.organization_id)
        .where(*([AuditLog.action == action.upper()] if action else []))
        .where(*([AuditLog.resource_type == resource_type] if resource_type else []))
        .where(*([User.full_name.ilike(f"%{search}%")] if search else []))
        .subquery()
    )
    total = (await db.execute(count_query)).scalar()

    rows = (await db.execute(query.offset((page - 1) * limit).limit(limit))).all()

    return APIResponse.success(message="Audit logs retrieved successfully.", data=paginate([
        {
            "id": str(row.AuditLog.id),
            "action": row.AuditLog.action,
            "resource_type": row.AuditLog.resource_type,
            "resource_id": row.AuditLog.resource_id,
            "user_id": str(row.AuditLog.user_id) if row.AuditLog.user_id else None,
            "user_name": row.user_name,
            "user_role": row.user_role,
            "details": row.AuditLog.details,
            "ip_address": row.AuditLog.ip_address,
            "created_at": row.AuditLog.created_at.isoformat(),
        }
        for row in rows
    ], total, page, limit))


@router.get("/stats")
async def org_stats(current_user: AdminUser, db: DB):
    """Admin dashboard stats."""
    total_users = (await db.execute(
        select(func.count(User.id)).where(User.organization_id == current_user.organization_id)
    )).scalar()
    active_users = (await db.execute(
        select(func.count(User.id)).where(
            User.organization_id == current_user.organization_id,
            User.is_active == True,
        )
    )).scalar()
    return APIResponse.success(message="Stats retrieved successfully.", data={"total_users": total_users, "active_users": active_users})
