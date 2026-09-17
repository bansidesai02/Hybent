"""
Inbox sync/read for a connected mailbox. Gmail-only for now — SMTP has no
read protocol (it's send-only), and Outlook inbox reading isn't built yet.
Message bodies are never stored: sync keeps metadata only, and the full body
is fetched live from Gmail when a message is opened.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

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

    async def list_messages(self, email_account_id: uuid.UUID, limit: int = 50, offset: int = 0) -> list[EmailMessage]:
        return await self.repo.list_for_account(email_account_id, limit=limit, offset=offset)

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
