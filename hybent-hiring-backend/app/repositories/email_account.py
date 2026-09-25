import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.email_account import EmailAccount, EmailAccountScope, EmailAccountStatus
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

    async def get_all_for_owner(self, organization_id: uuid.UUID, user_id: uuid.UUID) -> list[EmailAccount]:
        """Every mailbox this user connected, in any status — the only ones
        they may see or manage."""
        result = await self.db.execute(
            select(EmailAccount)
            .where(
                EmailAccount.organization_id == organization_id,
                EmailAccount.connected_by_user_id == user_id,
            )
            .order_by(EmailAccount.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_primary_for_owner(self, organization_id: uuid.UUID, user_id: uuid.UUID) -> EmailAccount | None:
        """The owner's connected primary; failing that, their earliest
        connected mailbox (e.g. the primary was disconnected by a health
        check). None when they have nothing connected."""
        connected = [
            a for a in await self.get_all_for_owner(organization_id, user_id)
            if a.status == EmailAccountStatus.CONNECTED
        ]
        return next((a for a in connected if a.is_default), connected[0] if connected else None)

    async def get_personal_account(self, organization_id: uuid.UUID, user_id: uuid.UUID) -> EmailAccount | None:
        """A recruiter's own mailbox — at most one ever exists per (org, user)."""
        result = await self.db.execute(
            select(EmailAccount).where(
                EmailAccount.organization_id == organization_id,
                EmailAccount.connected_by_user_id == user_id,
                EmailAccount.scope == EmailAccountScope.PERSONAL,
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

    async def unset_other_defaults(
        self, organization_id: uuid.UUID, owner_id: uuid.UUID | None, except_id: uuid.UUID | None
    ) -> None:
        """Clear is_default on the owner's other mailboxes, so they keep one
        primary. Scoped to the owner — another member's primary is untouched."""
        if owner_id is None:
            return
        changed = False
        for account in await self.get_all_for_owner(organization_id, owner_id):
            if account.id != except_id and account.is_default:
                account.is_default = False
                self.db.add(account)
                changed = True
        if changed:
            # Flushed, not committed: the caller sets the new primary in the
            # same transaction, and the one-primary-per-owner index must see
            # the old flag cleared first.
            await self.db.flush()
