"""app candidate fk restrict

Revision ID: 018_app_candidate_fk_restrict
Revises: 017_add_copilot_conversations
Create Date: 2026-05-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '018_app_candidate_fk_restrict'
down_revision = '017_add_copilot_conversations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old CASCADE FK on applications.candidate_id
    op.drop_constraint(
        'applications_candidate_id_fkey',
        'applications',
        type_='foreignkey'
    )
    # Re-create with RESTRICT so a candidate cannot be deleted
    # while they still have applications linked to them
    op.create_foreign_key(
        'applications_candidate_id_fkey',
        'applications',
        'candidates',
        ['candidate_id'],
        ['id'],
        ondelete='RESTRICT'
    )


def downgrade() -> None:
    # Revert back to CASCADE
    op.drop_constraint(
        'applications_candidate_id_fkey',
        'applications',
        type_='foreignkey'
    )
    op.create_foreign_key(
        'applications_candidate_id_fkey',
        'applications',
        'candidates',
        ['candidate_id'],
        ['id'],
        ondelete='CASCADE'
    )
