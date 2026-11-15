"""jobs.max_experience_years: the top of the job's experience range

Revision ID: 071_job_max_experience
Revises: 070_inbox_resume_backfill
"""
import sqlalchemy as sa
from alembic import op

revision = '071_job_max_experience'
down_revision = '070_inbox_resume_backfill'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('jobs', sa.Column('max_experience_years', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('jobs', 'max_experience_years')
