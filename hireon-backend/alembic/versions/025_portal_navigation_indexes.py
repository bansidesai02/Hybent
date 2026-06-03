# """Add portal navigation indexes

# Revision ID: 025_portal_nav_indexes
# Revises: 024_perf_indexes
# Create Date: 2026-05-27
# """

# from alembic import op


# revision = "025_portal_nav_indexes"
# down_revision = "024_perf_indexes"
# branch_labels = None
# depends_on = None


# def upgrade() -> None:
#     statements = [
#         "CREATE INDEX IF NOT EXISTS ix_applications_candidate_created_at_desc ON applications (candidate_id, created_at DESC)",
#         "CREATE INDEX IF NOT EXISTS ix_interviews_candidate_scheduled_at_desc ON interviews (candidate_id, scheduled_at DESC)",
#         "CREATE INDEX IF NOT EXISTS ix_offers_application_id ON offers (application_id)",
#         "CREATE INDEX IF NOT EXISTS ix_jobs_org_status_created_at_desc ON jobs (organization_id, status, created_at DESC)",
#         "CREATE INDEX IF NOT EXISTS ix_other_offers_candidate_id ON other_offers (candidate_id)",
#     ]

#     for statement in statements:
#         op.execute(statement)


# def downgrade() -> None:
#     for index_name in [
#         "ix_other_offers_candidate_id",
#         "ix_jobs_org_status_created_at_desc",
#         "ix_offers_application_id",
#         "ix_interviews_candidate_scheduled_at_desc",
#         "ix_applications_candidate_created_at_desc",
#     ]:
#         op.execute(f"DROP INDEX IF EXISTS {index_name}")

from alembic import op

revision = "025_portal_nav_indexes"
down_revision = "024_perf_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_applications_candidate_created_at_desc ON applications (candidate_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_interviews_candidate_scheduled_at_desc ON interviews (candidate_id, scheduled_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_offers_application_id ON offers (application_id)",
        "CREATE INDEX IF NOT EXISTS ix_jobs_org_status_created_at_desc ON jobs (organization_id, status, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_other_offers_candidate_id ON other_offers (candidate_id)",
    ]

    for statement in statements:
        op.execute(statement)


def downgrade() -> None:
    for index_name in [
        "ix_other_offers_candidate_id",
        "ix_jobs_org_status_created_at_desc",
        "ix_offers_application_id",
        "ix_interviews_candidate_scheduled_at_desc",
        "ix_applications_candidate_created_at_desc",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")