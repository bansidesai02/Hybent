import logging

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async
from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountStatus
from app.services.email_inbox_service import EmailInboxService

logger = logging.getLogger(__name__)


async def _sync_all_inboxes_async():
    async with AsyncSessionLocal() as db:
        # Every connected Gmail mailbox is its owner's inbox — an admin can
        # switch between all of theirs, not just the primary.
        result = await db.execute(
            select(EmailAccount).where(
                EmailAccount.provider == EmailAccountProvider.GMAIL,
                EmailAccount.status == EmailAccountStatus.CONNECTED,
            )
        )
        accounts = result.scalars().all()
        inbox_service = EmailInboxService(db)

        total_new = 0
        for account in accounts:
            try:
                total_new += await inbox_service.sync_account(account)
            except Exception as e:
                logger.warning(f"Inbox sync failed for {account.email_address}: {e}")

        if accounts:
            logger.info(f"Inbox sync: {total_new} new message(s) across {len(accounts)} account(s)")


@celery_app.task
def sync_all_inboxes():
    """Periodic task: pulls new mail into the DB for every account that backs
    someone's inbox view, so opening the Inbox page doesn't have to sync live."""
    run_async(_sync_all_inboxes_async())
