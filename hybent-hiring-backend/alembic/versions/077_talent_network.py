"""talent network: talent_profiles + talent_contact_requests

Candidates who opt in to be found by any company (Hybent Talent Network),
and companies' requests for their contact details.

Revision ID: 077_talent_network
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '077_talent_network'
down_revision = '076_job_publish_externally'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'talent_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50)),
        sa.Column('location', sa.String(255)),
        sa.Column('current_title', sa.String(255)),
        sa.Column('current_company', sa.String(255)),
        sa.Column('years_experience', sa.Float()),
        sa.Column('skills', postgresql.ARRAY(sa.String()), server_default='{}'),
        sa.Column('summary', sa.Text()),
        sa.Column('linkedin_url', sa.String(500)),
        sa.Column('looking_for', sa.String(255)),
        sa.Column('parsed_data', postgresql.JSONB()),
        sa.Column('consent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consent_version', sa.String(20), nullable=False),
        sa.Column('email_verified_at', sa.DateTime(timezone=True)),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('source', sa.String(50)),
        sa.Column('verify_token', sa.String(64)),
        sa.Column('manage_token', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_talent_profiles_email', 'talent_profiles', ['email'], unique=True)
    op.create_index('ix_talent_profiles_verify_token', 'talent_profiles', ['verify_token'])
    op.create_index('ix_talent_profiles_manage_token', 'talent_profiles', ['manage_token'])

    op.create_table(
        'talent_contact_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('profile_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('talent_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('jobs.id', ondelete='SET NULL')),
        sa.Column('message', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('token', sa.String(64), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('candidates.id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('responded_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('profile_id', 'organization_id', name='uq_talent_request_profile_org'),
    )
    op.create_index('ix_talent_contact_requests_profile_id', 'talent_contact_requests', ['profile_id'])
    op.create_index('ix_talent_contact_requests_organization_id', 'talent_contact_requests', ['organization_id'])
    op.create_index('ix_talent_contact_requests_token', 'talent_contact_requests', ['token'])


def downgrade():
    op.drop_table('talent_contact_requests')
    op.drop_table('talent_profiles')
