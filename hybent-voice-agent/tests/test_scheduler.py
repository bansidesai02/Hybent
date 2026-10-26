"""
End-to-end engine flow with the fake dialer: task -> dial -> analysis ->
signed callback, plus retries, calling hours, callbacks and opt-outs.
"""
import json
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from tests.conftest import task_body
from voice.analyzer import Analyzer
from voice.dialer import FakeDialer
from voice.models import CallTask, Delivery, OptOut
from voice.scheduler import deliver_due, dispatch_due, run_analysis
from voice.schemas import TaskCreate
from voice.security import verify
from voice.services import create_task

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc)  # 11:30 IST

ANSWERS = {
    "total_experience_years": {"raw": "five and a half years"},
    "relevant_experience_years": {"raw": "four years"},
    "current_company": {"raw": "ABC Technologies"},
    "current_role": {"raw": "Software Engineer"},
    "current_ctc": {"raw": "12 LPA"},
    "expected_ctc": {"raw": "sixteen lakhs"},
    "notice_period": {"raw": "two months, negotiable"},
}


async def _task(sessions, client, **overrides) -> CallTask:
    async with sessions() as s:
        task, _ = await create_task(s, client, TaskCreate(**task_body(**overrides)))
        await s.commit()
        return task


async def _reload(sessions, task_id) -> CallTask:
    async with sessions() as s:
        return await s.get(CallTask, task_id, populate_existing=True)


async def _deliveries(sessions, task_id) -> list[Delivery]:
    async with sessions() as s:
        return list(await s.scalars(select(Delivery).where(Delivery.task_id == task_id).order_by(Delivery.created_at)))


async def test_completed_prescreen_end_to_end(sessions, make_client):
    client, _ = await make_client()
    criteria = {"min_experience_years": 4, "budget_max": {"value": 1_800_000, "currency": "INR"}, "max_notice_days": 60}
    task = await _task(sessions, client, context={"criteria": criteria, "_fake": {"outcome": "COMPLETED", "answers": ANSWERS}})

    assert await dispatch_due(sessions, FakeDialer(), NOW) == 1
    assert (await _reload(sessions, task.id)).status == "ANALYZING"

    assert await run_analysis(sessions, Analyzer(), NOW) == 1
    done = await _reload(sessions, task.id)
    assert done.status == "DONE" and done.outcome == "COMPLETED"

    [delivery] = await _deliveries(sessions, task.id)
    result = delivery.payload["result"]
    answers = result["structured_data"]["answers"]
    assert answers["total_experience_years"] == 5.5
    assert answers["expected_ctc"]["value"] == 1_600_000
    assert answers["notice_period_days"] == 60 and answers["notice_negotiable"] is True
    assert result["structured_data"]["answers_raw"]["current_ctc"] == "12 LPA"
    assert result["recommendation"]["decision"] == "RECOMMEND_NEXT_ROUND"
    assert "llm_review_skipped" in result["flags"]          # no Groq key in tests
    assert delivery.payload["final"] is True

    # Delivered with a valid signature.
    seen = {}

    def handler(request: httpx.Request):
        seen["body"], seen["headers"] = request.content, request.headers
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        assert await deliver_due(sessions, http, NOW) == 1
    assert verify(client.callback_secret, seen["headers"]["X-Voice-Timestamp"], seen["body"], seen["headers"]["X-Voice-Signature"])
    assert json.loads(seen["body"])["client_ref"] == task.client_ref
    [delivery] = await _deliveries(sessions, task.id)
    assert delivery.delivered_at is not None


