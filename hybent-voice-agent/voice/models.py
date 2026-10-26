"""
Engine tables (schema "voice"). Plan §5.

A client (hiring, sales) creates call tasks; each dial attempt is a call
record; a conversation's analysis is a call result. Deliveries are the
outbox of signed callbacks to the client; events are the audit trail.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from voice.db import SCHEMA, Base
from voice.enums import AnalysisStatus, RecordStatus, TaskStatus

JSONType = JSON().with_variant(JSONB(), "postgresql")


def _fk(table: str) -> str:
    return f"{SCHEMA}.{table}.id"


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    callback_url: Mapped[str] = mapped_column(String(500))
    # Synchronous, signed questions the agent asks the client mid-call
    # (e.g. "hold this interview slot"). None = this client has no actions.
    actions_url: Mapped[str | None] = mapped_column(String(500))
    # Kept readable because the engine signs with it; never returned by the API.
    callback_secret: Mapped[str] = mapped_column(String(128))
    max_concurrent_calls: Mapped[int] = mapped_column(Integer, default=5)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CallTask(Base):
    __tablename__ = "call_tasks"
    __table_args__ = (
        UniqueConstraint("client_id", "client_ref", name="uq_call_tasks_client_ref"),
        Index("ix_call_tasks_due", "status", "next_attempt_at"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(_fk("clients")), index=True)
    client_ref: Mapped[str] = mapped_column(String(200))
    # The client's tenant (Hiring org id). Opaque to the engine; scopes opt-outs.
    scope_id: Mapped[str] = mapped_column(String(100), default="")
    type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.SCHEDULED)
    outcome: Mapped[str | None] = mapped_column(String(30))

    callee_name: Mapped[str] = mapped_column(String(200))
    callee_phone: Mapped[str] = mapped_column(String(20))
    callee_tz: Mapped[str] = mapped_column(String(64))
    language_pref: Mapped[str] = mapped_column(String(10), default="en")

    context: Mapped[dict] = mapped_column(JSONType, default=dict)
    consent: Mapped[dict] = mapped_column(JSONType, default=dict)
    config: Mapped[dict] = mapped_column(JSONType, default=dict)

    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # innerjoin: FOR UPDATE can't lock rows through a LEFT JOIN in Postgres.
    client: Mapped[Client] = relationship(lazy="joined", innerjoin=True)
    records: Mapped[list["CallRecord"]] = relationship(
        back_populates="task", order_by="CallRecord.attempt_no", lazy="selectin"
    )


class CallRecord(Base):
    __tablename__ = "call_records"
    __table_args__ = (
        UniqueConstraint("task_id", "attempt_no", name="uq_call_records_attempt"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(_fk("call_tasks"), ondelete="CASCADE"), index=True)
    attempt_no: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default=RecordStatus.DIALING)
    outcome: Mapped[str | None] = mapped_column(String(30))

    provider_room: Mapped[str | None] = mapped_column(String(200))
    provider_call_id: Mapped[str | None] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_sec: Mapped[int | None] = mapped_column(Integer)

    language_detected: Mapped[str | None] = mapped_column(String(10))
    audio_quality: Mapped[str | None] = mapped_column(String(20))
    transcript: Mapped[list] = mapped_column(JSONType, default=list)
    # What the agent captured through its tools during the call.
    captured: Mapped[dict] = mapped_column(JSONType, default=dict)
    callback_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recording_url: Mapped[str | None] = mapped_column(String(1000))
    error: Mapped[str | None] = mapped_column(Text)

    analysis_status: Mapped[str] = mapped_column(String(20), default=AnalysisStatus.NOT_NEEDED)
    analysis_attempts: Mapped[int] = mapped_column(Integer, default=0)

    task: Mapped[CallTask] = relationship(back_populates="records")
    result: Mapped["CallResult | None"] = relationship(back_populates="record", lazy="selectin", uselist=False)


class CallResult(Base):
    __tablename__ = "call_results"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(_fk("call_records"), ondelete="CASCADE"), unique=True)
    structured_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    summary_text: Mapped[str] = mapped_column(Text, default="")
    communication: Mapped[dict | None] = mapped_column(JSONType)
    recommendation: Mapped[dict | None] = mapped_column(JSONType)
    flags: Mapped[list] = mapped_column(JSONType, default=list)
    analyzer_version: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    record: Mapped[CallRecord] = relationship(back_populates="result")


class OptOut(Base):
    __tablename__ = "opt_outs"
    __table_args__ = (
        UniqueConstraint("client_id", "scope_id", "phone", name="uq_opt_outs_phone"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(_fk("clients")))
    scope_id: Mapped[str] = mapped_column(String(100), default="")
    phone: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Delivery(Base):
    __tablename__ = "deliveries"
    __table_args__ = (Index("ix_deliveries_due", "delivered_at", "next_attempt_at"), {"schema": SCHEMA})

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(_fk("call_tasks"), ondelete="CASCADE"), index=True)
    payload: Mapped[dict] = mapped_column(JSONType)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gave_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CallEvent(Base):
    __tablename__ = "call_events"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(_fk("call_tasks"), ondelete="CASCADE"), index=True)
    record_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey(_fk("call_records"), ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
