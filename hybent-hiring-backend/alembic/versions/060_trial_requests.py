"""7-day free trial: trial requests, company_subscriptions.is_trial, Trial plan

Companies request a trial from hybent.com/free-trial; a super admin approves
it, which creates the organization on the hidden Trial plan (Pro features,
1 admin + 1 recruiter seat, 500 AI credits). Existing subscriptions keep
is_trial = false, so their trial_end is still not enforced.

Revision ID: 060_trial_requests
Revises: 059_standard_5000_credits
Create Date: 2026-10-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '060_trial_requests'
down_revision = '059_standard_5000_credits'
branch_labels = None
depends_on = None

TRIAL_FEATURES = '{"ai": true, "video": true, "bulk": true, "domain": false, "analytics": true, "copilot": true}'


def upgrade() -> None:
    op.add_column(
        'company_subscriptions',
        sa.Column('is_trial', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )

    op.create_table(
        'trial_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_name', sa.String(200), nullable=False),
        sa.Column('company_website', sa.String(500), nullable=False),
        sa.Column('company_domain', sa.String(255), nullable=False),
        sa.Column('company_linkedin_url', sa.String(500), nullable=False),
        sa.Column('company_size', sa.String(50), nullable=False),
        sa.Column('industry', sa.String(100), nullable=False),
        sa.Column('country', sa.String(100), nullable=False),
        sa.Column('hires_per_year', sa.String(50), nullable=True),
        sa.Column('contact_name', sa.String(200), nullable=False),
        sa.Column('contact_title', sa.String(200), nullable=False),
        sa.Column('contact_email', sa.String(255), nullable=False),
        sa.Column('contact_phone', sa.String(50), nullable=False),
        sa.Column('contact_linkedin_url', sa.String(500), nullable=False),
        sa.Column('hiring_needs', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(100), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('risk_flags', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewed_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('trial_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trial_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('data_purge_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reminder_1d_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reminder_1h_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expired_notice_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('purge_warning_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('converted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('purged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
    )
    op.create_index('ix_trial_requests_company_domain', 'trial_requests', ['company_domain'])
    op.create_index('ix_trial_requests_contact_email', 'trial_requests', ['contact_email'])
    op.create_index('ix_trial_requests_status', 'trial_requests', ['status'])
    op.create_index(
        'uq_trial_requests_open_domain', 'trial_requests', ['company_domain'], unique=True,
        postgresql_where=sa.text("status IN ('pending', 'active')"),
    )

    op.get_bind().execute(sa.text("""
        INSERT INTO subscription_plans
            (id, name, price_monthly, price_yearly, max_users, max_jobs, features, ai_credits_monthly,
             term_months, currency, included_admins, included_recruiters, sort_order, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Trial', 0.0, 0.0, 2, 999, CAST(:features AS jsonb), 500,
                1, 'USD', 1, 1, 99, now(), now())
        ON CONFLICT (name) DO NOTHING
    """), {"features": TRIAL_FEATURES})


def downgrade() -> None:
    op.drop_index('uq_trial_requests_open_domain', table_name='trial_requests')
    op.drop_index('ix_trial_requests_status', table_name='trial_requests')
    op.drop_index('ix_trial_requests_contact_email', table_name='trial_requests')
    op.drop_index('ix_trial_requests_company_domain', table_name='trial_requests')
    op.drop_table('trial_requests')
    op.drop_column('company_subscriptions', 'is_trial')
    # Trial subscriptions reference the plan (ON DELETE RESTRICT), so it's
    # only removed when nothing uses it.
    op.execute("""
        DELETE FROM subscription_plans WHERE name = 'Trial'
        AND NOT EXISTS (SELECT 1 FROM company_subscriptions cs WHERE cs.plan_id = subscription_plans.id)
    """)
