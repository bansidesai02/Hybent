import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ScreeningRecommendation(Base):
    """What the Candidate Screening Agent suggests doing with a new candidate.

    One row per screening run. The recruiter's review list reads from here;
    the LangGraph checkpoint (thread `screening:<candidate_id>`) only holds the
    paused run. Nothing is done to the candidate until a recruiter approves.
    """
    __tablename__ = "screening_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The best-matching open job the recommendation is about (None: no match).
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    # pre_screen | shortlist | talent_pool | reject | duplicate
    recommendation: Mapped[str] = mapped_column(String(30), nullable=False)
    reasons: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    risks: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # low | medium | high
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Every open job it was scored against: [{"job_id", "title", "score", "source"}]
    matches: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # For recommendation == "duplicate": the profile it duplicates.
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True
    )
    # "rules" (no AI call) or "ai"
    decided_by_engine: Mapped[str] = mapped_column(String(10), nullable=False, default="rules")
    # pending | approved | overridden | dismissed | applied | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    # What actually ran on approval/override, and any error.
    action_taken: Mapped[str | None] = mapped_column(String(30), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
