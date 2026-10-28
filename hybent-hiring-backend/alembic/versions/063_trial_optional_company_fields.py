"""Shorter trial form: company size, industry and country are optional

The form no longer asks for them (the organization setup page does), so
requests can arrive without them.

Revision ID: 063_trial_optional_fields
Revises: 062_trial_schema_otp_setup
Create Date: 2026-10-28

"""
from alembic import op
import sqlalchemy as sa

revision = '063_trial_optional_fields'
down_revision = '062_trial_schema_otp_setup'
branch_labels = None
depends_on = None

COLUMNS = (("company_size", 50), ("industry", 100), ("country", 100))


def upgrade() -> None:
    for name, length in COLUMNS:
        op.alter_column('trial_requests', name, existing_type=sa.String(length), nullable=True, schema='trial')


def downgrade() -> None:
    for name, length in COLUMNS:
        op.execute(f"UPDATE trial.trial_requests SET {name} = '' WHERE {name} IS NULL")
        op.alter_column('trial_requests', name, existing_type=sa.String(length), nullable=False, schema='trial')
