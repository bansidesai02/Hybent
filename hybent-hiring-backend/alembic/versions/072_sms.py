"""SMS settings, delivery log and interview reminder stamps.

Revision ID: 072_sms
Revises: 071_job_max_experience
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '072_sms'
down_revision = '071_job_max_experience'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sms_settings',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('events', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )
    op.create_table(
        'sms_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event', sa.String(50), nullable=False),
        sa.Column('audience', sa.String(20), nullable=False),
        sa.Column('recipient_name', sa.String(255)),
        sa.Column('phone', sa.String(30)),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('error', sa.Text()),
        sa.Column('provider_ref', sa.String(100)),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True)),
        sa.Column('interview_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_sms_logs_organization_id', 'sms_logs', ['organization_id'])
    op.create_index('ix_sms_logs_candidate_id', 'sms_logs', ['candidate_id'])
    op.create_index('ix_sms_logs_interview_id', 'sms_logs', ['interview_id'])
    op.create_index('ix_sms_logs_created_at', 'sms_logs', ['created_at'])
    op.add_column('interviews', sa.Column('sms_reminder_24h_sent_at', sa.DateTime(timezone=True)))
    op.add_column('interviews', sa.Column('sms_reminder_1h_sent_at', sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column('interviews', 'sms_reminder_1h_sent_at')
    op.drop_column('interviews', 'sms_reminder_24h_sent_at')
    op.drop_table('sms_logs')
    op.drop_table('sms_settings')
