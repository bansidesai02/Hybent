import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class AICreditRule(Base):
    __tablename__ = "ai_credit_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feature: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    cost_type: Mapped[str] = mapped_column(String(50), default="fixed", nullable=False) # fixed, dynamic
    fixed_cost: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Rates for token-based usage conversion
    token_input_cost_per_1k: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    token_output_cost_per_1k: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Rates for audio-based usage conversion (speech-to-text)
    audio_cost_per_second: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
