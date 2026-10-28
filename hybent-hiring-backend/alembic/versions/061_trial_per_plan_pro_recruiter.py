"""A free trial per plan, and Pro includes one recruiter seat

- The trial now matches the plan it was requested from: "Trial Standard"
  (Standard features, 1 admin seat) or "Trial Pro" (Pro features with the
  Copilot, 1 admin + 1 recruiter seat). Both have 500 AI credits.
  The old "Trial" plan becomes "Trial Pro", so running trials keep it.
- trial_requests.plan_interest records which plan was chosen.
- Pro includes 1 recruiter seat. Existing Pro clients keep any extra seats
  they have, so they get the included seat on top.

Revision ID: 061_trial_per_plan
Revises: 060_trial_requests
Create Date: 2026-10-28

"""
from alembic import op
import sqlalchemy as sa

revision = '061_trial_per_plan'
down_revision = '060_trial_requests'
branch_labels = None
depends_on = None

STANDARD_TRIAL_FEATURES = '{"ai": true, "video": true, "bulk": true, "domain": false, "analytics": true, "copilot": false}'


def upgrade() -> None:
    op.add_column(
        'trial_requests',
        sa.Column('plan_interest', sa.String(20), nullable=False, server_default='pro'),
    )
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE subscription_plans SET name = 'Trial Pro', updated_at = now() WHERE name = 'Trial'"))
    conn.execute(sa.text("""
        INSERT INTO subscription_plans
            (id, name, price_monthly, price_yearly, max_users, max_jobs, features, ai_credits_monthly,
             term_months, currency, included_admins, included_recruiters, sort_order, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Trial Standard', 0.0, 0.0, 1, 999, CAST(:features AS jsonb), 500,
                1, 'USD', 1, 0, 98, now(), now())
        ON CONFLICT (name) DO NOTHING
    """), {"features": STANDARD_TRIAL_FEATURES})
    conn.execute(sa.text(
        "UPDATE subscription_plans SET included_recruiters = 1, updated_at = now() WHERE name = 'Pro'"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "UPDATE subscription_plans SET included_recruiters = 0, updated_at = now() WHERE name = 'Pro'"
    ))
    conn.execute(sa.text("""
        DELETE FROM subscription_plans WHERE name = 'Trial Standard'
        AND NOT EXISTS (SELECT 1 FROM company_subscriptions cs WHERE cs.plan_id = subscription_plans.id)
    """))
    conn.execute(sa.text("UPDATE subscription_plans SET name = 'Trial' WHERE name = 'Trial Pro'"))
    op.drop_column('trial_requests', 'plan_interest')
