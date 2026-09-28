"""Clear stored browser push (FCM) tokens

Notifications are shown only inside Hybent (the bell panel and in-app
toasts); browser push is no longer sent, so the tokens users granted are
removed.

Revision ID: 049_clear_fcm_tokens
Revises: 048_role_credit_defaults
Create Date: 2026-09-28

"""
from alembic import op

revision = '049_clear_fcm_tokens'
down_revision = '048_role_credit_defaults'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET fcm_token = NULL WHERE fcm_token IS NOT NULL")


def downgrade() -> None:
    # The tokens can't be restored; browsers would have to grant push again.
    pass
