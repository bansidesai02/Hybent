"""A product demo booked from hybent.com/book-demo.

The visitor picks a 30-minute slot (services/demo_service.py sets the hours)
and the booking becomes a Google Calendar event with a Meet link on the host
account. `manage_token` is the secret in the visitor's reschedule/cancel link.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# booked → completed | no_show | cancelled
DEMO_STATUSES = ("booked", "completed", "no_show", "cancelled")


class DemoBooking(Base):
    __tablename__ = "demo_bookings"
    __table_args__ = (
        # One demo per slot: two visitors racing for the same time can't both win.
        Index("uq_demo_bookings_slot", "start_at", unique=True, postgresql_where=text("status = 'booked'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    team_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    # The visitor's own time zone, so emails show their local time.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="booked", server_default="booked", index=True)
    meet_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    calendar_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manage_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    reminder_24h_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_1h_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
