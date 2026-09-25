import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.email_message import MAX_INGESTION_ATTEMPTS, EmailIngestionStatus, EmailMessage
from app.repositories.base import BaseRepository


RESUME_STATUSES = (EmailIngestionStatus.CREATED, EmailIngestionStatus.MATCHED_EXISTING)


def _claimable_status():
    """Not yet evaluated, or a transient failure with attempts left."""
    return or_(
        EmailMessage.ingestion_status.is_(None),
        (EmailMessage.ingestion_status == EmailIngestionStatus.RETRY_PENDING)
        & (EmailMessage.ingestion_attempts < MAX_INGESTION_ATTEMPTS),
    )


def _stale_processing(stale_cutoff: datetime):
    """"processing" with no live worker behind it: the lock is older than the
    cutoff, or missing altogether. A missing lock used to compare as NULL —
    neither stale nor fresh — so such a message was never selected nor
    claimed again and stayed "processing" forever."""
    return (EmailMessage.ingestion_status == EmailIngestionStatus.PROCESSING) & or_(
        EmailMessage.ingestion_locked_at.is_(None),
        EmailMessage.ingestion_locked_at < stale_cutoff,
    )


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
        self, email_account_id: uuid.UUID, limit: int = 50, offset: int = 0, resumes_only: bool = False
    ) -> list[EmailMessage]:
        query = select(EmailMessage).where(EmailMessage.email_account_id == email_account_id)
        if resumes_only:
            # Mail the ingestion pass turned into (or matched to) a candidate —
            # the rest of a mailbox is newsletters and alerts. Includes
            # messages still retrying some attachments (or that failed on the
            # rest) once they've produced a candidate: an email with 5 of 9
            # resumes done used to vanish from the Inbox while it retried.
            query = query.where(
                or_(
                    EmailMessage.ingestion_status.in_(RESUME_STATUSES),
                    EmailMessage.ingestion_result_candidate_id.is_not(None),
                )
            )
        result = await self.db.execute(
            query
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

    async def get_unprocessed(
        self, email_account_id: uuid.UUID, limit: int = 25, stale_after_minutes: int = 15
    ) -> list[EmailMessage]:
        """Messages on this account not yet through the auto-candidate-
        ingestion pass. Whether a message actually has an attachment worth
        acting on isn't known until its full body is fetched (Gmail's cheap
        metadata format doesn't expose attachment parts) — so this can't
        pre-filter on has_attachments; that column is set as a side effect of
        processing, for display purposes, not as a query filter here."""
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after_minutes)
        result = await self.db.execute(
            select(EmailMessage)
            .where(
                EmailMessage.email_account_id == email_account_id,
                or_(
                    _claimable_status(),
                    # A worker died mid-message (e.g. the container ran out of
                    # memory). claim_for_processing already reclaims these, but
                    # they were never *selected*, so the email stayed stuck in
                    # "processing" forever. Candidates it already made are
                    # skipped on resume (see _candidate_from_earlier_attempt).
                    _stale_processing(stale_cutoff),
                ),
            )
            .order_by(EmailMessage.received_at)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def status_counts(self, email_account_id: uuid.UUID) -> dict[str, int]:
        """How many of this mailbox's messages sit in each ingestion status —
        logged per run, so it's visible when an email isn't being evaluated
        because an earlier run already gave it a final status."""
        from sqlalchemy import func

        result = await self.db.execute(
            select(EmailMessage.ingestion_status, func.count())
            .where(EmailMessage.email_account_id == email_account_id)
            .group_by(EmailMessage.ingestion_status)
        )
        return {(status or "unprocessed"): count for status, count in result.all()}

    async def link_first_candidate(self, message_id: uuid.UUID, candidate_id: uuid.UUID) -> None:
        """Record the message's first candidate as soon as it exists — not
        only at the end — so the Inbox shows the email while its remaining
        attachments are still being processed (or if the worker dies)."""
        await self.db.execute(
            update(EmailMessage)
            .where(EmailMessage.id == message_id, EmailMessage.ingestion_result_candidate_id.is_(None))
            .values(ingestion_result_candidate_id=candidate_id)
        )

    async def pause_for_next_run(self, message_id: uuid.UUID, notes: str | None) -> None:
        """Hand a half-done message back for the next run without using up an
        attempt — a memory pause isn't a failure. Progress is kept: attachments
        already turned into candidates are skipped next time."""
        await self.db.execute(
            update(EmailMessage)
            .where(EmailMessage.id == message_id)
            .values(
                ingestion_status=None,
                ingestion_attempts=EmailMessage.ingestion_attempts - 1,
                ingestion_locked_at=None,
                ingestion_error=notes,
            )
        )

    async def claim_for_processing(self, message_id: uuid.UUID, stale_after_minutes: int = 15) -> bool:
        """Atomically claim a message for ingestion processing. Returns True if
        this call won the claim (status was NULL, a retry is pending, or was "processing" but its
        lock is stale — e.g. a worker crashed mid-run). Safe against two
        overlapping ingestion runs picking up the same message."""
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after_minutes)
        result = await self.db.execute(
            update(EmailMessage)
            .where(
                EmailMessage.id == message_id,
                or_(
                    _claimable_status(),
                    _stale_processing(stale_cutoff),
                ),
            )
            .values(
                ingestion_status=EmailIngestionStatus.PROCESSING,
                ingestion_locked_at=datetime.now(timezone.utc),
                ingestion_attempts=EmailMessage.ingestion_attempts + 1,
            )
        )
        return result.rowcount > 0

    async def mark_result(
        self,
        message_id: uuid.UUID,
        status: str,
        candidate_id: uuid.UUID | None = None,
        error: str | None = None,
    ) -> None:
        values = {
            "ingestion_status": status,
            "ingestion_error": error,
            "ingestion_processed_at": datetime.now(timezone.utc),
            "ingestion_locked_at": None,
        }
        # Only ever set, never cleared — a retry pass that creates nothing new
        # must not wipe the candidate an earlier pass already produced.
        if candidate_id is not None:
            values["ingestion_result_candidate_id"] = candidate_id
        await self.db.execute(update(EmailMessage).where(EmailMessage.id == message_id).values(**values))
