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


def test_send_email_falls_back_to_platform_sender_when_the_users_mailbox_fails():
    """A revoked token or changed SMTP password on the user's own mailbox must
    not lose the candidate's email — it goes out from the platform sender."""
    fake_account = MagicMock(provider="smtp", email_address="recruiting@acme.com")

    with patch("app.services.email_accounts_service.get_provider") as mock_get_provider, \
         patch.object(settings, "resend_api_key", ""), \
         patch.object(settings, "smtp_user", "platform@hybent.com"), \
         patch.object(settings, "smtp_password", "pw"), \
         patch("app.services.email_service._send_smtp") as platform_send:
        mock_get_provider.return_value.send.side_effect = Exception("smtp auth failed")
        result = email_service.send_email(
            "candidate@example.com", "Subject", "<p>Body</p>", email_account=fake_account
        )

    assert result is True
    platform_send.assert_called_once_with("candidate@example.com", "Subject", "<p>Body</p>")


def test_send_helpers_pass_the_users_mailbox_through():
    fake_account = MagicMock(provider="smtp", email_address="rec@acme.com")
    with patch("app.services.email_service.send_email") as send:
        email_service.send_interview_invite(
            candidate_email="c@x.com", candidate_name="C", round_name="R1", job_role="Dev",
            company_name="Acme", scheduled_at="September 24, 2026 at 10:00 AM", meeting_link="https://meet",
            email_account=fake_account,
        )
        email_service.send_rejection_email(
            candidate_email="c@x.com", candidate_name="C", job_title="Dev", company_name="Acme",
            email_account=fake_account,
        )
    assert [c.kwargs["email_account"] for c in send.call_args_list] == [fake_account, fake_account]
