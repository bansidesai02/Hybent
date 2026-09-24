import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EmailIngestionStatus:
    """Outcome of the auto-candidate-ingestion pass for a message (None = not
    yet evaluated). Terminal values are set exactly once and are never
    retried automatically; RETRY_PENDING is the one non-terminal outcome — see
    EmailMessageRepository.claim_for_processing."""
    PROCESSING = "processing"
    CREATED = "created"
    MATCHED_EXISTING = "matched_existing"
    SKIPPED_NOT_RESUME = "skipped_not_resume"
    FAILED = "failed"
    # A transient parse failure (AI rate limit, credits exhausted, provider
    # down) — picked up again by the next ingestion run until
    # MAX_INGESTION_ATTEMPTS is reached. Not terminal.
    RETRY_PENDING = "retry_pending"


MAX_INGESTION_ATTEMPTS = 3


class EmailMessage(Base):
    """A synced inbox message — metadata only (from/subject/snippet); the full
    body is fetched live from the provider on open, not stored, to keep sync
    cheap and avoid mirroring potentially large mail bodies at rest."""

    __tablename__ = "email_messages"
    __table_args__ = (
        UniqueConstraint("email_account_id", "provider_message_id", name="uq_email_messages_account_provider_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("email_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    thread_id: Mapped[str | None] = mapped_column(String(255))

    from_address: Mapped[str | None] = mapped_column(String(255))
    from_name: Mapped[str | None] = mapped_column(String(255))
    to_address: Mapped[str | None] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(Text)
    snippet: Mapped[str | None] = mapped_column(Text)

    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Auto-candidate-ingestion tracking ──────────────────────────────────
    # has_attachments is set during the cheap metadata/full-message fetch so
    # the ingestion pass can filter without re-fetching every message.
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    ingestion_status: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    # use_alter breaks the candidates<->email_messages FK cycle for
    # SQLAlchemy's metadata create_all/drop_all (e.g. test fixtures) — the
    # real migration already applies the two FKs as separate ALTER TABLEs,
    # which Postgres has no issue with either way.
    ingestion_result_candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "candidates.id", ondelete="SET NULL", use_alter=True, name="fk_email_messages_ingestion_result_candidate_id"
        ),
        nullable=True,
        index=True,
    )
    ingestion_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingestion_processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Claim lock for claim_for_processing — set when a worker starts
    # processing, cleared on completion; a stale lock is reclaimable.
    ingestion_locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Incremented on every claim; bounds RETRY_PENDING re-processing.
    ingestion_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    email_account: Mapped["EmailAccount"] = relationship("EmailAccount", lazy="noload")
