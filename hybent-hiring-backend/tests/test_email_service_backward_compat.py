"""
Regression test proving app.services.email_service.send_email()'s existing
call sites (no email_account argument) are byte-for-byte unaffected by the
new optional `email_account` parameter added for per-organization mailboxes.
"""
from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.services import email_service


def test_send_email_without_account_uses_existing_global_smtp_path():
    """Every pre-existing call site (send_interview_invite, send_offer_email, ...)
    calls send_email(to, subject, html_body) with no 4th argument — this must
    keep hitting _send_smtp exactly as before."""
    with patch.object(settings, "resend_api_key", ""), \
         patch.object(settings, "smtp_user", "sender@hybent.com"), \
         patch.object(settings, "smtp_password", "app-password"), \
         patch("app.services.email_service._send_smtp") as mock_send_smtp:
        result = email_service.send_email("candidate@example.com", "Subject", "<p>Body</p>")

    assert result is True
    mock_send_smtp.assert_called_once_with("candidate@example.com", "Subject", "<p>Body</p>")


def test_send_email_without_account_uses_existing_resend_path():
    with patch.object(settings, "resend_api_key", "re_test_key"), \
         patch("app.services.email_service._send_resend") as mock_send_resend:
        result = email_service.send_email("candidate@example.com", "Subject", "<p>Body</p>")

    assert result is True
    mock_send_resend.assert_called_once_with("candidate@example.com", "Subject", "<p>Body</p>")


def test_send_email_console_fallback_unchanged_when_unconfigured():
    with patch.object(settings, "resend_api_key", ""), \
         patch.object(settings, "smtp_user", ""), \
         patch.object(settings, "smtp_password", ""):
        result = email_service.send_email("candidate@example.com", "Subject", "<p>Body</p>")

    assert result is True  # console fallback still reports success, as before


def test_send_email_with_account_routes_through_org_provider_instead():
    """New behavior: only triggered when a caller explicitly passes email_account."""
    fake_account = MagicMock(provider="smtp", email_address="recruiting@acme.com")

    with patch("app.services.email_accounts_service.get_provider") as mock_get_provider, \
         patch("app.services.email_service._send_smtp") as mock_send_smtp, \
         patch("app.services.email_service._send_resend") as mock_send_resend:
        result = email_service.send_email(
            "candidate@example.com", "Subject", "<p>Body</p>", email_account=fake_account
        )

    assert result is True
    mock_get_provider.assert_called_once_with("smtp")
    mock_get_provider.return_value.send.assert_called_once_with(
        fake_account, "candidate@example.com", "Subject", "<p>Body</p>"
    )
    mock_send_smtp.assert_not_called()
    mock_send_resend.assert_not_called()


def test_send_email_with_account_returns_false_on_provider_failure():
    fake_account = MagicMock(provider="smtp", email_address="recruiting@acme.com")

    with patch("app.services.email_accounts_service.get_provider") as mock_get_provider:
        mock_get_provider.return_value.send.side_effect = Exception("smtp auth failed")
        result = email_service.send_email(
            "candidate@example.com", "Subject", "<p>Body</p>", email_account=fake_account
        )

    assert result is False
