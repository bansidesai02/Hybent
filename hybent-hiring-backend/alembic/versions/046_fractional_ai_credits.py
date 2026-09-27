"""Charge AI calls their exact fractional credits, carrying the remainder

Every call used to cost at least 1 credit, so a resume's ~10 embedding
calls (~$0.00001 each) cost 10 credits for $0.0001 of provider cost. Calls
now cost cost / $0.001 exactly; fractions carry on the balances and whole
credits come off as they add up.

Revision ID: 046_fractional_ai_credits
Revises: 045_extra_seats_per_role
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = '046_fractional_ai_credits'
down_revision = '045_extra_seats_per_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'organization_ai_credits',
        sa.Column('credit_remainder', sa.Float(), nullable=False, server_default='0'),
    )
    op.add_column(
        'user_ai_credits',
        sa.Column('credit_remainder', sa.Float(), nullable=False, server_default='0'),
    )
    op.alter_column(
        'ai_usage', 'credits_used',
        type_=sa.Float(), existing_type=sa.Integer(),
        postgresql_using='credits_used::double precision',
    )


def downgrade() -> None:
    op.alter_column(
        'ai_usage', 'credits_used',
        type_=sa.Integer(), existing_type=sa.Float(),
        postgresql_using='ceil(credits_used)::integer',
    )
    op.drop_column('user_ai_credits', 'credit_remainder')
    op.drop_column('organization_ai_credits', 'credit_remainder')
