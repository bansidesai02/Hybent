"""Screening recommendations for the Candidate Screening Agent

One row per screening run: what the agent suggests for a new candidate, and
what the recruiter decided. See app/models/screening_recommendation.py.

Revision ID: 051_screening_recommendations
Revises: 050_normalize_candidate_phones
Create Date: 2026-10-05

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '051_screening_recommendations'
down_revision = '050_normalize_candidate_phones'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'screening_recommendations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('recommendation', sa.String(30), nullable=False),
        sa.Column('reasons', postgresql.JSONB(), nullable=True),
        sa.Column('risks', postgresql.JSONB(), nullable=True),
        sa.Column('confidence', sa.String(10), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('matches', postgresql.JSONB(), nullable=True),
        sa.Column('duplicate_of_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('candidates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('decided_by_engine', sa.String(10), nullable=False, server_default='rules'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('action_taken', sa.String(30), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('decided_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_screening_recommendations_organization_id', 'screening_recommendations', ['organization_id'])
    op.create_index('ix_screening_recommendations_candidate_id', 'screening_recommendations', ['candidate_id'])
    op.create_index('ix_screening_recommendations_status', 'screening_recommendations', ['status'])
    op.create_index('ix_screening_recommendations_created_at', 'screening_recommendations', ['created_at'])


def downgrade() -> None:
    op.drop_table('screening_recommendations')
