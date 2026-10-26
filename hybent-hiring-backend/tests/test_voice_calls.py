"""
AI Calls (Hiring side): starting pre-screens, engine callbacks, tabs,
overrides, settings and tenant isolation. The engine is mocked.
"""
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.voice_call import VoiceCall
from app.routers import voice_calls as router_mod
from app.services import voice_calls as svc

SECRET = "test-voice-secret"


@pytest.fixture(autouse=True)
def ai_calls_off(monkeypatch):
    """Every test starts with AI Calls off, whatever the container's env says."""
    monkeypatch.setattr(settings, "ai_calls", False)
    monkeypatch.setattr(settings, "ai_calls_orgs", "")
    monkeypatch.setattr(settings, "voice_api_key", "")
    monkeypatch.setattr(settings, "voice_callback_secret", "")


@pytest.fixture
def ai_calls_on(monkeypatch):
    monkeypatch.setattr(settings, "ai_calls", True)
    monkeypatch.setattr(settings, "voice_api_key", "hvk_test")
    monkeypatch.setattr(settings, "voice_callback_secret", SECRET)


@pytest.fixture
def engine(monkeypatch):
    """Records task payloads; set .fail to make the engine refuse."""
    class FakeEngine:
        payloads: list = []
        fail: str | None = None

        async def create(self, payload):
            if self.fail:
                raise svc.EngineError(self.fail)
            self.payloads.append(payload)
            return {"id": str(uuid.uuid4()), "status": "SCHEDULED", "next_attempt_at": "2026-10-21T04:00:00+00:00"}

    fake = FakeEngine()
    fake.payloads = []
    monkeypatch.setattr(svc, "engine_create_task", fake.create)
    return fake


@pytest.fixture
def notified(monkeypatch):
    sent = []
    monkeypatch.setattr(router_mod, "_notify", lambda vc, name: sent.append((vc.outcome, name)))
    return sent


async def _job(db, org, user, **kw) -> Job:
    job = Job(organization_id=org.id, created_by_id=user.id, title="Backend Developer", description="APIs",
              skills_required=["Node.js"], min_experience_years=4, **kw)
    db.add(job)
    await db.commit()
    return job


async def _candidate(db, org, consent=True, phone="+91 9876543210", **kw) -> Candidate:
    c = Candidate(organization_id=org.id, email=f"c-{uuid.uuid4().hex[:6]}@x.com", full_name="Riya Shah", phone=phone,
                  ai_call_consent_at=datetime.now(timezone.utc) if consent else None,
                  ai_call_consent_source="APPLICATION_FORM" if consent else None, **kw)
    db.add(c)
    await db.commit()
    return c


def _signed(payload: dict, secret=SECRET, ts=None) -> tuple[bytes, dict]:
    body = json.dumps(payload).encode()
    ts = str(ts or int(time.time()))
    sig = "sha256=" + hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return body, {"X-Voice-Timestamp": ts, "X-Voice-Signature": sig, "Content-Type": "application/json"}


def _final_payload(vc: VoiceCall, **over) -> dict:
    payload = {
        "event": "call.final", "task_id": str(vc.engine_task_id), "client_ref": f"hiring:{vc.id}",
        "type": "PRESCREEN", "final": True, "task_status": "DONE", "status": "COMPLETED", "attempt_no": 1,
        "next_attempt_at": None,
        "call": {"started_at": "2026-10-21T05:00:00+00:00", "duration_sec": 296, "language": "en",
                 "audio_quality": "GOOD", "callback_at": None, "recording_url": None,
                 "transcript": [{"role": "assistant", "text": "Hello"}, {"role": "user", "text": "Hi"}]},
        "result": {
            "structured_data": {"answers": {
                "total_experience_years": 5.5, "current_company": "ABC Technologies", "current_role": "Software Engineer",
                "current_ctc": {"value": 1200000, "currency": "INR"}, "expected_ctc": {"value": 1600000, "currency": "INR"},
                "notice_period_days": 60, "relevant_experience_years": "UNCLEAR"}},
            "summary_text": "Strong backend profile.",
            "communication": {"overall": 4.2},
            "recommendation": {"decision": "RECOMMEND_NEXT_ROUND", "reasons": ["Experience matches"]},
            "flags": [],
        },
    }
    payload.update(over)
    return payload


# ── Unit ─────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("phone, tz, expected", [
    ("+91 9876543210", "Asia/Kolkata", "+919876543210"),
    ("+1 4155550123", "America/New_York", "+14155550123"),
    ("9876543210", "Asia/Kolkata", "+919876543210"),
    ("9876543210", "Asia/Dubai", None),        # no country code outside India: refuse to guess
    ("12345", "Asia/Kolkata", None),
    (None, "Asia/Kolkata", None),
])
def test_to_e164(phone, tz, expected):
    assert svc.to_e164(phone, tz) == expected


