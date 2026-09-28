import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Payment(Base):
    """One Stripe payment: a subscription link sent to a client, an admin's
    seat or top-up purchase, or a subscription renewal.

    Stripe tells us it was paid (webhook, or the return from Checkout) and
    payment_service applies it once, whichever arrives first."""
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # subscription (link from a super admin), seats, topup, renewal
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    # pending, paid, failed, expired, canceled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    amount_usd: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD", server_default="USD")
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    # What the payment buys, e.g. {"plan_name": ..., "extra_admin_seats": 1}
    # or {"credits": 5000}.
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Secret for the public /pay/<token> page (subscription links only).
    token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    receipt_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )
