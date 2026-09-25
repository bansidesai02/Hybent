"""
Orchestrates connect/manage/send for users' own mailboxes.
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

    # ── Ownership ──────────────────────────────────────────────────────────
    # A mailbox belongs to the user who connected it (connected_by_user_id).
    # Only that user sees it, manages it, sends from it or reads its inbox —
    # whatever their role. Scope only decides how many they may connect.

    async def list_for_user(self, organization_id: uuid.UUID, user_id: uuid.UUID) -> list[EmailAccount]:
        return await self.repo.get_all_for_owner(organization_id, user_id)

    async def get_owned(
        self, account_id: uuid.UUID, organization_id: uuid.UUID, user_id: uuid.UUID
    ) -> EmailAccount | None:
        """The account, if it exists in this org *and* belongs to this user."""
        account = await self.repo.get_by_id_and_org(account_id, organization_id)
        if account is None or account.connected_by_user_id != user_id:
            return None
        return account

    async def get_for_org(self, account_id: uuid.UUID, organization_id: uuid.UUID) -> EmailAccount | None:
        return await self.repo.get_by_id_and_org(account_id, organization_id)

    def can_manage(self, account: EmailAccount, user_id: uuid.UUID) -> bool:
        return account.connected_by_user_id == user_id

    # ── Connecting ─────────────────────────────────────────────────────────

    @staticmethod
    def _wipe_credentials(account: EmailAccount) -> None:
        account.access_token_encrypted = None
        account.refresh_token_encrypted = None
        account.token_expires_at = None
        account.smtp_password_encrypted = None
        account.last_error = None
        account.is_default = False

    async def _row_for_connect(
        self, organization_id: uuid.UUID, user_id: uuid.UUID, email_address: str, scope: str
    ) -> EmailAccount | None:
        """The existing row this connect should write into, or None for a new
        one. Raises ValueError when the address is someone else's.

        - Reconnect is always allowed, whatever the status (a mailbox in
          `reauth_required`/`error` used to be refused as "already connected").
        - A recruiter has one row: connecting again reconnects it or swaps its
          address.
        - An address another member has *actively* connected is refused.
        - An address left behind by a *disconnected* row of someone else is
          taken over — inserting a second row for it would violate the
          one-address-per-org constraint (a 500 before)."""
        address_row = await self.repo.get_by_org_and_address(organization_id, email_address)

        if scope == EmailAccountScope.PERSONAL:
            mine = await self.repo.get_personal_account(organization_id, user_id)
        else:
            mine = (
                address_row
                if address_row is not None
                and address_row.connected_by_user_id == user_id
                and address_row.scope == EmailAccountScope.ORGANIZATION
                else None
            )

        if address_row is None or (mine is not None and address_row.id == mine.id):
            return mine

        if address_row.status != EmailAccountStatus.DISCONNECTED:
            if address_row.connected_by_user_id == user_id:
                raise ValueError(f"You've already connected {email_address}.")
            raise ValueError(f"{email_address} is already connected by another member of your organization.")

        # A stale, disconnected row holds the address. It keeps that mailbox's
        # synced history, so take it over rather than deleting it.
        if mine is not None:
            # A recruiter moving their one mailbox onto that address: retire
            # their old row first (unowned, so the one-per-recruiter index is
            # free), flushed before the takeover claims the address.
            self._wipe_credentials(mine)
            mine.status = EmailAccountStatus.DISCONNECTED
            mine.connected_by_user_id = None
            self.db.add(mine)
            await self.db.flush()

        self._wipe_credentials(address_row)
        address_row.display_name = None
        return address_row

    async def _save_connected(self, account: EmailAccount, is_new: bool, user_id: uuid.UUID) -> EmailAccount:
        """Mark connected and settle the owner's primary: their first
        connected mailbox becomes it; otherwise the current primary stays."""
        account.status = EmailAccountStatus.CONNECTED
        account.last_error = None
        account.last_synced_at = datetime.now(timezone.utc)

        if not account.is_default:
            others = [
                a for a in await self.repo.get_all_for_owner(account.organization_id, user_id)
                if a.id != account.id
            ]
            has_live_primary = any(a.is_default and a.status == EmailAccountStatus.CONNECTED for a in others)
            if not has_live_primary:
                await self.repo.unset_other_defaults(account.organization_id, user_id, except_id=account.id)
                account.is_default = True

        if is_new:
            return await self.repo.create(account)
        return await self.repo.update(account, {})

    async def connect_smtp(
        self,
        organization_id: uuid.UUID,
        connected_by_user_id: uuid.UUID,
        payload: EmailAccountCreateSMTP,
        scope: str = EmailAccountScope.ORGANIZATION,
    ) -> EmailAccount:
        # Verify the credentials on a throwaway object first, so a bad
        # password leaves the database untouched — no rollback needed (one
        # would expire every object in the session, the caller's user too).
        probe = EmailAccount(
            provider=EmailAccountProvider.SMTP,
            email_address=payload.email_address,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port,
            smtp_username=payload.smtp_username,
            smtp_password_encrypted=crypto.encrypt(payload.smtp_password),
            use_tls=payload.use_tls,
        )
        try:
            get_provider(EmailAccountProvider.SMTP).send(
                probe,
                to=payload.email_address,
                subject="Hybent Hiring — email account connected",
                html_body="<p>This mailbox is now connected to your account on Hybent Hiring.</p>",
            )
        except Exception as e:
            logger.warning(f"SMTP account verification failed for {payload.email_address}: {e}")
            raise ValueError(f"Could not verify SMTP credentials: {e}") from e

        existing = await self._row_for_connect(organization_id, connected_by_user_id, payload.email_address, scope)
        is_new = existing is None
        account = existing or EmailAccount(organization_id=organization_id, scope=scope)
        account.provider = EmailAccountProvider.SMTP
        account.email_address = payload.email_address
        account.connected_by_user_id = connected_by_user_id
        account.scope = scope
        account.display_name = payload.display_name
        account.smtp_host = payload.smtp_host
        account.smtp_port = payload.smtp_port
        account.smtp_username = payload.smtp_username
        account.smtp_password_encrypted = probe.smtp_password_encrypted
        account.use_tls = payload.use_tls
        return await self._save_connected(account, is_new, connected_by_user_id)

    async def upsert_gmail(
        self,
        organization_id: uuid.UUID,
        connected_by_user_id: uuid.UUID,
        email_address: str,
        refresh_token: str | None,
        access_token: str | None,
        scope: str = EmailAccountScope.ORGANIZATION,
    ) -> EmailAccount:
        if not refresh_token:
            # Google returns a refresh token only on first consent. Without
            # one, only the owner's own existing row for this very address
            # still has a usable token — checked before anything is changed.
            current = await self.repo.get_by_org_and_address(organization_id, email_address)
            if not (
                current is not None
                and current.connected_by_user_id == connected_by_user_id
                and current.refresh_token_encrypted
            ):
                raise ValueError(
                    "Google did not return a refresh token — remove Hybent's access in your "
                    "Google account settings and connect again."
                )

        existing = await self._row_for_connect(organization_id, connected_by_user_id, email_address, scope)
        is_new = existing is None
        account = existing or EmailAccount(organization_id=organization_id, scope=scope)
        account.provider = EmailAccountProvider.GMAIL
        account.email_address = email_address
        account.connected_by_user_id = connected_by_user_id
        account.scope = scope
        if refresh_token:
            account.refresh_token_encrypted = crypto.encrypt(refresh_token)
        return await self._save_connected(account, is_new, connected_by_user_id)

    # ── Primary sender ─────────────────────────────────────────────────────

    async def set_default(self, account_id: uuid.UUID, organization_id: uuid.UUID, user_id: uuid.UUID) -> EmailAccount:
        """Make one of the caller's own mailboxes their primary sender."""
        account = await self.get_owned(account_id, organization_id, user_id)
        if account is None:
            raise ValueError("Email account not found")
        if account.status != EmailAccountStatus.CONNECTED:
            raise ValueError("Reconnect this mailbox before making it your primary")
        await self.repo.unset_other_defaults(organization_id, user_id, except_id=account_id)
        return await self.repo.update(account, {"is_default": True})

    async def resolve_sender(self, organization_id: uuid.UUID, user_id: uuid.UUID | None) -> EmailAccount | None:
        """The mailbox email triggered by this user goes out from: their
        connected primary. None means the platform's default sender."""
        if user_id is None:
            return None
        return await self.repo.get_primary_for_owner(organization_id, user_id)

    async def get_inbox_account(
        self, organization_id: uuid.UUID, user_id: uuid.UUID, account_id: uuid.UUID | None = None
    ) -> EmailAccount | None:
        """The mailbox whose inbox this user is looking at — only ever one of
        their own. An explicit `account_id` picks among them; otherwise their
        primary, preferring one that can actually be read (Gmail)."""
        if account_id is not None:
            return await self.get_owned(account_id, organization_id, user_id)
        owned = await self.repo.get_all_for_owner(organization_id, user_id)
        connected = [a for a in owned if a.status == EmailAccountStatus.CONNECTED]
        primary = next((a for a in connected if a.is_default), connected[0] if connected else None)
        if primary is not None and primary.provider == EmailAccountProvider.GMAIL:
            return primary
        return next((a for a in connected if a.provider == EmailAccountProvider.GMAIL), primary)

    async def update(
        self,
        account_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        display_name: str | None,
        is_default: bool | None,
    ) -> EmailAccount:
        account = await self.get_owned(account_id, organization_id, user_id)
        if account is None:
            raise ValueError("Email account not found")

        if is_default:
            account = await self.set_default(account_id, organization_id, user_id)

        if display_name is not None:
            account = await self.repo.update(account, {"display_name": display_name})
        return account

    async def disconnect(self, account_id: uuid.UUID, organization_id: uuid.UUID, user_id: uuid.UUID) -> EmailAccount:
        """Disconnect one of the caller's mailboxes. If it was their primary,
        their next connected mailbox takes over."""
        account = await self.get_owned(account_id, organization_id, user_id)
        if account is None:
            raise ValueError("Email account not found")
        was_primary = account.is_default
        account = await self.repo.update(account, {"status": EmailAccountStatus.DISCONNECTED, "is_default": False})
        if was_primary:
            successor = await self.repo.get_primary_for_owner(organization_id, user_id)
            if successor is not None:
                await self.repo.update(successor, {"is_default": True})
        return account

    async def test_send(
        self, account_id: uuid.UUID, organization_id: uuid.UUID, user_id: uuid.UUID, to_email: str
    ) -> None:
        account = await self.get_owned(account_id, organization_id, user_id)
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


async def resolve_sender_for_user(db: AsyncSession, user) -> EmailAccount | None:
    """The mailbox email triggered by `user` should be sent from — their own
    primary — or None for the platform sender. Never raises: a lookup problem
    just means the platform sender is used."""
    if user is None or getattr(user, "id", None) is None:
        return None
    try:
        return await EmailAccountsService(db).resolve_sender(user.organization_id, user.id)
    except Exception as e:
        logger.warning(f"Could not resolve sender mailbox for user {getattr(user, 'id', None)}: {e}")
        return None
