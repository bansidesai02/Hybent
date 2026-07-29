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
    # Check if table exists (optional but safe)
    # Since the error says it doesn't exist, we create it.
    op.create_table(
        'job_referrals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_id', sa.UUID(), nullable=False),
        sa.Column('referrer_id', sa.UUID(), nullable=False),
        sa.Column('referee_first_name', sa.String(length=100), nullable=False),
        sa.Column('referee_last_name', sa.String(length=100), nullable=False),
        sa.Column('referee_email', sa.String(length=255), nullable=False),
        sa.Column('referee_phone', sa.String(length=50), nullable=True),
        sa.Column('relation_to_referrer', sa.String(length=100), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('resume_url', sa.String(length=255), nullable=True),
        sa.Column('resume_filename', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referrer_id'], ['candidates.id'], ondelete='CASCADE')
    )
    op.create_index('ix_job_referrals_job_id', 'job_referrals', ['job_id'], unique=False)
    op.create_index('ix_job_referrals_referrer_id', 'job_referrals', ['referrer_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_job_referrals_referrer_id', table_name='job_referrals')
    op.drop_index('ix_job_referrals_job_id', table_name='job_referrals')
    op.drop_table('job_referrals')
