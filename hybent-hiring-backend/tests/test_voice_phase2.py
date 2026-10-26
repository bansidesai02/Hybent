"""
AI Calls phase 2: availability calls (slots, mid-call holds, booking) and
interview reminder calls (timing, re-sync on reschedule/cancel, results),
plus per-minute billing. The engine, emails and Celery are mocked.
"""
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.ai_usage import AIUsage
from app.models.candidate import Candidate
from app.models.interview import Interview, InterviewPanelist
from app.models.voice_call import VoiceCall, VoiceSlotHold
from app.services import email_service, interview_scheduling, voice_calls as svc, voice_scheduling as vs

SECRET = "test-voice-secret"
IST = ZoneInfo("Asia/Kolkata")


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setattr(settings, "ai_calls", True)
    monkeypatch.setattr(settings, "ai_calls_orgs", "")
    monkeypatch.setattr(settings, "voice_api_key", "hvk_test")
    monkeypatch.setattr(settings, "voice_callback_secret", SECRET)
    # No real email, Celery or calendar traffic from tests.
    for mod in (interview_scheduling, email_service):
        monkeypatch.setattr(mod, "send_interview_invite", lambda **kw: None)
    monkeypatch.setattr(interview_scheduling, "send_interviewer_invite", lambda **kw: None)
    monkeypatch.setattr(interview_scheduling.notify_interview_team, "delay", lambda *a, **kw: None)

    async def no_calendar(**kw):
        return {"meeting_link": "https://meet.test/abc", "event_id": None}
    monkeypatch.setattr(interview_scheduling, "create_calendar_event", no_calendar)
    from app.routers import voice_calls as router_mod
    monkeypatch.setattr(router_mod, "_notify", lambda vc, name: None)


@pytest.fixture
def engine(monkeypatch):
    class FakeEngine:
        def __init__(self):
            self.payloads, self.cancelled = [], []

        async def create(self, payload):
            self.payloads.append(payload)
            return {"id": str(uuid.uuid4()), "status": "SCHEDULED", "next_attempt_at": None}

        async def cancel(self, task_id):
            self.cancelled.append(task_id)

    fake = FakeEngine()
    monkeypatch.setattr(svc, "engine_create_task", fake.create)
    monkeypatch.setattr(svc, "engine_cancel_task", fake.cancel)
    return fake


