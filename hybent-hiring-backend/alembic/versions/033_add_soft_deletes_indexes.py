"""Add soft delete flags and performance indexes

Revision ID: 033_add_soft_deletes_indexes
Revises: 032_add_google_oauth_fields
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa

revision = '033_add_soft_deletes_indexes'
down_revision = '032_add_google_oauth_fields'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add soft delete fields to candidates and jobs
    op.add_column('candidates', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('candidates', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_candidates_is_deleted', 'candidates', ['is_deleted'])
    op.create_index('ix_candidates_created_at', 'candidates', ['created_at'])

    op.add_column('jobs', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('jobs', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_jobs_is_deleted', 'jobs', ['is_deleted'])
    op.create_index('ix_jobs_status', 'jobs', ['status'])
    op.create_index('ix_jobs_created_at', 'jobs', ['created_at'])

def downgrade() -> None:
    op.drop_index('ix_jobs_created_at', table_name='jobs')
    op.drop_index('ix_jobs_status', table_name='jobs')
    op.drop_index('ix_jobs_is_deleted', table_name='jobs')
    op.drop_column('jobs', 'deleted_at')
    op.drop_column('jobs', 'is_deleted')

    op.drop_index('ix_candidates_created_at', table_name='candidates')
    op.drop_index('ix_candidates_is_deleted', table_name='candidates')
    op.drop_column('candidates', 'deleted_at')
    op.drop_column('candidates', 'is_deleted')
