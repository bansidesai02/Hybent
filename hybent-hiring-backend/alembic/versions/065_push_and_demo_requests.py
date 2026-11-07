"""Phone push subscriptions for admins, and stored demo requests

Revision ID: 065_push_and_demo_requests
Revises: 064_user_last_seen
Create Date: 2026-11-07

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '065_push_and_demo_requests'
down_revision = '064_user_last_seen'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'push_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False, unique=True),
        sa.Column('p256dh', sa.String(255), nullable=False),
        sa.Column('auth', sa.String(255), nullable=False),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])

    op.create_table(
        'demo_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('work_email', sa.String(255), nullable=False),
        sa.Column('company_name', sa.String(200), nullable=False),
        sa.Column('team_size', sa.String(50), nullable=True),
        sa.Column('monthly_hires', sa.String(50), nullable=True),
        sa.Column('hiring_challenge', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='new'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('email_sent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_demo_requests_work_email', 'demo_requests', ['work_email'])
    op.create_index('ix_demo_requests_status', 'demo_requests', ['status'])
    op.create_index('ix_demo_requests_created_at', 'demo_requests', ['created_at'])


def downgrade() -> None:
    op.drop_table('demo_requests')
    op.drop_table('push_subscriptions')
