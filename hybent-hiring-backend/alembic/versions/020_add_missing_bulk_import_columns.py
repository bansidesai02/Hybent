"""Add missing bulk import columns

Revision ID: 020_bulk_import_missing_cols
Revises: 019_add_bulk_import_fields
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa


revision = "020_bulk_import_missing_cols"
down_revision = "019_add_bulk_import_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("sr_no", sa.String(length=50), nullable=True))
    op.add_column("candidates", sa.Column("import_row_date", sa.String(length=100), nullable=True))
    op.add_column("candidates", sa.Column("hr_name", sa.String(length=255), nullable=True))
    op.add_column("candidates", sa.Column("technical_panel", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "technical_panel")
    op.drop_column("candidates", "hr_name")
    op.drop_column("candidates", "import_row_date")
    op.drop_column("candidates", "sr_no")
