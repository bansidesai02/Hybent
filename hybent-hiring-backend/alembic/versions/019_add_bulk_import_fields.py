"""Add bulk import fields to candidates

Revision ID: 019_add_bulk_import_fields
Revises: 018_app_candidate_fk_restrict
Create Date: 2026-05-25

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '019_add_bulk_import_fields'
down_revision = '018_app_candidate_fk_restrict'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new fields for bulk import functionality
    op.add_column('candidates', sa.Column('reference', sa.String(255), nullable=True))
    op.add_column('candidates', sa.Column('relevant_experience', sa.String(100), nullable=True))
    op.add_column('candidates', sa.Column('import_status', sa.String(50), nullable=True, server_default='active'))
    op.add_column('candidates', sa.Column('remarks_hr', sa.Text(), nullable=True))
    op.add_column('candidates', sa.Column('remarks_technical', sa.Text(), nullable=True))
    op.add_column('candidates', sa.Column('remarks_practical', sa.Text(), nullable=True))
    op.add_column('candidates', sa.Column('techno_functional_hr_interview', sa.String(255), nullable=True))
    op.add_column('candidates', sa.Column('import_panel_name', sa.String(255), nullable=True))
    op.add_column('candidates', sa.Column('import_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('candidates', sa.Column('current_salary', sa.String(100), nullable=True))
    op.add_column('candidates', sa.Column('expected_salary', sa.String(100), nullable=True))


def downgrade() -> None:
    # Remove the new fields
    op.drop_column('candidates', 'expected_salary')
    op.drop_column('candidates', 'current_salary')
    op.drop_column('candidates', 'import_date')
    op.drop_column('candidates', 'import_panel_name')
    op.drop_column('candidates', 'techno_functional_hr_interview')
    op.drop_column('candidates', 'remarks_practical')
    op.drop_column('candidates', 'remarks_technical')
    op.drop_column('candidates', 'remarks_hr')
    op.drop_column('candidates', 'import_status')
    op.drop_column('candidates', 'relevant_experience')
    op.drop_column('candidates', 'reference')
