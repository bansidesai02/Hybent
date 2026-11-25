import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.services import whatsapp_bot, whatsapp_service


@pytest.fixture(autouse=True)
def _wa(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_token", "t")
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "PNID")
    monkeypatch.setattr(settings, "whatsapp_verify_token", "verify-me")
    monkeypatch.setattr(settings, "whatsapp_app_secret", "s3cret")


def _sig(body: bytes) -> str:
    return "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_handshake(client):
    ok = await client.get("/v1/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42"})
    assert ok.status_code == 200 and ok.text == "42"
    bad = await client.get("/v1/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42"})
    assert bad.status_code == 403


@pytest.mark.asyncio
async def test_webhook_needs_meta_signature_and_queues_messages(client):
    msg = {"from": "919876543210", "id": "wamid.1", "type": "text", "text": {"body": "price?"}}
    body = json.dumps({"entry": [{"changes": [{"value": {"metadata": {"phone_number_id": "PNID"}, "messages": [msg]}}]}]}).encode()
    with patch("app.tasks.whatsapp.whatsapp_answer.delay") as delay:
        r = await client.post("/v1/whatsapp/webhook", content=body, headers={"x-hub-signature-256": "sha256=bad"})
        assert r.status_code == 403
        r = await client.post("/v1/whatsapp/webhook", content=body, headers={"x-hub-signature-256": _sig(body)})
        assert r.status_code == 200
        delay.assert_called_once_with(msg, None)


def test_markdown_becomes_whatsapp_formatting():
    out = whatsapp_bot.to_whatsapp("## Plans\n**Pro** is $39. See [Pricing](/pricing)\n- one")
    assert out == "Plans\n*Pro* is $39. See Pricing: https://hybent.com/pricing\n• one"


def test_action_tags_are_parsed_and_removed():
    text, a = whatsapp_bot.parse_tags(
        'Great! Pro is *$39*. [LEAD:{"company":"Acme","team_size":"5","password":"x"}] [TRIAL] [SUGGEST:Pricing|Free trial]')
    assert text == "Great! Pro is *$39*."
    assert a["lead"] == {"company": "Acme", "team_size": "5"}       # unknown keys dropped
    assert a["trial"] and not a["handoff"] and a["suggest"] == ["Pricing", "Free trial"]


def _same_session(monkeypatch, db_session):
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def same():
        yield db_session
    monkeypatch.setattr(whatsapp_bot, "AsyncSessionLocal", same)


def _msg(sender, text):
    import uuid
    return {"from": sender, "id": f"wamid.{uuid.uuid4().hex}", "type": "text", "text": {"body": text}}


@pytest.mark.asyncio
async def test_lead_details_saved_and_handoff_pauses_bot(db_session, monkeypatch):
    import uuid
    from sqlalchemy import select
    from app.models.whatsapp import WhatsAppContact, WhatsAppMessage
    _same_session(monkeypatch, db_session)
    sender = f"91{uuid.uuid4().int % 10**10:010d}"
    replies = iter([
        'Nice to meet you! [LEAD:{"name":"Priya","company":"Acme","team_size":"8"}] [SUGGEST:Pricing]',
        "Sure. [HANDOFF]",
    ])
    model = AsyncMock(side_effect=lambda *a, **k: next(replies))
    with patch.object(whatsapp_bot, "_generate_text_with_fallback", model),          patch.object(whatsapp_service, "send_message", return_value="w") as send,          patch.object(whatsapp_service, "mark_read"), patch.object(whatsapp_bot, "_notify_team", AsyncMock()) as notify:
        await whatsapp_bot.handle(_msg(sender, "I'm Priya from Acme, 8 recruiters"), "Priya")
        await whatsapp_bot.handle(_msg(sender, "can I talk to someone?"))
        await whatsapp_bot.handle(_msg(sender, "hello?"))                 # paused: bot quiet
    c = (await db_session.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == sender))).scalar_one()
    assert c.kind == "lead" and c.status == "qualified" and c.lead["company"] == "Acme"
    assert c.bot_paused and c.handoff_requested_at
    assert model.await_count == 2 and send.call_count == 2
    assert notify.await_count == 2
    n = len((await db_session.execute(select(WhatsAppMessage).where(WhatsAppMessage.contact_id == c.id))).scalars().all())
    assert n == 5                                                        # 3 in, 2 out


@pytest.mark.asyncio
async def test_number_alone_never_unlocks_a_candidate(db_session, organization, monkeypatch):
    """A resume phone that matches proves nothing; the portal OTP or an email code does."""
    import uuid
    from datetime import datetime, timezone
    from app.models.candidate import Candidate
    from app.models.whatsapp import WhatsAppContact
    from app.services import whatsapp_identity
    digits = f"91{uuid.uuid4().int % 10**10:010d}"
    cand = Candidate(organization_id=organization.id, email=f"r{digits}@example.com", full_name="Raj Patel",
                     phone=f"+{digits}", skills=[], tags=[])
    db_session.add(cand)
    contact = WhatsAppContact(wa_id=digits, phone=f"+{digits}", lead={})
    db_session.add(contact)
    await db_session.flush()
    assert (await whatsapp_identity.identify(db_session, contact)).kind == "visitor"
    cand.phone_verified_at = datetime.now(timezone.utc)
    await db_session.flush()
    who = await whatsapp_identity.identify(db_session, contact)
    assert who.kind == "candidate" and who.name == "Raj Patel"


