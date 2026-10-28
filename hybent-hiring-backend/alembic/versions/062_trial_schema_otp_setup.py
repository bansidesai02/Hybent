"""Free trial data in its own schema; email OTP, replies and organization setup

- A Postgres schema `trial` holds everything about trial requests, apart
  from the trial organizations' hiring data (that stays in the main tables
  so an upgrade keeps it): trial_requests moves there, with
  - trial.email_otps: the code that proves the applicant owns the work email,
  - trial.messages: every email the Hybent team sent about a request.
- trial_requests gains the email verification time and the one-time
  organization setup link (valid until the trial ends).
- organizations gain the brand colour and the sender name their emails use.

Revision ID: 062_trial_schema_otp_setup
Revises: 061_trial_per_plan
Create Date: 2026-10-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '062_trial_schema_otp_setup'
down_revision = '061_trial_per_plan'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS trial")
    op.execute("ALTER TABLE public.trial_requests SET SCHEMA trial")
    op.add_column('trial_requests', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True), schema='trial')
    op.add_column('trial_requests', sa.Column('setup_token', sa.String(128), nullable=True), schema='trial')
    op.add_column('trial_requests', sa.Column('setup_completed_at', sa.DateTime(timezone=True), nullable=True), schema='trial')
    op.create_index('uq_trial_requests_setup_token', 'trial_requests', ['setup_token'], unique=True, schema='trial')

    op.create_table(
        'email_otps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, index=True),
        sa.Column('code_hash', sa.String(128), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_token', sa.String(128), nullable=True, unique=True),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        schema='trial',
    )
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('request_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('trial.trial_requests.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('to_email', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(300), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('ai_generated', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('delivered', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sent_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('public.users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sent_by_email', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')),
        schema='trial',
    )

    op.add_column('organizations', sa.Column('brand_color', sa.String(9), nullable=True))
    op.add_column('organizations', sa.Column('email_sender_name', sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'email_sender_name')
    op.drop_column('organizations', 'brand_color')
    op.drop_table('messages', schema='trial')
    op.drop_table('email_otps', schema='trial')
    op.drop_index('uq_trial_requests_setup_token', table_name='trial_requests', schema='trial')
    op.drop_column('trial_requests', 'setup_completed_at', schema='trial')
    op.drop_column('trial_requests', 'setup_token', schema='trial')
    op.drop_column('trial_requests', 'email_verified_at', schema='trial')
    op.execute("ALTER TABLE trial.trial_requests SET SCHEMA public")
    op.execute("DROP SCHEMA IF EXISTS trial")
