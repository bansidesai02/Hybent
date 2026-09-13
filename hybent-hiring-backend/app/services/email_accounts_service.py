"""
Orchestrates CRUD + connect/send for an organization's email accounts.
Encrypts secrets on write; never returns decrypted values to callers other
than the provider send() calls themselves.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope, EmailAccountStatus
from app.repositories.email_account import EmailAccountRepository
from app.schemas.email_account import EmailAccountCreateSMTP
from app.services.email_providers.base import EmailProvider
from app.services.email_providers.gmail_provider import GmailProvider
from app.services.email_providers.outlook_provider import OutlookProvider
from app.services.email_providers.smtp_provider import SMTPProvider
from app.utils import crypto
from app.utils.permissions import UserRole

_MANAGER_ROLES = {UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value}

logger = logging.getLogger(__name__)

_PROVIDERS: dict[str, EmailProvider] = {
    EmailAccountProvider.SMTP: SMTPProvider(),
    EmailAccountProvider.GMAIL: GmailProvider(),
    EmailAccountProvider.OUTLOOK: OutlookProvider(),
}


def get_provider(provider_name: str) -> EmailProvider:
    provider = _PROVIDERS.get(provider_name)
    if provider is None:
        raise ValueError(f"Unknown email provider: {provider_name}")
    return provider


class EmailAccountsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EmailAccountRepository(db)

    async def list_for_org(self, organization_id: uuid.UUID, user_id: uuid.UUID, role: str) -> list[EmailAccount]:
        """Every organization-shared account, plus the caller's own personal
        one if they have it — never another user's personal mailbox."""
        accounts = await self.repo.get_all_for_org(organization_id)
        return [
            a for a in accounts
            if a.scope == EmailAccountScope.ORGANIZATION or a.connected_by_user_id == user_id
        ]

    async def get_for_org(self, account_id: uuid.UUID, organization_id: uuid.UUID) -> EmailAccount | None:
        return await self.repo.get_by_id_and_org(account_id, organization_id)

    async def _find_existing_for_connect(
        self, organization_id: uuid.UUID, connected_by_user_id: uuid.UUID, email_address: str, scope: str
    ) -> EmailAccount | None:
        """A personal account is identified by (org, owner) — a recruiter has at
        most one, ever, and may swap its address on reconnect. An organization
        account is identified by its address, same as before."""
        if scope == EmailAccountScope.PERSONAL:
            existing = await self.repo.get_personal_account(organization_id, connected_by_user_id)
            if existing is not None and existing.status != EmailAccountStatus.DISCONNECTED:
                raise ValueError("You already have a personal mailbox connected — disconnect it first.")
        else:
            existing = await self.repo.get_by_org_and_address(organization_id, email_address)
            if existing is not None and existing.status != EmailAccountStatus.DISCONNECTED:
                raise ValueError(f"An account for {email_address} is already connected")

        # Regardless of scope, the address itself must not belong to a *different*,
        # still-active row (DB also enforces this — this just gives a clean error).
        address_owner = await self.repo.get_by_org_and_address(organization_id, email_address)
        if (
            address_owner is not None
            and (existing is None or address_owner.id != existing.id)
            and address_owner.status != EmailAccountStatus.DISCONNECTED
        ):
            raise ValueError(f"An account for {email_address} is already connected")

        return existing

    async def connect_smtp(
        self,
        organization_id: uuid.UUID,
        connected_by_user_id: uuid.UUID,
        payload: EmailAccountCreateSMTP,
        scope: str = EmailAccountScope.ORGANIZATION,
    ) -> EmailAccount:
        existing = await self._find_existing_for_connect(
            organization_id, connected_by_user_id, payload.email_address, scope
        )
        is_new = existing is None
        account = existing or EmailAccount(
            organization_id=organization_id,
            provider=EmailAccountProvider.SMTP,
            scope=scope,
        )
        account.email_address = payload.email_address
        account.connected_by_user_id = connected_by_user_id
        account.scope = scope
        account.display_name = payload.display_name
        account.smtp_host = payload.smtp_host
        account.smtp_port = payload.smtp_port
        account.smtp_username = payload.smtp_username
        account.smtp_password_encrypted = crypto.encrypt(payload.smtp_password)
        account.use_tls = payload.use_tls

        if is_new:
            account.is_default = (
                scope == EmailAccountScope.ORGANIZATION
                and await self.repo.count_organization_scoped(organization_id) == 0
            )

        # Verify the credentials actually work before persisting anything.
        try:
            get_provider(EmailAccountProvider.SMTP).send(
                account,
                to=payload.email_address,
                subject="Hybent Hiring — email account connected",
                html_body="<p>This mailbox is now connected to your organization on Hybent Hiring.</p>",
            )
        except Exception as e:
            logger.warning(f"SMTP account verification failed for {payload.email_address}: {e}")
            raise ValueError(f"Could not verify SMTP credentials: {e}") from e

        account.status = EmailAccountStatus.CONNECTED
        account.last_error = None
        account.last_synced_at = datetime.now(timezone.utc)

        if not is_new:
            return await self.repo.update(account, {})
        return await self.repo.create(account)

    async def upsert_gmail(
        self,
        organization_id: uuid.UUID,
        connected_by_user_id: uuid.UUID,
        email_address: str,
        refresh_token: str | None,
        access_token: str | None,
        scope: str = EmailAccountScope.ORGANIZATION,
    ) -> EmailAccount:
        existing = await self._find_existing_for_connect(organization_id, connected_by_user_id, email_address, scope)
        is_new = existing is None
        account = existing or EmailAccount(
            organization_id=organization_id,
            connected_by_user_id=connected_by_user_id,
            provider=EmailAccountProvider.GMAIL,
            scope=scope,
        )
        account.email_address = email_address
        account.connected_by_user_id = connected_by_user_id
        account.scope = scope

        if is_new:
            account.is_default = (
                scope == EmailAccountScope.ORGANIZATION
                and await self.repo.count_organization_scoped(organization_id) == 0
            )

        if refresh_token:
            account.refresh_token_encrypted = crypto.encrypt(refresh_token)
        account.status = EmailAccountStatus.CONNECTED
        account.last_error = None
        account.last_synced_at = datetime.now(timezone.utc)

        if not is_new:
            return await self.repo.update(account, {})
        return await self.repo.create(account)

    async def set_default(self, account_id: uuid.UUID, organization_id: uuid.UUID) -> EmailAccount:
        account = await self.repo.get_by_id_and_org(account_id, organization_id)
        if account is None:
            raise ValueError("Email account not found")
        if account.scope != EmailAccountScope.ORGANIZATION:
            raise ValueError("Only organization-shared accounts can be set as default")
        await self.repo.unset_other_defaults(organization_id, except_id=account_id)
        account.is_default = True
        return await self.repo.update(account, {"is_default": True})

    def can_manage(self, account: EmailAccount, user_id: uuid.UUID, role: str) -> bool:
        """Admins/super admins manage any org-scoped account; a recruiter may
        only ever manage their own personal one."""
        if role in _MANAGER_ROLES:
            return True
        return account.scope == EmailAccountScope.PERSONAL and account.connected_by_user_id == user_id

    async def get_inbox_account(self, organization_id: uuid.UUID, user_id: uuid.UUID, role: str) -> EmailAccount | None:
        """Which account's inbox this user sees: admins/super admins get the
        org's primary (shared) mailbox; a recruiter gets their own personal one."""
        if role in _MANAGER_ROLES:
            return await self.repo.get_default_for_org(organization_id)
        return await self.repo.get_personal_account(organization_id, user_id)

    async def update(
        self, account_id: uuid.UUID, organization_id: uuid.UUID, display_name: str | None, is_default: bool | None
    ) -> EmailAccount:
        account = await self.repo.get_by_id_and_org(account_id, organization_id)
        if account is None:
            raise ValueError("Email account not found")

        if is_default:
            return await self.set_default(account_id, organization_id)

        fields: dict = {}
        if display_name is not None:
            fields["display_name"] = display_name
        return await self.repo.update(account, fields) if fields else account

    async def disconnect(self, account_id: uuid.UUID, organization_id: uuid.UUID) -> EmailAccount:
        account = await self.repo.get_by_id_and_org(account_id, organization_id)
        if account is None:
            raise ValueError("Email account not found")
        return await self.repo.update(account, {"status": EmailAccountStatus.DISCONNECTED, "is_default": False})

    async def test_send(self, account_id: uuid.UUID, organization_id: uuid.UUID, to_email: str) -> None:
        account = await self.repo.get_by_id_and_org(account_id, organization_id)
        if account is None:
            raise ValueError("Email account not found")
        try:
            get_provider(account.provider).send(
                account,
                to=to_email,
                subject="Hybent Hiring — test email",
                html_body="<p>This is a test email from your connected mailbox.</p>",
            )
        except Exception as e:
            await self._record_health(account, ok=False, error=str(e))
            raise
        await self._record_health(account, ok=True)

    async def check_health(self, account: EmailAccount) -> bool:
        """Proactively verify a connection (refresh the Gmail token / re-auth
        the SMTP login) without sending anything. Returns True if healthy."""
        try:
            get_provider(account.provider).verify(account)
        except Exception as e:
            await self._record_health(account, ok=False, error=str(e))
            return False
        await self._record_health(account, ok=True)
        return True

    async def _record_health(self, account: EmailAccount, ok: bool, error: str | None = None) -> None:
        fields = {"last_synced_at": datetime.now(timezone.utc)}
        if ok:
            fields["status"] = EmailAccountStatus.CONNECTED
            fields["last_error"] = None
        else:
            # Any verify/send failure means the user needs to act (fix
            # credentials or reconnect) — surfaced in the UI as "Needs reconnect".
            fields["status"] = EmailAccountStatus.REAUTH_REQUIRED
            fields["last_error"] = error
        await self.repo.update(account, fields)

    async def resolve_account_for_org(
        self, organization_id: uuid.UUID, preferred_account_id: uuid.UUID | None = None
    ) -> EmailAccount | None:
        """preferred (if connected & belongs to org) → org default → None."""
        if preferred_account_id is not None:
            preferred = await self.repo.get_by_id_and_org(preferred_account_id, organization_id)
            if preferred is not None and preferred.status == EmailAccountStatus.CONNECTED:
                return preferred
        return await self.repo.get_default_for_org(organization_id)
