"""Super admin operations: email log, platform errors, contact messages

New tables only; nothing existing changes.

Revision ID: 068_operations_center
Revises: 067_demo_bookings
Create Date: 2026-11-09

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '068_operations_center'
down_revision = '067_demo_bookings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'email_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('to_address', sa.String(320), nullable=False),
        sa.Column('subject', sa.String(500), nullable=False),
        sa.Column('provider', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('html_body', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_email_logs_to_address', 'email_logs', ['to_address'])
    op.create_index('ix_email_logs_status', 'email_logs', ['status'])
    op.create_index('ix_email_logs_created_at', 'email_logs', ['created_at'])

    op.create_table(
        'platform_errors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('kind', sa.String(10), nullable=False),
        sa.Column('source', sa.String(300), nullable=False),
        sa.Column('error', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('task_args', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_platform_errors_kind', 'platform_errors', ['kind'])
    op.create_index('ix_platform_errors_status', 'platform_errors', ['status'])
    op.create_index('ix_platform_errors_last_seen_at', 'platform_errors', ['last_seen_at'])

    op.create_table(
        'contact_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('topic', sa.String(50), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('email', sa.String(320), nullable=False),
        sa.Column('phone', sa.String(40), nullable=True),
        sa.Column('company', sa.String(200), nullable=True),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='new'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_contact_messages_email', 'contact_messages', ['email'])
    op.create_index('ix_contact_messages_status', 'contact_messages', ['status'])
    op.create_index('ix_contact_messages_created_at', 'contact_messages', ['created_at'])


def downgrade() -> None:
    op.drop_table('contact_messages')
    op.drop_table('platform_errors')
    op.drop_table('email_logs')
