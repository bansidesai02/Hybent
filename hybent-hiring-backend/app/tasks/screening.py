"""Celery task for the Candidate Screening Agent (app/services/agents/screening)."""
import logging

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import run_async

logger = logging.getLogger(__name__)


async def _screen_async(candidate_id: str, organization_id: str):
    from app.services.agents.checkpointer import init_checkpointer
    from app.services.agents.screening.service import screen_candidate

    # The worker reuses one event loop (run_async), so the checkpointer's
    # connection pool is opened once per worker process and kept.
    from app.core.database import AsyncSessionLocal
    from app.services.feature_flags import is_enabled

    # The super admin's "AI scoring" switch for this client.
    async with AsyncSessionLocal() as db:
        if not await is_enabled(db, organization_id, "ai"):
            logger.info("AI scoring is off for organization %s; candidate %s not screened", organization_id, candidate_id)
            return None

    await init_checkpointer()
    return await screen_candidate(candidate_id, organization_id)


@celery_app.task(ignore_result=True)
def screen_candidate_task(candidate_id: str, organization_id: str):
    try:
        run_async(_screen_async(candidate_id, organization_id))
    except Exception as exc:
        # Screening is a convenience: a failure leaves the candidate in the
        # normal review queue, exactly as before the agent existed.
        logger.error("Screening agent failed for candidate %s: %s", candidate_id, exc, exc_info=True)


def enqueue_screening(candidate_ids, organization_id) -> None:
    """Queue screening for new candidates. Call only after they're committed.
    Never raises: intake must not fail because Redis or the flag is off."""
    try:
        if not settings.screening_agent_enabled_for(organization_id):
            return
        for cid in candidate_ids or []:
            if cid:
                screen_candidate_task.delay(str(cid), str(organization_id))
    except Exception as exc:
        logger.warning("Could not queue candidate screening: %s", exc)
