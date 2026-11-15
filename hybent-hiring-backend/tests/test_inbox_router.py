"""Inbox API: role-based account resolution, sync, and message detail."""
from datetime import datetime as _dt, timezone as _tz
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

CONNECTED_LONG_AGO = _dt(2020, 1, 1, tzinfo=_tz.utc)


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
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
        email_address="gmail@acme.com", is_default=True, connected_by_user_id=admin_user.id,
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    db_session.add(account)
    await db_session.commit()

    fake = {
        "provider_message_id": "m1", "thread_id": "t1", "from_name": "Jane",
        "from_address": "jane@acme.com", "to_address": "gmail@acme.com",
        "subject": "Hello", "snippet": "Hi there", "received_at_ms": 1700000000000,
    }
    with patch("app.services.email_providers.gmail_provider.search_message_ids", return_value=(["m1"], None)), \
         patch("app.services.email_providers.gmail_provider.get_message_metadata", return_value=fake):
        sync_response = await client.post("/v1/inbox/sync", headers=admin_headers)
    assert sync_response.status_code == 200
    assert sync_response.json()["data"]["new_count"] == 1
    assert sync_response.json()["data"]["history_done"] is True

    # A resume email waiting to be processed is listed (tab "Processing"), not hidden.
    data = (await client.get("/v1/inbox", headers=admin_headers)).json()["data"]
    assert [m["subject"] for m in data["messages"]] == ["Hello"]
    assert data["counts"] == {"all": 1, "candidates": 0, "review": 0, "processing": 1}
    assert data["account"]["history_done"] is True and data["account"]["last_synced_at"]

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

    list_response = await client.get("/v1/inbox", params={"view": "candidates"}, headers=admin_headers)
    messages = list_response.json()["data"]["messages"]
    assert len(messages) == 1
    assert messages[0]["subject"] == "Hello"
    assert messages[0]["is_read"] is False
    assert messages[0]["candidate_count"] == 1


