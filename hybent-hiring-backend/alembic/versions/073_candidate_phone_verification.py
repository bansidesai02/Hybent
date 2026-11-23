"""Candidate mobile verification (OTP) and SMS consent.

Revision ID: 073_candidate_phone_verification
Revises: 072_sms
"""
import sqlalchemy as sa
from alembic import op

revision = '073_candidate_phone_verification'
down_revision = '072_sms'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('candidates', sa.Column('phone_verified_at', sa.DateTime(timezone=True)))
    op.add_column('candidates', sa.Column('sms_opt_in', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('candidates', 'sms_opt_in')
    op.drop_column('candidates', 'phone_verified_at')
