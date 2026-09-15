import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.email_message import EmailIngestionStatus, EmailMessage
from app.repositories.base import BaseRepository


class EmailMessageRepository(BaseRepository[EmailMessage]):
    def __init__(self, db: AsyncSession):
        super().__init__(EmailMessage, db)

    async def get_by_provider_id(self, email_account_id: uuid.UUID, provider_message_id: str) -> EmailMessage | None:
        result = await self.db.execute(
            select(EmailMessage).where(
                EmailMessage.email_account_id == email_account_id,
                EmailMessage.provider_message_id == provider_message_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_account(
        self, email_account_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> list[EmailMessage]:
        result = await self.db.execute(
            select(EmailMessage)
            .where(EmailMessage.email_account_id == email_account_id)
            .order_by(desc(EmailMessage.received_at))
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_by_id_and_account(self, message_id: uuid.UUID, email_account_id: uuid.UUID) -> EmailMessage | None:
        result = await self.db.execute(
            select(EmailMessage).where(
                EmailMessage.id == message_id,
                EmailMessage.email_account_id == email_account_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_unprocessed(self, email_account_id: uuid.UUID, limit: int = 25) -> list[EmailMessage]:
        """Messages on this account not yet through the auto-candidate-
        ingestion pass. Whether a message actually has an attachment worth
        acting on isn't known until its full body is fetched (Gmail's cheap
        metadata format doesn't expose attachment parts) — so this can't
        pre-filter on has_attachments; that column is set as a side effect of
        processing, for display purposes, not as a query filter here."""
        result = await self.db.execute(
            select(EmailMessage)
            .where(
                EmailMessage.email_account_id == email_account_id,
                EmailMessage.ingestion_status.is_(None),
            )
            .order_by(EmailMessage.received_at)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def claim_for_processing(self, message_id: uuid.UUID, stale_after_minutes: int = 15) -> bool:
        """Atomically claim a message for ingestion processing. Returns True if
        this call won the claim (status was NULL, or was "processing" but its
        lock is stale — e.g. a worker crashed mid-run). Safe against two
        overlapping ingestion runs picking up the same message."""
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after_minutes)
        result = await self.db.execute(
            update(EmailMessage)
            .where(
                EmailMessage.id == message_id,
                or_(
                    EmailMessage.ingestion_status.is_(None),
                    (EmailMessage.ingestion_status == EmailIngestionStatus.PROCESSING)
                    & (EmailMessage.ingestion_locked_at < stale_cutoff),
                ),
            )
            .values(ingestion_status=EmailIngestionStatus.PROCESSING, ingestion_locked_at=datetime.now(timezone.utc))
        )
        return result.rowcount > 0

    async def mark_result(
        self,
        message_id: uuid.UUID,
        status: str,
        candidate_id: uuid.UUID | None = None,
        error: str | None = None,
    ) -> None:
        await self.db.execute(
            update(EmailMessage)
            .where(EmailMessage.id == message_id)
            .values(
                ingestion_status=status,
                ingestion_result_candidate_id=candidate_id,
                ingestion_error=error,
                ingestion_processed_at=datetime.now(timezone.utc),
                ingestion_locked_at=None,
            )
        )
