"""AI Calls phase 2: availability + reminder calls, call billing

voice_calls gets the interview it concerns, what was asked, the use-case
outcome, the reminder number and the last billed attempt; voice_slot_holds
locks an interview slot while a candidate confirms it on a call.

Revision ID: 055_ai_calls_phase2
Revises: 054_ai_calls
Create Date: 2026-10-21

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '055_ai_calls_phase2'
down_revision = '054_ai_calls'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('voice_calls', sa.Column('interview_id', postgresql.UUID(as_uuid=True),
                                           sa.ForeignKey('interviews.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_voice_calls_interview_id', 'voice_calls', ['interview_id'])
    op.add_column('voice_calls', sa.Column('reminder_number', sa.Integer(), nullable=True))
    op.add_column('voice_calls', sa.Column('request', postgresql.JSONB(), nullable=True))
    op.add_column('voice_calls', sa.Column('use_case_outcome', sa.String(40), nullable=True))
    op.add_column('voice_calls', sa.Column('billed_attempt_no', sa.Integer(), nullable=False, server_default='0'))

    op.create_table(
        'voice_slot_holds',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('voice_call_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('voice_calls.id', ondelete='CASCADE'), nullable=False),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_min', sa.Integer(), nullable=False),
        sa.Column('panelist_ids', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('status', sa.String(20), nullable=False, server_default='HELD'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_voice_slot_holds_voice_call_id', 'voice_slot_holds', ['voice_call_id'])
    op.create_index('ix_voice_slot_holds_org_start', 'voice_slot_holds', ['organization_id', 'start_at'])


def downgrade() -> None:
    op.drop_index('ix_voice_slot_holds_org_start', table_name='voice_slot_holds')
    op.drop_index('ix_voice_slot_holds_voice_call_id', table_name='voice_slot_holds')
    op.drop_table('voice_slot_holds')
    op.drop_column('voice_calls', 'billed_attempt_no')
    op.drop_column('voice_calls', 'use_case_outcome')
    op.drop_column('voice_calls', 'request')
    op.drop_column('voice_calls', 'reminder_number')
    op.drop_index('ix_voice_calls_interview_id', table_name='voice_calls')
    op.drop_column('voice_calls', 'interview_id')
