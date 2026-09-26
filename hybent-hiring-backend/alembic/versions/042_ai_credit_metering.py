"""AI credits metered from real provider cost; per-user limits; top-ups

1 credit is now $0.001 of provider cost (was an abstract unit), so existing
allowances (50k-250k in the old unit) are reset to the new 10,000/month
default and this period's usage starts from zero.

Revision ID: 042_ai_credit_metering
Revises: 041_email_account_owner_primary
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '042_ai_credit_metering'
down_revision = '041_email_account_owner_primary'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'subscription_plans',
        sa.Column('ai_credits_monthly', sa.Integer(), nullable=False, server_default='10000'),
    )
    op.add_column('organization_ai_credits', sa.Column('custom_monthly_credits', sa.Integer(), nullable=True))
    op.add_column(
        'organization_ai_credits',
        sa.Column('purchased_credits', sa.Integer(), nullable=False, server_default='0'),
    )

    op.create_table(
        'user_ai_credits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('monthly_limit', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('used_credits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('daily_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('daily_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_user_ai_credits_organization_id', 'user_ai_credits', ['organization_id'])
    op.create_index('ix_user_ai_credits_user_id', 'user_ai_credits', ['user_id'], unique=True)

    # Move existing pools onto the new unit.
    op.execute("""
        UPDATE organization_ai_credits
        SET allowed_credits = 10000, used_credits = 0,
            warning_50_sent = false, warning_25_sent = false, warning_10_sent = false,
            warning_5_sent = false, warning_0_sent = false
    """)


def downgrade() -> None:
    op.drop_index('ix_user_ai_credits_user_id', table_name='user_ai_credits')
    op.drop_index('ix_user_ai_credits_organization_id', table_name='user_ai_credits')
    op.drop_table('user_ai_credits')
    op.drop_column('organization_ai_credits', 'purchased_credits')
    op.drop_column('organization_ai_credits', 'custom_monthly_credits')
    op.drop_column('subscription_plans', 'ai_credits_monthly')