def test_signature_rejects_old_or_forged():
    body = b'{"a":1}'
    _, headers = _signed({"a": 1})
    old = str(int(time.time()) - 3600)
    assert not svc.verify_signature(old, headers["X-Voice-Signature"], body)
    assert not svc.verify_signature(headers["X-Voice-Timestamp"], "sha256=deadbeef", body)


# ── Starting calls ───────────────────────────────────────────────────────────

async def test_disabled_by_default(client, recruiter_headers, organization, recruiter_user, db_session):
    r = await client.get("/v1/voice-calls/status", headers=recruiter_headers)
    assert r.json()["data"]["enabled"] is False
    job = await _job(db_session, organization, recruiter_user)
    cand = await _candidate(db_session, organization)
    r = await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                          json={"job_id": str(job.id), "candidate_ids": [str(cand.id)]})
    assert r.status_code == 403


async def test_start_prescreen_sends_task(ai_calls_on, engine, client, recruiter_headers, organization, recruiter_user, db_session):
    job = await _job(db_session, organization, recruiter_user, voice_call_config={
        "criteria": {"budget_max": {"value": 1800000, "currency": "INR"}, "max_notice_days": 60},
        "client_facing": True})
    ok = await _candidate(db_session, organization)
    no_consent = await _candidate(db_session, organization, consent=False)
    no_phone = await _candidate(db_session, organization, phone="12345")

    r = await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                          json={"job_id": str(job.id), "candidate_ids": [str(ok.id), str(no_consent.id), str(no_phone.id)]})
    assert r.status_code == 200
    by_id = {x["candidate_id"]: x for x in r.json()["data"]}
    assert by_id[str(ok.id)]["error"] is None
    assert "consent" in by_id[str(no_consent.id)]["error"]
    assert "Phone" in by_id[str(no_phone.id)]["error"]

    [payload] = engine.payloads
    assert payload["callee"]["phone_e164"] == "+919876543210"
    assert payload["consent"]["type"] == "APPLICATION_FORM"
    assert payload["scope_id"] == str(organization.id)
    criteria = payload["context"]["criteria"]
    assert criteria["min_experience_years"] == 4                    # from the job
    assert criteria["communication_threshold"] == 3.5               # client-facing default
    assert criteria["budget_max"]["value"] == 1800000

    vc = await db_session.scalar(select(VoiceCall).where(VoiceCall.candidate_id == ok.id))
    assert vc.task_status == "SCHEDULED" and payload["client_ref"] == f"hiring:{vc.id}"

    again = await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                              json={"job_id": str(job.id), "candidate_ids": [str(ok.id)]})
    assert "already in progress" in again.json()["data"][0]["error"]


async def test_engine_failure_lands_in_needs_action(ai_calls_on, engine, client, recruiter_headers, organization, recruiter_user, db_session):
    engine.fail = "AI calling service unreachable (ConnectError)"
    job = await _job(db_session, organization, recruiter_user)
    cand = await _candidate(db_session, organization)
    r = await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                          json={"job_id": str(job.id), "candidate_ids": [str(cand.id)]})
    assert "unreachable" in r.json()["data"][0]["error"]
    listing = (await client.get("/v1/voice-calls?tab=needs_action", headers=recruiter_headers)).json()["data"]
    assert listing["counts"]["needs_action"] == 1
    assert listing["items"][0]["task_status"] == "FAILED_TO_START"
    assert listing["items"][0]["candidate_name"] == "Riya Shah"


async def test_other_org_cannot_be_called_or_seen(ai_calls_on, engine, client, recruiter_headers, other_org_admin_headers,
                                                 organization, other_organization, recruiter_user, other_org_admin, db_session):
    job = await _job(db_session, organization, recruiter_user)
    foreign_cand = await _candidate(db_session, other_organization)
    r = await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                          json={"job_id": str(job.id), "candidate_ids": [str(foreign_cand.id)]})
    assert r.json()["data"][0]["error"] == "Candidate not found"
    # Their admin can't start calls on our job either.
    r = await client.post("/v1/voice-calls/prescreen", headers=other_org_admin_headers,
                          json={"job_id": str(job.id), "candidate_ids": [str(foreign_cand.id)]})
    assert r.status_code == 404

    cand = await _candidate(db_session, organization)
    await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                      json={"job_id": str(job.id), "candidate_ids": [str(cand.id)]})
    vc = await db_session.scalar(select(VoiceCall).where(VoiceCall.candidate_id == cand.id))
    assert (await client.get(f"/v1/voice-calls/{vc.id}", headers=other_org_admin_headers)).status_code == 404
    assert (await client.get("/v1/voice-calls", headers=other_org_admin_headers)).json()["data"]["items"] == []


