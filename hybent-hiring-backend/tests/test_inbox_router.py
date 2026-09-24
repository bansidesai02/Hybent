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

    # Synced, but not a resume application — the Inbox only lists those.
    list_response = await client.get("/v1/inbox", headers=admin_headers)
    assert list_response.json()["data"]["messages"] == []

    from sqlalchemy import select
    from app.models.candidate import Candidate
    from app.models.email_message import EmailIngestionStatus, EmailMessage
    message = (await db_session.execute(select(EmailMessage))).scalar_one()
    message.ingestion_status = EmailIngestionStatus.CREATED
    db_session.add(Candidate(
        organization_id=organization.id, email="jane@acme.com", full_name="Jane",
        source="email", source_email_message_id=message.id,
    ))
    await db_session.commit()

    list_response = await client.get("/v1/inbox", headers=admin_headers)
    messages = list_response.json()["data"]["messages"]
    assert len(messages) == 1
    assert messages[0]["subject"] == "Hello"
    assert messages[0]["is_read"] is False
    assert messages[0]["candidate_count"] == 1


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


async def test_message_detail_has_headers_attachments_and_candidates(client, admin_headers, db_session, organization):
    from app.models.candidate import Candidate
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailIngestionStatus, EmailMessage

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True,
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id, provider_message_id="m1",
        subject="Two profiles", ingestion_status=EmailIngestionStatus.CREATED,
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    alice = Candidate(
        organization_id=organization.id, email="alice@x.com", full_name="Alice",
        source="email", source_email_message_id=message.id, resume_filename="alice.pdf",
    )
    db_session.add(alice)
    await db_session.commit()
    await db_session.refresh(alice)

    full = {
        "body_html": None, "body_text": "Please find attached.",
        "to": "gmail@acme.com", "cc": "boss@acme.com", "date": "Thu, 24 Sep 2026 13:09:49 +0000",
        "attachments": [
            {"filename": "alice.pdf", "mime_type": "application/pdf", "size": 1200, "inline_data": "YWJj"},
            {"filename": "terms.pdf", "mime_type": "application/pdf", "size": 300, "inline_data": "eHl6"},
        ],
    }
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=full):
        detail = (await client.get(f"/v1/inbox/{message.id}", headers=admin_headers)).json()["data"]
        download = await client.get(f"/v1/inbox/{message.id}/attachments/0", headers=admin_headers)
        missing = await client.get(f"/v1/inbox/{message.id}/attachments/5", headers=admin_headers)

    assert detail["to"] == "gmail@acme.com"
    assert detail["cc"] == "boss@acme.com"
    assert detail["date"].startswith("Thu, 24 Sep 2026")
    assert [a["filename"] for a in detail["attachments"]] == ["alice.pdf", "terms.pdf"]
    assert detail["attachments"][0]["candidate_id"] == str(alice.id)
    assert detail["attachments"][1]["candidate_id"] is None
    assert [c["full_name"] for c in detail["candidates"]] == ["Alice"]

    assert download.status_code == 200
    assert download.content == b"abc"
    assert download.headers["content-type"] == "application/pdf"
    assert "alice.pdf" in download.headers["content-disposition"]
    assert missing.status_code == 404
