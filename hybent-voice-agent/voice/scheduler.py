"""
The engine's heartbeat: every few seconds it
  1. starts due call attempts (calling hours, opt-outs, per-client limits),
  2. fails attempts the agent never reported back on,
  3. runs pending post-call analysis,
  4. delivers queued callbacks.

Rows are claimed with FOR UPDATE SKIP LOCKED, so a second scheduler would
not double-dial — but the deployment still runs exactly one.
"""
import asyncio
import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from voice.analyzer import AnalysisError, Analyzer
from voice.config import settings
from voice.dialer import Dialer
from voice.enums import AnalysisStatus, Outcome, RecordStatus, TaskStatus
from voice.models import CallRecord, CallTask, Client, Delivery
from voice.notifier import deliver
from voice.policy import next_allowed_time
from voice.services import (
    CallReport,
    as_utc,
    complete_analysis,
    expire_or_block,
    finish_record,
    is_opted_out,
    log_event,
    utcnow,
)

logger = logging.getLogger(__name__)

BATCH = 20
_ACTIVE = (RecordStatus.DIALING, RecordStatus.IN_CALL)


async def _active_calls(session, client_id) -> int:
    return await session.scalar(
        select(func.count())
        .select_from(CallRecord)
        .join(CallTask, CallTask.id == CallRecord.task_id)
        .where(CallTask.client_id == client_id, CallRecord.status.in_(_ACTIVE))
    )


async def dispatch_due(sessions: async_sessionmaker, dialer: Dialer, now: datetime) -> int:
    started = 0
    async with sessions() as session:
        tasks = (
            await session.scalars(
                select(CallTask)
                .where(CallTask.status == TaskStatus.SCHEDULED, CallTask.next_attempt_at <= now)
                .order_by(CallTask.next_attempt_at)
                .limit(BATCH)
                .with_for_update(skip_locked=True, of=CallTask)
            )
        ).all()
        for task in tasks:
            if task.expires_at and as_utc(task.expires_at) <= now:
                await expire_or_block(session, task, Outcome.EXPIRED, now)
                continue
            if await is_opted_out(session, task.client_id, task.scope_id, task.callee_phone):
                await expire_or_block(session, task, Outcome.OPTED_OUT, now)
                continue
            allowed = next_allowed_time(now, task.callee_tz, task.config["window_start"], task.config["window_end"])
            if allowed > now:
                task.next_attempt_at = allowed
                continue
            if await _active_calls(session, task.client_id) >= task.client.max_concurrent_calls:
                continue

            task.attempt_count += 1
            task.status = TaskStatus.IN_CALL
            record = CallRecord(task_id=task.id, attempt_no=task.attempt_count, status=RecordStatus.DIALING)
            session.add(record)
            await session.flush()
            log_event(session, task, "call.dialing", record, attempt_no=record.attempt_no)
            await session.commit()
            try:
                await dialer.start(session, task, record)
                started += 1
            except Exception as exc:  # provider down, bad trunk config…
                logger.exception("voice: could not start call for task %s", task.id)
                await finish_record(session, record.id, CallReport(outcome=Outcome.FAILED, error=str(exc)[:500]))
            await session.commit()
        await session.commit()
    return started


async def sweep_stale(sessions: async_sessionmaker, now: datetime) -> int:
    cutoff = now - timedelta(minutes=settings.stale_call_minutes)
    async with sessions() as session:
        ids = (
            await session.scalars(
                select(CallRecord.id).where(CallRecord.status.in_(_ACTIVE), CallRecord.started_at < cutoff)
            )
        ).all()
        for record_id in ids:
            await finish_record(session, record_id, CallReport(outcome=Outcome.FAILED, error="no report from agent"))
        await session.commit()
    return len(ids)


async def run_analysis(sessions: async_sessionmaker, analyzer: Analyzer, now: datetime) -> int:
    done = 0
    async with sessions() as session:
        records = (
            await session.scalars(
                select(CallRecord)
                .where(CallRecord.analysis_status == AnalysisStatus.PENDING)
                .limit(5)
                .with_for_update(skip_locked=True, of=CallRecord)
            )
        ).all()
        for record in records:
            task = await session.get(CallTask, record.task_id)
            try:
                output = await analyzer.analyze(task, record)
            except Exception as exc:
                record.analysis_attempts += 1
                level = logging.WARNING if isinstance(exc, AnalysisError) else logging.ERROR
                logger.log(level, "voice: analysis failed for record %s: %s", record.id, exc)
                if record.analysis_attempts >= settings.max_analysis_attempts:
                    await complete_analysis(session, record, None, now)
                await session.commit()
                continue
            await complete_analysis(session, record, output, now)
            await session.commit()
            done += 1
    return done


async def deliver_due(sessions: async_sessionmaker, http: httpx.AsyncClient, now: datetime) -> int:
    async with sessions() as session:
        rows = (
            await session.execute(
                select(Delivery, Client)
                .join(CallTask, CallTask.id == Delivery.task_id)
                .join(Client, Client.id == CallTask.client_id)
                .where(Delivery.delivered_at.is_(None), Delivery.gave_up_at.is_(None), Delivery.next_attempt_at <= now)
                .order_by(Delivery.created_at)
                .limit(BATCH)
                .with_for_update(skip_locked=True, of=Delivery)
            )
        ).all()
        for delivery, client in rows:
            await deliver(http, client, delivery, now, settings.max_delivery_attempts)
        await session.commit()
    return len(rows)


async def tick(sessions: async_sessionmaker, dialer: Dialer, analyzer: Analyzer, http: httpx.AsyncClient) -> None:
    now = utcnow()
    for step in (
        lambda: dispatch_due(sessions, dialer, now),
        lambda: sweep_stale(sessions, now),
        lambda: run_analysis(sessions, analyzer, utcnow()),
        lambda: deliver_due(sessions, http, utcnow()),
    ):
        try:
            await step()
        except Exception:
            logger.exception("voice: scheduler step failed")


async def run_forever(sessions: async_sessionmaker, dialer: Dialer, analyzer: Analyzer, stop: asyncio.Event) -> None:
    async with httpx.AsyncClient() as http:
        while not stop.is_set():
            await tick(sessions, dialer, analyzer, http)
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.scheduler_interval_sec)
            except asyncio.TimeoutError:
                pass
