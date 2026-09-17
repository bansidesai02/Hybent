"""Model/constraint tests for EmailAccount."""
import pytest
from sqlalchemy.exc import IntegrityError

from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountStatus


async def test_default_status_is_connected(db_session, organization):
    account = EmailAccount(
        organization_id=organization.id,
        provider=EmailAccountProvider.SMTP,
        email_address="inbox@acme.com",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    assert account.status == EmailAccountStatus.CONNECTED
    assert account.is_default is False
    assert account.use_tls is True


async def test_unique_organization_and_email_address(db_session, organization):
    db_session.add(
        EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="dup@acme.com")
    )
    await db_session.commit()

    db_session.add(
        EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="dup@acme.com")
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_same_address_allowed_across_different_orgs(db_session, organization, other_organization):
    db_session.add(
        EmailAccount(organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="shared@acme.com")
    )
    db_session.add(
        EmailAccount(organization_id=other_organization.id, provider=EmailAccountProvider.SMTP, email_address="shared@acme.com")
    )
    await db_session.commit()  # should not raise