def _signed(payload: dict) -> tuple[bytes, dict]:
    body = json.dumps(payload).encode()
    ts = str(int(time.time()))
    sig = "sha256=" + hmac.new(SECRET.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return body, {"X-Voice-Timestamp": ts, "X-Voice-Signature": sig, "Content-Type": "application/json"}


async def _candidate(db, org, **kw) -> Candidate:
    c = Candidate(organization_id=org.id, email=f"c-{uuid.uuid4().hex[:6]}@x.com", full_name="Riya Shah",
                  phone="+91 9876543210", ai_call_consent_at=datetime.now(timezone.utc),
                  ai_call_consent_source="APPLICATION_FORM", **kw)
    db.add(c)
    await db.commit()
    return c


def _window(days_ahead=3) -> dict:
    d = (datetime.now(IST) + timedelta(days=days_ahead)).date()
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return {"from_date": d.isoformat(), "to_date": d.isoformat(), "day_start": "10:00", "day_end": "13:00", "weekdays_only": True}


# ── Pure rules ───────────────────────────────────────────────────────────────

def test_reminder_times_day_before_6pm_and_hour_before():
    start = datetime(2026, 10, 23, 11, 0, tzinfo=IST)
    now = datetime(2026, 10, 21, 12, 0, tzinfo=IST)
    times = vs.reminder_times(start, now, IST, "09:00", "20:00")
    assert times == [(1, datetime(2026, 10, 22, 18, 0, tzinfo=IST)), (2, datetime(2026, 10, 23, 10, 0, tzinfo=IST))]


def test_reminder_times_same_day_soon_only_hour_before():
    now = datetime(2026, 10, 23, 9, 0, tzinfo=IST)
    times = vs.reminder_times(datetime(2026, 10, 23, 11, 0, tzinfo=IST), now, IST, "09:00", "20:00")
    assert [n for n, _ in times] == [2]


def test_reminder_never_outside_calling_hours():
    now = datetime(2026, 10, 20, 12, 0, tzinfo=IST)
    # 9:30 interview -> 8:30 reminder is before 9:00, so it's dropped.
    times = vs.reminder_times(datetime(2026, 10, 23, 9, 30, tzinfo=IST), now, IST, "09:00", "20:00")
    assert [n for n, _ in times] == [1]
    # Calling hours end at 17:00 -> the evening reminder moves earlier, to 16:30.
    times = vs.reminder_times(datetime(2026, 10, 23, 11, 0, tzinfo=IST), now, IST, "09:00", "17:00")
    assert times[0] == (1, datetime(2026, 10, 22, 16, 30, tzinfo=IST))


def test_window_starts_skip_weekends_and_step_by_length():
    now = datetime(2026, 10, 20, 9, 0, tzinfo=IST)
    win = {"from_date": "2026-10-23", "to_date": "2026-10-26", "day_start": "10:00", "day_end": "12:00", "weekdays_only": True}
    starts = vs.window_starts(win, 45, IST, now)   # Fri 23 + Mon 26; 45 min -> 60 min steps
    assert [s.strftime("%a %H:%M") for s in starts] == ["Fri 10:00", "Fri 11:00", "Mon 10:00", "Mon 11:00"]


# ── Availability: slots & holds ──────────────────────────────────────────────

async def test_slots_exclude_panelist_interviews(client, recruiter_headers, organization, recruiter_user, admin_user, db_session):
    cand = await _candidate(db_session, organization)
    win = _window()
    first = datetime.fromisoformat(f"{win['from_date']}T10:00:00+05:30")
    iv = Interview(organization_id=organization.id, candidate_id=cand.id, scheduled_by_id=recruiter_user.id,
                   title="Other", scheduled_at=first, duration_minutes=60)
    db_session.add(iv)
    await db_session.flush()
    db_session.add(InterviewPanelist(interview_id=iv.id, user_id=admin_user.id))
    await db_session.commit()

    body = {"candidate_id": str(cand.id), "round": "Technical Round 1", "duration_min": 60,
            "panelists": [{"user_id": str(admin_user.id)}], "window": win}
    slots = (await client.post("/v1/voice-calls/availability/slots", headers=recruiter_headers, json=body)).json()["data"]["slots"]
    assert first.isoformat() not in slots and len(slots) == 2
    # Without that panelist the 10:00 slot is free.
    body["panelists"] = []
    slots = (await client.post("/v1/voice-calls/availability/slots", headers=recruiter_headers, json=body)).json()["data"]["slots"]
    assert first.isoformat() in slots


async def _start_availability(client, headers, cand, panelist, engine, **over):
    body = {"candidate_id": str(cand.id), "round": "Technical Round 1", "mode": "VIDEO", "duration_min": 60,
            "panelists": [{"user_id": str(panelist.id), "role": "Lead"}], "window": _window(), **over}
    r = await client.post("/v1/voice-calls/availability", headers=headers, json=body)
    assert r.status_code == 200, r.text
    return r.json()["data"]["id"], engine.payloads[-1]


async def test_start_availability_sends_slots(engine, client, recruiter_headers, organization, admin_user, db_session):
    cand = await _candidate(db_session, organization)
    call_id, payload = await _start_availability(client, recruiter_headers, cand, admin_user, engine)
    assert payload["type"] == "AVAILABILITY" and len(payload["context"]["slots"]) == 3
    assert payload["context"]["interview"] == {"round": "Technical Round 1", "mode": "VIDEO", "duration_min": 60, "location": None}
    vc = await db_session.get(VoiceCall, uuid.UUID(call_id))
    assert vc.request["slots"] == payload["context"]["slots"]
    # One at a time per candidate.
    again = await client.post("/v1/voice-calls/availability", headers=recruiter_headers, json={
        "candidate_id": str(cand.id), "round": "Tech", "window": _window()})
    assert again.status_code == 409


async def test_hold_slot_prevents_double_booking(engine, client, recruiter_headers, organization, admin_user, db_session):
    a = await _candidate(db_session, organization)
    b = await _candidate(db_session, organization)
    call_a, payload = await _start_availability(client, recruiter_headers, a, admin_user, engine)
    call_b, _ = await _start_availability(client, recruiter_headers, b, admin_user, engine)
    slot = payload["context"]["slots"][0]

    async def hold(call_id, start):
        body, headers = _signed({"action": "hold_slot", "client_ref": f"hiring:{call_id}", "start": start})
        return (await client.post("/v1/voice-calls/actions", content=body, headers=headers)).json()

    assert await hold(call_a, slot) == {"ok": True}
    assert await hold(call_a, slot) == {"ok": True}                    # idempotent for the same call
    taken = await hold(call_b, slot)
    assert taken["ok"] is False and slot not in taken["alternatives"] and taken["alternatives"]
    assert (await hold(call_b, "2030-01-01T10:00:00+05:30"))["ok"] is False   # not an offered slot

    # A hold left over from a call that never finished stops blocking after 30 minutes.
    stale = await db_session.scalar(select(VoiceSlotHold).where(VoiceSlotHold.voice_call_id == uuid.UUID(call_a)))
    stale.created_at = datetime.now(timezone.utc) - timedelta(minutes=31)
    await db_session.commit()
    assert await hold(call_b, slot) == {"ok": True}


async def test_actions_require_signature(client):
    r = await client.post("/v1/voice-calls/actions", json={"action": "hold_slot", "client_ref": "hiring:x"})
    assert r.status_code == 401


async def test_confirmed_slot_books_interview_and_reminders(engine, client, recruiter_headers, organization, admin_user, db_session):
    cand = await _candidate(db_session, organization)
    call_id, payload = await _start_availability(client, recruiter_headers, cand, admin_user, engine)
    slot = payload["context"]["slots"][0]
    body, headers = _signed({"action": "hold_slot", "client_ref": f"hiring:{call_id}", "start": slot})
    await client.post("/v1/voice-calls/actions", content=body, headers=headers)

    final = {"client_ref": f"hiring:{call_id}", "final": True, "task_status": "DONE", "status": "COMPLETED", "attempt_no": 1,
             "call": {"duration_sec": 70, "transcript": [{"role": "user", "text": "yes"}]},
             "result": {"structured_data": {"result": {"outcome": "SLOT_CONFIRMED",
                                                       "confirmed_slot": {"start": slot, "duration_min": 60, "mode": "VIDEO"}}},
                        "summary_text": "", "communication": None, "recommendation": None, "flags": []}}
    body, headers = _signed(final)
    assert (await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)).status_code == 200

    vc = await db_session.get(VoiceCall, uuid.UUID(call_id), populate_existing=True)
    assert vc.use_case_outcome == "SLOT_CONFIRMED" and vc.interview_id
    iv = await db_session.get(Interview, vc.interview_id)
    assert iv.scheduled_at == datetime.fromisoformat(slot) and iv.title == "Technical Round 1" and iv.interview_type == "video"
    panel = (await db_session.scalars(select(InterviewPanelist).where(InterviewPanelist.interview_id == iv.id))).all()
    assert [p.user_id for p in panel] == [admin_user.id]
    hold = await db_session.scalar(select(VoiceSlotHold).where(VoiceSlotHold.voice_call_id == vc.id))
    assert hold.status == "USED"
    reminders = [p for p in engine.payloads if p["type"] == "REMINDER"]
    assert reminders and all(datetime.fromisoformat(p["expires_at"]) == iv.scheduled_at for p in reminders)
    assert reminders[0]["context"]["interview"]["meeting_link_sent"] is True

    # Billed: 70 s -> 2 started minutes x $0.035 = 70 credits, and only once.
    usage = (await db_session.scalars(select(AIUsage).where(AIUsage.feature == "ai_calls"))).all()
    assert len(usage) == 1 and round(usage[0].credits_used) == 70
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    assert len((await db_session.scalars(select(AIUsage).where(AIUsage.feature == "ai_calls"))).all()) == 1


