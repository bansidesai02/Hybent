"""The periodic health-check task's async implementation (not the Celery
scheduling machinery itself, which nothing else in this repo tests either)."""
from unittest.mock import AsyncMock, patch

from app.tasks.email_accounts import _check_email_accounts_health_async


async def test_health_sweep_checks_every_account_returned_by_repo(db_session, organization, admin_user):
    from app.services.email_accounts_service import EmailAccountsService
    from tests.test_email_accounts_service import _smtp_payload

    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await service.connect_smtp(organization.id, admin_user.id, _smtp_payload(email_address="a@acme.com"))
        await service.connect_smtp(organization.id, admin_user.id, _smtp_payload(email_address="b@acme.com"))

    with patch("app.tasks.email_accounts.AsyncSessionLocal", return_value=db_session), \
         patch("app.services.email_providers.smtp_provider.SMTPProvider.verify", return_value=None) as mock_verify:
        await _check_email_accounts_health_async()

    assert mock_verify.call_count == 2
