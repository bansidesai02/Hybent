"""Free trial reminders, expiry and purge (services/trial_service.py)."""
import logging

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async

logger = logging.getLogger(__name__)


async def _process_trial_lifecycle_async():
    from app.services.trial_service import process_lifecycle

    async with AsyncSessionLocal() as db:
        done = await process_lifecycle(db)
    if any(done.values()):
        logger.info(f"Trial lifecycle: {done}")
    return done


@celery_app.task
def process_trial_lifecycle():
    """Every 5 minutes: the 1-day and 1-hour reminders, expiry, the purge
    warning and the purge. Access itself ends at trial_end on every request,
    so a late run only delays the emails."""
    return run_async(_process_trial_lifecycle_async())