async def test_get_message_detail_fetches_body(client, admin_headers, db_session, organization, admin_user):
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailMessage

    account = EmailAccount(
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
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
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL,
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


async def test_company_mailbox_is_shared_and_personal_one_is_private(
    client, db_session, organization, admin_user, second_admin_user, recruiter_user, second_recruiter_user
):
    """A mailbox an admin connected (company scope) is read by every admin and
    recruiter; a recruiter's personal one stays theirs alone."""
    from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope
    from tests.conftest import auth_headers

    company = EmailAccount(
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="hr@acme.com",
        is_default=True, connected_by_user_id=admin_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
        scope=EmailAccountScope.ORGANIZATION,
    )
    personal = EmailAccount(
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="neha@acme.com",
        is_default=True, connected_by_user_id=recruiter_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
        scope=EmailAccountScope.PERSONAL,
    )
    db_session.add_all([company, personal])
    await db_session.commit()

    other_admin = (await client.get("/v1/inbox", headers=auth_headers(second_admin_user))).json()["data"]
    assert other_admin["account"]["email_address"] == "hr@acme.com" and other_admin["account"]["shared"] is True
    assert [m["email_address"] for m in other_admin["mailboxes"]] == ["hr@acme.com"]

    owner = (await client.get("/v1/inbox", headers=auth_headers(recruiter_user))).json()["data"]
    assert owner["account"]["email_address"] == "neha@acme.com"            # own first
    assert sorted(m["email_address"] for m in owner["mailboxes"]) == ["hr@acme.com", "neha@acme.com"]

    other_recruiter = (await client.get("/v1/inbox", headers=auth_headers(second_recruiter_user))).json()["data"]
    assert other_recruiter["account"]["email_address"] == "hr@acme.com"
    asked = (await client.get("/v1/inbox", params={"account_id": str(personal.id)},
                              headers=auth_headers(second_recruiter_user))).json()["data"]
    assert asked["account"] is None


async def test_personal_mailbox_messages_stay_private(client, db_session, organization, recruiter_user, second_recruiter_user):
    """A recruiter's personal mailbox: nobody else lists it or opens its
    messages — even when asking for it by id."""
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailIngestionStatus, EmailMessage
    from tests.conftest import auth_headers

    from app.models.email_account import EmailAccountScope
    account = EmailAccount(
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="owner@acme.com",
        is_default=True, connected_by_user_id=recruiter_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
        scope=EmailAccountScope.PERSONAL,
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

    owner, other = auth_headers(recruiter_user), auth_headers(second_recruiter_user)

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
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="one@acme.com",
        is_default=True, connected_by_user_id=admin_user.id, refresh_token_encrypted=crypto.encrypt("rt"),
    )
    second = EmailAccount(
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="two@acme.com",
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
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="me@acme.com",
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


async def _gmail_with_message(db_session, organization, owner, **message_fields):
    from app.models.email_account import EmailAccount, EmailAccountProvider
    from app.models.email_message import EmailMessage

    account = EmailAccount(
        created_at=CONNECTED_LONG_AGO, organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="hr@acme.com",
        display_name="Acme HR", is_default=True, connected_by_user_id=owner.id,
        refresh_token_encrypted=crypto.encrypt("rt"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = EmailMessage(organization_id=organization.id, email_account_id=account.id,
                           provider_message_id="g1", thread_id="th1", subject="My resume", **message_fields)
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    return account, message


async def test_send_and_reply_from_the_inbox(client, db_session, organization, admin_user, admin_headers):
    account, message = await _gmail_with_message(db_session, organization, admin_user, has_attachments=True)
    sent = []

    def fake_send(acc, to, subject, html_body, cc=None, thread_id=None, in_reply_to=None, references=None):
        sent.append(dict(to=to, subject=subject, body=html_body, cc=cc, thread_id=thread_id, in_reply_to=in_reply_to))
        return {"id": "x", "threadId": thread_id or "new"}

    meta = {"message_id_header": "<abc@mail.gmail.com>", "references": None}
    with patch("app.services.email_providers.gmail_provider.send_message", side_effect=fake_send), \
         patch("app.services.email_providers.gmail_provider.get_message_metadata", return_value=meta):
        new = await client.post("/v1/inbox/send", headers=admin_headers, json={
            "to": ["jane@x.com"], "subject": "Interview", "body": "Hi Jane,\n<b>Thursday</b> works?",
        })
        reply = await client.post("/v1/inbox/send", headers=admin_headers, json={
            "to": ["jane@x.com"], "cc": ["boss@acme.com"], "subject": "Re: My resume", "body": "Thanks!",
            "reply_to_message_id": str(message.id),
        })
        bad = await client.post("/v1/inbox/send", headers=admin_headers, json={"to": ["not-an-email"], "subject": "x", "body": "y"})

    assert new.status_code == 200, new.text and "hr@acme.com" in new.json()["message"]
    assert sent[0]["thread_id"] is None and sent[0]["to"] == ["jane@x.com"]
    assert "&lt;b&gt;Thursday&lt;/b&gt;" in sent[0]["body"] and "<br>" in sent[0]["body"]   # escaped, line breaks kept
    assert reply.status_code == 200
    assert sent[1]["thread_id"] == "th1" and sent[1]["in_reply_to"] == "<abc@mail.gmail.com>"
    assert sent[1]["cc"] == ["boss@acme.com"]
    assert bad.status_code == 422


async def test_send_needs_a_connected_gmail(client, db_session, organization, admin_user, admin_headers):
    account, _ = await _gmail_with_message(db_session, organization, admin_user)
    account.status = "reauth_required"
    await db_session.commit()
    r = await client.post("/v1/inbox/send", headers=admin_headers, json={"to": ["a@x.com"], "subject": "s", "body": "b"})
    assert r.status_code == 409


async def test_failed_resume_is_listed_for_review_and_can_be_retried(
    client, db_session, organization, admin_user, admin_headers
):
    from app.models.email_message import EmailIngestionStatus

    _, message = await _gmail_with_message(
        db_session, organization, admin_user, has_attachments=True, ingestion_attempts=3,
        ingestion_status=EmailIngestionStatus.FAILED, ingestion_error="cv.pdf\tCould not read it",
    )
    data = (await client.get("/v1/inbox", params={"view": "review"}, headers=admin_headers)).json()["data"]
    assert [m["subject"] for m in data["messages"]] == ["My resume"]

    r = await client.post(f"/v1/inbox/{message.id}/retry", headers=admin_headers)
    assert r.status_code == 200
    await db_session.refresh(message)
    assert message.ingestion_status is None and message.ingestion_attempts == 0 and message.ingestion_error is None
    data = (await client.get("/v1/inbox", params={"view": "processing"}, headers=admin_headers)).json()["data"]
    assert [m["subject"] for m in data["messages"]] == ["My resume"]
