"""Repository tests: default resolution and single-default-per-org enforcement."""
from app.models.email_account import EmailAccount, EmailAccountProvider
from app.repositories.email_account import EmailAccountRepository


async def test_get_default_for_org_returns_none_when_no_default(db_session, organization):
    repo = EmailAccountRepository(db_session)
    db_session.add(
        EmailAccount(
            organization_id=organization.id,
            provider=EmailAccountProvider.SMTP,
            email_address="a@acme.com",
            is_default=False,
        )
    )
    await db_session.commit()

    assert await repo.get_default_for_org(organization.id) is None


async def test_get_default_for_org_returns_the_flagged_account(db_session, organization):
    repo = EmailAccountRepository(db_session)
    default_account = EmailAccount(
        organization_id=organization.id,
        provider=EmailAccountProvider.SMTP,
        email_address="default@acme.com",
        is_default=True,
    )
    db_session.add(default_account)
    db_session.add(
        EmailAccount(
            organization_id=organization.id,
            provider=EmailAccountProvider.SMTP,
            email_address="secondary@acme.com",
            is_default=False,
        )
    )
    await db_session.commit()
    await db_session.refresh(default_account)

    result = await repo.get_default_for_org(organization.id)
    assert result is not None
    assert result.id == default_account.id


async def test_unset_other_defaults_clears_prior_default(db_session, organization):
    repo = EmailAccountRepository(db_session)
    first = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="first@acme.com", is_default=True
    )
    second = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="second@acme.com", is_default=False
    )
    db_session.add_all([first, second])
    await db_session.commit()
    await db_session.refresh(first)
    await db_session.refresh(second)

    await repo.unset_other_defaults(organization.id, except_id=second.id)
    await db_session.refresh(first)

    assert first.is_default is False


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
