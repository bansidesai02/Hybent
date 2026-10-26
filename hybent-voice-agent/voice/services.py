"""
Task lifecycle shared by the API, the scheduler and the agent worker.

    create_task ─► SCHEDULED ─(scheduler)─► IN_CALL ─► finish_record
                      ▲                                   │
                      │                    conversation? ─┤─► ANALYZING ─► complete_analysis
                      │                                   ▼                     │
                      └──── retry / callback ◄──────── settle ◄─────────────────┘
                                                          │
                                                          └─► DONE + signed callback
"""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from voice.analyzer import AnalysisOutput
from voice.enums import CONVERSED, AnalysisStatus, Outcome, RecordStatus, TaskStatus
from voice.models import CallEvent, CallRecord, CallResult, CallTask, Client, Delivery, OptOut
from voice.policy import default_config, next_allowed_time, retry_time
from voice.schemas import TaskCreate


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; treat them as UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def log_event(session: AsyncSession, task: CallTask, event_type: str, record: CallRecord | None = None, **payload):
    session.add(CallEvent(task_id=task.id, record_id=record.id if record else None, event_type=event_type, payload=payload))


async def is_opted_out(session: AsyncSession, client_id: uuid.UUID, scope_id: str, phone: str) -> bool:
    found = await session.scalar(
        select(OptOut.id).where(OptOut.client_id == client_id, OptOut.scope_id == scope_id, OptOut.phone == phone)
    )
    return found is not None


async def add_opt_out(session: AsyncSession, client_id: uuid.UUID, scope_id: str, phone: str, reason: str) -> None:
    if not await is_opted_out(session, client_id, scope_id, phone):
        session.add(OptOut(client_id=client_id, scope_id=scope_id, phone=phone, reason=reason))


class OptedOutError(Exception):
    pass


async def create_task(session: AsyncSession, client: Client, data: TaskCreate) -> tuple[CallTask, bool]:
    """(task, created). A repeated client_ref returns the existing task."""
    existing = await session.scalar(
        select(CallTask).where(CallTask.client_id == client.id, CallTask.client_ref == data.client_ref)
    )
    if existing:
        return existing, False
    if await is_opted_out(session, client.id, data.scope_id, data.callee.phone_e164):
        raise OptedOutError()

    config = {**default_config(data.type), **data.config}
    first = next_allowed_time(
        data.schedule_at or utcnow(), data.callee.timezone, config["window_start"], config["window_end"]
    )
    task = CallTask(
        client_id=client.id,
        client_ref=data.client_ref,
        scope_id=data.scope_id,
        type=data.type,
        status=TaskStatus.SCHEDULED,
        callee_name=data.callee.name,
        callee_phone=data.callee.phone_e164,
        callee_tz=data.callee.timezone,
        language_pref=data.callee.language_pref,
        context=data.context,
        consent=data.consent.model_dump(mode="json"),
        config=config,
        next_attempt_at=first,
        expires_at=data.expires_at,
    )
    session.add(task)
    await session.flush()
    log_event(session, task, "task.created", next_attempt_at=first.isoformat())
    return task, True


def cancel_task(session: AsyncSession, task: CallTask) -> None:
    """Stops future attempts. A call already in progress finishes normally."""
    if task.status in (TaskStatus.DONE, TaskStatus.CANCELLED):
        return
    task.cancelled_at = utcnow()
    if task.status == TaskStatus.SCHEDULED:
        task.status = TaskStatus.CANCELLED
        task.next_attempt_at = None
    log_event(session, task, "task.cancelled")


@dataclass
class CallReport:
    """What the dialer / agent worker knows when an attempt ends."""
    outcome: Outcome
    answered_at: datetime | None = None
    ended_at: datetime | None = None
    transcript: list = field(default_factory=list)
    captured: dict = field(default_factory=dict)
    language: str | None = None
    audio_quality: str | None = None
    callback_at: datetime | None = None
    opt_out: bool = False
    provider_call_id: str | None = None
    error: str | None = None


async def finish_record(session: AsyncSession, record_id: uuid.UUID, report: CallReport) -> None:
    """Record an attempt's end. Idempotent: a second report for the same record is ignored."""
    record = await session.get(CallRecord, record_id, with_for_update=True)
    if record is None or record.status == RecordStatus.ENDED:
        return
    task = await session.get(CallTask, record.task_id, with_for_update=True)
    now = utcnow()

    record.status = RecordStatus.ENDED
    record.outcome = Outcome.OPTED_OUT if report.opt_out else report.outcome
    record.answered_at = report.answered_at
    record.ended_at = report.ended_at or now
    if report.answered_at:
        record.duration_sec = int((as_utc(record.ended_at) - as_utc(report.answered_at)).total_seconds())
    record.transcript = report.transcript
    record.captured = report.captured
    record.language_detected = report.language
    record.audio_quality = report.audio_quality
    record.callback_at = report.callback_at
    record.provider_call_id = report.provider_call_id or record.provider_call_id
    record.error = report.error
    log_event(session, task, "call.ended", record, outcome=record.outcome, error=report.error)

    if report.opt_out:
        await add_opt_out(session, task.client_id, task.scope_id, task.callee_phone, "callee_request")
        log_event(session, task, "opt_out.added", record)

    if report.outcome in CONVERSED and report.transcript:
        record.analysis_status = AnalysisStatus.PENDING
        task.status = TaskStatus.ANALYZING
    else:
        await settle(session, task, record, None, now)


