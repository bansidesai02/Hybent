"""Inbox: bring in every resume a mailbox ever received

Revision ID: 070_inbox_resume_backfill
Revises: 069_super_admin_alert_prefs
Create Date: 2026-11-15

"""
import sqlalchemy as sa
from alembic import op

revision = '070_inbox_resume_backfill'
down_revision = '069_super_admin_alert_prefs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('email_accounts', sa.Column('resume_backfill_token', sa.Text(), nullable=True))
    op.add_column('email_accounts', sa.Column(
        'resume_backfill_done', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('email_accounts', 'resume_backfill_done')
    op.drop_column('email_accounts', 'resume_backfill_token')
