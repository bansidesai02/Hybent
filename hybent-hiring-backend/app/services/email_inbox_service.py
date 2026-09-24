"""
Inbox sync/read for a connected mailbox. Gmail-only for now — SMTP has no
read protocol (it's send-only), and Outlook inbox reading isn't built yet.
Message bodies are never stored: sync keeps metadata only, and the full body
is fetched live from Gmail when a message is opened.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.email_account import EmailAccount, EmailAccountProvider
from app.models.email_message import EmailMessage
from app.repositories.email_message import EmailMessageRepository
from app.services.email_providers import gmail_provider

logger = logging.getLogger(__name__)


def _supports_inbox(account: EmailAccount) -> bool:
    return account.provider == EmailAccountProvider.GMAIL


class EmailInboxService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EmailMessageRepository(db)

    async def sync_account(self, account: EmailAccount) -> int:
        """Fetch recent inbox metadata and store anything not already synced.
        Returns how many new messages were added."""
        if not _supports_inbox(account):
            return 0

        messages = gmail_provider.list_recent_messages(account, max_results=30)
        new_count = 0
        for msg in messages:
            existing = await self.repo.get_by_provider_id(account.id, msg["provider_message_id"])
            if existing is not None:
                continue
            received_at = (
                datetime.fromtimestamp(msg["received_at_ms"] / 1000, tz=timezone.utc)
                if msg.get("received_at_ms")
                else None
            )
            email_message = EmailMessage(
                organization_id=account.organization_id,
                email_account_id=account.id,
                provider_message_id=msg["provider_message_id"],
                thread_id=msg.get("thread_id"),
                from_address=msg.get("from_address"),
                from_name=msg.get("from_name"),
                to_address=msg.get("to_address"),
                subject=msg.get("subject"),
                snippet=msg.get("snippet"),
                received_at=received_at,
            )
            self.db.add(email_message)
            new_count += 1
        if new_count:
            await self.db.commit()
        return new_count

    async def list_messages(
        self, email_account_id: uuid.UUID, limit: int = 50, offset: int = 0, resumes_only: bool = False
    ) -> list[EmailMessage]:
        return await self.repo.list_for_account(
            email_account_id, limit=limit, offset=offset, resumes_only=resumes_only
        )

    async def get_message_detail(self, account: EmailAccount, message_id: uuid.UUID) -> tuple[EmailMessage, dict]:
        message = await self.repo.get_by_id_and_account(message_id, account.id)
        if message is None:
            raise ValueError("Message not found")
        if not _supports_inbox(account):
            raise ValueError("Reading full message bodies is only available for Gmail-connected accounts")

        body = gmail_provider.get_message_full(account, message.provider_message_id)
        if not message.is_read:
            message.is_read = True
            self.db.add(message)
            await self.db.commit()
            await self.db.refresh(message)
        return message, body

    async def candidates_for_messages(self, messages: list[EmailMessage]) -> dict[uuid.UUID, list[Candidate]]:
        """Candidates each message produced — every one created from its
        attachments, plus the existing candidate a duplicate was matched to."""
        if not messages:
            return {}
        by_message: dict[uuid.UUID, list[Candidate]] = {m.id: [] for m in messages}
        result = await self.db.execute(
            select(Candidate)
            .where(Candidate.source_email_message_id.in_(list(by_message)))
            .order_by(Candidate.created_at)
        )
        for candidate in result.scalars().all():
            by_message[candidate.source_email_message_id].append(candidate)

        matched_ids = {
            m.ingestion_result_candidate_id
            for m in messages
            if m.ingestion_result_candidate_id
            and not any(c.id == m.ingestion_result_candidate_id for c in by_message[m.id])
        }
        if matched_ids:
            matched = {
                c.id: c
                for c in (await self.db.execute(select(Candidate).where(Candidate.id.in_(matched_ids)))).scalars()
            }
            for m in messages:
                c = matched.get(m.ingestion_result_candidate_id)
                if c:
                    by_message[m.id].append(c)
        return by_message

    async def get_attachment(self, account: EmailAccount, message_id: uuid.UUID, index: int) -> tuple[dict, bytes]:
        message = await self.repo.get_by_id_and_account(message_id, account.id)
        if message is None:
            raise ValueError("Message not found")
        if not _supports_inbox(account):
            raise ValueError("Attachments are only available for Gmail-connected accounts")
        full = gmail_provider.get_message_full(account, message.provider_message_id)
        attachments = full.get("attachments") or []
        if not 0 <= index < len(attachments):
            raise ValueError("Attachment not found")
        attachment = attachments[index]
        return attachment, gmail_provider.get_attachment_content(account, message.provider_message_id, attachment)
