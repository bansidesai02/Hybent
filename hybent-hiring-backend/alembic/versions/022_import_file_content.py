"""Add file content column to import batches

Revision ID: 022_import_file_content
Revises: 021_bulk_import_batches
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa


revision = "022_import_file_content"
down_revision = "021_bulk_import_batches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("import_batches", sa.Column("file_content", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("import_batches", "file_content")
