"""Integration keys

Machine credentials for /v1/integrations/* (n8n). Each key belongs to one
organization and carries a fixed set of scopes; only a SHA-256 hash of its
secret is stored.

Revision ID: 053_integration_keys
Revises: 052_chat_groups_and_attachments
Create Date: 2026-10-10

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '053_integration_keys'
down_revision = '052_chat_groups_and_attachments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'integration_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('key_id', sa.String(16), nullable=False),
        sa.Column('secret_hash', sa.String(64), nullable=False),
        sa.Column('scopes', postgresql.ARRAY(sa.String(50)), nullable=False, server_default='{}'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_integration_keys_organization_id', 'integration_keys', ['organization_id'])
    op.create_index('ix_integration_keys_key_id', 'integration_keys', ['key_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_integration_keys_key_id', table_name='integration_keys')
    op.drop_index('ix_integration_keys_organization_id', table_name='integration_keys')
    op.drop_table('integration_keys')
