"""add linkedin_access_token to users

Revision ID: 012_add_linkedin_token
Revises: 011_add_phone_to_users
Create Date: 2026-04-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '012_add_linkedin_token'
down_revision = '011_add_phone_to_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('linkedin_access_token', sa.String(length=2000), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'linkedin_access_token')
