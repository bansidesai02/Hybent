import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EmailAccountProvider:
    GMAIL = "gmail"
    OUTLOOK = "outlook"
    SMTP = "smtp"


class EmailAccountStatus:
    CONNECTED = "connected"
    ERROR = "error"
    REAUTH_REQUIRED = "reauth_required"
    DISCONNECTED = "disconnected"


class EmailAccount(Base):
    """A mailbox connected to an organization for sending recruiting email.

    An organization may connect multiple mailboxes (Gmail / Outlook / custom SMTP);
    exactly one may be flagged as the org's default sender at a time.
    """

    __tablename__ = "email_accounts"
    __table_args__ = (
        UniqueConstraint("organization_id", "email_address", name="uq_email_accounts_org_address"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=EmailAccountStatus.CONNECTED)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    connected_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # OAuth providers (gmail / outlook)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[str | None] = mapped_column(Text)

    # Custom SMTP provider
    smtp_host: Mapped[str | None] = mapped_column(String(255))
    smtp_port: Mapped[int | None] = mapped_column(Integer)
    smtp_username: Mapped[str | None] = mapped_column(String(255))
    smtp_password_encrypted: Mapped[str | None] = mapped_column(Text)
    use_tls: Mapped[bool] = mapped_column(Boolean, default=True)

    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    organization: Mapped["Organization"] = relationship("Organization", lazy="noload")
    connected_by: Mapped["User"] = relationship("User", foreign_keys=[connected_by_user_id], lazy="noload")