# ── Callbacks ────────────────────────────────────────────────────────────────

async def _started_call(client, headers, db, org, user) -> tuple[VoiceCall, Candidate]:
    job = await _job(db, org, user)
    cand = await _candidate(db, org, current_ctc="10 LPA")
    await client.post("/v1/voice-calls/prescreen", headers=headers,
                      json={"job_id": str(job.id), "candidate_ids": [str(cand.id)]})
    vc = await db.scalar(select(VoiceCall).where(VoiceCall.candidate_id == cand.id))
    return vc, cand


async def test_callback_requires_valid_signature(ai_calls_on, client):
    body, headers = _signed({"client_ref": "hiring:x"}, secret="wrong")
    assert (await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)).status_code == 401


async def test_final_callback_updates_call_and_profile(ai_calls_on, engine, notified, client, recruiter_headers,
                                                       organization, recruiter_user, db_session):
    vc, cand = await _started_call(client, recruiter_headers, db_session, organization, recruiter_user)
    body, headers = _signed(_final_payload(vc))
    r = await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    assert r.status_code == 200

    await db_session.refresh(vc)
    await db_session.refresh(cand)
    assert vc.task_status == "DONE" and vc.outcome == "COMPLETED" and vc.final
    assert vc.decision == "RECOMMEND_NEXT_ROUND" and vc.duration_sec == 296
    assert vc.profile_updated_at is not None
    assert cand.expected_ctc == "16 LPA" and cand.current_ctc == "12 LPA"
    assert cand.notice_period_days == "60" and cand.years_experience == 5.5
    assert cand.current_company == "ABC Technologies" and cand.current_title == "Software Engineer"
    assert cand.relevant_experience is None                                 # UNCLEAR is left for HR
    log = await db_session.scalar(select(AuditLog).where(AuditLog.action == "ai_call.final"))
    assert log.details["profile_changes"]["current_ctc"] == ["10 LPA", "12 LPA"]
    assert notified == [("COMPLETED", "Riya Shah")]

    detail = (await client.get(f"/v1/voice-calls/{vc.id}", headers=recruiter_headers)).json()["data"]
    assert detail["summary_text"] == "Strong backend profile." and len(detail["transcript"]) == 2


async def test_stale_callback_is_ignored(ai_calls_on, engine, notified, client, recruiter_headers, organization, recruiter_user, db_session):
    vc, _ = await _started_call(client, recruiter_headers, db_session, organization, recruiter_user)
    body, headers = _signed(_final_payload(vc, attempt_no=2))
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    late = {"task_id": str(vc.engine_task_id), "client_ref": f"hiring:{vc.id}", "final": False,
            "task_status": "SCHEDULED", "status": "NO_ANSWER", "attempt_no": 1, "call": None, "result": None}
    body, headers = _signed(late)
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    await db_session.refresh(vc)
    assert vc.outcome == "COMPLETED" and vc.attempt_no == 2


async def test_opt_out_callback_blocks_future_calls(ai_calls_on, engine, notified, client, recruiter_headers,
                                                    organization, recruiter_user, db_session):
    vc, cand = await _started_call(client, recruiter_headers, db_session, organization, recruiter_user)
    body, headers = _signed(_final_payload(vc, status="OPTED_OUT", result=None))
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    await db_session.refresh(cand)
    assert cand.ai_call_opted_out_at is not None
    r = await client.post("/v1/voice-calls/prescreen", headers=recruiter_headers,
                          json={"job_id": str(vc.job_id), "candidate_ids": [str(cand.id)]})
    assert "opted out" in r.json()["data"][0]["error"]
    r = await client.post(f"/v1/voice-calls/candidates/{cand.id}/consent", headers=recruiter_headers, json={})
    assert r.status_code == 409


async def test_no_answer_final_needs_action_until_resolved(ai_calls_on, engine, notified, client, recruiter_headers,
                                                           organization, recruiter_user, db_session):
    vc, _ = await _started_call(client, recruiter_headers, db_session, organization, recruiter_user)
    body, headers = _signed(_final_payload(vc, status="NO_ANSWER", attempt_no=3, call=None, result=None))
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    counts = (await client.get("/v1/voice-calls", headers=recruiter_headers)).json()["data"]["counts"]
    assert counts == {"queue": 0, "needs_action": 1, "history": 1}
    await client.post(f"/v1/voice-calls/{vc.id}/resolve", headers=recruiter_headers)
    counts = (await client.get("/v1/voice-calls", headers=recruiter_headers)).json()["data"]["counts"]
    assert counts["needs_action"] == 0


# ── HR actions & settings ────────────────────────────────────────────────────

