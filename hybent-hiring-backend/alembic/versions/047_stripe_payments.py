"""Stripe payments: subscription links, seat and top-up purchases, renewals

Revision ID: 047_stripe_payments
Revises: 046_fractional_ai_credits
Create Date: 2026-09-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '047_stripe_payments'
down_revision = '046_fractional_ai_credits'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('stripe_customer_id', sa.String(255), nullable=True))
    op.add_column('company_subscriptions', sa.Column('stripe_subscription_id', sa.String(255), nullable=True))
    op.create_unique_constraint(
        'uq_company_subscriptions_stripe_subscription_id', 'company_subscriptions', ['stripe_subscription_id']
    )
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('amount_usd', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('details', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('token', sa.String(64), nullable=True),
        sa.Column('stripe_session_id', sa.String(255), nullable=True),
        sa.Column('stripe_invoice_id', sa.String(255), nullable=True, unique=True),
        sa.Column('receipt_url', sa.String(1000), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_payments_organization_id', 'payments', ['organization_id'])
    op.create_index('ix_payments_token', 'payments', ['token'], unique=True)
    op.create_index('ix_payments_stripe_session_id', 'payments', ['stripe_session_id'], unique=True)


def downgrade() -> None:
    op.drop_table('payments')
    op.drop_constraint('uq_company_subscriptions_stripe_subscription_id', 'company_subscriptions', type_='unique')
    op.drop_column('company_subscriptions', 'stripe_subscription_id')
    op.drop_column('organizations', 'stripe_customer_id')
