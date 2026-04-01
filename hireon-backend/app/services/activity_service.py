import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

async def log_activity(
    db: AsyncSession,
    organization_id: uuid.UUID,
    user_id: uuid.UUID | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None
) -> AuditLog:
    """
    Logs an activity to the database and broadcasts it via WebSockets.
    """
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
