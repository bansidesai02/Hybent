"""SMS to candidates and interviewers: per-company settings and a delivery log."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SmsSettings(Base):
    """One row per company. `events` maps an event key to
    {"on": bool, "template_id": str} — the template id is the MSG91 (DLT
    approved) template the message is sent with."""

    __tablename__ = "sms_settings"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    events: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class SmsStatus:
    SENT = "sent"
    TEST = "test"        # no SMS provider key yet: logged only, nothing sent
    FAILED = "failed"
    SKIPPED = "skipped"  # no phone number, unsupported country, no template id


class SmsLog(Base):
    __tablename__ = "sms_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event: Mapped[str] = mapped_column(String(50), nullable=False)
    audience: Mapped[str] = mapped_column(String(20), nullable=False)  # candidate | interviewer
    recipient_name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    provider_ref: Mapped[str | None] = mapped_column(String(100))
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    interview_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
