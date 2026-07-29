import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlalchemy import select
from app.dependencies import DB, CurrentUser
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.utils.security import decode_access_token
from app.websocket.manager import ws_manager
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time notifications.
    Connect: ws://localhost:8000/v1/notifications/ws?token=ACCESS_TOKEN
    """
    await websocket.accept() # Accept the connection first to avoid 403 handshake rejections
    
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        org_id = payload.get("org")
        if not user_id:
            logger.error(f"[WS] No 'sub' in token: {token[:15]}...")
            await websocket.send_json({"type": "error", "message": "unauthorized"})
            await websocket.close(code=4001)
            return
    except Exception as e:
        logger.error(f"[WS] Token validation failed: {str(e)}")
        # Send an error event before closing so the client knows WHY it's closing
        try:
            await websocket.send_json({"type": "error", "message": "unauthorized", "detail": str(e)})
            await websocket.close(code=4001)
        except Exception:
            pass
        return

    # Now that we're verified, connect to the manager
    # We call connect with accept=False since we already accepted
    if user_id not in ws_manager._connections:
        ws_manager._connections[user_id] = []
    ws_manager._connections[user_id].append(websocket)
    if org_id:
        ws_manager._user_orgs[user_id] = org_id
    
    # Send a welcome message
    await ws_manager.send_to_user(user_id, "connected", {"message": "Connected to Hybent Hiring notifications"})

    try:
        while True:
            # Keep connection alive; handle ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


@router.get("", response_model=list[NotificationOut])
async def list_notifications(current_user: CurrentUser, db: DB, unread_only: bool = False):
    query = (
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            # profile_viewed notifications are hidden from candidates
            Notification.type != "profile_viewed",
        )
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)
    result = await db.execute(query)
    return APIResponse.success(message="Notifications retrieved.", data=[NotificationOut.model_validate(n) for n in result.scalars().all()])


@router.get("/unread-count")
async def unread_count(current_user: CurrentUser, db: DB):
    from sqlalchemy import func
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            # profile_viewed notifications are excluded from the unread badge count
            Notification.type != "profile_viewed",
        )
    )).scalar()
    return APIResponse.success(message="Unread count retrieved.", data={"count": count})


@router.post("/{notification_id}/read")
async def mark_read(notification_id: uuid.UUID, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    return APIResponse.success(message="Marked as read.")


@router.post("/read-all")
async def mark_all_read(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    for notif in result.scalars().all():
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    return APIResponse.success(message="All notifications marked as read.")


@router.post("/fcm-token")
async def save_fcm_token(current_user: CurrentUser, db: DB, payload: dict):
    """Save the browser's FCM registration token for the current user."""
    token = payload.get("token", "").strip()
    if not token:
        raise HTTPException(status_code=422, detail="token is required")

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user:
        user.fcm_token = token
        await db.commit()

    return APIResponse.success(message="FCM token saved.")


@router.delete("/{notification_id}")
async def delete_notification(notification_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Permanently dismiss/delete a notification for the current user."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(notif)
    await db.commit()
    return APIResponse.success(message="Notification deleted.")

