import logging

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async
from app.repositories.email_account import EmailAccountRepository
from app.services.email_accounts_service import EmailAccountsService

logger = logging.getLogger(__name__)


async def _check_email_accounts_health_async():
    async with AsyncSessionLocal() as db:
        repo = EmailAccountRepository(db)
        service = EmailAccountsService(db)
        accounts = await repo.get_for_health_check()

        healthy = 0
        needs_reconnect = 0
        for account in accounts:
            if await service.check_health(account):
                healthy += 1
            else:
                needs_reconnect += 1
                logger.warning(
                    f"Email account {account.email_address} (org {account.organization_id}) "
                    f"needs reconnecting: {account.last_error}"
                )

        if accounts:
            logger.info(
                f"Email account health check: {healthy} healthy, {needs_reconnect} need reconnect "
                f"(of {len(accounts)} checked)"
            )


@celery_app.task
def check_email_accounts_health():
    """
    Periodic task: proactively refreshes each connected Gmail account's access
    token and re-verifies each SMTP login, before either would otherwise only
    be discovered as broken on the next real send. Flags failures as
    'reauth_required' so the UI's "Needs reconnect" badge stays accurate.
    """
    run_async(_check_email_accounts_health_async())