async def test_override(ai_calls_on, engine, notified, client, recruiter_headers, organization, recruiter_user, db_session):
    vc, _ = await _started_call(client, recruiter_headers, db_session, organization, recruiter_user)
    r = await client.post(f"/v1/voice-calls/{vc.id}/override", headers=recruiter_headers, json={"decision": "HOLD"})
    assert r.status_code == 409                                             # nothing to override yet
    body, headers = _signed(_final_payload(vc))
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    r = await client.post(f"/v1/voice-calls/{vc.id}/override", headers=recruiter_headers,
                          json={"decision": "HOLD", "note": "Check salary first"})
    assert r.json()["data"]["hr_override"]["decision"] == "HOLD"


async def test_settings_admin_only_and_validated(client, admin_headers, recruiter_headers):
    defaults = (await client.get("/v1/voice-calls/settings", headers=recruiter_headers)).json()["data"]
    assert defaults["window_start"] == "09:00" and defaults["max_attempts"] == 3
    assert (await client.put("/v1/voice-calls/settings", headers=recruiter_headers, json={"max_attempts": 2})).status_code == 403
    assert (await client.put("/v1/voice-calls/settings", headers=admin_headers, json={"window_start": "21:00"})).status_code == 422
    r = await client.put("/v1/voice-calls/settings", headers=admin_headers, json={"max_attempts": 2, "default_language": "hi"})
    assert r.json()["data"]["max_attempts"] == 2 and r.json()["data"]["window_end"] == "20:00"


async def test_job_config_roundtrip(client, recruiter_headers, organization, recruiter_user, db_session):
    job = await _job(db_session, organization, recruiter_user)
    bad = {"questions": [{"field": "Night Shift", "question": "Night shifts ok?"}]}
    assert (await client.put(f"/v1/voice-calls/jobs/{job.id}/config", headers=recruiter_headers, json=bad)).status_code == 422
    good = {"questions": [{"field": "night_shift_ok", "question": "Are you fine with night shifts?"}],
            "criteria": {"max_notice_days": 30}, "client_facing": True}
    assert (await client.put(f"/v1/voice-calls/jobs/{job.id}/config", headers=recruiter_headers, json=good)).status_code == 200
    data = (await client.get(f"/v1/voice-calls/jobs/{job.id}/config", headers=recruiter_headers)).json()["data"]
    assert data["questions"][0]["field"] == "night_shift_ok" and data["criteria"]["max_notice_days"] == 30


async def test_public_job_says_whether_to_ask_for_ai_call_consent(client, organization, recruiter_user, db_session, monkeypatch):
    job = await _job(db_session, organization, recruiter_user)
    url = f"/api/public/jobs/{organization.slug}/{job.id}"
    assert (await client.get(url)).json()["data"]["ai_calls"] is False
    monkeypatch.setattr(settings, "ai_calls_orgs", str(organization.id))
    monkeypatch.setattr(settings, "voice_api_key", "hvk_test")
    monkeypatch.setattr(settings, "voice_callback_secret", SECRET)
    assert (await client.get(url)).json()["data"]["ai_calls"] is True


def test_long_role_answer_is_not_copied_as_title():
    cand = Candidate(full_name="R", email="r@x.com", current_title="Engineer")
    changes = svc.update_profile_from_answers(cand, {
        "current_role": "Software Engineer, I build REST APIs and handle deployments",   # short, but a description
        "current_company": "ABC Technologies",
    })
    assert cand.current_title == "Engineer" and "current_title" not in changes
    assert cand.current_company == "ABC Technologies"


def test_clean_role_title_is_copied():
    cand = Candidate(full_name="R", email="r@x.com", current_title="Engineer")
    svc.update_profile_from_answers(cand, {"current_role": "Senior Software Engineer"})
    assert cand.current_title == "Senior Software Engineer"


async def test_super_admin_flag_turns_ai_calls_on_for_one_client(client, recruiter_headers, organization, db_session, monkeypatch):
    from app.models.super_admin import CompanyFeatureFlag
    monkeypatch.setattr(settings, "voice_api_key", "hvk_test")
    monkeypatch.setattr(settings, "voice_callback_secret", SECRET)
    assert (await client.get("/v1/voice-calls/status", headers=recruiter_headers)).json()["data"]["enabled"] is False
    db_session.add(CompanyFeatureFlag(organization_id=organization.id, flag_key="ai_calls", is_enabled=True))
    await db_session.commit()
    assert (await client.get("/v1/voice-calls/status", headers=recruiter_headers)).json()["data"]["enabled"] is True
    # Without the engine configured, the flag alone can't turn it on.
    monkeypatch.setattr(settings, "voice_api_key", "")
    assert (await client.get("/v1/voice-calls/status", headers=recruiter_headers)).json()["data"]["enabled"] is False
