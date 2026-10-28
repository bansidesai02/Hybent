"""A company's request for the 7-day free trial, from hybent.com/free-trial.

A super admin reviews it. Approving creates the organization on the Trial
plan (company_subscriptions.is_trial); the row then follows that trial
through its reminders, expiry, and either a paid upgrade or the purge of its
data 30 days after expiry. The row itself is kept as the record.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# pending → active (approved) or rejected; active → converted or expired;
# expired → converted or purged.
TRIAL_STATUSES = ("pending", "rejected", "active", "expired", "converted", "purged")
# A domain with a request in one of these can't send another.
OPEN_STATUSES = ("pending", "active")
TRIAL_SCHEMA = "trial"


class TrialRequest(Base):
    __tablename__ = "trial_requests"
    __table_args__ = (
        # One open request or running trial per company domain, even under a race.
        Index(
            "uq_trial_requests_open_domain", "company_domain", unique=True,
            postgresql_where=text("status IN ('pending', 'active')"),
        ),
        Index("uq_trial_requests_setup_token", "setup_token", unique=True),
        # Trial data lives in its own schema (alembic 062).
        {"schema": TRIAL_SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_website: Mapped[str] = mapped_column(String(500), nullable=False)
    # The work email's domain, lowercased: what duplicate checks key on.
    company_domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_linkedin_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # Optional: the short form doesn't ask; organization setup does.
    company_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hires_per_year: Mapped[str | None] = mapped_column(String(50), nullable=True)

    contact_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_title: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    contact_linkedin_url: Mapped[str] = mapped_column(String(500), nullable=False)
    hiring_needs: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The plan the trial was requested from: "standard" or "pro". The trial runs on its Trial plan.
    plan_interest: Mapped[str] = mapped_column(String(20), nullable=False, default="pro", server_default="pro")

    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Weaker signals for the reviewer, e.g. the email domain not matching the website.
    risk_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Kept after the purge deletes the organization, as the record of who had a trial.
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    trial_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_purge_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Each notice is sent once: the scheduled job stamps it in the same commit.
    reminder_1d_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_1h_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expired_notice_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purge_warning_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The applicant proved they own contact_email with a code (TrialEmailOTP).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The one-time organization setup link sent on approval; valid until trial_end.
    setup_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    setup_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class TrialEmailOTP(Base):
    """A code emailed to a work address on the trial form. Verifying it gives
    a verification_token the form submits; a request needs an unused one."""
    __tablename__ = "email_otps"
    __table_args__ = {"schema": TRIAL_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_token: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TrialMessage(Base):
    """An email the Hybent team sent about a trial request, from Super Admin."""
    __tablename__ = "messages"
    __table_args__ = {"schema": TRIAL_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{TRIAL_SCHEMA}.trial_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # approve, reject, info
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sent_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