# ── Reminders follow the interview ───────────────────────────────────────────

async def _schedule(client, headers, cand, when):
    r = await client.post("/v1/interviews", headers=headers, json={
        "candidate_id": str(cand.id), "title": "HR Round", "interview_type": "video",
        "scheduled_at": when.isoformat(), "duration_minutes": 30})
    assert r.status_code in (200, 201), r.text   # the endpoint has always answered 200
    return r.json()["data"]["id"]


def _future(days=3, hour=11) -> datetime:
    return (datetime.now(IST) + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)


async def test_scheduling_creates_reminders_and_reschedule_replaces_them(engine, client, recruiter_headers, organization, db_session):
    cand = await _candidate(db_session, organization)
    iv_id = await _schedule(client, recruiter_headers, cand, _future())
    first = [p for p in engine.payloads if p["type"] == "REMINDER"]
    assert [p["context"]["reminder_number"] for p in first] == [1, 2]

    r = await client.put(f"/v1/interviews/{iv_id}", headers=recruiter_headers,
                         json={"scheduled_at": _future(days=4, hour=15).isoformat()})
    assert r.status_code == 200
    assert len(engine.cancelled) == 2                                    # old reminders cancelled
    active = (await db_session.scalars(select(VoiceCall).where(
        VoiceCall.interview_id == uuid.UUID(iv_id), VoiceCall.task_status == "SCHEDULED"))).all()
    assert len(active) == 2
    assert all("15:00" not in p["schedule_at"] for p in engine.payloads[-2:])  # new times, not the old ones

    await client.delete(f"/v1/interviews/{iv_id}", headers=recruiter_headers)
    active = (await db_session.scalars(select(VoiceCall).where(
        VoiceCall.interview_id == uuid.UUID(iv_id), VoiceCall.task_status == "SCHEDULED"))).all()
    assert active == [] and len(engine.cancelled) == 4


