"""Inbox API: role-based account resolution, sync, and message detail."""
from unittest.mock import patch

from app.utils import crypto

SMTP_PAYLOAD = {
    "email_address": "recruiting@acme.com",
    "display_name": "Acme Recruiting",
    "smtp_host": "smtp.acme.com",
    "smtp_port": 587,
    "smtp_username": "recruiting@acme.com",
    "smtp_password": "app-password",
    "use_tls": True,
}


async def test_inbox_empty_when_nothing_connected(client, recruiter_headers):
    response = await client.get("/v1/inbox", headers=recruiter_headers)
    assert response.status_code == 200
    assert response.json()["data"]["account"] is None
    assert response.json()["data"]["messages"] == []


async def test_admin_inbox_resolves_org_primary(client, admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)

    response = await client.get("/v1/inbox", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["data"]["account"]["email_address"] == "recruiting@acme.com"


async def test_recruiter_inbox_resolves_own_personal_account(client, recruiter_headers, admin_headers):
    # The org's shared account should NOT show up as the recruiter's inbox.
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
        personal_payload = {**SMTP_PAYLOAD, "email_address": "mine@acme.com"}
        await client.post("/v1/email-accounts/smtp", json=personal_payload, headers=recruiter_headers)

    response = await client.get("/v1/inbox", headers=recruiter_headers)
    assert response.status_code == 200
    assert response.json()["data"]["account"]["email_address"] == "mine@acme.com"


async def test_sync_rejects_non_gmail_account(client, admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)

    response = await client.post("/v1/inbox/sync", headers=admin_headers)
    assert response.status_code == 400
    assert "Gmail" in response.json()["message"]


async def test_sync_and_list_gmail_inbox(client, admin_headers, db_session, organization):
    from app.models.email_account import EmailAccount, EmailAccountProvider

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True,
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    db_session.add(account)
    await db_session.commit()

    fake_messages = [{
        "provider_message_id": "m1", "thread_id": "t1", "from_name": "Jane",
        "from_address": "jane@acme.com", "to_address": "gmail@acme.com",
        "subject": "Hello", "snippet": "Hi there", "received_at_ms": 1700000000000,
    }]
    with patch("app.services.email_providers.gmail_provider.list_recent_messages", return_value=fake_messages):
        sync_response = await client.post("/v1/inbox/sync", headers=admin_headers)
    assert sync_response.status_code == 200
    assert sync_response.json()["data"]["new_count"] == 1

    list_response = await client.get("/v1/inbox", headers=admin_headers)
    messages = list_response.json()["data"]["messages"]
    assert len(messages) == 1
    assert messages[0]["subject"] == "Hello"
    assert messages[0]["is_read"] is False


async def test_get_message_detail_fetches_body(client, admin_headers, db_session, organization):
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailMessage

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True,
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id,
        provider_message_id="m1", subject="Hello", is_read=False,
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)

    with patch(
        "app.services.email_providers.gmail_provider.get_message_full",
        return_value={"body_html": "<p>Hi</p>", "body_text": "Hi"},
    ):
        response = await client.get(f"/v1/inbox/{message.id}", headers=admin_headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["body_html"] == "<p>Hi</p>"
    assert data["is_read"] is True
