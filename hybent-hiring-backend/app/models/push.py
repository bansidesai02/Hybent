import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PushSubscription(Base):
    """One device (browser / installed app) that asked for push notifications.
    Created only when an admin taps "Turn on" on that device."""
    __tablename__ = "push_subscriptions"
    # One phone can serve several accounts (e.g. a super admin who is also an admin).
    __table_args__ = (UniqueConstraint("user_id", "endpoint", name="uq_push_subscriptions_user_endpoint"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The push service URL of the device (shared by its accounts).
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DemoRequestRecord(Base):
    """A free demo request from hybent.com/register, kept so it can be
    followed up from the super admin portal (it used to exist only as an email)."""
    __tablename__ = "demo_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    work_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    team_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    monthly_hires: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hiring_challenge: Mapped[str | None] = mapped_column(Text, nullable=True)
    # new | contacted | converted | closed
    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
