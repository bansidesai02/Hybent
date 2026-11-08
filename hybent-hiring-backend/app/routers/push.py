"""Turning phone push on and off for the signed-in admin's current device."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select

from app.core.config import settings
from app.dependencies import DB, CurrentUser
from app.models.push import PushSubscription
from app.schemas.response import APIResponse
from app.services import push_service

router = APIRouter(prefix="/v1/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=10, max_length=255)
    auth: str = Field(..., min_length=8, max_length=255)


class SubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=2000, pattern=r"^https://")
    keys: SubscriptionKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., max_length=2000)


def _allowed(user) -> None:
    if user.role not in push_service.PUSH_ROLES:
        raise HTTPException(status_code=403, detail="Phone notifications are for admins.")
    if getattr(user, "is_impersonating", False):
        # A support session must not subscribe the super admin's phone to a client's alerts.
        raise HTTPException(status_code=403, detail="Not available during a support session.")


@router.get("/config")
async def push_config(current_user: CurrentUser, db: DB):
    """Whether push is available, the key a browser subscribes with, and how
    many of the caller's devices are on."""
    devices = await db.scalar(
        select(func.count(PushSubscription.id)).where(PushSubscription.user_id == current_user.id)
    ) or 0
    return APIResponse.success(data={
        "enabled": push_service.push_enabled() and current_user.role in push_service.PUSH_ROLES,
        "public_key": settings.vapid_public_key or None,
        "devices": devices,
        "events": (
            ["Free demo requests", "Your Hybent notifications"] if current_user.role == "super_admin"
            else ["All your Hybent notifications"]
        ),
    })


@router.post("/subscribe")
async def subscribe(payload: SubscribeRequest, current_user: CurrentUser, db: DB, request: Request):
    _allowed(current_user)
    if not push_service.push_enabled():
        raise HTTPException(status_code=503, detail="Phone notifications aren't configured on the server yet.")
    existing = await db.scalar(select(PushSubscription).where(
        PushSubscription.endpoint == payload.endpoint, PushSubscription.user_id == current_user.id,
    ))
    if existing:
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
    else:
        db.add(PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=(request.headers.get("user-agent") or "")[:500] or None,
            created_at=datetime.now(timezone.utc),
        ))
    await db.commit()
    return APIResponse.success(message="Phone notifications are on for this device.")


@router.post("/check")
async def check_device(payload: UnsubscribeRequest, current_user: CurrentUser, db: DB):
    """Whether this browser's subscription is turned on for the signed-in
    account. One phone can serve several accounts, so it can be on in the
    browser (for another account) but not yet for this one."""
    mine = await db.scalar(select(func.count(PushSubscription.id)).where(
        PushSubscription.endpoint == payload.endpoint, PushSubscription.user_id == current_user.id,
    ))
    return APIResponse.success(data={"mine": bool(mine)})


@router.post("/unsubscribe")
async def unsubscribe(payload: UnsubscribeRequest, current_user: CurrentUser, db: DB):
    await db.execute(delete(PushSubscription).where(
        PushSubscription.endpoint == payload.endpoint, PushSubscription.user_id == current_user.id,
    ))
    await db.commit()
    return APIResponse.success(message="Phone notifications are off for this device.")


@router.post("/test")
async def send_test(current_user: CurrentUser, db: DB):
    """Send a test notification to the caller's own devices."""
    _allowed(current_user)
    result = await push_service.send_to_users(db, [current_user.id], {
        "title": "Hybent notifications are on",
        "body": "You'll get your Hybent notifications here, like this one.",
        "url": "/hiring/super-admin/demo-requests" if current_user.role == "super_admin" else "/hiring/admin",
        "tag": "hybent-test",
    })
    if not result["devices"]:
        raise HTTPException(status_code=404, detail="No device is turned on for your account yet.")
    if not result["delivered"]:
        raise HTTPException(
            status_code=502,
            detail="The phone's push service refused the notification: "
                   + "; ".join(e for e in result["errors"] if e)[:300]
                   if result["errors"] else "This device is no longer registered. Turn it on again.",
        )
    message = f"Sent to {result['delivered']} of {result['devices']} device(s). It can take a few seconds to show."
    return APIResponse.success(message=message, data={"message": message, **result})
