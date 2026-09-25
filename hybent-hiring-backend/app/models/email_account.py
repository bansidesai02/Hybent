import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
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


class EmailAccountScope:
    """How many mailboxes the owner may connect — not who can see them.

    organization: connected by an admin/super admin, who may connect many.
    personal: connected by a recruiter, exactly one per recruiter.

    Either way a mailbox is private to its owner (connected_by_user_id): only
    they see it, manage it and read its inbox."""
    ORGANIZATION = "organization"
    PERSONAL = "personal"


class EmailAccount(Base):
    """A mailbox a user connected, for sending their recruiting email and for
    resume ingestion.

    Owned by `connected_by_user_id` and visible only to that user.
    `is_default` marks the owner's **primary** — the sender for email they
    trigger. Each owner has at most one (enforced below); a recruiter's single
    mailbox is always their primary.
    """

    __tablename__ = "email_accounts"
    __table_args__ = (
        UniqueConstraint("organization_id", "email_address", name="uq_email_accounts_org_address"),
        # A recruiter has at most one personal mailbox, ever — enforced at the
        # DB level, not just in the service layer. Must match the migration's
        # partial index exactly (name, columns, where-clause).
        Index(
            "uq_email_accounts_one_personal_per_user",
            "organization_id", "connected_by_user_id",
            unique=True,
            postgresql_where=text("scope = 'personal'"),
        ),
        # One primary per owner (migration 041).
        Index(
            "uq_email_accounts_one_primary_per_owner",
            "organization_id", "connected_by_user_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=EmailAccountStatus.CONNECTED)
    # The owner's primary sender — see class docstring.
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False, default=EmailAccountScope.ORGANIZATION)

    # The owner. Only this user sees or manages the mailbox.
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
