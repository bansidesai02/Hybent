"""Mailboxes are private to their owner. Scope only sets how many the owner
may connect: personal (recruiter) = one, organization (admin) = many."""
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


async def test_db_enforces_one_primary_per_owner(db_session, organization, admin_user):
    for address in ("a@acme.com", "b@acme.com"):
        db_session.add(EmailAccount(
            organization_id=organization.id, connected_by_user_id=admin_user.id,
            provider=EmailAccountProvider.SMTP, email_address=address, is_default=True,
        ))
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def _connect(service, org, user, address, scope):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        return await service.connect_smtp(org.id, user.id, _payload(email_address=address), scope=scope)


async def test_list_shows_only_the_callers_own_mailboxes(
    db_session, organization, admin_user, second_admin_user, recruiter_user
):
    service = EmailAccountsService(db_session)
    await _connect(service, organization, admin_user, "a@acme.com", EmailAccountScope.ORGANIZATION)
    await _connect(service, organization, second_admin_user, "b@acme.com", EmailAccountScope.ORGANIZATION)
    await _connect(service, organization, recruiter_user, "r@gmail.com", EmailAccountScope.PERSONAL)

    def addresses(accounts):
        return [a.email_address for a in accounts]

    assert addresses(await service.list_for_user(organization.id, admin_user.id)) == ["a@acme.com"]
    assert addresses(await service.list_for_user(organization.id, second_admin_user.id)) == ["b@acme.com"]
    assert addresses(await service.list_for_user(organization.id, recruiter_user.id)) == ["r@gmail.com"]


async def test_only_the_owner_can_manage(db_session, organization, admin_user, recruiter_user):
    service = EmailAccountsService(db_session)
    recruiters = await _connect(service, organization, recruiter_user, "r@gmail.com", EmailAccountScope.PERSONAL)
    admins = await _connect(service, organization, admin_user, "a@acme.com", EmailAccountScope.ORGANIZATION)

    assert service.can_manage(recruiters, recruiter_user.id) is True
    assert service.can_manage(recruiters, admin_user.id) is False  # an admin can't touch a recruiter's mailbox
    assert service.can_manage(admins, recruiter_user.id) is False
    assert await service.get_owned(recruiters.id, organization.id, admin_user.id) is None
    with pytest.raises(ValueError):
        await service.disconnect(recruiters.id, organization.id, admin_user.id)


async def test_inbox_is_always_one_of_the_users_own_mailboxes(
    db_session, organization, admin_user, second_admin_user
):
    service = EmailAccountsService(db_session)
    a1 = await _connect(service, organization, admin_user, "a1@acme.com", EmailAccountScope.ORGANIZATION)
    a2 = await _connect(service, organization, admin_user, "a2@acme.com", EmailAccountScope.ORGANIZATION)
    for a in (a1, a2):
        a.provider = EmailAccountProvider.GMAIL
    await db_session.commit()

    assert (await service.get_inbox_account(organization.id, admin_user.id)).id == a1.id  # primary
    assert (await service.get_inbox_account(organization.id, admin_user.id, a2.id)).id == a2.id
    # Another admin gets nothing — neither by default nor by asking for it.
    assert await service.get_inbox_account(organization.id, second_admin_user.id) is None
    assert await service.get_inbox_account(organization.id, second_admin_user.id, a1.id) is None


async def test_inbox_none_when_nothing_connected(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    assert await service.get_inbox_account(organization.id, recruiter_user.id) is None
