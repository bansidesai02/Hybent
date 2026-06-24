"""029_add_resume_storage_path

Adds resume_storage_path column to candidates table for Supabase Storage integration.

- resume_storage_path: stores the private Supabase bucket path only.
  Signed URLs are generated on-demand and never stored.

Revision ID: 029
Revises: d9cff50e2092
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "029"
down_revision = "2915b1d1b4ca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("resume_storage_path", sa.String(1000), nullable=True),
    )
    # Index to quickly find candidates who have uploaded resumes to Supabase
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