@pytest.mark.asyncio
async def test_client_links_with_email_code(db_session, admin_user, monkeypatch):
    import uuid
    from sqlalchemy import select
    from app.models.whatsapp import WhatsAppContact
    _same_session(monkeypatch, db_session)
    sender = f"91{uuid.uuid4().int % 10**10:010d}"
    sent = {}
    monkeypatch.setattr("app.services.email_service.send_email",
                        lambda to, subject, html, **k: sent.update(to=to, code=html.split("4px'>")[1][:6]) or True)
    model = AsyncMock(return_value=f"Let me check. [LINK_EMAIL:{admin_user.email}]")
    with patch.object(whatsapp_bot, "_generate_text_with_fallback", model),          patch.object(whatsapp_service, "send_message", return_value="w"), patch.object(whatsapp_service, "mark_read"):
        await whatsapp_bot.handle(_msg(sender, f"I use Hybent, my email is {admin_user.email}"))
        assert sent["to"] == admin_user.email
        await whatsapp_bot.handle(_msg(sender, sent["code"]))
    c = (await db_session.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == sender))).scalar_one()
    assert c.kind == "client" and c.user_id == admin_user.id


@pytest.mark.asyncio
async def test_console_is_super_admin_only_and_sends(client, admin_headers, super_admin_headers):
    r = await client.post("/v1/whatsapp/console/send", json={"to": "9876543210", "text": "hi"}, headers=admin_headers)
    assert r.status_code == 403
    with patch.object(whatsapp_service, "send_text", return_value="wamid.9") as send:
        r = await client.post("/v1/whatsapp/console/send", json={"to": "98765 43210", "text": "hi"}, headers=super_admin_headers)
    assert r.status_code == 200 and r.json()["data"]["message_id"] == "wamid.9"
    assert send.call_args.args == ("919876543210", "hi")


# ── Step 2: verified candidates ───────────────────────────────────────────

def test_stage_labels_are_candidate_friendly():
    from app.services.whatsapp_identity import stage_label
    assert stage_label("applied") == "Under review"
    assert stage_label("pre_screening_selected") == "Shortlisted"
    assert stage_label("technical_round") == "In Technical round"
    assert stage_label("technical_round_selected").startswith("Cleared Technical round")
    assert stage_label("hr_round_rejected") == "Closed (not moving ahead this time)"
    assert stage_label("hired") == "Hired 🎉"


async def _verified_candidate_with_interview(db_session, organization, admin_user):
    import uuid
    from datetime import datetime, timedelta, timezone
    from app.models.application import Application
    from app.models.candidate import Candidate
    from app.models.interview import Interview
    from app.models.job import Job
    digits = f"91{uuid.uuid4().int % 10**10:010d}"
    cand = Candidate(organization_id=organization.id, email=f"c{digits}@example.com", full_name="Raj Patel",
                     phone=f"+{digits}", phone_verified_at=datetime.now(timezone.utc), sms_opt_in=True,
                     skills=[], tags=[])
    job = Job(organization_id=organization.id, title="Sales Executive", description="Sell", created_by_id=admin_user.id)
    db_session.add_all([cand, job])
    await db_session.flush()
    app_ = Application(organization_id=organization.id, job_id=job.id, candidate_id=cand.id,
                       stage="technical_round", match_score=87.5, recruiter_notes="SECRET NOTE")
    db_session.add(app_)
    await db_session.flush()
    iv = Interview(organization_id=organization.id, candidate_id=cand.id, application_id=app_.id,
                   scheduled_by_id=admin_user.id, title="Technical interview",
                   scheduled_at=datetime.now(timezone.utc) + timedelta(days=1), meeting_link="https://meet.google.com/x")
    db_session.add(iv)
    await db_session.commit()
    return digits, cand, iv


@pytest.mark.asyncio
async def test_candidate_context_has_status_and_interview_but_no_secrets(db_session, organization, admin_user):
    from app.services import whatsapp_identity
    _, cand, iv = await _verified_candidate_with_interview(db_session, organization, admin_user)
    ctx = await whatsapp_identity.candidate_context(db_session, [str(cand.id)])
    assert ctx["applications"][0]["job"] == "Sales Executive"
    assert ctx["applications"][0]["status"] == "In Technical round"
    assert ctx["interviews"][0]["ref"] == "I1" and ctx["interviews"][0]["join"] == "https://meet.google.com/x"
    blob = str(ctx)
    assert "87.5" not in blob and "SECRET NOTE" not in blob


