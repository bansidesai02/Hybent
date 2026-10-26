"""
LiveKit agent worker. The scheduler dispatches it into a room per call
attempt (metadata: record_id); it dials the callee over the SIP trunk,
holds the conversation, and reports the outcome back into the engine DB.

    python -m voice.agent.worker download-files   # once: VAD / turn-detector models
    python -m voice.agent.worker start            # production
    python -m voice.agent.worker dev              # local, auto-reload
"""
import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Literal

from google.protobuf.duration_pb2 import Duration
from livekit import agents, api, rtc
from livekit.agents import Agent, AgentSession, JobContext, JobProcess, RunContext, WorkerOptions, cli, function_tool
from livekit.plugins import silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from voice.agent.prompts import answer_fields, build_instructions
from voice.client_actions import ActionError, call_action
from voice.agent.providers import build_llm, build_stt, build_tts, set_tts_language
from voice.config import settings
from voice.db import SessionLocal
from voice.enums import Outcome, RecordStatus
from voice.models import CallRecord, CallTask
from voice.services import CallReport, finish_record, utcnow

logger = logging.getLogger("voice.agent")

RING_SECONDS = 30
MAX_CALL_SECONDS = 15 * 60
# SIP response codes -> outcome when the call is never answered.
SIP_OUTCOMES = {
    486: Outcome.BUSY, 600: Outcome.BUSY, 603: Outcome.BUSY,
    408: Outcome.NO_ANSWER, 480: Outcome.NO_ANSWER, 487: Outcome.NO_ANSWER,
    404: Outcome.INVALID_NUMBER, 484: Outcome.INVALID_NUMBER, 604: Outcome.INVALID_NUMBER,
}

EndOutcome = Literal["COMPLETED", "PARTIAL", "WRONG_PERSON", "CALLBACK_REQUESTED", "DECLINED", "HUMAN_REQUESTED", "VOICEMAIL"]


@dataclass
class CallState:
    language: str
    answers: dict = field(default_factory=dict)
    candidate_questions: list = field(default_factory=list)
    flags: list = field(default_factory=list)
    outcome: Outcome | None = None
    callback_at: datetime | None = None
    opt_out: bool = False
    audio_quality: str | None = None
    answered_at: datetime | None = None
    # Use-case result for availability / reminder calls (Spec §6.7, §7.6).
    result: dict = field(default_factory=dict)


def sip_outcome(exc: api.TwirpError) -> Outcome:
    try:
        code = int((exc.metadata or {}).get("sip_status_code", 0))
    except ValueError:
        code = 0
    return SIP_OUTCOMES.get(code, Outcome.UNREACHABLE)


class BaseCallAgent(Agent):
    """Tools every call type has (Spec §4): questions for HR, language, ending the call."""

    def __init__(self, task: CallTask, state: CallState, ctx: JobContext):
        super().__init__(instructions=build_instructions(task, utcnow()))
        self.task = task
        self.state = state
        self.ctx = ctx

    @function_tool()
    async def note_candidate_question(self, context: RunContext, question: str) -> str:
        """Save a question the candidate asked that HR must answer."""
        self.state.candidate_questions.append(question)
        return "noted"

    @function_tool()
    async def set_language(self, context: RunContext, language: Literal["en", "hi"]) -> str:
        """Switch the language you speak in: en (English) or hi (Hindi)."""
        self.state.language = language
        set_tts_language(context.session.tts, language)
        return f"now speaking {language}"

    @function_tool()
    async def end_call(
        self,
        context: RunContext,
        outcome: EndOutcome,
        callback_time_iso: str | None = None,
        opt_out: bool = False,
        poor_audio: bool = False,
    ) -> None:
        """End the call after your closing line.

        Args:
            outcome: Why the call is ending.
            callback_time_iso: For CALLBACK_REQUESTED, the agreed time in ISO 8601 with offset.
            opt_out: True only if the person asked never to be called again.
            poor_audio: True if noise or a bad line made the person hard to understand.
        """
        self.state.outcome = Outcome(outcome)
        self.state.opt_out = opt_out
        if poor_audio:
            self.state.audio_quality = "POOR"
        if callback_time_iso:
            try:
                self.state.callback_at = datetime.fromisoformat(callback_time_iso)
            except ValueError:
                self.state.flags.append(f"unparsed_callback_time:{callback_time_iso}")
        await context.wait_for_playout()
        await self.ctx.delete_room()


