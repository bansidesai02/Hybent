"""Default monthly AI credit limits: admin 4,000, recruiter 3,000

The plan's included seats (1 admin + 2 recruiters) now split its 10,000
credits as 4,000 + 3,000 + 3,000 instead of 1,000 + 4,500 + 4,500. Members
still on an old default move to the new one; limits an admin changed, and
extra-seat limits (1,500 / 1,000), are left alone.

Revision ID: 048_role_credit_defaults
Revises: 047_stripe_payments
Create Date: 2026-09-27

"""
from alembic import op
import sqlalchemy as sa

revision = '048_role_credit_defaults'
down_revision = '047_stripe_payments'
branch_labels = None
depends_on = None


def _move(role: str, old: int, new: int) -> None:
    op.get_bind().execute(sa.text("""
        UPDATE user_ai_credits c SET monthly_limit = :new
        FROM users u
        WHERE u.id = c.user_id AND u.role = :role AND c.monthly_limit = :old
    """), {"role": role, "old": old, "new": new})


def upgrade() -> None:
    _move("admin", 1000, 4000)
    _move("recruiter", 4500, 3000)


def downgrade() -> None:
    _move("admin", 4000, 1000)
    _move("recruiter", 3000, 4500)
