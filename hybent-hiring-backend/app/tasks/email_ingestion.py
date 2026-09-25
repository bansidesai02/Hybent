import logging

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async
from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountStatus
from app.services.email_ingestion_service import EmailApplicationIngestionService, MemoryPause

logger = logging.getLogger(__name__)


async def _process_email_ingestion_async():
    async with AsyncSessionLocal() as db:
        # Every connected Gmail mailbox, org-shared or personal, regardless
        # of is_default — unlike sync_all_inboxes (which only backs the
        # Inbox UI and is scoped to an org's default + each recruiter's
        # personal account), resume ingestion must cover every mailbox an
        # org has connected. is_default is about which mailbox is the org's
        # primary for admin/send purposes, not about which ones can receive
        # applications.
        result = await db.execute(
            select(EmailAccount).where(
                EmailAccount.provider == EmailAccountProvider.GMAIL,
                EmailAccount.status == EmailAccountStatus.CONNECTED,
            )
        )
        accounts = result.scalars().all()
        ingestion_service = EmailApplicationIngestionService(db)

        totals = {"created": 0, "matched_existing": 0, "skipped": 0, "failed": 0}
        for account in accounts:
            try:
                counts = await ingestion_service.process_account(account)
                for key, value in counts.items():
                    totals[key] = totals.get(key, 0) + value
            except MemoryPause as e:
                # Memory is running high: end this run here so the worker can
                # be recycled; the paused message continues on the next run.
                totals["paused"] = totals.get("paused", 0) + 1
                logger.warning(f"Email ingestion paused to free memory ({e}); remaining work continues next run")
                break
            except Exception as e:
                logger.warning(f"Email ingestion failed for account {account.email_address}: {e}")

        if accounts:
            logger.info(f"Email ingestion: {totals} across {len(accounts)} account(s)")


@celery_app.task
def process_email_ingestion():
    """Periodic task: turns inbound email attachments on every connected
    mailbox into candidates awaiting review. Syncs each account's own
    message metadata itself (see EmailApplicationIngestionService.process_account)
    rather than depending on sync_all_inboxes's narrower account set."""
    run_async(_process_email_ingestion_async())
