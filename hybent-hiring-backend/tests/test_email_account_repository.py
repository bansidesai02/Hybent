"""Repository tests: owner-scoped primary resolution and org isolation."""
from app.models.email_account import EmailAccount, EmailAccountProvider
from app.repositories.email_account import EmailAccountRepository


async def test_get_primary_for_owner_prefers_the_flag_then_earliest_connected(db_session, organization, admin_user):
    repo = EmailAccountRepository(db_session)
    assert await repo.get_primary_for_owner(organization.id, admin_user.id) is None

    first = EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP,
                         email_address="first@acme.com", connected_by_user_id=admin_user.id)
    second = EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP,
                          email_address="second@acme.com", connected_by_user_id=admin_user.id, is_default=True)
    db_session.add_all([first, second])
    await db_session.commit()
    assert (await repo.get_primary_for_owner(organization.id, admin_user.id)).id == second.id

    second.status = "disconnected"
    await db_session.commit()
    assert (await repo.get_primary_for_owner(organization.id, admin_user.id)).id == first.id


async def test_unset_other_defaults_is_scoped_to_the_owner(db_session, organization, admin_user, second_admin_user):
    repo = EmailAccountRepository(db_session)
    mine = EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP,
                        email_address="mine@acme.com", connected_by_user_id=admin_user.id, is_default=True)
    theirs = EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP,
                          email_address="theirs@acme.com", connected_by_user_id=second_admin_user.id, is_default=True)
    db_session.add_all([mine, theirs])
    await db_session.commit()

    await repo.unset_other_defaults(organization.id, admin_user.id, except_id=None)
    await db_session.commit()
    await db_session.refresh(mine)
    await db_session.refresh(theirs)

    assert mine.is_default is False
    assert theirs.is_default is True


async def test_get_all_for_org_excludes_other_orgs(db_session, organization, other_organization):
    repo = EmailAccountRepository(db_session)
    db_session.add(EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="mine@acme.com"))
    db_session.add(EmailAccount(organization_id=other_organization.id, provider=EmailAccountProvider.SMTP, email_address="theirs@other.com"))
    await db_session.commit()

    accounts = await repo.get_all_for_org(organization.id)
    assert len(accounts) == 1
    assert accounts[0].email_address == "mine@acme.com"


async def test_get_for_health_check_excludes_disconnected_and_outlook(db_session, organization):
    repo = EmailAccountRepository(db_session)
    db_session.add(EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP,
        email_address="connected@acme.com", status="connected",
    ))
    db_session.add(EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="erroring@acme.com", status="error",
    ))
    db_session.add(EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP,
        email_address="gone@acme.com", status="disconnected",
    ))
    db_session.add(EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.OUTLOOK,
        email_address="outlook@acme.com", status="connected",
    ))
    await db_session.commit()

    accounts = await repo.get_for_health_check()
    addresses = {a.email_address for a in accounts}
    assert addresses == {"connected@acme.com", "erroring@acme.com"}
