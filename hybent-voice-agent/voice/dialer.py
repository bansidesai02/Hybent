"""
Starting a call attempt.

LiveKitDialer only dispatches the agent worker into a fresh room; the worker
dials the candidate over SIP and reports the outcome itself (it is the one
that knows whether the phone was answered). FakeDialer finishes the attempt
immediately with a scripted outcome, for local development and tests.
"""
import json
import logging
import uuid
from datetime import timedelta
from typing import Protocol

from voice.agent.prompts import questions_for
from voice.client_actions import ActionError, call_action
from voice.config import settings
from voice.enums import Outcome
from voice.models import CallRecord, CallTask
from voice.services import CallReport, finish_record, utcnow

logger = logging.getLogger(__name__)


class Dialer(Protocol):
    async def start(self, session, task: CallTask, record: CallRecord) -> None:
        """Begin the attempt. Raise to mark it FAILED."""


class LiveKitDialer:
    async def start(self, session, task: CallTask, record: CallRecord) -> None:
        from livekit import api

        room = f"call-{record.id}"
        lk = api.LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
        try:
            await lk.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name=settings.livekit_agent_name,
                    room=room,
                    metadata=json.dumps({"record_id": str(record.id)}),
                )
            )
        finally:
            await lk.aclose()
        record.provider_room = room


# What FakeDialer "hears" when a task doesn't script its own answers, so a
# local demo shows a realistic result end to end.
DEMO_ANSWERS = {
    "total_experience_years": {"raw": "around five and a half years"},
    "relevant_experience_years": {"raw": "four years"},
    "current_company": {"raw": "ABC Technologies"},
    "current_role": {"raw": "Software Engineer, I build REST APIs and handle deployments"},
    "key_skills": {"raw": "Node.js, PostgreSQL, AWS"},
    "current_ctc": {"raw": "12 LPA"},
    "expected_ctc": {"raw": "sixteen lakhs"},
    "notice_period": {"raw": "two months, negotiable"},
    "location": {"raw": "Ahmedabad, open to relocate"},
    "reason_for_change": {"raw": "looking for bigger product challenges"},
}


class FakeDialer:
    """Ends the call at once. task.context["_fake"] can script the outcome:
    {"outcome": "NO_ANSWER"} or {"outcome": "COMPLETED", "answers": {...}, "callback_in_minutes": 30}
    or {"result": {...}} for availability / reminder calls.
    Without a script: a pre-screen completes with DEMO_ANSWERS, an availability
    call holds the first open slot through the client (the real lock path),
    and a reminder is confirmed."""

    async def start(self, session, task: CallTask, record: CallRecord) -> None:
        script = task.context.get("_fake") or {}
        outcome = Outcome(script.get("outcome", Outcome.COMPLETED))
        now = utcnow()
        conversed = outcome in (Outcome.COMPLETED, Outcome.PARTIAL, Outcome.CALLBACK_REQUESTED, Outcome.DECLINED)
        if task.type != "PRESCREEN":
            await self._use_case_call(session, task, record, script, outcome, now)
            return
        answers = script.get("answers", DEMO_ANSWERS if "_fake" not in task.context else {})
        transcript = []
        if conversed:
            # The agent's real question text, so a fake transcript reads like a call.
            asked = {q["field"]: q["question"] for q in questions_for(task)}
            transcript = [{"role": "assistant", "text": f"Hello, this is the Hybent AI Agent. Am I speaking with {task.callee_name}?"},
                          {"role": "user", "text": "Yes."}]
            for name, item in answers.items():
                question = asked.get(name) or name.replace("_", " ").capitalize() + "?"
                transcript += [{"role": "assistant", "text": question}, {"role": "user", "text": item.get("raw", "")}]
        record.provider_room = f"fake-{uuid.uuid4().hex[:8]}"
        await finish_record(
            session,
            record.id,
            CallReport(
                outcome=outcome,
                answered_at=now - timedelta(minutes=4) if conversed else None,
                ended_at=now,
                transcript=transcript,
                captured={"answers": answers} if answers else {},
                language=task.language_pref if conversed else None,
                audio_quality="GOOD" if conversed else None,
                callback_at=now + timedelta(minutes=script["callback_in_minutes"]) if "callback_in_minutes" in script else None,
                opt_out=bool(script.get("opt_out")),
            ),
        )


    async def _use_case_call(self, session, task: CallTask, record: CallRecord, script: dict, outcome: Outcome, now) -> None:
        conversed = outcome == Outcome.COMPLETED
        result = dict(script.get("result") or {})
        flags: list[str] = []
        transcript = [{"role": "assistant", "text": f"Hello, this is the Hybent AI Agent. Am I speaking with {task.callee_name}?"},
                      {"role": "user", "text": "Yes."}]
        if conversed and not result and task.type == "AVAILABILITY":
            slots = task.context.get("slots") or []
            transcript += [{"role": "assistant", "text": "When would you be available for the interview?"},
                           {"role": "user", "text": "The first slot you have works for me."}]
            if slots:
                try:
                    answer = await call_action(task.client, "hold_slot", task.client_ref, start=slots[0])
                except ActionError:
                    answer, flags = {"ok": False}, ["slot_hold_unavailable"]
                if answer.get("ok"):
                    iv = task.context.get("interview") or {}
                    result = {"outcome": "SLOT_CONFIRMED", "confirmed_slot": {
                        "start": slots[0], "duration_min": iv.get("duration_min"), "mode": iv.get("mode")}}
                else:
                    result = {"outcome": "SLOT_PROPOSED_NEEDS_APPROVAL", "proposed_slot": {"start": slots[0], "note": ""},
                              "alternatives_offered": answer.get("alternatives") or []}
        elif conversed and not result and task.type == "REMINDER":
            transcript += [{"role": "assistant", "text": "This is a reminder about your interview. Will you be able to attend?"},
                           {"role": "user", "text": "Yes, I'll be there."}]
            result = {"outcome": "CONFIRMED", "reason": None}
        record.provider_room = f"fake-{uuid.uuid4().hex[:8]}"
        await finish_record(
            session,
            record.id,
            CallReport(
                outcome=outcome,
                answered_at=now - timedelta(minutes=1) if conversed else None,
                ended_at=now,
                transcript=transcript if conversed else [],
                captured={"result": result, "flags": flags} if conversed else {},
                language=task.language_pref if conversed else None,
                audio_quality="GOOD" if conversed else None,
                callback_at=now + timedelta(minutes=script["callback_in_minutes"]) if "callback_in_minutes" in script else None,
                opt_out=bool(script.get("opt_out")),
            ),
        )


def get_dialer() -> Dialer:
    if settings.dialer == "livekit":
        return LiveKitDialer()
    return FakeDialer()
