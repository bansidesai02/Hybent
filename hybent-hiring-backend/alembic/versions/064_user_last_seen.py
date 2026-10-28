"""users.last_seen_at: when the user last had Hybent open, for chat presence

Set when their live connection (the notifications websocket) opens and
closes. Chat shows "Active now" while one is open, else "Last seen …".

Revision ID: 064_user_last_seen
Revises: 063_trial_optional_fields
Create Date: 2026-10-28

"""
from alembic import op
import sqlalchemy as sa

revision = '064_user_last_seen'
down_revision = '063_trial_optional_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'last_seen_at')
