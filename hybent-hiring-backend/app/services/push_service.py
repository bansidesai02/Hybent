"""
Phone push notifications for admins (standard Web Push with VAPID keys).

Deliberately narrow, after the old Firebase push was removed for being noisy:
- a device only receives push after an admin taps "Turn on" on it
  (POST /v1/push/subscribe); nothing ever asks for permission on its own;
- only two events push: a candidate applying through a public link
  (to that organization's admins) and a free demo request (to super admins).

Push is off unless VAPID keys are configured. Generate a pair with
`python -m app.services.push_service` and set VAPID_PUBLIC_KEY /
VAPID_PRIVATE_KEY.
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)

# Roles that may turn push on, and who receives each event.
PUSH_ROLES = {"admin", "super_admin"}


def push_enabled() -> bool:
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def _send_one(sub, payload: dict) -> tuple[str, str | None]:
    """Deliver to one device: ("ok", None), ("gone", status) when the push
    service says the device no longer exists, or ("failed", reason)."""
    from pywebpush import WebPushException, webpush

    try:
        resp = webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=24 * 3600,
            timeout=10,
        )
        status = getattr(resp, "status_code", 201)
        if 200 <= status < 300:
            return "ok", None
        return "failed", f"push service answered {status}"
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return "gone", str(status)
        body = (getattr(e.response, "text", "") or "")[:200]
        logger.warning("[push] delivery failed (%s): %s %s", status, e, body)
        return "failed", f"push service answered {status}: {body or e}"
    except Exception as e:  # network trouble etc.: try again next event
        logger.warning("[push] delivery failed: %s", e)
        return "failed", str(e)[:200]


async def send_to_users(db: AsyncSession, user_ids: list[uuid.UUID], payload: dict) -> dict:
    """Push `payload` ({title, body, url, tag}) to every device of these users.
    Devices the push service says are gone are removed.
    Returns {"devices", "delivered", "errors"}."""
    from app.models.push import PushSubscription

    result = {"devices": 0, "delivered": 0, "errors": []}
    if not push_enabled() or not user_ids:
        return result
    subs = (await db.execute(
        select(PushSubscription).where(PushSubscription.user_id.in_(user_ids))
    )).scalars().all()
    result["devices"] = len(subs)
    if not subs:
        return result

    outcomes = await asyncio.gather(*(asyncio.to_thread(_send_one, s, payload) for s in subs))
    now = datetime.now(timezone.utc)
    gone = []
    for s, (state, detail) in zip(subs, outcomes):
        if state == "ok":
            s.last_sent_at = now
            result["delivered"] += 1
        elif state == "gone":
            gone.append(s.id)
        else:
            result["errors"].append(detail)
    if gone:
        await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(gone)))
    await db.commit()
    return result


async def recipients_for(db: AsyncSession, kind: str, organization_id: str | None) -> list[uuid.UUID]:
    from app.models.user import User

    if kind == "application" and organization_id:
        query = select(User.id).where(
            User.organization_id == uuid.UUID(str(organization_id)), User.role == "admin", User.is_active == True,  # noqa: E712
        )
    elif kind == "demo_request":
        query = select(User.id).where(User.role == "super_admin", User.is_active == True)  # noqa: E712
    else:
        return []
    return list((await db.execute(query)).scalars().all())


def queue_push(kind: str, payload: dict, organization_id: str | None = None) -> None:
    """Hand an event to the worker. Never raises: a public form must not fail
    because Redis is down or push isn't configured."""
    if not push_enabled():
        return
    try:
        from app.tasks.push import send_event_push
        send_event_push.delay(kind, payload, str(organization_id) if organization_id else None)
    except Exception as e:
        logger.warning("[push] could not queue %s push: %s", kind, e)


if __name__ == "__main__":
    # Print a fresh VAPID key pair for .env.
    import base64

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    key = ec.generate_private_key(ec.SECP256R1())
    private = base64.urlsafe_b64encode(
        key.private_numbers().private_value.to_bytes(32, "big")
    ).rstrip(b"=").decode()
    public = base64.urlsafe_b64encode(
        key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    ).rstrip(b"=").decode()
    print(f"VAPID_PUBLIC_KEY={public}\nVAPID_PRIVATE_KEY={private}")
