import uuid
from datetime import datetime, timezone
from sqlalchemy import ARRAY, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CandidateResumeChunk(Base):
    """
    RAG chunk for a candidate's parsed resume. One row per meaningful section
    (overview, summary, skills, one per experience entry, one per project,
    education, certifications) so retrieval can be scoped to what's relevant
    instead of matching the whole resume blob.

    Embeddings are stored as a plain float array (not pgvector — unavailable
    on this deployment's Postgres image) and compared with cosine similarity
    in Python. This is safe because every query pre-filters by
    organization_id and almost always by candidate_id first, so similarity
    is only ever computed over a handful of rows.
    """
    __tablename__ = "candidate_resume_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )

    section: Mapped[str] = mapped_column(String(50), nullable=False)  # overview, summary, skills, experience, project, education, certifications
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(Float), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", lazy="noload")
