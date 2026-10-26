"""Standard plan includes 5,000 AI credits a month (Pro keeps 10,000)

Existing Standard subscriptions pick up the new allowance at their next
monthly reset.

The included admin seat now gets the plan's credits not set aside for
included recruiters (previously a flat 4,000), so a solo admin can use the
whole allowance. Each organization's first admin still on the old 4,000
default is moved to that amount.

Revision ID: 059_standard_5000_credits
Revises: 058_standard_pro_plans
Create Date: 2026-10-26

"""
from alembic import op

revision = '059_standard_5000_credits'
down_revision = '058_standard_pro_plans'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE subscription_plans SET ai_credits_monthly = 5000, updated_at = now() WHERE name = 'Standard'")
    op.execute("""
        UPDATE user_ai_credits uac
        SET monthly_limit = GREATEST(4000, sp.ai_credits_monthly - sp.included_recruiters * 3000)
        FROM (
            SELECT DISTINCT ON (u.organization_id) c.id, u.organization_id
            FROM user_ai_credits c JOIN users u ON u.id = c.user_id
            WHERE u.role = 'admin' AND u.is_active
            ORDER BY u.organization_id, c.created_at
        ) first_admin
        JOIN company_subscriptions cs ON cs.organization_id = first_admin.organization_id
        JOIN subscription_plans sp ON sp.id = cs.plan_id
        WHERE uac.id = first_admin.id AND uac.monthly_limit = 4000
    """)


def downgrade() -> None:
    op.execute("UPDATE subscription_plans SET ai_credits_monthly = 10000, updated_at = now() WHERE name = 'Standard'")
