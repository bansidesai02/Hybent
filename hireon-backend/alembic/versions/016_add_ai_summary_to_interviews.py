"""add ai_summary to interviews

Revision ID: 016_add_ai_summary_to_interviews
Revises: 015_add_recovery_email_to_users
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_add_ai_summary_to_interviews'
down_revision = '015_add_recovery_email_to_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('interviews', sa.Column('ai_summary', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('interviews', 'ai_summary')
