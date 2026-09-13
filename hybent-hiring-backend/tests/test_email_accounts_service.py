"""Service-level tests: default resolution fallback, connect-verification-before-save,
single-default-per-org enforcement."""
from unittest.mock import patch

import pytest

from app.models.email_account import EmailAccount, EmailAccountProvider
from app.schemas.email_account import EmailAccountCreateSMTP
from app.services.email_accounts_service import EmailAccountsService


def _smtp_payload(**overrides):
    defaults = dict(
        email_address="recruiting@acme.com",
        display_name="Acme Recruiting",
        smtp_host="smtp.acme.com",
        smtp_port=587,
        smtp_username="recruiting@acme.com",
        smtp_password="app-password",
        use_tls=True,
    )
    defaults.update(overrides)
    return EmailAccountCreateSMTP(**defaults)


async def test_connect_smtp_persists_when_test_send_succeeds(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    assert account.id is not None
    assert account.is_default is True  # first account for the org becomes default
    stored = await service.get_for_org(account.id, organization.id)
    assert stored is not None


async def test_connect_smtp_does_not_persist_when_test_send_fails(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch(
        "app.services.email_providers.smtp_provider.SMTPProvider.send",
        side_effect=Exception("auth failed"),
    ):
        with pytest.raises(ValueError, match="Could not verify SMTP credentials"):
            await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    accounts = await service.list_for_org(organization.id)
    assert accounts == []


async def test_connect_smtp_allows_reconnecting_a_disconnected_account(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        original = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())
        await service.disconnect(original.id, organization.id)

        reconnected = await service.connect_smtp(
            organization.id, admin_user.id, _smtp_payload(smtp_password="new-app-password")
        )

    assert reconnected.id == original.id  # updated in place, not duplicated
    assert reconnected.status == "connected"
    accounts = await service.list_for_org(organization.id)
    assert len(accounts) == 1


async def test_connect_smtp_rejects_duplicate_address(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())
        with pytest.raises(ValueError, match="already connected"):
            await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())


async def test_set_default_enforces_single_default_per_org(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        first = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload(email_address="first@acme.com"))
        second = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload(email_address="second@acme.com"))

    assert first.is_default is True
    assert second.is_default is False

    await service.set_default(second.id, organization.id)

    refreshed_first = await service.get_for_org(first.id, organization.id)
    refreshed_second = await service.get_for_org(second.id, organization.id)
    assert refreshed_first.is_default is False
    assert refreshed_second.is_default is True


async def test_resolve_account_for_org_prefers_explicit_account(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        default_account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload(email_address="default@acme.com"))
        other_account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload(email_address="other@acme.com"))

    resolved = await service.resolve_account_for_org(organization.id, preferred_account_id=other_account.id)
    assert resolved.id == other_account.id


async def test_resolve_account_for_org_falls_back_to_default(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        default_account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    resolved = await service.resolve_account_for_org(organization.id, preferred_account_id=None)
    assert resolved.id == default_account.id


async def test_resolve_account_for_org_returns_none_when_no_accounts(db_session, organization):
    service = EmailAccountsService(db_session)
    resolved = await service.resolve_account_for_org(organization.id)
    assert resolved is None


async def test_disconnect_clears_default_and_status(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    await service.disconnect(account.id, organization.id)
    resolved = await service.resolve_account_for_org(organization.id)
    assert resolved is None  # disconnected accounts are never resolved as sender


async def test_check_health_marks_connected_on_success(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    with patch("app.services.email_providers.smtp_provider.SMTPProvider.verify", return_value=None):
        ok = await service.check_health(account)

    assert ok is True
    refreshed = await service.get_for_org(account.id, organization.id)
    assert refreshed.status == "connected"
    assert refreshed.last_error is None
    assert refreshed.last_synced_at is not None


async def test_check_health_marks_reauth_required_on_failure(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    with patch(
        "app.services.email_providers.smtp_provider.SMTPProvider.verify",
        side_effect=Exception("auth failed"),
    ):
        ok = await service.check_health(account)

    assert ok is False
    refreshed = await service.get_for_org(account.id, organization.id)
    assert refreshed.status == "reauth_required"
    assert refreshed.last_error == "auth failed"


async def test_test_send_records_health_on_success_and_failure(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())

    with patch(
        "app.services.email_providers.smtp_provider.SMTPProvider.send",
        side_effect=Exception("network unreachable"),
    ):
        with pytest.raises(Exception, match="network unreachable"):
            await service.test_send(account.id, organization.id, "someone@example.com")

    failed = await service.get_for_org(account.id, organization.id)
    assert failed.status == "reauth_required"
    assert failed.last_error == "network unreachable"

    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await service.test_send(account.id, organization.id, "someone@example.com")

    recovered = await service.get_for_org(account.id, organization.id)
    assert recovered.status == "connected"
    assert recovered.last_error is None
