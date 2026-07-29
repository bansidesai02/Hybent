"""add fcm_token to users

Revision ID: 010_add_fcm_token
Revises: 009_add_settings
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '010_add_fcm_token'
down_revision = '009_add_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('fcm_token', sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'fcm_token')
