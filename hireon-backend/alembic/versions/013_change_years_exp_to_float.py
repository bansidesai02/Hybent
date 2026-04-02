"""change years_experience to float

Revision ID: 013_change_years_exp_to_float
Revises: 012_add_linkedin_token
Create Date: 2026-04-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013_change_years_exp_to_float'
down_revision = '012_add_linkedin_token'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('candidates', 'years_experience',
               existing_type=sa.INTEGER(),
               type_=sa.Float(),
               postgresql_using='years_experience::double precision',
               existing_nullable=True)


def downgrade() -> None:
    op.alter_column('candidates', 'years_experience',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               postgresql_using='years_experience::integer',
               existing_nullable=True)