class PrescreenAgent(BaseCallAgent):
    def __init__(self, task: CallTask, state: CallState, ctx: JobContext):
        super().__init__(task, state, ctx)
        self.fields = set(answer_fields(task))

    @function_tool()
    async def record_answer(
        self, context: RunContext, field: str, raw: str, status: Literal["ANSWERED", "UNCLEAR", "DECLINED_TO_SHARE"]
    ) -> str:
        """Save the candidate's answer to one screening question.

        Args:
            field: The field name in square brackets in your question list.
            raw: The candidate's answer in their own words.
            status: ANSWERED, UNCLEAR (still unclear after one follow-up) or DECLINED_TO_SHARE.
        """
        if field not in self.fields:
            return f"Unknown field {field}. Use one of: {', '.join(sorted(self.fields))}"
        self.state.answers[field] = {"raw": raw, "status": status}
        return "saved"


class AvailabilityAgent(BaseCallAgent):
    @function_tool()
    async def confirm_slot(self, context: RunContext, start_iso: str) -> str:
        """Lock the interview slot the candidate clearly said yes to.

        Args:
            start_iso: The slot's ISO time exactly as listed in your open slots.
        """
        if start_iso not in (self.task.context.get("slots") or []):
            return "That isn't one of the open slots. Offer one from the list, or use propose_time."
        try:
            answer = await call_action(self.task.client, "hold_slot", self.task.client_ref, start=start_iso)
        except ActionError:
            self.state.flags.append("slot_hold_unavailable")
            return "The calendar can't be reached right now. Say HR will confirm the time by email; don't promise the slot."
        if answer.get("ok"):
            iv = self.task.context.get("interview") or {}
            self.state.result.update(
                outcome="SLOT_CONFIRMED",
                confirmed_slot={"start": start_iso, "duration_min": iv.get("duration_min"), "mode": iv.get("mode")},
            )
            return "Slot confirmed and locked."
        alternatives = answer.get("alternatives") or []
        self.state.result.setdefault("alternatives_offered", []).extend(alternatives)
        return "That slot was just taken. Offer these instead: " + (", ".join(alternatives) or "none - use propose_time")

    @function_tool()
    async def propose_time(self, context: RunContext, start_iso: str, note: str = "") -> str:
        """The candidate wants a time that isn't an open slot; HR will approve or counter.

        Args:
            start_iso: The time they asked for, ISO 8601 with offset.
            note: Anything HR should know (e.g. only evenings).
        """
        if self.state.result.get("outcome") != "SLOT_CONFIRMED":
            self.state.result.update(outcome="SLOT_PROPOSED_NEEDS_APPROVAL",
                                     proposed_slot={"start": start_iso, "note": note})
        return "Noted for HR. Tell them HR will confirm the time."

    @function_tool()
    async def record_constraint(self, context: RunContext, constraint: str) -> str:
        """A limit on when the candidate can attend (e.g. only after 6 PM, needs manager approval)."""
        self.state.result.setdefault("constraints", []).append(constraint)
        return "noted"

    @function_tool()
    async def note_reason(self, context: RunContext, reason: str) -> str:
        """Why the candidate isn't interested any more."""
        self.state.result.update(outcome="CANDIDATE_NOT_INTERESTED", reason=reason)
        return "noted"


