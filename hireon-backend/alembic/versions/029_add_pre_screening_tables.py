"""Add pre_screening_sessions and pre_screening_responses tables

Revision ID: 029_add_pre_screening_tables
Revises: 028_add_designation_features
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "029_add_pre_screening_tables"
down_revision: Union[str, None] = "028_add_designation_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS pre_screening_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
            job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
            created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
            questions JSONB NOT NULL DEFAULT '[]',
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            invite_token VARCHAR(128) NOT NULL UNIQUE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            overall_ai_summary TEXT,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pre_screening_sessions_org_id ON pre_screening_sessions(organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pre_screening_sessions_candidate_id ON pre_screening_sessions(candidate_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pre_screening_sessions_invite_token ON pre_screening_sessions(invite_token)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pre_screening_sessions_status ON pre_screening_sessions(status)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS pre_screening_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES pre_screening_sessions(id) ON DELETE CASCADE,
            question_index INTEGER NOT NULL,
            audio_file_path VARCHAR(500),
            transcript TEXT,
            duration_seconds FLOAT,
            recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pre_screening_responses_session_id ON pre_screening_responses(session_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_pre_screening_responses_session_id")
    op.execute("DROP TABLE IF EXISTS pre_screening_responses")
    op.execute("DROP INDEX IF EXISTS ix_pre_screening_sessions_status")
    op.execute("DROP INDEX IF EXISTS ix_pre_screening_sessions_invite_token")
    op.execute("DROP INDEX IF EXISTS ix_pre_screening_sessions_candidate_id")
    op.execute("DROP INDEX IF EXISTS ix_pre_screening_sessions_org_id")
    op.execute("DROP TABLE IF EXISTS pre_screening_sessions")
