import uuid

from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.email_message import EmailMessage
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