class ReminderAgent(BaseCallAgent):
    @function_tool()
    async def set_reminder_outcome(
        self,
        context: RunContext,
        outcome: Literal["CONFIRMED", "RESCHEDULE_REQUESTED", "CANCELLED_BY_CANDIDATE", "UNSURE"],
        reason: str = "",
    ) -> str:
        """Record what the candidate said about attending."""
        self.state.result.update(outcome=outcome, reason=reason or None)
        return "noted"

    @function_tool()
    async def resend_details(self, context: RunContext) -> str:
        """Re-send the interview link / address to the candidate's email."""
        try:
            await call_action(self.task.client, "resend_details", self.task.client_ref)
        except ActionError:
            self.state.flags.append("resend_failed")
            return "Couldn't resend right now. Say HR will send the details shortly."
        self.state.result["link_resent"] = True
        return "Sent."


AGENTS = {"PRESCREEN": PrescreenAgent, "AVAILABILITY": AvailabilityAgent, "REMINDER": ReminderAgent}


def _transcript(session: AgentSession) -> list[dict]:
    turns = []
    for item in session.history.items:
        if getattr(item, "type", None) != "message" or item.role not in ("user", "assistant"):
            continue
        text = item.text_content or ""
        if text.strip():
            turns.append({"role": item.role, "text": text, "at": item.created_at})
    return turns


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    record_id = uuid.UUID(json.loads(ctx.job.metadata or "{}")["record_id"])
    async with SessionLocal() as s:
        record = await s.get(CallRecord, record_id)
        task = await s.get(CallTask, record.task_id) if record else None
        if record is None or task is None or record.status != RecordStatus.DIALING:
            logger.warning("voice: dispatch for unknown or finished record %s", record_id)
            return
        record.status = RecordStatus.IN_CALL
        record.provider_room = ctx.room.name
        await s.commit()

    state = CallState(language=task.language_pref)
    session: AgentSession | None = None

    async def report(report: CallReport) -> None:
        async with SessionLocal() as s:
            await finish_record(s, record_id, report)
            await s.commit()

    await ctx.connect()
    try:
        await ctx.api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                room_name=ctx.room.name,
                sip_trunk_id=settings.sip_outbound_trunk_id,
                sip_call_to=task.callee_phone,
                participant_identity="callee",
                participant_name=task.callee_name,
                wait_until_answered=True,
                ringing_timeout=Duration(seconds=RING_SECONDS),
                max_call_duration=Duration(seconds=MAX_CALL_SECONDS),
            )
        )
    except api.TwirpError as exc:
        await report(CallReport(outcome=sip_outcome(exc), error=f"sip: {exc.message}"[:500]))
        ctx.shutdown()
        return
    state.answered_at = utcnow()

    session = AgentSession(
        stt=build_stt(task),
        llm=build_llm(),
        tts=build_tts(task),
        vad=ctx.proc.userdata["vad"],
        turn_detection=MultilingualModel(),
    )

    async def on_shutdown() -> None:
        heard = any(t["role"] == "user" for t in _transcript(session))
        outcome = state.outcome
        if outcome is None:  # the callee hung up before end_call
            outcome = Outcome.PARTIAL if heard else Outcome.NO_ANSWER
            if heard:
                state.flags.append("callee_hung_up")
        await report(
            CallReport(
                outcome=outcome,
                answered_at=state.answered_at,
                ended_at=utcnow(),
                transcript=_transcript(session),
                captured={
                    "answers": state.answers,
                    "candidate_questions": state.candidate_questions,
                    "flags": state.flags,
                    "result": state.result,
                },
                language=state.language,
                audio_quality=state.audio_quality or ("GOOD" if heard else None),
                callback_at=state.callback_at,
                opt_out=state.opt_out,
            )
        )

    ctx.add_shutdown_callback(on_shutdown)

    @ctx.room.on("participant_disconnected")
    def _on_left(participant: rtc.RemoteParticipant) -> None:
        if participant.identity == "callee":
            ctx.shutdown(reason="callee hung up")

    await session.start(agent=AGENTS[task.type](task, state, ctx), room=ctx.room)
    # A beat of silence lets a voicemail greeting start before we speak.
    await asyncio.sleep(1.0)
    session.generate_reply(instructions="Begin the call with the opening, step 1.")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name=settings.livekit_agent_name))
