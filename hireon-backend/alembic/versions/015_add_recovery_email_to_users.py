"""add recovery_email to users

Revision ID: 015_add_recovery_email_to_users
Revises: 014_add_ai_usage_tracking
Create Date: 2026-04-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015_add_recovery_email_to_users'
down_revision = '014_add_ai_usage_tracking'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('recovery_email', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'recovery_email')
