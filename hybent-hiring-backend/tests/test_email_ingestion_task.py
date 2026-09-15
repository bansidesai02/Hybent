"""The periodic email-ingestion task's account-eligibility query: every
connected Gmail mailbox is scanned for resumes, not just the org's default
or a recruiter's personal one — is_default only matters for admin/send
purposes, not for whether a mailbox's mail gets scanned for applications."""
from unittest.mock import AsyncMock, patch

from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope, EmailAccountStatus
from app.tasks.email_ingestion import _process_email_ingestion_async
from app.utils import crypto


def _gmail_account(organization_id, **overrides) -> EmailAccount:
    defaults = dict(
        organization_id=organization_id,
        provider=EmailAccountProvider.GMAIL,
        status=EmailAccountStatus.CONNECTED,
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    defaults.update(overrides)
    return EmailAccount(**defaults)


async def test_ingestion_covers_every_connected_account_not_just_default_or_personal(
    db_session, organization, admin_user, recruiter_user
):
    default_org_account = _gmail_account(
        organization.id, email_address="careers@acme.com", is_default=True, connected_by_user_id=admin_user.id,
    )
    non_default_org_account = _gmail_account(
        organization.id, email_address="sales@acme.com", is_default=False, connected_by_user_id=admin_user.id,
    )
    personal_account = _gmail_account(
        organization.id, email_address="recruiter@acme.com", scope=EmailAccountScope.PERSONAL,
        connected_by_user_id=recruiter_user.id,
    )
    disconnected_account = _gmail_account(
        organization.id, email_address="stale@acme.com", status=EmailAccountStatus.DISCONNECTED,
    )
    db_session.add_all([default_org_account, non_default_org_account, personal_account, disconnected_account])
    await db_session.commit()

    processed_addresses = []

    async def _fake_process_account(account):
        processed_addresses.append(account.email_address)
        return {"created": 0, "matched_existing": 0, "skipped": 0, "failed": 0}

    with patch("app.tasks.email_ingestion.AsyncSessionLocal", return_value=db_session), \
         patch(
             "app.services.email_ingestion_service.EmailApplicationIngestionService.process_account",
             new=AsyncMock(side_effect=_fake_process_account),
         ):
        await _process_email_ingestion_async()

    assert set(processed_addresses) == {"careers@acme.com", "sales@acme.com", "recruiter@acme.com"}
    assert "stale@acme.com" not in processed_addresses  # disconnected — never scanned
