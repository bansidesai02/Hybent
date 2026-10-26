"""Time-limited, auditable super admin support (impersonation) sessions

impersonation_logs gets the session's client, when it expires, whether it may
change data, and how and by whom it ended. Existing rows keep nulls (their end
was never recorded) and allow_changes = false.

Revision ID: 057_support_sessions
Revises: 056_login_events
Create Date: 2026-10-23

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '057_support_sessions'
down_revision = '056_login_events'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('impersonation_logs', sa.Column(
        'organization_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True))
    op.add_column('impersonation_logs', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('impersonation_logs', sa.Column(
        'allow_changes', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('impersonation_logs', sa.Column('end_reason', sa.String(20), nullable=True))
    op.add_column('impersonation_logs', sa.Column(
        'ended_by_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_impersonation_logs_organization_id', 'impersonation_logs', ['organization_id'])


def downgrade() -> None:
    op.drop_index('ix_impersonation_logs_organization_id', table_name='impersonation_logs')
    op.drop_column('impersonation_logs', 'ended_by_id')
    op.drop_column('impersonation_logs', 'end_reason')
    op.drop_column('impersonation_logs', 'allow_changes')
    op.drop_column('impersonation_logs', 'expires_at')
    op.drop_column('impersonation_logs', 'organization_id')
