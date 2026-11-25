"""People who message Hybent's WhatsApp number, and the conversation.

A contact is identified by the WhatsApp sender id (the number, as Meta
proves it). `user_id` / `candidate_email` are set only once the person proved
they own that Hybent account (email code, or the portal's WhatsApp OTP), so
the bot never shows someone else's data to a number that merely matches.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _now():
    return datetime.now(timezone.utc)


class WaContactKind:
    VISITOR = "visitor"      # nothing known yet
    LEAD = "lead"            # gave us company details
    CANDIDATE = "candidate"  # verified owner of candidate profile(s)
    CLIENT = "client"        # verified owner of a Hybent user account


class WhatsAppContact(Base):
    __tablename__ = "whatsapp_contacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wa_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), index=True)
    profile_name: Mapped[str | None] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default=WaContactKind.VISITOR,
                                      server_default=WaContactKind.VISITOR, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    candidate_email: Mapped[str | None] = mapped_column(String(320))
    # Lead details the bot collected: name, company, role, team_size, cvs_per_month, email, city, current_tool, interest
    lead: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)
    # new | qualified | trial_link_sent | customer | closed
    status: Mapped[str] = mapped_column(String(30), default="new", server_default="new", nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    bot_paused: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    handoff_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_inbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("whatsapp_contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(3), nullable=False)       # in | out
    author: Mapped[str] = mapped_column(String(10), nullable=False)         # person | bot | team
    text: Mapped[str] = mapped_column(Text, nullable=False)
    wamid: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
