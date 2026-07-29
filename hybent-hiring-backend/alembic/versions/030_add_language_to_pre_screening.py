"""Add language column to pre_screening_sessions

Revision ID: 030_add_language_to_pre_screening
Revises: 029_add_pre_screening_tables
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op


revision: str = "030_add_lang_prescreening"
down_revision: Union[str, None] = "029_add_pre_screening_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE pre_screening_sessions "
        "ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL DEFAULT 'english'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE pre_screening_sessions DROP COLUMN IF EXISTS language"
    )
