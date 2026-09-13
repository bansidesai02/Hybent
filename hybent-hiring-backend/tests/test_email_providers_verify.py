"""
Unit tests for each provider's verify() — the no-send connection check used by
the periodic health job and by test_send()'s health bookkeeping.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.models.email_account import EmailAccount
from app.services.email_providers.gmail_provider import GmailProvider
from app.services.email_providers.outlook_provider import OutlookProvider
from app.services.email_providers.smtp_provider import SMTPProvider
from app.utils import crypto


def _smtp_account(**overrides) -> EmailAccount:
    defaults = dict(
        email_address="recruiting@acme.com",
        smtp_host="smtp.acme.com",
        smtp_port=587,
        smtp_username="recruiting@acme.com",
        smtp_password_encrypted=crypto.encrypt("app-password"),
        use_tls=True,
    )
    defaults.update(overrides)
    return EmailAccount(**defaults)


def test_smtp_verify_logs_in_without_sending():
    account = _smtp_account()
    with patch("smtplib.SMTP") as mock_smtp:
        server = mock_smtp.return_value.__enter__.return_value
        SMTPProvider().verify(account)

    server.login.assert_called_once_with("recruiting@acme.com", "app-password")
    server.sendmail.assert_not_called()


def test_smtp_verify_raises_on_missing_config():
    account = _smtp_account(smtp_host=None)
    with pytest.raises(ValueError, match="missing host/port/username"):
        SMTPProvider().verify(account)


def test_smtp_verify_propagates_login_failure():
    account = _smtp_account()
    with patch("smtplib.SMTP") as mock_smtp:
        server = mock_smtp.return_value.__enter__.return_value
        server.login.side_effect = Exception("535 auth failed")
        with pytest.raises(Exception, match="535 auth failed"):
            SMTPProvider().verify(account)


def test_gmail_verify_refreshes_token_only():
    account = EmailAccount(
        email_address="recruiting@acme.com",
        refresh_token_encrypted=crypto.encrypt("refresh-token-value"),
    )
    with patch("app.services.email_providers.gmail_provider.httpx.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=200, json=lambda: {"access_token": "new-token"})
        GmailProvider().verify(account)

    mock_post.assert_called_once()
    assert "oauth2.googleapis.com/token" in mock_post.call_args[0][0]


def test_gmail_verify_raises_without_refresh_token():
    account = EmailAccount(email_address="recruiting@acme.com", refresh_token_encrypted=None)
    with pytest.raises(ValueError, match="reconnect required"):
        GmailProvider().verify(account)


def test_gmail_verify_raises_on_revoked_token():
    account = EmailAccount(
        email_address="recruiting@acme.com",
        refresh_token_encrypted=crypto.encrypt("revoked-token"),
    )
    with patch("app.services.email_providers.gmail_provider.httpx.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=400, text="invalid_grant")
        with pytest.raises(ValueError, match="Failed to refresh Gmail access token"):
            GmailProvider().verify(account)


def test_outlook_verify_not_implemented():
    with pytest.raises(NotImplementedError):
        OutlookProvider().verify(EmailAccount(email_address="x@acme.com"))
