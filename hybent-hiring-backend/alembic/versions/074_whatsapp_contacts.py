"""WhatsApp contacts (who is messaging the Hybent number) and conversation.

Revision ID: 074_whatsapp_contacts
Revises: 073_candidate_phone_verification
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '074_whatsapp_contacts'
down_revision = '073_candidate_phone_verification'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'whatsapp_contacts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('wa_id', sa.String(64), nullable=False),
        sa.Column('phone', sa.String(30)),
        sa.Column('profile_name', sa.String(255)),
        sa.Column('kind', sa.String(20), nullable=False, server_default='visitor'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('candidate_email', sa.String(320)),
        sa.Column('lead', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(30), nullable=False, server_default='new'),
        sa.Column('summary', sa.Text()),
        sa.Column('bot_paused', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('handoff_requested_at', sa.DateTime(timezone=True)),
        sa.Column('last_message_at', sa.DateTime(timezone=True)),
        sa.Column('last_inbound_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_whatsapp_contacts_wa_id', 'whatsapp_contacts', ['wa_id'], unique=True)
    op.create_index('ix_whatsapp_contacts_phone', 'whatsapp_contacts', ['phone'])
    op.create_index('ix_whatsapp_contacts_kind', 'whatsapp_contacts', ['kind'])
    op.create_index('ix_whatsapp_contacts_status', 'whatsapp_contacts', ['status'])
    op.create_index('ix_whatsapp_contacts_last_message_at', 'whatsapp_contacts', ['last_message_at'])
    op.create_table(
        'whatsapp_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contact_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('whatsapp_contacts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('direction', sa.String(3), nullable=False),
        sa.Column('author', sa.String(10), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('wamid', sa.String(200)),
        sa.Column('created_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_whatsapp_messages_contact_id', 'whatsapp_messages', ['contact_id'])
    op.create_index('ix_whatsapp_messages_created_at', 'whatsapp_messages', ['created_at'])


def downgrade():
    op.drop_table('whatsapp_messages')
    op.drop_table('whatsapp_contacts')
