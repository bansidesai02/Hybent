"""
Availability and reminder calls (Spec §6, §7): scripts, the mid-call slot
hold through the client, and what reaches the client in the callback.
"""
import json
from datetime import datetime, timezone

import httpx
import pytest
from sqlalchemy import select

from tests.conftest import task_body
from voice import client_actions, dialer
from voice.analyzer import Analyzer
from voice.agent.prompts import build_instructions
from voice.dialer import FakeDialer
from voice.models import CallTask, Client, Delivery
from voice.scheduler import dispatch_due, run_analysis
from voice.schemas import TaskCreate
from voice.security import verify
from voice.services import create_task

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc)  # 11:30 IST
SLOTS = ["2026-10-22T10:00:00+05:30", "2026-10-22T11:00:00+05:30"]
AVAIL_CONTEXT = {
    "company_name": "Acme",
    "job": {"title": "Backend Developer"},
    "interview": {"round": "Technical Round 1", "mode": "VIDEO", "duration_min": 45},
    "slots": SLOTS,
}
REMINDER_CONTEXT = {
    "company_name": "Acme",
    "job": {"title": "Backend Developer"},
    "interview": {"round": "Technical Round 1", "mode": "IN_PERSON", "start": "2026-10-22T10:00:00+05:30",
                  "address": "4th floor, Iscon Tower", "contact_person": "Neha", "documents": "a photo ID"},
    "reminder_number": 1,
}


def _task(type_: str, context: dict) -> CallTask:
    return CallTask(type=type_, callee_name="Riya Shah", callee_phone="+919812345678", callee_tz="Asia/Kolkata",
                    language_pref="en", context=context, client_ref="hiring:x")


def test_availability_script_lists_slots_in_local_time():
    text = build_instructions(_task("AVAILABILITY", AVAIL_CONTEXT), NOW)
    assert "shortlisted for the Technical Round 1 for Backend Developer" in text
    assert "Thursday, 22 October, 10:00 AM  [ISO 2026-10-22T10:00:00+05:30]" in text
    assert "wait for a clear \"yes\"" in text
    assert "a video call" in text


def test_reminder_script_has_in_person_logistics():
    text = build_instructions(_task("REMINDER", REMINDER_CONTEXT), NOW)
    assert "Technical Round 1 for Backend Developer, Thursday, 22 October, 10:00 AM" in text
    assert "the venue is 4th floor, Iscon Tower; ask for Neha; bring a photo ID" in text
    assert "set_reminder_outcome" in text


async def _make(sessions, make_client, type_, context, actions_url="https://hiring.test/actions"):
    client, _ = await make_client()
    async with sessions() as s:
        c = await s.get(Client, client.id)
        c.actions_url = actions_url
        await s.commit()
        await s.refresh(c)
        task, _ = await create_task(s, c, TaskCreate(**task_body(type=type_, context=context)))
        await s.commit()
    return c, task


async def _payload(sessions, task_id) -> dict:
    async with sessions() as s:
        [d] = (await s.scalars(select(Delivery).where(Delivery.task_id == task_id))).all()
        return d.payload


async def test_fake_availability_holds_first_slot_via_client(sessions, make_client, monkeypatch):
    held = []

    async def fake_action(client, action, client_ref, **params):
        held.append((action, client_ref, params))
        return {"ok": True}

    monkeypatch.setattr(dialer, "call_action", fake_action)
    _, task = await _make(sessions, make_client, "AVAILABILITY", AVAIL_CONTEXT)
    await dispatch_due(sessions, FakeDialer(), NOW)
    await run_analysis(sessions, Analyzer(), NOW)

    assert held == [("hold_slot", task.client_ref, {"start": SLOTS[0]})]
    result = (await _payload(sessions, task.id))["result"]["structured_data"]["result"]
    assert result["outcome"] == "SLOT_CONFIRMED"
    assert result["confirmed_slot"] == {"start": SLOTS[0], "duration_min": 45, "mode": "VIDEO"}


async def test_taken_slot_becomes_a_proposal_with_alternatives(sessions, make_client, monkeypatch):
    async def taken(client, action, client_ref, **params):
        return {"ok": False, "alternatives": [SLOTS[1]]}

    monkeypatch.setattr(dialer, "call_action", taken)
    _, task = await _make(sessions, make_client, "AVAILABILITY", AVAIL_CONTEXT)
    await dispatch_due(sessions, FakeDialer(), NOW)
    await run_analysis(sessions, Analyzer(), NOW)
    result = (await _payload(sessions, task.id))["result"]["structured_data"]["result"]
    assert result["outcome"] == "SLOT_PROPOSED_NEEDS_APPROVAL"
    assert result["alternatives_offered"] == [SLOTS[1]]


async def test_fake_reminder_is_confirmed(sessions, make_client):
    _, task = await _make(sessions, make_client, "REMINDER", REMINDER_CONTEXT)
    await dispatch_due(sessions, FakeDialer(), NOW)
    await run_analysis(sessions, Analyzer(), NOW)
    payload = await _payload(sessions, task.id)
    assert payload["status"] == "COMPLETED"
    assert payload["result"]["structured_data"]["result"]["outcome"] == "CONFIRMED"


async def test_reminder_retries_once_after_15_minutes(sessions, make_client):
    _, task = await _make(sessions, make_client, "REMINDER", {**REMINDER_CONTEXT, "_fake": {"outcome": "NO_ANSWER"}})
    assert task.config["max_attempts"] == 2 and task.config["retry_gap_minutes"] == 15


async def test_call_action_is_signed(monkeypatch):
    seen = {}

    def handler(request: httpx.Request):
        seen["body"], seen["headers"] = request.content, request.headers
        return httpx.Response(200, json={"ok": True})

    real = httpx.AsyncClient
    monkeypatch.setattr(client_actions.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    c = Client(name="hiring", key_hash="x", callback_url="https://h.test/callbacks",
               actions_url="https://h.test/actions", callback_secret="s3cret")
    assert await client_actions.call_action(c, "hold_slot", "hiring:1", start=SLOTS[0]) == {"ok": True}
    assert json.loads(seen["body"]) == {"action": "hold_slot", "client_ref": "hiring:1", "start": SLOTS[0]}
    assert verify("s3cret", seen["headers"]["X-Voice-Timestamp"], seen["body"], seen["headers"]["X-Voice-Signature"])


async def test_call_action_without_endpoint_fails_safely():
    c = Client(name="sales", key_hash="x", callback_url="https://s.test/cb", actions_url=None, callback_secret="s")
    with pytest.raises(client_actions.ActionError):
        await client_actions.call_action(c, "hold_slot", "sales:1")