@pytest.mark.asyncio
async def test_candidate_reschedule_request_and_stop_updates(db_session, organization, admin_user, monkeypatch):
    _same_session(monkeypatch, db_session)
    digits, cand, iv = await _verified_candidate_with_interview(db_session, organization, admin_user)
    seen = {}

    async def fake_model(system, user, **k):
        seen.setdefault("prompt", user)
        if "stop" in user.split("## New message")[1]:
            return "Done, no more updates. [STOP_UPDATES]"
        return 'Sent to the company. [RESCHEDULE:{"interview":"I1","reason":"exam","preferred":"Friday 4pm"}]'

    with patch.object(whatsapp_bot, "_generate_text_with_fallback", side_effect=fake_model), \
         patch.object(whatsapp_service, "send_message", return_value="w"), patch.object(whatsapp_service, "mark_read"), \
         patch("app.tasks.notifications.notify_organization_roles.delay") as notify:
        await whatsapp_bot.handle(_msg(digits, "kal exam hai, interview Friday 4pm kar sakte hai?"))
        await whatsapp_bot.handle(_msg(digits, "please stop updates"))
    assert "Technical interview" in seen["prompt"] and "Kind: candidate" in seen["prompt"]
    assert notify.call_count == 1
    org_id, roles, *_ , data = notify.call_args.args
    assert org_id == str(organization.id) and data["interview_id"] == str(iv.id)
    await db_session.refresh(cand)
    assert cand.sms_opt_in is False


# ── Step 3: apply on WhatsApp, client snapshot ────────────────────────────

@pytest.mark.asyncio
async def test_apply_on_whatsapp_creates_candidate_and_application(db_session, organization, admin_user, monkeypatch):
    import uuid
    from sqlalchemy import select
    from app.models.application import Application
    from app.models.candidate import Candidate
    from app.models.job import Job
    from app.models.whatsapp import WhatsAppContact
    from app.services import resume_intake, whatsapp_apply
    _same_session(monkeypatch, db_session)
    job = Job(organization_id=organization.id, title="Sales Executive", description="Sell",
              created_by_id=admin_user.id, status="active")
    db_session.add(job)
    await db_session.commit()
    sender = f"91{uuid.uuid4().int % 10**10:010d}"

    monkeypatch.setattr(resume_intake, "store_resume", AsyncMock())
    monkeypatch.setattr(resume_intake, "parse_into_profile", AsyncMock(return_value=True))
    monkeypatch.setattr(resume_intake, "score_application", AsyncMock())
    sent = []
    model = AsyncMock(return_value="should not be called")
    doc = {"from": sender, "id": f"wamid.{uuid.uuid4().hex}", "type": "document",
           "document": {"id": "MEDIA1", "mime_type": "application/pdf", "filename": "raj.pdf"}}
    with patch.object(whatsapp_bot, "_generate_text_with_fallback", model), \
         patch.object(whatsapp_service, "send_message", side_effect=lambda p: sent.append(p["text"]["body"]) or "w"), \
         patch.object(whatsapp_service, "mark_read"), \
         patch.object(whatsapp_service, "download_media", return_value=(b"%PDF-1.4 resume", "application/pdf")), \
         patch("app.tasks.screening.enqueue_screening"), patch("app.tasks.notifications.notify_organization_roles.delay"):
        for t in [f"Apply {whatsapp_apply.job_code(job.id)}", "Raj Patel", "not-an-email", f"raj{sender}@example.com",
                  "4 LPA", "6 LPA", "30 days"]:
            await whatsapp_bot.handle(_msg(sender, t))
        await whatsapp_bot.handle(doc)
    assert "Sales Executive" in sent[0] and "full name" in sent[0]
    assert "doesn't look right" in sent[2]
    assert "Done, Raj" in sent[-1]
    model.assert_not_called()
    cand = (await db_session.execute(select(Candidate).where(Candidate.email == f"raj{sender}@example.com"))).scalar_one()
    assert cand.phone_verified_at and cand.sms_opt_in and cand.expected_ctc == "6 LPA" and cand.notice_period_days == "30 days"
    app_ = (await db_session.execute(select(Application).where(Application.candidate_id == cand.id))).scalar_one()
    assert app_.job_id == job.id and app_.source == "whatsapp"
    c = (await db_session.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == sender))).scalar_one()
    assert c.kind == "candidate"


@pytest.mark.asyncio
async def test_client_snapshot_is_own_company_only(db_session, organization, admin_user):
    from app.services import whatsapp_identity
    _, cand, iv = await _verified_candidate_with_interview(db_session, organization, admin_user)
    snap = await whatsapp_identity.client_context(db_session, str(admin_user.id))
    assert snap["scope"] == "whole company"
    assert any(i["candidate"] == "Raj Patel" for i in snap["interviews_today_and_tomorrow"])
    assert any(j["job"] == "Sales Executive" for j in snap["open_jobs"])
    assert "87.5" not in str(snap) and "SECRET NOTE" not in str(snap)
