"""client actions url

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('actions_url', sa.String(length=500), nullable=True), schema='voice')


def downgrade() -> None:
    op.drop_column('clients', 'actions_url', schema='voice')
