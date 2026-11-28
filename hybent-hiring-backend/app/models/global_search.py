"""A Global Search a recruiter ran, with what it found, so the team can reopen
it later without spending outside-search credits again."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GlobalSearchRun(Base):
    __tablename__ = "global_search_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"))
    query: Mapped[str | None] = mapped_column(String(300))
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Totals per source, for the history list: {"outside": n, "github": n, "network": n, "own": n}
    counts: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # The whole response as it was shown (outside, github, network, own lists).
    results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
