"""Repair bulk import schema drift

Revision ID: 023_repair_bulk_schema_drift
Revises: 022_import_file_content
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa


revision = "023_repair_bulk_schema_drift"
down_revision = "022_import_file_content"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    statements = [
        """
        CREATE TABLE IF NOT EXISTS import_batches (
            id UUID PRIMARY KEY,
            organization_id UUID NOT NULL,
            imported_by_id UUID NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(600) NULL,
            selected_panels VARCHAR[] NOT NULL DEFAULT '{}',
            total_rows INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            duplicate_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(50) NOT NULL DEFAULT 'completed',
            failure_details JSONB NULL,
            file_content BYTEA NULL,
            deleted_at TIMESTAMP WITH TIME ZONE NULL,
            deleted_by_id UUID NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS other_offers (
            id UUID PRIMARY KEY,
            candidate_id UUID NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
            company_name VARCHAR(255) NOT NULL,
            role VARCHAR(255) NULL,
            ctc VARCHAR(100) NULL,
            validity_date VARCHAR(100) NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS candidate_documents (
            id UUID PRIMARY KEY,
            candidate_id UUID NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
            doc_type VARCHAR(100) NOT NULL,
            file_url VARCHAR(500) NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """,
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS file_content BYTEA",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS selected_panels VARCHAR[] DEFAULT '{}'",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 0",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed'",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS failure_details JSONB",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS deleted_by_id UUID",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS reference VARCHAR(255)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS relevant_experience VARCHAR(100)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS import_status VARCHAR(50) DEFAULT 'active'",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS remarks_hr TEXT",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS remarks_technical TEXT",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS remarks_practical TEXT",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS techno_functional_hr_interview VARCHAR(255)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS import_panel_name VARCHAR(255)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_salary VARCHAR(100)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS sr_no VARCHAR(50)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS import_row_date VARCHAR(100)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hr_name VARCHAR(255)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS technical_panel VARCHAR(255)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS import_batch_id UUID",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS imported_by_id UUID",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE",
        "CREATE INDEX IF NOT EXISTS ix_import_batches_organization_id ON import_batches (organization_id)",
        "CREATE INDEX IF NOT EXISTS ix_import_batches_imported_by_id ON import_batches (imported_by_id)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_import_batch_id ON candidates (import_batch_id)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_imported_by_id ON candidates (imported_by_id)",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_import_batches_organization_id') THEN
                ALTER TABLE import_batches ADD CONSTRAINT fk_import_batches_organization_id
                FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_import_batches_imported_by_id') THEN
                ALTER TABLE import_batches ADD CONSTRAINT fk_import_batches_imported_by_id
                FOREIGN KEY (imported_by_id) REFERENCES users (id) ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_import_batches_deleted_by_id') THEN
                ALTER TABLE import_batches ADD CONSTRAINT fk_import_batches_deleted_by_id
                FOREIGN KEY (deleted_by_id) REFERENCES users (id) ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_candidates_import_batch_id') THEN
                ALTER TABLE candidates ADD CONSTRAINT fk_candidates_import_batch_id
                FOREIGN KEY (import_batch_id) REFERENCES import_batches (id) ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_candidates_imported_by_id') THEN
                ALTER TABLE candidates ADD CONSTRAINT fk_candidates_imported_by_id
                FOREIGN KEY (imported_by_id) REFERENCES users (id) ON DELETE SET NULL;
            END IF;
        END $$;
        """,
    ]

    for statement in statements:
        bind.execute(sa.text(statement))


def downgrade() -> None:
    # This migration repairs drift idempotently. Do not drop user data on downgrade.
    pass
