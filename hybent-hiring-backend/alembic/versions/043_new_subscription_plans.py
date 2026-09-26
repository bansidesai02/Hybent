"""Replace the INR Starter/Pro/Enterprise plans with the published USD plans

Standard ($69/mo), 6 months ($66/mo), 12 months ($62/mo) and Custom. Every
plan includes 1 admin + 2 recruiter seats and 10,000 AI credits a month;
extra recruiter seats are tracked on the subscription.

Existing subscriptions move to Standard (Enterprise to Custom).

Revision ID: 043_new_subscription_plans
Revises: 042_ai_credit_metering
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = '043_new_subscription_plans'
down_revision = '042_ai_credit_metering'
branch_labels = None
depends_on = None

FEATURES = '{"ai": true, "video": true, "bulk": true, "domain": false, "analytics": true}'

NEW_PLANS = [
    # name, term_months, price_monthly, sort_order
    ("Standard", 1, 69.0, 1),
    ("6 months", 6, 66.0, 2),
    ("12 months", 12, 62.0, 3),
    ("Custom", None, 0.0, 4),
]


def upgrade() -> None:
    op.add_column('subscription_plans', sa.Column('term_months', sa.Integer(), nullable=True))
    op.add_column('subscription_plans', sa.Column('currency', sa.String(3), nullable=False, server_default='USD'))
    op.add_column('subscription_plans', sa.Column('included_admins', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('subscription_plans', sa.Column('included_recruiters', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('subscription_plans', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('company_subscriptions', sa.Column('extra_recruiter_seats', sa.Integer(), nullable=False, server_default='0'))

    conn = op.get_bind()
    for name, term, price, order in NEW_PLANS:
        conn.execute(sa.text("""
            INSERT INTO subscription_plans
                (id, name, price_monthly, price_yearly, max_users, max_jobs, features, ai_credits_monthly,
                 term_months, currency, included_admins, included_recruiters, sort_order, created_at, updated_at)
            VALUES (gen_random_uuid(), :name, :price, :yearly, 3, 999, CAST(:features AS jsonb), 10000,
                    :term, 'USD', 1, 2, :order, now(), now())
            ON CONFLICT (name) DO NOTHING
        """), {"name": name, "price": price, "yearly": price * 12, "features": FEATURES, "term": term, "order": order})

    conn.execute(sa.text("""
        UPDATE company_subscriptions s
        SET plan_id = (SELECT id FROM subscription_plans WHERE name =
                CASE WHEN p.name = 'Enterprise' THEN 'Custom' ELSE 'Standard' END),
            billing_cycle = CASE WHEN p.name = 'Enterprise' THEN 'custom' ELSE 'monthly' END
        FROM subscription_plans p
        WHERE p.id = s.plan_id AND p.name IN ('Starter', 'Pro', 'Enterprise')
    """))
    conn.execute(sa.text("DELETE FROM subscription_plans WHERE name IN ('Starter', 'Pro', 'Enterprise')"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, max_users, max_jobs, features,
                                        ai_credits_monthly, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Pro', 24000, 240000, 50, 20,
                '{"ai": true, "bulk": true, "video": true, "domain": false, "analytics": false}'::jsonb, 10000, now(), now())
        ON CONFLICT (name) DO NOTHING
    """))
    conn.execute(sa.text("""
        UPDATE company_subscriptions SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'Pro'),
               billing_cycle = 'monthly'
        WHERE plan_id IN (SELECT id FROM subscription_plans WHERE name IN ('Standard', '6 months', '12 months', 'Custom'))
    """))
    conn.execute(sa.text("DELETE FROM subscription_plans WHERE name IN ('Standard', '6 months', '12 months', 'Custom')"))
    op.drop_column('company_subscriptions', 'extra_recruiter_seats')
    for col in ('sort_order', 'included_recruiters', 'included_admins', 'currency', 'term_months'):
        op.drop_column('subscription_plans', col)
