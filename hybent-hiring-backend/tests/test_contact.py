"""The public hybent.com/contact form."""
import pytest

import app.routers.public as public


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(public, "send_email", lambda to, subject, body: sent.append((to, subject, body)) or True)
    return sent


async def test_contact_emails_the_team(client, outbox):
    res = await client.post("/api/public/contact", json={
        "name": "Ananya Shah", "email": "ananya@example.com",
        "message": "We lose two weeks of every search in screening <script>",
        "company": "Acme", "phone": "  ", "referrer": "LinkedIn",
    })
    assert res.status_code == 200, res.text
    assert len(outbox) == 1
    to, subject, body = outbox[0]
    assert to == "info@hybent.com"
    assert subject == "Contact form: Ananya Shah (Acme)"
    assert "LinkedIn" in body and "Phone" not in body  # blank optional fields are left out
    assert "<script>" not in body and "&lt;script&gt;" in body


async def test_only_name_email_and_message_are_required(client, outbox):
    res = await client.post("/api/public/contact", json={
        "name": "A", "email": "a@example.com", "message": "Just a short question here",
    })
    assert res.status_code == 200 and len(outbox) == 1


@pytest.mark.parametrize("payload", [
    {"email": "a@example.com", "message": "long enough message"},
    {"name": "A", "email": "not-an-email", "message": "long enough message"},
    {"name": "A", "email": "a@example.com", "message": "short"},
    {"name": "   ", "email": "a@example.com", "message": "long enough message"},
])
async def test_invalid_submissions_are_refused(client, outbox, payload):
    assert (await client.post("/api/public/contact", json=payload)).status_code == 422
    assert outbox == []


async def test_honeypot_drops_bots_quietly(client, outbox):
    res = await client.post("/api/public/contact", json={
        "name": "Bot", "email": "bot@example.com", "message": "buy cheap things now", "website": "http://spam",
    })
    assert res.status_code == 200 and outbox == []


async def test_failed_send_is_reported(client, monkeypatch):
    monkeypatch.setattr(public, "send_email", lambda *a: False)
    res = await client.post("/api/public/contact", json={
        "name": "A", "email": "a@example.com", "message": "long enough message",
    })
    assert res.status_code == 502
    assert "info@hybent.com" in res.json()["message"]


# ── Demo requests (hybent.com/register) ──────────────────────────────────────

import app.services.email_service as email_service  # noqa: E402

DEMO = {
    "first_name": "Ananya", "last_name": "Shah", "work_email": "ananya@example.com",
    "company_name": "Acme", "team_size": "11-50", "monthly_hires": "Not asked",
    "hiring_challenge": "Book a demo",
}


@pytest.fixture
def demo_outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "send_email", lambda to, subject, body: sent.append((to, subject, body)) or True)
    return sent


async def test_demo_request_escapes_what_visitors_type(client, demo_outbox):
    res = await client.post("/api/public/demo-request", json={
        **DEMO,
        "first_name": "<img src=x onerror=alert(1)>",
        "company_name": "Acme\r\nBcc: victim@example.com",
        "hiring_challenge": '"><a href="https://evil.example">click</a>',
    })
    assert res.status_code == 200, res.text
    to, subject, body = demo_outbox[0]
    assert to == "info@hybent.com"
    assert "<img src=x" not in body and "&lt;img src=x onerror=alert(1)&gt;" in body
    assert 'href="https://evil.example"' not in body
    # No line breaks reach the subject header.
    assert "\r" not in subject and "\n" not in subject


async def test_demo_request_reports_a_failed_send(client, monkeypatch):
    monkeypatch.setattr(email_service, "send_email", lambda *a: False)
    res = await client.post("/api/public/demo-request", json=DEMO)
    assert res.status_code == 502
    assert "info@hybent.com" in res.json()["message"]


async def test_demo_request_hides_internal_errors(client, monkeypatch):
    def boom(*a):
        raise RuntimeError("smtp password=hunter2")
    monkeypatch.setattr(email_service, "send_email", boom)
    res = await client.post("/api/public/demo-request", json=DEMO)
    assert res.status_code == 502
    assert "hunter2" not in res.text


async def test_demo_request_limits_input_size(client, demo_outbox):
    res = await client.post("/api/public/demo-request", json={**DEMO, "hiring_challenge": "x" * 5001})
    assert res.status_code == 422 and demo_outbox == []
