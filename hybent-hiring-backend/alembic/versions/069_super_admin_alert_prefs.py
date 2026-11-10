"""Super admins choose which alerts they get

Revision ID: 069_super_admin_alert_prefs
Revises: 068_operations_center
Create Date: 2026-11-09

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '069_super_admin_alert_prefs'
down_revision = '068_operations_center'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('alert_prefs', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'alert_prefs')
