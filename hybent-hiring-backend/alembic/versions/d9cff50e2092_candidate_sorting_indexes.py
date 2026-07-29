"""Candidate sorting indexes

Revision ID: d9cff50e2092
Revises: 026_missing_perf_indexes
Create Date: 2026-06-04 13:58:10.069101

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9cff50e2092'
down_revision: Union[str, None] = '026_missing_perf_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Index for /v1/talent-pool sorting
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidates_org_match_score ON candidates (organization_id, match_score DESC NULLS LAST)")
    # Index for /v1/candidates sorting
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidates_org_created_at ON candidates (organization_id, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_candidates_org_created_at")
    op.execute("DROP INDEX IF EXISTS ix_candidates_org_match_score")
