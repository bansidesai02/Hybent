"""
AI Calls — the Hiring side of the Hybent AI Agent (hybent-voice-agent/).

The engine owns dialing, retries and analysis. Hiring keeps one VoiceCall
row per call task it asked for, updated from the engine's signed callbacks,
so candidate pages and the AI Calls page never depend on the engine being up.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class VoiceCall(Base):
    __tablename__ = "voice_calls"
    __table_args__ = (
        Index("ix_voice_calls_org_status", "organization_id", "task_status"),
        Index("ix_voice_calls_candidate", "candidate_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # The interview a reminder is about, or the one an availability call booked.
    interview_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="SET NULL"), nullable=True, index=True
    )

    type: Mapped[str] = mapped_column(String(30), nullable=False)          # PRESCREEN | AVAILABILITY | REMINDER
    reminder_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # What we asked for (availability: round, mode, duration, panelists, open slots).
    request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    engine_task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True, nullable=True)
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    # Engine task status: SCHEDULED | IN_CALL | ANALYZING | DONE | CANCELLED,
    # plus FAILED_TO_START when the engine refused or couldn't be reached.
    task_status: Mapped[str] = mapped_column(String(20), nullable=False, default="SCHEDULED")
    outcome: Mapped[str | None] = mapped_column(String(30), nullable=True)   # COMPLETED, NO_ANSWER, …
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Latest attempt that reached a person.
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    language_detected: Mapped[str | None] = mapped_column(String(10), nullable=True)
    audio_quality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    callback_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transcript: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    recording_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Analysis (engine call_result): answers, communication, recommendation…
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision: Mapped[str | None] = mapped_column(String(30), nullable=True)   # RECOMMEND_NEXT_ROUND | HOLD | NOT_RECOMMENDED
    # Availability / reminder result (Spec §6.6, §7.5): SLOT_CONFIRMED, CONFIRMED, RESCHEDULE_REQUESTED…
    use_case_outcome: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Highest attempt already charged to AI credits, so a re-delivered callback never bills twice.
    billed_attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # HR's own call on the recommendation: {decision, note, by, at}
    hr_override: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Set once HR has dealt with a call that needed action (human requested, unreachable…).
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    profile_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    candidate: Mapped["Candidate"] = relationship("Candidate", foreign_keys=[candidate_id], lazy="noload")
    job: Mapped["Job | None"] = relationship("Job", foreign_keys=[job_id], lazy="noload")


class VoiceSlotHold(Base):
    """An interview slot locked while a candidate confirms it on a call
    (Spec §6.8: no double booking). HELD -> USED when the interview is
    created, RELEASED when the call ends without it. A HELD row older than
    HOLD_MINUTES no longer blocks the slot."""
    __tablename__ = "voice_slot_holds"
    __table_args__ = (Index("ix_voice_slot_holds_org_start", "organization_id", "start_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    voice_call_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("voice_calls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    panelist_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="HELD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class OrgVoiceSettings(Base):
    """Admin → Settings → AI Calls. Missing row = defaults (see voice_calls service)."""
    __tablename__ = "org_voice_settings"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