async def test_no_answer_retries_then_gives_up(sessions, make_client):
    client, _ = await make_client()
    task = await _task(sessions, client, context={"_fake": {"outcome": "NO_ANSWER"}})

    now = NOW
    for attempt in (1, 2, 3):
        assert await dispatch_due(sessions, FakeDialer(), now) == 1
        t = await _reload(sessions, task.id)
        assert t.attempt_count == attempt
        if attempt < 3:
            assert t.status == "SCHEDULED"
            # Retries are timed from when the attempt actually ended (wall clock).
            nxt = t.next_attempt_at.replace(tzinfo=timezone.utc)
            gap = nxt - datetime.now(timezone.utc)
            assert timedelta(minutes=119) < gap <= timedelta(hours=2)
            now = nxt
    assert t.status == "DONE" and t.outcome == "NO_ANSWER"
    payloads = [d.payload for d in await _deliveries(sessions, task.id)]
    assert [p["final"] for p in payloads] == [False, False, True]


async def test_waits_for_calling_hours(sessions, make_client):
    client, _ = await make_client()
    task = await _task(sessions, client, config={"window_start": "09:00", "window_end": "20:00"})
    late = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)   # 20:30 IST
    assert await dispatch_due(sessions, FakeDialer(), late) == 0
    t = await _reload(sessions, task.id)
    assert t.status == "SCHEDULED" and t.attempt_count == 0
    assert t.next_attempt_at.replace(tzinfo=timezone.utc) == datetime(2026, 10, 21, 3, 30, tzinfo=timezone.utc)


async def test_callback_requested_is_scheduled_at_that_time(sessions, make_client):
    client, _ = await make_client()
    task = await _task(sessions, client, context={"_fake": {"outcome": "CALLBACK_REQUESTED", "callback_in_minutes": 90,
                                                            "answers": {"current_company": {"raw": "ABC"}}}})
    await dispatch_due(sessions, FakeDialer(), NOW)
    await run_analysis(sessions, Analyzer(), NOW)
    t = await _reload(sessions, task.id)
    assert t.status == "SCHEDULED" and t.outcome == "CALLBACK_REQUESTED"
    assert t.next_attempt_at is not None


async def test_opt_out_during_call_blocks_future_calls(sessions, make_client):
    client, _ = await make_client()
    task = await _task(sessions, client, context={"_fake": {"outcome": "NO_ANSWER", "opt_out": True}})
    await dispatch_due(sessions, FakeDialer(), NOW)
    t = await _reload(sessions, task.id)
    assert t.status == "DONE" and t.outcome == "OPTED_OUT"
    async with sessions() as s:
        assert await s.scalar(select(OptOut).where(OptOut.phone == "+919812345678")) is not None


async def test_expired_task_is_closed_without_dialing(sessions, make_client):
    client, _ = await make_client()
    task = await _task(sessions, client, expires_at="2026-10-20T05:00:00Z")
    assert await dispatch_due(sessions, FakeDialer(), NOW) == 0
    t = await _reload(sessions, task.id)
    assert t.status == "DONE" and t.outcome == "EXPIRED" and t.attempt_count == 0


async def test_concurrency_limit_per_client(sessions, make_client):
    client, _ = await make_client(max_concurrent=1)

    class HangingDialer:
        async def start(self, session, task, record):  # call stays "in progress"
            record.provider_room = "room"

    await _task(sessions, client, client_ref="a")
    await _task(sessions, client, client_ref="b", callee={"name": "B", "phone_e164": "+919800000002"})
    assert await dispatch_due(sessions, HangingDialer(), NOW) == 1


async def test_failed_delivery_backs_off(sessions, make_client):
    client, _ = await make_client()
    task = await _task(sessions, client, context={"_fake": {"outcome": "BUSY"}}, config={"window_start": "00:00", "window_end": "23:59", "max_attempts": 1})
    await dispatch_due(sessions, FakeDialer(), NOW)
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(503))) as http:
        await deliver_due(sessions, http, now)
    [d] = await _deliveries(sessions, task.id)
    assert d.delivered_at is None and d.attempts == 1 and "503" in d.last_error
    assert d.next_attempt_at.replace(tzinfo=timezone.utc) == now + timedelta(minutes=2)
