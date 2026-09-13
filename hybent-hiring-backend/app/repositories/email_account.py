import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.email_account import EmailAccount, EmailAccountStatus
from app.repositories.base import BaseRepository


class EmailAccountRepository(BaseRepository[EmailAccount]):
    def __init__(self, db: AsyncSession):
        super().__init__(EmailAccount, db)

    async def get_all_for_org(self, organization_id: uuid.UUID) -> list[EmailAccount]:
        result = await self.db.execute(
            select(EmailAccount)
            .where(EmailAccount.organization_id == organization_id)
            .order_by(EmailAccount.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_by_id_and_org(self, id: uuid.UUID, organization_id: uuid.UUID) -> EmailAccount | None:
        result = await self.db.execute(
            select(EmailAccount).where(
                EmailAccount.id == id,
                EmailAccount.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_org_and_address(self, organization_id: uuid.UUID, email_address: str) -> EmailAccount | None:
        result = await self.db.execute(
            select(EmailAccount).where(
                EmailAccount.organization_id == organization_id,
                EmailAccount.email_address == email_address,
            )
        )
        return result.scalar_one_or_none()

    async def get_default_for_org(self, organization_id: uuid.UUID) -> EmailAccount | None:
        result = await self.db.execute(
            select(EmailAccount).where(
                EmailAccount.organization_id == organization_id,
                EmailAccount.is_default == True,  # noqa: E712
                EmailAccount.status == EmailAccountStatus.CONNECTED,
            )
        )
        return result.scalar_one_or_none()

    async def get_for_health_check(self) -> list[EmailAccount]:
        """Every non-disconnected, implemented-provider account across all orgs —
        used by the periodic health/token-refresh sweep, not by any API endpoint."""
        result = await self.db.execute(
            select(EmailAccount).where(
                EmailAccount.status.in_([EmailAccountStatus.CONNECTED, EmailAccountStatus.ERROR]),
                EmailAccount.provider != "outlook",
            )
        )
        return list(result.scalars().all())

    async def unset_other_defaults(self, organization_id: uuid.UUID, except_id: uuid.UUID) -> None:
        """Clear is_default on every other account in the org, so only one stays default."""
        accounts = await self.get_all_for_org(organization_id)
        changed = False
        for account in accounts:
            if account.id != except_id and account.is_default:
                account.is_default = False
                self.db.add(account)
                changed = True
        if changed:
            await self.db.commit()
