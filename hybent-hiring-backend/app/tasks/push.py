"""Celery task: deliver an event's phone push to whoever should get it."""
import logging

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async

logger = logging.getLogger(__name__)


async def _send(kind: str, payload: dict, organization_id: str | None) -> int:
    from app.services import push_service

    async with AsyncSessionLocal() as db:
        users = await push_service.recipients_for(db, kind, organization_id)
        return await push_service.send_to_users(db, users, payload)


@celery_app.task(ignore_result=True)
def send_event_push(kind: str, payload: dict, organization_id: str | None = None):
    try:
        reached = run_async(_send(kind, payload, organization_id))
        logger.info("[push] %s pushed to %s device(s)", kind, reached)
    except Exception as exc:
        # A missed push never affects the application or the demo request itself.
        logger.error("[push] %s push failed: %s", kind, exc, exc_info=True)