async def test_no_reminders_without_consent_or_when_turned_off(engine, client, recruiter_headers, admin_headers, organization, db_session):
    no_consent = await _candidate(db_session, organization)
    no_consent.ai_call_consent_at = None
    await db_session.commit()
    await _schedule(client, recruiter_headers, no_consent, _future())
    assert not [p for p in engine.payloads if p["type"] == "REMINDER"]

    await client.put("/v1/voice-calls/settings", headers=admin_headers, json={"reminder_calls": False})
    cand = await _candidate(db_session, organization)
    await _schedule(client, recruiter_headers, cand, _future())
    assert not [p for p in engine.payloads if p["type"] == "REMINDER"]


async def test_reminder_results(engine, client, recruiter_headers, organization, db_session):
    cand = await _candidate(db_session, organization)
    iv_id = await _schedule(client, recruiter_headers, cand, _future())
    r1, r2 = (await db_session.scalars(select(VoiceCall).where(
        VoiceCall.interview_id == uuid.UUID(iv_id)).order_by(VoiceCall.reminder_number))).all()

    def final(vc, outcome):
        return {"client_ref": f"hiring:{vc.id}", "final": True, "task_status": "DONE", "status": "COMPLETED", "attempt_no": 1,
                "call": {"duration_sec": 40, "transcript": [{"role": "user", "text": "ok"}]},
                "result": {"structured_data": {"result": {"outcome": outcome, "reason": "Clash with exam"}},
                           "summary_text": "", "communication": None, "recommendation": None, "flags": []}}

    body, headers = _signed(final(r1, "CONFIRMED"))
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    iv = await db_session.get(Interview, uuid.UUID(iv_id), populate_existing=True)
    assert iv.is_confirmed is True

    body, headers = _signed(final(r2, "RESCHEDULE_REQUESTED"))
    await client.post("/v1/voice-calls/callbacks", content=body, headers=headers)
    needs = (await client.get("/v1/voice-calls?tab=needs_action", headers=recruiter_headers)).json()["data"]
    assert [c["use_case_outcome"] for c in needs["items"]] == ["RESCHEDULE_REQUESTED"]


async def test_interview_status_for_schedule_page(engine, client, recruiter_headers, other_org_admin_headers, organization, db_session):
    cand = await _candidate(db_session, organization)
    iv_id = await _schedule(client, recruiter_headers, cand, _future())
    data = (await client.get(f"/v1/voice-calls/interviews?ids={iv_id}", headers=recruiter_headers)).json()["data"]
    assert data[iv_id]["booked_by_ai"] is False
    assert sorted(data[iv_id]["reminders"]) == ["1", "2"]
    assert data[iv_id]["reminders"]["1"]["task_status"] == "SCHEDULED"
    # Another org sees nothing for it.
    other = (await client.get(f"/v1/voice-calls/interviews?ids={iv_id}", headers=other_org_admin_headers)).json()["data"]
    assert other == {}
