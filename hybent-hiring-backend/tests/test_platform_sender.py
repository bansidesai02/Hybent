"""Platform email goes out as info@hybent.com, whatever account SMTP logs in with."""
import email

import pytest

import app.routers.users as users_router
import app.services.email_service as email_service
from app.core.config import settings


class FakeSMTP:
    sent: list = []

    def __init__(self, *a, **k): pass
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def ehlo(self): pass
    def starttls(self): pass
    def login(self, user, password): self.user = user
    def sendmail(self, envelope_from, to, raw):
        FakeSMTP.sent.append((self.user, envelope_from, to, email.message_from_string(raw)))


@pytest.fixture
def smtp(monkeypatch):
    FakeSMTP.sent = []
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "smtp_user", "someone@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")
    monkeypatch.setattr(settings, "resend_api_key", "")
    return FakeSMTP.sent


def test_smtp_sends_as_the_platform_address(smtp):
    assert email_service.send_email("x@example.com", "Hi", "<p>Hello</p>")
    login, envelope_from, to, msg = smtp[0]
    assert login == "someone@gmail.com"
    assert envelope_from == "info@hybent.com"
    assert msg["From"] == "Hybent Hiring <info@hybent.com>"
    assert msg["Reply-To"] == "info@hybent.com"
    assert "someone@gmail.com" not in msg.as_string()


async def test_team_invite_comes_from_platform_not_admin_mailbox(client, admin_headers, monkeypatch):
    seen = {}

    def fake_invite(**kwargs):
        seen.update(kwargs)

    monkeypatch.setattr(users_router, "send_team_invite", fake_invite)
    res = await client.post("/v1/users/invite", headers=admin_headers, json={
        "email": "new.recruiter@example.com", "full_name": "New Recruiter",
        "role": "recruiter", "password": "TempPass123!",
    })
    assert res.status_code in (200, 201), res.text
    assert seen["to_email"] == "new.recruiter@example.com"
    # No mailbox passed, so send_email uses the platform sender.
    assert seen.get("email_account") is None
