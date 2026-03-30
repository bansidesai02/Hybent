"""add phone to users

Revision ID: 010_add_phone_to_users
Revises: 009_add_fcm_token
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '010_add_phone_to_users'
down_revision = '009_add_fcm_token'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'phone')
