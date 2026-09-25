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


async def test_admin_inbox_resolves_their_own_primary(client, admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)

    response = await client.get("/v1/inbox", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["data"]["account"]["email_address"] == "recruiting@acme.com"


async def test_recruiter_inbox_resolves_own_personal_account(client, recruiter_headers, admin_headers):
    # An admin's mailbox never shows up as the recruiter's inbox.
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


async def test_sync_and_list_gmail_inbox(client, admin_headers, db_session, organization, admin_user):
    from app.models.email_account import EmailAccount, EmailAccountProvider

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True, connected_by_user_id=admin_user.id,
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


async def test_get_message_detail_fetches_body(client, admin_headers, db_session, organization, admin_user):
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailMessage

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True, connected_by_user_id=admin_user.id,
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


async def test_message_detail_has_headers_attachments_and_candidates(client, admin_headers, db_session, organization, admin_user):
    from app.models.candidate import Candidate
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailIngestionStatus, EmailMessage

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True, connected_by_user_id=admin_user.id,
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


async def test_another_admins_inbox_is_private(client, db_session, organization, admin_user, second_admin_user):
    """Two admins, one mailbox: only its owner sees it, lists it or opens its
    messages — even when asking for it by id."""
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailIngestionStatus, EmailMessage
    from tests.conftest import auth_headers

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="owner@acme.com",
        is_default=True, connected_by_user_id=admin_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id, provider_message_id="m1",
        subject="Resume", ingestion_status=EmailIngestionStatus.CREATED,
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)

    owner, other = auth_headers(admin_user), auth_headers(second_admin_user)

    assert (await client.get("/v1/inbox", headers=owner)).json()["data"]["account"]["id"] == str(account.id)
    other_view = (await client.get("/v1/inbox", headers=other)).json()["data"]
    assert other_view["account"] is None and other_view["messages"] == [] and other_view["mailboxes"] == []
    asked = (await client.get("/v1/inbox", params={"account_id": str(account.id)}, headers=other)).json()["data"]
    assert asked["account"] is None
    detail = await client.get(f"/v1/inbox/{message.id}", params={"account_id": str(account.id)}, headers=other)
    assert detail.status_code == 404


async def test_admin_can_switch_between_their_own_mailboxes(client, db_session, organization, admin_user, admin_headers):
    from app.models.email_account import EmailAccount, EmailAccountProvider

    first = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="one@acme.com",
        is_default=True, connected_by_user_id=admin_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
    )
    second = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="two@acme.com",
        connected_by_user_id=admin_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
    )
    db_session.add_all([first, second])
    await db_session.commit()
    await db_session.refresh(second)

    default_view = (await client.get("/v1/inbox", headers=admin_headers)).json()["data"]
    assert default_view["account"]["email_address"] == "one@acme.com"
    assert sorted(m["email_address"] for m in default_view["mailboxes"]) == ["one@acme.com", "two@acme.com"]
    switched = (await client.get("/v1/inbox", params={"account_id": str(second.id)}, headers=admin_headers)).json()["data"]
    assert switched["account"]["email_address"] == "two@acme.com"


async def test_partly_processed_email_still_shows_with_per_file_outcomes(
    client, db_session, organization, admin_user, admin_headers
):
    """5 of 9 done, the rest retrying: it used to vanish from the Inbox until
    every attachment finished."""
    from app.models.candidate import Candidate
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailIngestionStatus, EmailMessage

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="me@acme.com",
        is_default=True, connected_by_user_id=admin_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id, provider_message_id="m1",
        subject="Profiles", ingestion_status=EmailIngestionStatus.RETRY_PENDING,
        ingestion_error="scan.pdf\tWaiting to retry — AI parsing temporarily failed\ninvoice.pdf\tNot a resume",
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    good = Candidate(organization_id=organization.id, email="a@x.com", full_name="A", source="email",
                     source_email_message_id=message.id, resume_filename="a.pdf")
    db_session.add(good)
    await db_session.commit()
    await db_session.refresh(good)
    message.ingestion_result_candidate_id = good.id
    await db_session.commit()

    listed = (await client.get("/v1/inbox", headers=admin_headers)).json()["data"]["messages"]
    assert [(m["subject"], m["ingestion_status"], m["candidate_count"]) for m in listed] == [("Profiles", "retry_pending", 1)]

    full = {"body_text": "hi", "attachments": [
        {"filename": n, "mime_type": "application/pdf", "size": 1, "inline_data": "eA"} for n in ("a.pdf", "scan.pdf", "invoice.pdf")
    ]}
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=full):
        detail = (await client.get(f"/v1/inbox/{message.id}", headers=admin_headers)).json()["data"]
    assert [(a["filename"], a["candidate_name"], a["outcome"]) for a in detail["attachments"]] == [
        ("a.pdf", "A", None),
        ("scan.pdf", None, "Waiting to retry — AI parsing temporarily failed"),
        ("invoice.pdf", None, "Not a resume"),
    ]
