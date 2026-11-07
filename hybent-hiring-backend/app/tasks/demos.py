"""Demo booking reminders (services/demo_service.py)."""
import logging

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async

logger = logging.getLogger(__name__)


async def _send_demo_reminders_async():
    from app.services.demo_service import send_reminders

    async with AsyncSessionLocal() as db:
        done = await send_reminders(db)
    if any(done.values()):
        logger.info(f"Demo reminders: {done}")
    return done


@celery_app.task
def send_demo_reminders():
    """Every 5 minutes: the 24-hour and 1-hour reminders, each sent once."""
    return run_async(_send_demo_reminders_async())
