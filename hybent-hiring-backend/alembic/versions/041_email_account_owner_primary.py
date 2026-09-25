"""Email accounts are owned by the user who connected them; is_default = that owner's primary

Revision ID: 041_email_account_owner_primary
Revises: 040_email_ingestion_attempts
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = '041_email_account_owner_primary'
down_revision = '040_email_ingestion_attempts'
branch_labels = None
depends_on = None

INDEX = 'uq_email_accounts_one_primary_per_owner'


def upgrade() -> None:
    conn = op.get_bind()

    # is_default used to mean "the org's one default". It now means "this
    # owner's primary sender", one per owner. Previously there was at most one
    # per org, so no owner can have two already; give every owner with
    # connected mailboxes and no primary their earliest one — this covers
    # every recruiter's personal mailbox, which never had the flag set.
    conn.execute(sa.text("""
        UPDATE email_accounts SET is_default = true
        WHERE id IN (
            SELECT DISTINCT ON (organization_id, connected_by_user_id) id
            FROM email_accounts a
            WHERE status = 'connected'
              AND connected_by_user_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM email_accounts d
                  WHERE d.organization_id = a.organization_id
                    AND d.connected_by_user_id = a.connected_by_user_id
                    AND d.is_default
              )
            ORDER BY organization_id, connected_by_user_id, created_at
        )
    """))

    op.create_index(
        INDEX,
        'email_accounts',
        ['organization_id', 'connected_by_user_id'],
        unique=True,
        postgresql_where=sa.text('is_default'),
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(INDEX, table_name='email_accounts', if_exists=True)
