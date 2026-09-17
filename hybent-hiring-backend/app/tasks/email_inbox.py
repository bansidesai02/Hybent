import logging

from sqlalchemy import or_, select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async
from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope, EmailAccountStatus
from app.services.email_inbox_service import EmailInboxService

logger = logging.getLogger(__name__)


async def _sync_all_inboxes_async():
    async with AsyncSessionLocal() as db:
        # Only the accounts that actually back someone's inbox view: an org's
        # primary (admin/super_admin) or a recruiter's personal mailbox.
        result = await db.execute(
            select(EmailAccount).where(
                EmailAccount.provider == EmailAccountProvider.GMAIL,
                EmailAccount.status == EmailAccountStatus.CONNECTED,
                or_(EmailAccount.is_default == True, EmailAccount.scope == EmailAccountScope.PERSONAL),  # noqa: E712
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
