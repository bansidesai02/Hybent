"""Inbox sync/read: Gmail metadata parsing, sync dedupe, and read-on-open."""
from unittest.mock import MagicMock, patch

import pytest

from app.models.email_account import EmailAccount, EmailAccountProvider
from app.services.email_inbox_service import EmailInboxService
from app.services.email_providers import gmail_provider
from app.utils import crypto


def _gmail_account(**overrides) -> EmailAccount:
    defaults = dict(
        provider=EmailAccountProvider.GMAIL,
        email_address="recruiter@acme.com",
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    defaults.update(overrides)
    return EmailAccount(**defaults)


def test_parse_from_header_with_display_name():
    name, address = gmail_provider._parse_from_header('"Jane Doe" <jane@acme.com>')
    assert name == "Jane Doe"
    assert address == "jane@acme.com"


def test_parse_from_header_bare_address():
    name, address = gmail_provider._parse_from_header("jane@acme.com")
    assert name is None
    assert address == "jane@acme.com"


def test_list_recent_messages_parses_metadata():
    account = _gmail_account()
    list_response = MagicMock(status_code=200, json=lambda: {"messages": [{"id": "m1"}, {"id": "m2"}]})
    detail_response = MagicMock(
        status_code=200,
        json=lambda: {
            "id": "m1",
            "threadId": "t1",
            "snippet": "Hi there",
            "internalDate": "1700000000000",
            "payload": {"headers": [
                {"name": "From", "value": '"Jane Doe" <jane@acme.com>'},
                {"name": "Subject", "value": "Hello"},
                {"name": "To", "value": "me@acme.com"},
            ]},
        },
    )
    with patch("app.services.email_providers.gmail_provider._refresh_access_token_sync", return_value="fake-access-token"), \
         patch("app.services.email_providers.gmail_provider.httpx.get", side_effect=[list_response, detail_response, detail_response]):
        results = gmail_provider.list_recent_messages(account, max_results=2)

    assert len(results) == 2
    assert results[0]["from_name"] == "Jane Doe"
    assert results[0]["from_address"] == "jane@acme.com"
    assert results[0]["subject"] == "Hello"
    assert results[0]["snippet"] == "Hi there"


def test_get_message_full_extracts_html_and_text_parts():
    import base64
    account = _gmail_account()
    html_b64 = base64.urlsafe_b64encode(b"<p>Hi</p>").decode()
    text_b64 = base64.urlsafe_b64encode(b"Hi").decode()
    response = MagicMock(
        status_code=200,
        json=lambda: {
            "payload": {
                "mimeType": "multipart/alternative",
                "parts": [
                    {"mimeType": "text/plain", "body": {"data": text_b64}},
                    {"mimeType": "text/html", "body": {"data": html_b64}},
                ],
            }
        },
    )
    with patch("app.services.email_providers.gmail_provider._refresh_access_token_sync", return_value="fake-access-token"), \
         patch("app.services.email_providers.gmail_provider.httpx.get", return_value=response):
        body = gmail_provider.get_message_full(account, "m1")

    assert body["body_text"] == "Hi"
    assert body["body_html"] == "<p>Hi</p>"


async def test_sync_account_dedupes_by_provider_message_id(db_session, organization):
    account = EmailAccount(
        organization_id=organization.id,
        provider=EmailAccountProvider.GMAIL,
        email_address="recruiter@acme.com",
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    fake_messages = [
        {
            "provider_message_id": "m1", "thread_id": "t1", "from_name": "Jane",
            "from_address": "jane@acme.com", "to_address": "me@acme.com",
            "subject": "Hi", "snippet": "snippet", "received_at_ms": 1700000000000,
        }
    ]
    service = EmailInboxService(db_session)

    with patch("app.services.email_providers.gmail_provider.list_recent_messages", return_value=fake_messages):
        first_count = await service.sync_account(account)
        second_count = await service.sync_account(account)  # same message again

    assert first_count == 1
    assert second_count == 0
    messages = await service.list_messages(account.id)
    assert len(messages) == 1


async def test_sync_account_skips_non_gmail_providers(db_session, organization):
    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="a@acme.com",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    service = EmailInboxService(db_session)
    with patch("app.services.email_providers.gmail_provider.list_recent_messages") as mock_list:
        count = await service.sync_account(account)

    assert count == 0
    mock_list.assert_not_called()


async def test_get_message_detail_marks_read_and_fetches_body(db_session, organization):
    from app.models.email_message import EmailMessage

    account = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.GMAIL, email_address="a@acme.com",
        refresh_token_encrypted=crypto.encrypt("rt"),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id,
        provider_message_id="m1", subject="Hi", is_read=False,
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)

    service = EmailInboxService(db_session)
    with patch(
        "app.services.email_providers.gmail_provider.get_message_full",
        return_value={"body_html": "<p>Hi</p>", "body_text": "Hi"},
    ):
        fetched, body = await service.get_message_detail(account, message.id)

    assert fetched.is_read is True
    assert body["body_html"] == "<p>Hi</p>"
