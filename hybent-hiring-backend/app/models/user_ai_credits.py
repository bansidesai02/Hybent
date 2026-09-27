import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class UserAICredits(Base):
    """A user's share of their organization's AI credit pool.

    `monthly_limit` caps what one user can spend in a credit period so a
    single recruiter can't drain the pool; the admin can reallocate limits.
    `daily_used` is checked against a fraction of the monthly limit to stop
    runaway bulk jobs.
    """
    __tablename__ = "user_ai_credits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    monthly_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    used_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Fraction of a credit charged but not yet counted against the limits.
    credit_remainder: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
