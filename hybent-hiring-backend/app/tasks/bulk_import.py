"""Celery task: parse the resumes of a bulk resume import (services/bulk_resume_import.py)."""
import logging

from app.core.celery_app import celery_app
from app.core.database import run_async

logger = logging.getLogger(__name__)


async def run_resume_import(batch_id: str) -> None:
    from app.core.database import AsyncSessionLocal
    from app.services.bulk_resume_import import process_batch

    async with AsyncSessionLocal() as db:
        await process_batch(db, batch_id)


@celery_app.task(ignore_result=True, acks_late=True)
def process_resume_import(batch_id: str):
    try:
        run_async(run_resume_import(batch_id))
    except Exception as exc:
        logger.error("Bulk resume import %s failed: %s", batch_id, exc, exc_info=True)
