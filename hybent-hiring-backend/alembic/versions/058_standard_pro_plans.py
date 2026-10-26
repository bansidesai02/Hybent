"""Replace the term plans with Standard ($29/mo) and Pro ($39/mo)

Standard and Pro are both monthly and include one admin seat, no recruiter
seats (recruiters are extra seats at $10/month) and 10,000 AI credits a month. Pro adds the Recruiter Copilot; Standard has it off
(the plan's features.copilot, read by services/feature_flags). Custom stays.

Existing subscriptions on the old Standard / 6 months / 12 months plans move
to Pro, so no current client loses the Copilot they already have, and get
their 2 previously included recruiter seats as extra seats so no recruiter
loses access. Their Stripe subscriptions keep billing what they signed up for.

Revision ID: 058_standard_pro_plans
Revises: 057_support_sessions
Create Date: 2026-10-25

"""
from alembic import op
import sqlalchemy as sa

revision = '058_standard_pro_plans'
down_revision = '057_support_sessions'
branch_labels = None
depends_on = None

STANDARD_FEATURES = '{"ai": true, "video": true, "bulk": true, "domain": false, "analytics": true, "copilot": false}'
PRO_FEATURES = '{"ai": true, "video": true, "bulk": true, "domain": false, "analytics": true, "copilot": true}'
OLD_TERM_PLANS = ('6 months', '12 months')


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO subscription_plans
            (id, name, price_monthly, price_yearly, max_users, max_jobs, features, ai_credits_monthly,
             term_months, currency, included_admins, included_recruiters, sort_order, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Pro', 39.0, 468.0, 3, 999, CAST(:features AS jsonb), 10000,
                1, 'USD', 1, 0, 2, now(), now())
        ON CONFLICT (name) DO UPDATE SET price_monthly = 39.0, price_yearly = 468.0,
            features = CAST(:features AS jsonb), term_months = 1, currency = 'USD', sort_order = 2,
            included_recruiters = 0
    """), {"features": PRO_FEATURES})

    # Current clients keep the Copilot: everyone on a term plan moves to Pro.
    conn.execute(sa.text("""
        UPDATE company_subscriptions
        SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'Pro'),
            extra_recruiter_seats = extra_recruiter_seats + 2
        WHERE plan_id IN (SELECT id FROM subscription_plans WHERE name IN ('Standard', '6 months', '12 months'))
    """))

    conn.execute(sa.text("""
        UPDATE subscription_plans
        SET price_monthly = 29.0, price_yearly = 348.0, term_months = 1, sort_order = 1,
            included_recruiters = 0, features = CAST(:features AS jsonb)
        WHERE name = 'Standard'
    """), {"features": STANDARD_FEATURES})
    conn.execute(sa.text("UPDATE subscription_plans SET sort_order = 3 WHERE name = 'Custom'"))
    conn.execute(sa.text("DELETE FROM subscription_plans WHERE name IN :names").bindparams(
        sa.bindparam("names", expanding=True)), {"names": list(OLD_TERM_PLANS)})


def downgrade() -> None:
    conn = op.get_bind()
    features = '{"ai": true, "video": true, "bulk": true, "domain": false, "analytics": true}'
    for name, term, price, order in (("6 months", 6, 66.0, 2), ("12 months", 12, 62.0, 3)):
        conn.execute(sa.text("""
            INSERT INTO subscription_plans
                (id, name, price_monthly, price_yearly, max_users, max_jobs, features, ai_credits_monthly,
                 term_months, currency, included_admins, included_recruiters, sort_order, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :price, :yearly, 3, 999, CAST(:features AS jsonb), 10000,
                    :term, 'USD', 1, 2, :order, now(), now())
            ON CONFLICT (name) DO NOTHING
        """), {"name": name, "price": price, "yearly": price * 12, "features": features, "term": term, "order": order})
    conn.execute(sa.text("""
        UPDATE subscription_plans SET price_monthly = 69.0, price_yearly = 828.0, sort_order = 1,
            included_recruiters = 2, features = CAST(:features AS jsonb)
        WHERE name = 'Standard'
    """), {"features": features})
    conn.execute(sa.text("""
        UPDATE company_subscriptions SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'Standard'),
            extra_recruiter_seats = GREATEST(extra_recruiter_seats - 2, 0)
        WHERE plan_id = (SELECT id FROM subscription_plans WHERE name = 'Pro')
    """))
    conn.execute(sa.text("DELETE FROM subscription_plans WHERE name = 'Pro'"))
    conn.execute(sa.text("UPDATE subscription_plans SET sort_order = 4 WHERE name = 'Custom'"))
