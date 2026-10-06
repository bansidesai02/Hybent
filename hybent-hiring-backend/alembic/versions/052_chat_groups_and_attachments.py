"""Chat groups and file attachments

Adds collaborative chat groups (chat_groups, chat_group_members), file
attachments for chat messages (message_attachments), and lets a message
target a group instead of a single receiver.

Revision ID: 052_chat_groups_and_attachments
Revises: 051_screening_recommendations
Create Date: 2026-10-06

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '052_chat_groups_and_attachments'
down_revision = '051_screening_recommendations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'chat_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_chat_groups_organization_id', 'chat_groups', ['organization_id'])

    op.create_table(
        'chat_group_members',
        sa.Column('group_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('chat_groups.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role', sa.String(20), nullable=False, server_default='member'),
        sa.Column('added_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_chat_group_members_user_id', 'chat_group_members', ['user_id'])

    # Messages can now target a group instead of a receiver
    op.alter_column('messages', 'receiver_id', existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column('messages', sa.Column(
        'group_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('chat_groups.id', ondelete='CASCADE'), nullable=True,
    ))
    op.create_index('ix_messages_group_id', 'messages', ['group_id'])
    op.create_check_constraint(
        'ck_messages_exactly_one_target', 'messages',
        '(receiver_id IS NULL) <> (group_id IS NULL)',
    )

    op.create_table(
        'message_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('message_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('messages.id', ondelete='CASCADE'), nullable=True),
        sa.Column('uploader_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(150), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_message_attachments_organization_id', 'message_attachments', ['organization_id'])
    op.create_index('ix_message_attachments_message_id', 'message_attachments', ['message_id'])
    op.create_index('ix_message_attachments_uploader_id', 'message_attachments', ['uploader_id'])


def downgrade() -> None:
    op.drop_table('message_attachments')
    op.drop_constraint('ck_messages_exactly_one_target', 'messages', type_='check')
    op.drop_index('ix_messages_group_id', table_name='messages')
    op.drop_column('messages', 'group_id')
    op.execute("DELETE FROM messages WHERE receiver_id IS NULL")
    op.alter_column('messages', 'receiver_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_table('chat_group_members')
    op.drop_table('chat_groups')
