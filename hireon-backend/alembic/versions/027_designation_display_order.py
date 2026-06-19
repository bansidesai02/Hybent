"""Designation display order

Revision ID: 027_designation_display_order
Revises: d9cff50e2092
Create Date: 2026-06-19 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "027_designation_display_order"
down_revision: Union[str, None] = "d9cff50e2092"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        """
        WITH ordered_jobs AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY organization_id
                ORDER BY created_at ASC, id ASC
            ) - 1 AS rn
            FROM jobs
        )
        UPDATE jobs
        SET display_order = ordered_jobs.rn
        FROM ordered_jobs
        WHERE jobs.id = ordered_jobs.id
        """
    )
    op.create_index(
        "ix_jobs_org_status_display_order",
        "jobs",
        ["organization_id", "status", "display_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_org_status_display_order", table_name="jobs")
    op.drop_column("jobs", "display_order")
