"""Extra seats are priced per role: admin $15 (+1,500 credits), recruiter $10 (+1,000)

Existing untyped extra seats become recruiter seats.

Revision ID: 045_extra_seats_per_role
Revises: 044_extra_seats_any_role
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = '045_extra_seats_per_role'
down_revision = '044_extra_seats_any_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('company_subscriptions', 'extra_seats', new_column_name='extra_recruiter_seats')
    op.add_column(
        'company_subscriptions',
        sa.Column('extra_admin_seats', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.execute("UPDATE company_subscriptions SET extra_recruiter_seats = extra_recruiter_seats + extra_admin_seats")
    op.drop_column('company_subscriptions', 'extra_admin_seats')
    op.alter_column('company_subscriptions', 'extra_recruiter_seats', new_column_name='extra_seats')
