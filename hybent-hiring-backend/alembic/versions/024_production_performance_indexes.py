"""Add production performance indexes

Revision ID: 024_perf_indexes
Revises: 023_repair_bulk_schema_drift
Create Date: 2026-05-27
"""

from alembic import op


revision = "024_perf_indexes"
down_revision = "023_repair_bulk_schema_drift"
branch_labels = None
depends_on = None


def upgrade() -> None:
    statements = [
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        "CREATE INDEX IF NOT EXISTS ix_candidates_org_created_at_desc ON candidates (organization_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_org_pipeline_stage ON candidates (organization_id, pipeline_stage)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_org_created_by ON candidates (organization_id, created_by_id)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_org_match_score_desc ON candidates (organization_id, match_score DESC NULLS LAST)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_org_applied_job_title ON candidates (organization_id, applied_job_title)",
        "CREATE INDEX IF NOT EXISTS ix_applications_org_job_candidate ON applications (organization_id, job_id, candidate_id)",
        "CREATE INDEX IF NOT EXISTS ix_applications_candidate_job ON applications (candidate_id, job_id)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_full_name_trgm ON candidates USING gin (full_name gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_email_trgm ON candidates USING gin (email gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_current_title_trgm ON candidates USING gin (current_title gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_current_company_trgm ON candidates USING gin (current_company gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_skills_gin ON candidates USING gin (skills)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_tags_gin ON candidates USING gin (tags)",
    ]
    for statement in statements:
        op.execute(statement)


def downgrade() -> None:
    for index_name in [
        "ix_candidates_tags_gin",
        "ix_candidates_skills_gin",
        "ix_candidates_current_company_trgm",
        "ix_candidates_current_title_trgm",
        "ix_candidates_email_trgm",
        "ix_candidates_full_name_trgm",
        "ix_applications_candidate_job",
        "ix_applications_org_job_candidate",
        "ix_candidates_org_applied_job_title",
        "ix_candidates_org_match_score_desc",
        "ix_candidates_org_created_by",
        "ix_candidates_org_pipeline_stage",
        "ix_candidates_org_created_at_desc",
    ]:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")
