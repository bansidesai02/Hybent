"""Add designation features

Revision ID: 028_add_designation_features
Revises: 027_designation_display_order
Create Date: 2026-06-19 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "028_add_designation_features"
down_revision: Union[str, None] = "027_designation_display_order"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add designation_id to candidates
    op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS designation_id UUID REFERENCES jobs(id) ON DELETE SET NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidates_designation_id ON candidates(designation_id)")

    # 2. Create designation_change_logs table
    op.execute("""
        CREATE TABLE IF NOT EXISTS designation_change_logs (
            id UUID PRIMARY KEY,
            candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            from_designation_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
            to_designation_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_designation_change_logs_candidate_id ON designation_change_logs(candidate_id)")

    # 3. Create user_preferences table
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            designation_order JSONB,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_preferences_user_id ON user_preferences(user_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_user_preferences_user_id")
    op.execute("DROP TABLE IF EXISTS user_preferences")
    op.execute("DROP INDEX IF EXISTS ix_designation_change_logs_candidate_id")
    op.execute("DROP TABLE IF EXISTS designation_change_logs")
    op.execute("DROP INDEX IF EXISTS ix_candidates_designation_id")
    op.execute("ALTER TABLE candidates DROP COLUMN IF EXISTS designation_id")
