import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PreScreeningSession(Base):
    __tablename__ = "pre_screening_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True, index=True
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # JSONB array: [{id, text, category}] where category in job_description|resume|role_awareness
    questions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # pending | in_progress | completed
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)

    invite_token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    overall_ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # english | hindi | gujarati — set by candidate on intro screen
    language: Mapped[str] = mapped_column(String(20), nullable=False, default="english", server_default="english")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", foreign_keys=[candidate_id], lazy="noload")
    job: Mapped["Job | None"] = relationship("Job", foreign_keys=[job_id], lazy="noload")
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id], lazy="noload")
    responses: Mapped[list["PreScreeningResponse"]] = relationship(
        "PreScreeningResponse",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="noload",
        order_by="PreScreeningResponse.question_index",
    )


class PreScreeningResponse(Base):
    __tablename__ = "pre_screening_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pre_screening_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    audio_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship
    session: Mapped["PreScreeningSession"] = relationship("PreScreeningSession", back_populates="responses", lazy="noload")
