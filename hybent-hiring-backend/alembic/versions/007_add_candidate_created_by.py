"""Add created_by_id to candidates

Revision ID: 007_add_candidate_created_by
Revises: 006_add_resume_to_job_referral
Create Date: 2026-03-25 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '007_add_candidate_created_by'
down_revision: Union[str, None] = '006_add_resume_to_job_referral'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add created_by_id to candidates
    op.add_column('candidates', sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_candidates_created_by_id', 'candidates', ['created_by_id'])


def downgrade() -> None:
    op.drop_index('ix_candidates_created_by_id', table_name='candidates')
    op.drop_column('candidates', 'created_by_id')