async def complete_analysis(
    session: AsyncSession, record: CallRecord, output: AnalysisOutput | None, now: datetime
) -> None:
    """Store the analysis (or its final failure) and settle the task."""
    task = await session.get(CallTask, record.task_id, with_for_update=True)
    result = None
    if output is not None:
        result = CallResult(
            record_id=record.id,
            structured_data=output.structured,
            summary_text=output.summary,
            communication=output.communication,
            recommendation=output.recommendation,
            flags=output.flags,
            analyzer_version=output.version,
        )
        session.add(result)
        record.analysis_status = AnalysisStatus.DONE
    else:
        record.analysis_status = AnalysisStatus.FAILED
    await settle(session, task, record, result, now)


async def settle(
    session: AsyncSession, task: CallTask, record: CallRecord, result: CallResult | None, now: datetime
) -> None:
    """Decide the next attempt (or stop) and queue the callback to the client."""
    task.outcome = record.outcome
    callbacks = await session.scalar(
        select(func.count()).select_from(CallRecord).where(
            CallRecord.task_id == task.id, CallRecord.outcome == Outcome.CALLBACK_REQUESTED
        )
    )
    nxt = None
    if task.cancelled_at is None and record.outcome != Outcome.OPTED_OUT:
        nxt = retry_time(
            outcome=record.outcome,
            attempt_count=task.attempt_count,
            callbacks_so_far=callbacks,
            callback_at=as_utc(record.callback_at),
            config=task.config,
            now=now,
        )
        if nxt is not None:
            nxt = next_allowed_time(nxt, task.callee_tz, task.config["window_start"], task.config["window_end"])
            if task.expires_at and nxt > as_utc(task.expires_at):
                nxt = None

    if nxt is not None:
        task.status = TaskStatus.SCHEDULED
        task.next_attempt_at = nxt
    else:
        task.status = TaskStatus.CANCELLED if task.cancelled_at else TaskStatus.DONE
        task.next_attempt_at = None
    log_event(session, task, "task.settled", record, status=task.status, next_attempt_at=nxt.isoformat() if nxt else None)
    session.add(Delivery(task_id=task.id, payload=build_payload(task, record, result), next_attempt_at=now))


async def expire_or_block(session: AsyncSession, task: CallTask, outcome: Outcome, now: datetime) -> None:
    """End a task without dialing (expired before it could run, or opted out)."""
    task.status = TaskStatus.DONE
    task.outcome = outcome
    task.next_attempt_at = None
    log_event(session, task, "task.closed_without_call", outcome=outcome)
    session.add(Delivery(task_id=task.id, payload=build_payload(task, None, None), next_attempt_at=now))


def build_payload(task: CallTask, record: CallRecord | None, result: CallResult | None) -> dict:
    """The callback body (Plan §4.2). Shape per type follows Spec §5.9, §6.7, §7.6."""
    final = task.status in (TaskStatus.DONE, TaskStatus.CANCELLED)
    payload = {
        "event": "call.final" if final else "call.attempt",
        "task_id": str(task.id),
        "client_ref": task.client_ref,
        "scope_id": task.scope_id,
        "type": task.type,
        "final": final,
        "task_status": task.status,
        "status": task.outcome,
        "attempt_no": record.attempt_no if record else task.attempt_count,
        "next_attempt_at": task.next_attempt_at.isoformat() if task.next_attempt_at else None,
        "call": None,
        "result": None,
    }
    if record is not None:
        payload["call"] = {
            "record_id": str(record.id),
            "started_at": as_utc(record.started_at).isoformat() if record.started_at else None,
            "ended_at": as_utc(record.ended_at).isoformat() if record.ended_at else None,
            "duration_sec": record.duration_sec,
            "language": record.language_detected,
            "audio_quality": record.audio_quality,
            "callback_at": as_utc(record.callback_at).isoformat() if record.callback_at else None,
            "transcript": record.transcript,
            "recording_url": record.recording_url,
            "analysis_status": record.analysis_status,
        }
    if result is not None:
        payload["result"] = {
            "structured_data": result.structured_data,
            "summary_text": result.summary_text,
            "communication": result.communication,
            "recommendation": result.recommendation,
            "flags": result.flags,
            "analyzer_version": result.analyzer_version,
        }
    return payload
