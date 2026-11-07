"""One phone can get push for several accounts (e.g. super admin and admin)

The endpoint was unique, so turning a phone on for a second account moved it
away from the first. Now each (account, device) pair is its own row.

Revision ID: 066_push_device_per_account
Revises: 065_push_and_demo_requests
Create Date: 2026-11-07

"""
from alembic import op

revision = '066_push_device_per_account'
down_revision = '065_push_and_demo_requests'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('push_subscriptions_endpoint_key', 'push_subscriptions', type_='unique')
    op.create_unique_constraint('uq_push_subscriptions_user_endpoint', 'push_subscriptions', ['user_id', 'endpoint'])


def downgrade() -> None:
    # Keep one row per device (the newest) before restoring the old rule.
    op.execute("""
        DELETE FROM push_subscriptions a USING push_subscriptions b
        WHERE a.endpoint = b.endpoint AND a.created_at < b.created_at
    """)
    op.drop_constraint('uq_push_subscriptions_user_endpoint', 'push_subscriptions', type_='unique')
    op.create_unique_constraint('push_subscriptions_endpoint_key', 'push_subscriptions', ['endpoint'])
