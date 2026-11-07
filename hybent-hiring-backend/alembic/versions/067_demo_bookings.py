"""Demo bookings from hybent.com/book-demo

Revision ID: 067_demo_bookings
Revises: 066_push_device_per_account
Create Date: 2026-11-07

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '067_demo_bookings'
down_revision = '066_push_device_per_account'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'demo_bookings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('company', sa.String(200), nullable=False),
        sa.Column('team_size', sa.String(50), nullable=True),
        sa.Column('phone', sa.String(40), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('timezone', sa.String(64), nullable=False, server_default='UTC'),
        sa.Column('status', sa.String(20), nullable=False, server_default='booked'),
        sa.Column('meet_link', sa.String(500), nullable=True),
        sa.Column('calendar_event_id', sa.String(255), nullable=True),
        sa.Column('manage_token', sa.String(64), nullable=False, unique=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('ip', sa.String(64), nullable=True),
        sa.Column('reminder_24h_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reminder_1h_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_demo_bookings_email', 'demo_bookings', ['email'])
    op.create_index('ix_demo_bookings_start_at', 'demo_bookings', ['start_at'])
    op.create_index('ix_demo_bookings_status', 'demo_bookings', ['status'])
    op.create_index('uq_demo_bookings_slot', 'demo_bookings', ['start_at'], unique=True,
                    postgresql_where=sa.text("status = 'booked'"))


def downgrade() -> None:
    op.drop_table('demo_bookings')
