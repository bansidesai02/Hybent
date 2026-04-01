import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from jose import JWTError
from sqlalchemy import select
from app.dependencies import DB, CurrentUser
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.utils.security import decode_access_token
from app.websocket.manager import ws_manager
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time notifications.
    Connect: ws://localhost:8000/v1/notifications/ws?token=ACCESS_TOKEN
    """
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        org_id = payload.get("org")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception as e:
        # Handle expired or invalid tokens gracefully
        await websocket.close(code=4001, reason=str(e))
        return

    await ws_manager.connect(websocket, user_id, org_id)
    # Send a welcome message
    await ws_manager.send_to_user(user_id, "connected", {"message": "Connected to HireOn notifications"})

    try:
        while True:
            # Keep connection alive; handle ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


@router.get("", response_model=list[NotificationOut])
async def list_notifications(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return APIResponse.success(message="Notifications retrieved.", data=[NotificationOut.model_validate(n) for n in result.scalars().all()])


@router.get("/unread-count")
async def unread_count(current_user: CurrentUser, db: DB):
    from sqlalchemy import func
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
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

