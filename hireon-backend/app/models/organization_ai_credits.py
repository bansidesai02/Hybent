import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class OrganizationAICredits(Base):
    __tablename__ = "organization_ai_credits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    allowed_credits: Mapped[int] = mapped_column(Integer, default=0)
    used_credits: Mapped[int] = mapped_column(Integer, default=0)
    reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Warning flags to prevent double notifications in the current cycle
    warning_50_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    warning_25_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    warning_10_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    warning_5_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    warning_0_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", lazy="raise")
