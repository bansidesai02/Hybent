"""Add resume columns to JobReferral

Revision ID: 006_add_resume_to_job_referral
Revises: 005_expand_candidate_profile
Create Date: 2026-03-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_add_resume_to_job_referral'
down_revision: Union[str, None] = '005_expand_candidate_profile'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('job_referrals', sa.Column('resume_url', sa.String(length=255), nullable=True))
    op.add_column('job_referrals', sa.Column('resume_filename', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('job_referrals', 'resume_filename')
    op.drop_column('job_referrals', 'resume_url')
