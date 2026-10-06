import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async
from app.models.message import Message, MessageAttachment
from app.routers.chat import cleanup_stale_attachments
from app.services import chat_attachment_storage as storage

logger = logging.getLogger(__name__)

CHAT_RETENTION_DAYS = 90


async def _purge_old_chat_async():
    cutoff = datetime.now(timezone.utc) - timedelta(days=CHAT_RETENTION_DAYS)
    async with AsyncSessionLocal() as db:
        # Files first: the DB rows cascade away with their message, the
        # stored objects don't.
        paths = (await db.execute(
            select(MessageAttachment.storage_path)
            .join(Message, MessageAttachment.message_id == Message.id)
            .where(Message.created_at < cutoff)
        )).scalars().all()
        await storage.delete_chat_attachments(list(paths))

        result = await db.execute(delete(Message).where(Message.created_at < cutoff))
        await db.commit()
        if result.rowcount:
            logger.info("Chat retention: deleted %d messages, %d files", result.rowcount, len(paths))

        stale = await cleanup_stale_attachments(db)
        if stale:
            logger.info("Chat retention: deleted %d unsent uploads", stale)


@celery_app.task
def purge_old_chat():
    """Daily: drop chat messages (and their files) older than the retention window."""
    run_async(_purge_old_chat_async())
