import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EmailLog(Base):
    """Every email the platform tried to send, for the super admin portal.

    `html_body` is kept only for failed mail that holds no one-time link or
    code, so it can be sent again; delivered mail keeps no body.
    """
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    to_address: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # sent | failed | resent
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class PlatformError(Base):
    """A crashed API request or background job. Repeats of the same failure
    update one row (`count`, `last_seen_at`) rather than adding more."""
    __tablename__ = "platform_errors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # api | task
    kind: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    # "POST /v1/jobs" or the Celery task name
    source: Mapped[str] = mapped_column(String(300), nullable=False)
    error: Mapped[str] = mapped_column(Text, nullable=False)
    # open | resolved
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open", nullable=False, index=True)
    count: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    # Celery arguments, so a failed job can be run again.
    task_args: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class ContactMessage(Base):
    """A message from the hybent.com/contact form, kept for follow-up."""
    __tablename__ = "contact_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # new | replied | closed
    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
