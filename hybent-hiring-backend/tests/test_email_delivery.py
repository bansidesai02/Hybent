"""Email isn't silently lost: providers fall back, and failure is reported."""
import pytest

from app.core.config import settings
from app.services import email_service
from tests.conftest import auth_headers


@pytest.fixture
def both_providers(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "key")
    monkeypatch.setattr(settings, "smtp_user", "user")
    monkeypatch.setattr(settings, "smtp_password", "pass")


def _fail(*a, **k):
    raise RuntimeError("provider down")


def test_smtp_takes_over_when_resend_fails(monkeypatch, both_providers):
    sent = []
    monkeypatch.setattr(email_service, "_send_resend", _fail)
    monkeypatch.setattr(email_service, "_send_smtp", lambda to, *a, **k: sent.append(to))
    assert email_service.send_email("a@example.com", "Hi", "<p>x</p>") is True
    assert sent == ["a@example.com"]


def test_smtp_not_used_when_resend_works(monkeypatch, both_providers):
    monkeypatch.setattr(email_service, "_send_resend", lambda *a, **k: None)
    monkeypatch.setattr(email_service, "_send_smtp", _fail)
    assert email_service.send_email("a@example.com", "Hi", "<p>x</p>") is True


def test_all_providers_failing_is_reported(monkeypatch, both_providers):
    monkeypatch.setattr(email_service, "_send_resend", _fail)
    monkeypatch.setattr(email_service, "_send_smtp", _fail)
    assert email_service.send_email("a@example.com", "Hi", "<p>x</p>") is False


def test_unconfigured_email_is_a_failure_in_production(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(settings, "app_env", "production")
    assert email_service.send_email("a@example.com", "Hi", "<p>x</p>") is False


async def test_super_admin_sees_a_failed_reset_email(client, monkeypatch, super_admin_user, admin_user):
    monkeypatch.setattr(email_service, "send_email", lambda *a, **k: False)
    r = await client.post(f"/v1/super-admin/users/{admin_user.id}/reset-password", headers=auth_headers(super_admin_user))
    assert r.status_code == 502 and "could not be sent" in r.json()["message"]
