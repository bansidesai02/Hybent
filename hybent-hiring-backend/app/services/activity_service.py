import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.services import impersonation
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

async def _alert_super_admins(db: AsyncSession, organization_id, action: str, resource_type: str) -> None:
    """Tell Hybent's team about client activity that matters. Never blocks the action."""
    from app.services.alert_catalog import ACTIVITY_ALERTS

    hit = ACTIVITY_ALERTS.get((action, resource_type)) or ACTIVITY_ALERTS.get((action, None))
    if not hit:
        return
    try:
        from app.models.organization import Organization
        from app.tasks.notifications import alert_super_admins

        name = await db.scalar(select(Organization.name).where(Organization.id == organization_id))
        alert_super_admins(hit[1], name or "A client", f"/hiring/super-admin/clients/{organization_id}",
                           event=hit[0], throttle=str(organization_id))
    except Exception as e:
        logger.warning(f"Could not alert super admins about {action}: {e}")


async def log_activity(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    broadcast: bool = True,
) -> AuditLog:
    """
    Logs an activity to the database and broadcasts it via WebSockets.

    Pass `broadcast=False` when the caller announces the change itself —
    the broadcast here goes out on flush, before the caller commits, and
    skips the acting user, which suits an interactive request but not a
    background job acting on someone's behalf.
    """
    support = impersonation.current()
    if support is not None:
        # A super admin acting through a support session, not the user.
        details = {**(details or {}), "impersonated_by": support.super_admin_email}
    if support is None:
        await _alert_super_admins(db, organization_id, action, resource_type)
    activity = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(activity)
    await db.flush()  # To get the ID and created_at
    
    # Refresh to ensure we have all fields for broadcasting
    await db.refresh(activity)

    if not broadcast:
        return activity

    # Broadcast to organization
    # For now, we'll broadcast to all connected users in the organization
    # In a real app, we might want to filter by permissions
    # Broadcast to organization for real-time UI updates (toasts and query refreshes)
    try:
        event_data = {
            "id": str(activity.id),
            "action": activity.action,
            "resource_type": activity.resource_type,
            "resource_id": activity.resource_id,
            "details": activity.details,
            "created_at": activity.created_at.isoformat(),
            "user_id": str(activity.user_id) if activity.user_id else None,
        }
        
        # Correctly broadcast to everyone in the organization via WebSocket
        # The frontend's useWebSocket hook listens for 'activity_created' to refresh lists.
        await ws_manager.broadcast_to_org(
            org_id=str(organization_id),
            event="activity_created",
            data=event_data,
            exclude_user_id=str(user_id) if user_id else None
        )
    except Exception as e:
        logger.error(f"Failed to broadcast activity: {e}")

    return activity
