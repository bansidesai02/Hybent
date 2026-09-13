"""Add email_accounts.scope (org vs personal) + email_messages inbox table

Revision ID: 037_email_scope_and_inbox
Revises: 036_add_email_accounts
Create Date: 2026-09-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '037_email_scope_and_inbox'
down_revision = '036_add_email_accounts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    has_scope_col = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT FROM information_schema.columns "
            "WHERE table_name = 'email_accounts' AND column_name = 'scope')"
        )
    ).scalar()
    if not has_scope_col:
        op.add_column(
            'email_accounts',
            sa.Column('scope', sa.String(20), server_default='organization', nullable=False),
        )
        op.create_index(
            'uq_email_accounts_one_personal_per_user',
            'email_accounts',
            ['organization_id', 'connected_by_user_id'],
            unique=True,
            postgresql_where=sa.text("scope = 'personal'"),
        )

    has_messages_table = conn.execute(
        sa.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_messages')")
    ).scalar()
    if not has_messages_table:
        op.create_table(
            'email_messages',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('email_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('email_accounts.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('provider_message_id', sa.String(255), nullable=False),
            sa.Column('thread_id', sa.String(255), nullable=True),
            sa.Column('from_address', sa.String(255), nullable=True),
            sa.Column('from_name', sa.String(255), nullable=True),
            sa.Column('to_address', sa.String(255), nullable=True),
            sa.Column('subject', sa.Text(), nullable=True),
            sa.Column('snippet', sa.Text(), nullable=True),
            sa.Column('received_at', sa.DateTime(timezone=True), nullable=True, index=True),
            sa.Column('is_read', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.UniqueConstraint('email_account_id', 'provider_message_id', name='uq_email_messages_account_provider_id'),
        )


def downgrade() -> None:
    op.drop_table('email_messages')
    op.drop_index('uq_email_accounts_one_personal_per_user', table_name='email_accounts')
    op.drop_column('email_accounts', 'scope')
