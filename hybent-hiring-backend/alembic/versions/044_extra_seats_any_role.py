"""Extra seats can hold an admin or a recruiter, not only a recruiter

Revision ID: 044_extra_seats_any_role
Revises: 043_new_subscription_plans
Create Date: 2026-09-26

"""
from alembic import op

revision = '044_extra_seats_any_role'
down_revision = '043_new_subscription_plans'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('company_subscriptions', 'extra_recruiter_seats', new_column_name='extra_seats')


def downgrade() -> None:
    op.alter_column('company_subscriptions', 'extra_seats', new_column_name='extra_recruiter_seats')
