"""trial request: WhatsApp opt-in

The trial form asks whether the company may get updates (its invoice) on
WhatsApp; only those who agree are messaged there.

Revision ID: 075_trial_whatsapp_opt_in
"""
import sqlalchemy as sa
from alembic import op

revision = '075_trial_whatsapp_opt_in'
down_revision = '074_whatsapp_contacts'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'trial_requests',
        sa.Column('whatsapp_opt_in', sa.Boolean(), nullable=False, server_default=sa.false()),
        schema='trial',
    )


def downgrade():
    op.drop_column('trial_requests', 'whatsapp_opt_in', schema='trial')
