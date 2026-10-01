"""Normalize stored candidate phone numbers

Phones copied verbatim from résumés kept their separators ("+91-9664957351",
"+91 6355 833 722"). New writes are normalized by the Candidate model; this
brings existing rows to the same "+91 9664957351" form.

Revision ID: 050_normalize_candidate_phones
Revises: 049_clear_fcm_tokens
Create Date: 2026-10-01

"""
import sqlalchemy as sa
from alembic import op

from app.utils.phone import normalize_phone

revision = '050_normalize_candidate_phones'
down_revision = '049_clear_fcm_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Runs the same normalizer the model uses, so old and new rows match.
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, phone FROM candidates WHERE phone IS NOT NULL")).all()
    for row_id, phone in rows:
        clean = normalize_phone(phone)
        if clean != phone:
            bind.execute(
                sa.text("UPDATE candidates SET phone = :phone WHERE id = :id"),
                {"phone": clean, "id": row_id},
            )


def downgrade() -> None:
    # The original separators are not recoverable and carry no meaning.
    pass
