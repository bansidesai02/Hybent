"""Service-level tests for per-user mailboxes: a mailbox belongs to whoever
connected it; admins may connect many and pick a primary, a recruiter has
exactly one; the primary is that user's sender."""
from unittest.mock import patch

import pytest

from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope, EmailAccountStatus
from app.schemas.email_account import EmailAccountCreateSMTP
from app.services.email_accounts_service import EmailAccountsService, resolve_sender_for_user

SMTP_SEND = "app.services.email_providers.smtp_provider.SMTPProvider.send"


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


async def _connect(service, org, user, address, scope=EmailAccountScope.ORGANIZATION):
    with patch(SMTP_SEND, return_value=None):
        return await service.connect_smtp(org.id, user.id, _smtp_payload(email_address=address), scope=scope)


# ── Connecting ─────────────────────────────────────────────────────────────

async def test_first_mailbox_becomes_the_owners_primary(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    first = await _connect(service, organization, admin_user, "one@acme.com")
    second = await _connect(service, organization, admin_user, "two@acme.com")

    assert first.is_default is True
    assert second.is_default is False
    assert first.connected_by_user_id == admin_user.id


async def test_connect_does_not_persist_when_verification_fails(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    with patch(SMTP_SEND, side_effect=Exception("auth failed")):
        with pytest.raises(ValueError, match="Could not verify SMTP credentials"):
            await service.connect_smtp(organization.id, admin_user.id, _smtp_payload())
    assert await service.list_for_user(organization.id, admin_user.id) == []


@pytest.mark.parametrize("status", [
    EmailAccountStatus.DISCONNECTED, EmailAccountStatus.REAUTH_REQUIRED, EmailAccountStatus.ERROR,
])
async def test_owner_can_reconnect_from_any_status(db_session, organization, admin_user, status):
    """Only `disconnected` used to be reconnectable — a mailbox in
    `reauth_required` or `error` was refused as 'already connected'."""
    service = EmailAccountsService(db_session)
    account = await _connect(service, organization, admin_user, "recruiting@acme.com")
    account.status = status
    await db_session.commit()

    again = await _connect(service, organization, admin_user, "recruiting@acme.com")
    assert again.id == account.id
    assert again.status == EmailAccountStatus.CONNECTED


async def test_address_actively_connected_by_another_member_is_refused(
    db_session, organization, admin_user, second_admin_user
):
    service = EmailAccountsService(db_session)
    await _connect(service, organization, admin_user, "shared@acme.com")
    with pytest.raises(ValueError, match="another member"):
        await _connect(service, organization, second_admin_user, "shared@acme.com")


async def test_address_left_by_a_disconnected_member_is_taken_over(
    db_session, organization, admin_user, recruiter_user
):
    """Used to insert a second row for the address and hit the
    one-address-per-org constraint (a 500)."""
    service = EmailAccountsService(db_session)
    old = await _connect(service, organization, admin_user, "jobs@acme.com")
    await service.disconnect(old.id, organization.id, admin_user.id)

    taken = await _connect(service, organization, recruiter_user, "jobs@acme.com", scope=EmailAccountScope.PERSONAL)

    assert taken.id == old.id  # same row, history kept
    assert taken.connected_by_user_id == recruiter_user.id
    assert taken.scope == EmailAccountScope.PERSONAL
    assert taken.is_default is True
    assert await service.list_for_user(organization.id, admin_user.id) == []


# ── Recruiter: exactly one mailbox ─────────────────────────────────────────

async def test_recruiter_connecting_again_swaps_their_one_mailbox(db_session, organization, recruiter_user):
    service = EmailAccountsService(db_session)
    first = await _connect(service, organization, recruiter_user, "me@gmail.com", scope=EmailAccountScope.PERSONAL)
    second = await _connect(service, organization, recruiter_user, "me.new@gmail.com", scope=EmailAccountScope.PERSONAL)

    assert second.id == first.id
    mine = await service.list_for_user(organization.id, recruiter_user.id)
    assert [a.email_address for a in mine] == ["me.new@gmail.com"]
    assert mine[0].is_default is True  # their one mailbox is their sender


async def test_recruiter_moving_onto_an_address_another_member_abandoned(
    db_session, organization, recruiter_user, second_recruiter_user
):
    service = EmailAccountsService(db_session)
    theirs = await _connect(service, organization, second_recruiter_user, "old@gmail.com", scope=EmailAccountScope.PERSONAL)
    await service.disconnect(theirs.id, organization.id, second_recruiter_user.id)
    await _connect(service, organization, recruiter_user, "mine@gmail.com", scope=EmailAccountScope.PERSONAL)

    moved = await _connect(service, organization, recruiter_user, "old@gmail.com", scope=EmailAccountScope.PERSONAL)

    mine = await service.list_for_user(organization.id, recruiter_user.id)
    assert [a.id for a in mine] == [moved.id]  # still exactly one
    assert moved.email_address == "old@gmail.com"


# ── Primary ────────────────────────────────────────────────────────────────

async def test_make_primary_only_affects_the_owner(db_session, organization, admin_user, second_admin_user):
    service = EmailAccountsService(db_session)
    a1 = await _connect(service, organization, admin_user, "a1@acme.com")
    a2 = await _connect(service, organization, admin_user, "a2@acme.com")
    b1 = await _connect(service, organization, second_admin_user, "b1@acme.com")

    await service.set_default(a2.id, organization.id, admin_user.id)
    for a in (a1, a2, b1):
        await db_session.refresh(a)

    assert (a1.is_default, a2.is_default) == (False, True)
    assert b1.is_default is True  # the other admin's primary is untouched


async def test_cannot_make_someone_elses_mailbox_primary(db_session, organization, admin_user, second_admin_user):
    service = EmailAccountsService(db_session)
    theirs = await _connect(service, organization, second_admin_user, "b@acme.com")
    with pytest.raises(ValueError, match="not found"):
        await service.set_default(theirs.id, organization.id, admin_user.id)


async def test_disconnecting_the_primary_promotes_the_next_mailbox(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    primary = await _connect(service, organization, admin_user, "a1@acme.com")
    backup = await _connect(service, organization, admin_user, "a2@acme.com")

    await service.disconnect(primary.id, organization.id, admin_user.id)
    await db_session.refresh(primary)
    await db_session.refresh(backup)

    assert primary.status == EmailAccountStatus.DISCONNECTED and primary.is_default is False
    assert backup.is_default is True


# ── Sender ─────────────────────────────────────────────────────────────────

async def test_resolve_sender_is_the_users_own_primary(db_session, organization, admin_user, recruiter_user):
    service = EmailAccountsService(db_session)
    await _connect(service, organization, admin_user, "a1@acme.com")
    a2 = await _connect(service, organization, admin_user, "a2@acme.com")
    await service.set_default(a2.id, organization.id, admin_user.id)
    mine = await _connect(service, organization, recruiter_user, "rec@gmail.com", scope=EmailAccountScope.PERSONAL)

    assert (await service.resolve_sender(organization.id, admin_user.id)).id == a2.id
    assert (await resolve_sender_for_user(db_session, recruiter_user)).id == mine.id


async def test_resolve_sender_none_without_a_connected_mailbox(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    assert await service.resolve_sender(organization.id, admin_user.id) is None
    account = await _connect(service, organization, admin_user, "a@acme.com")
    await service.disconnect(account.id, organization.id, admin_user.id)
    assert await service.resolve_sender(organization.id, admin_user.id) is None
    assert await resolve_sender_for_user(db_session, None) is None


# ── Health ─────────────────────────────────────────────────────────────────

async def test_check_health_marks_connected_on_success(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="a@acme.com",
        connected_by_user_id=admin_user.id, status="reauth_required", last_error="old",
    )
    db_session.add(account)
    await db_session.commit()

    with patch("app.services.email_providers.smtp_provider.SMTPProvider.verify", return_value=None):
        assert await service.check_health(account) is True
    await db_session.refresh(account)
    assert account.status == "connected"
    assert account.last_error is None


async def test_check_health_marks_reauth_required_on_failure(db_session, organization, admin_user):
    service = EmailAccountsService(db_session)
    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="a@acme.com",
        connected_by_user_id=admin_user.id,
    )
    db_session.add(account)
    await db_session.commit()

    with patch("app.services.email_providers.smtp_provider.SMTPProvider.verify", side_effect=Exception("bad password")):
        assert await service.check_health(account) is False
    await db_session.refresh(account)
    assert account.status == "reauth_required"
    assert account.last_error == "bad password"


async def test_test_send_is_owner_only_and_records_health(db_session, organization, admin_user, second_admin_user):
    service = EmailAccountsService(db_session)
    account = await _connect(service, organization, admin_user, "a@acme.com")

    with pytest.raises(ValueError, match="not found"):
        await service.test_send(account.id, organization.id, second_admin_user.id, "x@acme.com")

    with patch(SMTP_SEND, side_effect=Exception("network unreachable")):
        with pytest.raises(Exception, match="network unreachable"):
            await service.test_send(account.id, organization.id, admin_user.id, "x@acme.com")
    await db_session.refresh(account)
    assert account.status == "reauth_required"
