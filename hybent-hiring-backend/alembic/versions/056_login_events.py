"""Sign-in history for the super admin portal

login_events records every sign-in attempt from here on (there is no
earlier history to backfill). Adds indexes the super admin lists sort and
filter on: users.last_login and super_admin_audit_logs.created_at.

Revision ID: 056_login_events
Revises: 055_ai_calls_phase2
Create Date: 2026-10-23

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '056_login_events'
down_revision = '055_ai_calls_phase2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'login_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('method', sa.String(30), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('reason', sa.String(50), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_login_events_user_id', 'login_events', ['user_id'])
    op.create_index('ix_login_events_organization_id', 'login_events', ['organization_id'])
    op.create_index('ix_login_events_email', 'login_events', ['email'])
    op.create_index('ix_login_events_created_at', 'login_events', ['created_at'])
    op.create_index('ix_users_last_login', 'users', ['last_login'], if_not_exists=True)
    op.create_index('ix_super_admin_audit_logs_created_at', 'super_admin_audit_logs', ['created_at'],
                    if_not_exists=True)


def downgrade() -> None:
    op.drop_index('ix_super_admin_audit_logs_created_at', table_name='super_admin_audit_logs', if_exists=True)
    op.drop_index('ix_users_last_login', table_name='users', if_exists=True)
    op.drop_table('login_events')
