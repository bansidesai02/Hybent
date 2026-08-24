"""Add MFA and refresh token composite index

Revision ID: 034_add_mfa_and_token_indexes
Revises: 033_add_soft_deletes_indexes
Create Date: 2026-08-24

"""
from alembic import op
import sqlalchemy as sa

revision = '034_add_mfa_and_token_indexes'
down_revision = '033_add_soft_deletes_indexes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add mfa_enabled to users
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add composite index on is_revoked and token for refresh_tokens table
    op.create_index('ix_refresh_tokens_is_revoked_token', 'refresh_tokens', ['is_revoked', 'token'])

def downgrade() -> None:
    # Drop composite index
    op.drop_index('ix_refresh_tokens_is_revoked_token', table_name='refresh_tokens')
    
    # Drop mfa_enabled column
    op.drop_column('users', 'mfa_enabled')
