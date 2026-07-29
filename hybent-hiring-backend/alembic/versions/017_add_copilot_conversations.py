"""add copilot conversations

Revision ID: 017_add_copilot_conversations
Revises: 016_add_ai_summary_to_interviews
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '017_add_copilot_conversations'
down_revision = '016_add_ai_summary_to_interviews'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('copilot_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_copilot_conversations_organization_id'), 'copilot_conversations', ['organization_id'], unique=False)
    op.create_index(op.f('ix_copilot_conversations_user_id'), 'copilot_conversations', ['user_id'], unique=False)
    
    op.create_table('copilot_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['copilot_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_copilot_messages_conversation_id'), 'copilot_messages', ['conversation_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_copilot_messages_conversation_id'), table_name='copilot_messages')
    op.drop_table('copilot_messages')
    
    op.drop_index(op.f('ix_copilot_conversations_user_id'), table_name='copilot_conversations')
    op.drop_index(op.f('ix_copilot_conversations_organization_id'), table_name='copilot_conversations')
    op.drop_table('copilot_conversations')
