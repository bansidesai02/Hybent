"""The public hybent.com/contact form."""
import pytest

import app.routers.public as public


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(public, "send_email", lambda to, subject, body: sent.append((to, subject, body)) or True)
    # No DNS or shared rate-limit state in tests.
    monkeypatch.setattr(public.lead_checks, "domain_accepts_mail", _accepts)
    monkeypatch.setattr(public.lead_checks, "rate_limited", lambda ip: False)
    return sent


async def _accepts(domain):
    return True


# Every field the form shows is required; Hybent Hiring leads add size and hires.
VALID = {
    "topic": "services", "name": "Ananya Shah", "email": "ananya@acme-example.com",
    "message": "We lose two weeks of every search in screening <script>",
    "company": "Acme", "phone": "+91 98765 43210", "location": "Pune", "referrer": "LinkedIn",
}


async def test_contact_emails_the_team(client, outbox):
    res = await client.post("/api/public/contact", json=VALID)
    assert res.status_code == 200, res.text
    assert len(outbox) == 1
    to, subject, body = outbox[0]
    assert to == "info@hybent.com"
    assert subject == "[IT Services] Ananya Shah – Acme"
    assert "LinkedIn" in body and "Pune" in body
    assert "<script>" not in body and "&lt;script&gt;" in body


async def test_hiring_leads_need_team_size_and_hires(client, outbox):
    hiring = {**VALID, "topic": "hiring"}
    assert (await client.post("/api/public/contact", json=hiring)).status_code == 422
    res = await client.post("/api/public/contact", json={**hiring, "team_size": "11-50", "hires_per_year": "10-25"})
    assert res.status_code == 200, res.text
    assert outbox[0][1].startswith("[Hybent Hiring]")


@pytest.mark.parametrize("change", [
    {"topic": None},
    {"name": "   "},
    {"email": "not-an-email"},
    {"message": "short"},
    {"phone": ""},
    {"company": ""},
    {"location": ""},
    {"referrer": ""},
])
async def test_invalid_submissions_are_refused(client, outbox, change):
    payload = {k: v for k, v in {**VALID, **change}.items() if v is not None}
    assert (await client.post("/api/public/contact", json=payload)).status_code == 422
    assert outbox == []


async def test_invalid_phone_names_the_field(client, outbox):
    res = await client.post("/api/public/contact", json={**VALID, "phone": "12"})
    assert res.status_code == 422 and outbox == []


async def test_honeypot_drops_bots_quietly(client, outbox):
    res = await client.post("/api/public/contact", json={**VALID, "website": "http://spam"})
    assert res.status_code == 200 and outbox == []


async def test_failed_send_is_reported(client, outbox, monkeypatch):
    monkeypatch.setattr(public, "send_email", lambda *a: False)
    res = await client.post("/api/public/contact", json=VALID)
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
