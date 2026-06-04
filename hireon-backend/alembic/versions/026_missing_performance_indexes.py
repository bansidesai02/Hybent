"""Add missing performance indexes

Revision ID: 026_missing_perf_indexes
Revises: 025_portal_nav_indexes
Create Date: 2026-06-04
"""

from alembic import op


revision = "026_missing_perf_indexes"
down_revision = "025_portal_nav_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_candidates_org_phone ON candidates (organization_id, phone) WHERE phone IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_interview_panelists_user_id ON interview_panelists (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_applications_org_applied_at ON applications (organization_id, applied_at)",
        "CREATE INDEX IF NOT EXISTS ix_interviews_org_scheduled_at ON interviews (organization_id, scheduled_at)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON notifications (user_id, is_read, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_scorecards_submitted_by ON scorecards (submitted_by_id)",
        "CREATE INDEX IF NOT EXISTS ix_offers_created_by ON offers (created_by_id)",
    ]

    for statement in statements:
        op.execute(statement)


def downgrade() -> None:
    for index_name in [
        "ix_offers_created_by",
        "ix_scorecards_submitted_by",
        "ix_notifications_user_unread",
        "ix_interviews_org_scheduled_at",
        "ix_applications_org_applied_at",
        "ix_interview_panelists_user_id",
        "ix_candidates_org_phone",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")
