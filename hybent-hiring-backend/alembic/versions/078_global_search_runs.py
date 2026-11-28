"""global search runs: search history with results

Each Global Search a recruiter runs is kept with its results, so the team can
reopen it without spending outside-search credits again.

Revision ID: 078_global_search_runs
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '078_global_search_runs'
down_revision = '077_talent_network'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'global_search_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('jobs.id', ondelete='SET NULL')),
        sa.Column('query', sa.String(300)),
        sa.Column('filters', postgresql.JSONB(), nullable=False),
        sa.Column('counts', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('results', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_global_search_runs_organization_id', 'global_search_runs', ['organization_id'])
    op.create_index('ix_global_search_runs_created_at', 'global_search_runs', ['created_at'])


def downgrade():
    op.drop_table('global_search_runs')
