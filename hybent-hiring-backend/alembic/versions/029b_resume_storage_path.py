"""Add resume_storage_path to candidates (Supabase Storage)

Adds resume_storage_path column to candidates table for Supabase Storage integration.
resume_storage_path stores the private bucket path only; signed URLs are generated on-demand.

NOTE: This migration runs on the super-admin branch (parent: 2915b1d1b4ca).
      It is merged into the main sequence by 031_merge_heads.

Revision ID: 029
Revises: 2915b1d1b4ca
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "2915b1d1b4ca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("resume_storage_path", sa.String(1000), nullable=True),
    )
    op.create_index(
        "ix_candidates_resume_storage_path",
        "candidates",
        ["resume_storage_path"],
        unique=False,
        postgresql_where=sa.text("resume_storage_path IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_candidates_resume_storage_path",
        table_name="candidates",
        postgresql_where=sa.text("resume_storage_path IS NOT NULL"),
    )
    op.drop_column("candidates", "resume_storage_path")
