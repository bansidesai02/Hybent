"""Personal (recruiter) vs organization (admin-shared) account scoping."""
from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope
from app.schemas.email_account import EmailAccountCreateSMTP
from app.services.email_accounts_service import EmailAccountsService


def _payload(**overrides):
    defaults = dict(
        email_address="personal@acme.com",
        display_name=None,
        smtp_host="smtp.acme.com",
        smtp_port=587,
        smtp_username="personal@acme.com",
        smtp_password="app-password",
        use_tls=True,
    )
    defaults.update(overrides)
    return EmailAccountCreateSMTP(**defaults)


async def test_db_enforces_one_personal_account_per_user(db_session, organization, recruiter_user):
    db_session.add(EmailAccount(
        organization_id=organization.id, connected_by_user_id=recruiter_user.id,
        provider=EmailAccountProvider.SMTP, email_address="a@acme.com", scope=EmailAccountScope.PERSONAL,
    ))
    await db_session.commit()

    db_session.add(EmailAccount(
        organization_id=organization.id, connected_by_user_id=recruiter_user.id,
        provider=EmailAccountProvider.SMTP, email_address="b@acme.com", scope=EmailAccountScope.PERSONAL,
    ))
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_two_different_recruiters_can_each_have_a_personal_account(db_session, organization, recruiter_user):
    from tests.conftest import _make_user
    from app.utils.permissions import UserRole

    other_recruiter = await _make_user(db_session, organization, UserRole.RECRUITER.value)

    db_session.add(EmailAccount(
        organization_id=organization.id, connected_by_user_id=recruiter_user.id,
        provider=EmailAccountProvider.SMTP, email_address="one@acme.com", scope=EmailAccountScope.PERSONAL,
    ))
    db_session.add(EmailAccount(
        organization_id=organization.id, connected_by_user_id=other_recruiter.id,
        provider=EmailAccountProvider.SMTP, email_address="two@acme.com", scope=EmailAccountScope.PERSONAL,
    ))
    await db_session.commit()  # should not raise


async def test_recruiter_connect_is_personal_and_never_default(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(), scope=EmailAccountScope.PERSONAL
        )
    assert account.scope == EmailAccountScope.PERSONAL
    assert account.is_default is False


async def test_admin_connect_is_organization_and_first_one_is_default(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(organization.id, admin_user.id, _payload())
    assert account.scope == EmailAccountScope.ORGANIZATION
    assert account.is_default is True


async def test_recruiter_reconnect_can_change_address_reusing_same_row(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        first = await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(email_address="old@acme.com"), scope=EmailAccountScope.PERSONAL
        )
        await service.disconnect(first.id, organization.id)
        second = await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(email_address="new@acme.com"), scope=EmailAccountScope.PERSONAL
        )

    assert second.id == first.id
    assert second.email_address == "new@acme.com"
    accounts = await service.list_for_org(organization.id, recruiter_user.id, "recruiter")
    assert len(accounts) == 1


async def test_recruiter_blocked_while_personal_account_still_active(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(email_address="one@acme.com"), scope=EmailAccountScope.PERSONAL
        )
        with pytest.raises(ValueError, match="already have a personal mailbox"):
            await service.connect_smtp(
                organization.id, recruiter_user.id, _payload(email_address="two@acme.com"), scope=EmailAccountScope.PERSONAL
            )


async def test_set_default_rejects_personal_scope(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        account = await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(), scope=EmailAccountScope.PERSONAL
        )
    with pytest.raises(ValueError, match="Only organization-shared accounts"):
        await service.set_default(account.id, organization.id)


async def test_can_manage_rules(db_session, organization, admin_user, recruiter_user):
    from tests.conftest import _make_user
    from app.utils.permissions import UserRole

    service = EmailAccountsService(db_session)
    other_recruiter = await _make_user(db_session, organization, UserRole.RECRUITER.value)

    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        org_account = await service.connect_smtp(organization.id, admin_user.id, _payload(email_address="org@acme.com"))
        personal_account = await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(email_address="mine@acme.com"), scope=EmailAccountScope.PERSONAL
        )

    assert service.can_manage(org_account, admin_user.id, "admin") is True
    assert service.can_manage(org_account, recruiter_user.id, "recruiter") is False
    assert service.can_manage(personal_account, recruiter_user.id, "recruiter") is True
    assert service.can_manage(personal_account, other_recruiter.id, "recruiter") is False
    assert service.can_manage(personal_account, admin_user.id, "admin") is True  # admins can still help debug


async def test_get_inbox_account_resolution(db_session, organization, admin_user, recruiter_user):
    service = EmailAccountsService(db_session)
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        org_account = await service.connect_smtp(organization.id, admin_user.id, _payload(email_address="org@acme.com"))
        personal_account = await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(email_address="mine@acme.com"), scope=EmailAccountScope.PERSONAL
        )

    admin_inbox = await service.get_inbox_account(organization.id, admin_user.id, "admin")
    recruiter_inbox = await service.get_inbox_account(organization.id, recruiter_user.id, "recruiter")

    assert admin_inbox.id == org_account.id
    assert recruiter_inbox.id == personal_account.id


async def test_get_inbox_account_none_when_nothing_connected(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    inbox = await service.get_inbox_account(organization.id, recruiter_user.id, "recruiter")
    assert inbox is None


async def test_list_never_leaks_another_users_personal_account(db_session, organization, admin_user, recruiter_user):
    """A recruiter's list call must see org-shared accounts and their own
    personal one, but never a different recruiter's personal mailbox."""
    from tests.conftest import _make_user
    from app.utils.permissions import UserRole

    other_recruiter = await _make_user(db_session, organization, UserRole.RECRUITER.value)
    service = EmailAccountsService(db_session)

    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await service.connect_smtp(organization.id, admin_user.id, _payload(email_address="shared@acme.com"))
        await service.connect_smtp(
            organization.id, recruiter_user.id, _payload(email_address="mine@acme.com"), scope=EmailAccountScope.PERSONAL
        )
        await service.connect_smtp(
            organization.id, other_recruiter.id, _payload(email_address="theirs@acme.com"), scope=EmailAccountScope.PERSONAL
        )

    my_view = await service.list_for_org(organization.id, recruiter_user.id, "recruiter")
    addresses = {a.email_address for a in my_view}
    assert addresses == {"shared@acme.com", "mine@acme.com"}

    admin_view = await service.list_for_org(organization.id, admin_user.id, "admin")
    admin_addresses = {a.email_address for a in admin_view}
    assert admin_addresses == {"shared@acme.com"}  # admin isn't shown either recruiter's personal mailbox
