"""AI Calls (Hybent AI Agent)

voice_calls mirrors each call task sent to the voice engine; org_voice_settings
holds Settings → AI Calls; candidates get consent / opt-out columns and jobs
get their pre-screen setup.

Revision ID: 054_ai_calls
Revises: 053_integration_keys
Create Date: 2026-10-21

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '054_ai_calls'
down_revision = '053_integration_keys'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'voice_calls',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('engine_task_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('phone_e164', sa.String(20), nullable=False),
        sa.Column('language', sa.String(10), nullable=False, server_default='en'),
        sa.Column('task_status', sa.String(20), nullable=False, server_default='SCHEDULED'),
        sa.Column('outcome', sa.String(30), nullable=True),
        sa.Column('attempt_no', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('final', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_sec', sa.Integer(), nullable=True),
        sa.Column('language_detected', sa.String(10), nullable=True),
        sa.Column('audio_quality', sa.String(20), nullable=True),
        sa.Column('callback_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('transcript', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('recording_url', sa.String(1000), nullable=True),
        sa.Column('result', postgresql.JSONB(), nullable=True),
        sa.Column('summary_text', sa.Text(), nullable=True),
        sa.Column('decision', sa.String(30), nullable=True),
        sa.Column('hr_override', postgresql.JSONB(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('profile_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('engine_task_id', name='uq_voice_calls_engine_task_id'),
    )
    op.create_index('ix_voice_calls_organization_id', 'voice_calls', ['organization_id'])
    op.create_index('ix_voice_calls_job_id', 'voice_calls', ['job_id'])
    op.create_index('ix_voice_calls_org_status', 'voice_calls', ['organization_id', 'task_status'])
    op.create_index('ix_voice_calls_candidate', 'voice_calls', ['candidate_id', 'created_at'])

    op.create_table(
        'org_voice_settings',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('settings', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.add_column('candidates', sa.Column('ai_call_consent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('candidates', sa.Column('ai_call_consent_source', sa.String(50), nullable=True))
    op.add_column('candidates', sa.Column('ai_call_opted_out_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('jobs', sa.Column('voice_call_config', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'voice_call_config')
    op.drop_column('candidates', 'ai_call_opted_out_at')
    op.drop_column('candidates', 'ai_call_consent_source')
    op.drop_column('candidates', 'ai_call_consent_at')
    op.drop_table('org_voice_settings')
    op.drop_index('ix_voice_calls_candidate', table_name='voice_calls')
    op.drop_index('ix_voice_calls_org_status', table_name='voice_calls')
    op.drop_index('ix_voice_calls_job_id', table_name='voice_calls')
    op.drop_index('ix_voice_calls_organization_id', table_name='voice_calls')
    op.drop_table('voice_calls')
