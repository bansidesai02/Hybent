"""Add bulk import batches and candidate batch tracking

Revision ID: 021_bulk_import_batches
Revises: 020_bulk_import_missing_cols
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "021_bulk_import_batches"
down_revision = "020_bulk_import_missing_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("imported_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=600), nullable=True),
        sa.Column("selected_panels", postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("failure_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_import_batches_organization_id", "import_batches", ["organization_id"])
    op.create_index("ix_import_batches_imported_by_id", "import_batches", ["imported_by_id"])

    op.add_column("candidates", sa.Column("import_batch_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("candidates", sa.Column("imported_by_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("candidates", sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_candidates_import_batch_id", "candidates", "import_batches", ["import_batch_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_candidates_imported_by_id", "candidates", "users", ["imported_by_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_candidates_import_batch_id", "candidates", ["import_batch_id"])
    op.create_index("ix_candidates_imported_by_id", "candidates", ["imported_by_id"])


def downgrade() -> None:
    op.drop_index("ix_candidates_imported_by_id", table_name="candidates")
    op.drop_index("ix_candidates_import_batch_id", table_name="candidates")
    op.drop_constraint("fk_candidates_imported_by_id", "candidates", type_="foreignkey")
    op.drop_constraint("fk_candidates_import_batch_id", "candidates", type_="foreignkey")
    op.drop_column("candidates", "imported_at")
    op.drop_column("candidates", "imported_by_id")
    op.drop_column("candidates", "import_batch_id")

    op.drop_index("ix_import_batches_imported_by_id", table_name="import_batches")
    op.drop_index("ix_import_batches_organization_id", table_name="import_batches")
    op.drop_table("import_batches")
