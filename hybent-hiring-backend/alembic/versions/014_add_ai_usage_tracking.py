"""add ai usage tracking

Revision ID: 014_add_ai_usage_tracking
Revises: 013_change_years_exp_to_float
Create Date: 2026-04-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '014_add_ai_usage_tracking'
down_revision = '013_change_years_exp_to_float'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('ai_usage',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('organization_id', sa.UUID(), nullable=True),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('provider', sa.String(length=50), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=False),
    sa.Column('feature', sa.String(length=100), nullable=False),
    sa.Column('prompt_tokens', sa.Integer(), nullable=False),
    sa.Column('completion_tokens', sa.Integer(), nullable=False),
    sa.Column('total_tokens', sa.Integer(), nullable=False),
    sa.Column('duration_ms', sa.Float(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('error_detail', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_usage_created_at'), 'ai_usage', ['created_at'], unique=False)
    op.create_index(op.f('ix_ai_usage_feature'), 'ai_usage', ['feature'], unique=False)
    op.create_index(op.f('ix_ai_usage_organization_id'), 'ai_usage', ['organization_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_provider'), 'ai_usage', ['provider'], unique=False)
    op.create_index(op.f('ix_ai_usage_user_id'), 'ai_usage', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_usage_user_id'), table_name='ai_usage')
    op.drop_index(op.f('ix_ai_usage_provider'), table_name='ai_usage')
    op.drop_index(op.f('ix_ai_usage_organization_id'), table_name='ai_usage')
    op.drop_index(op.f('ix_ai_usage_feature'), table_name='ai_usage')
    op.drop_index(op.f('ix_ai_usage_created_at'), table_name='ai_usage')
    op.drop_table('ai_usage')
