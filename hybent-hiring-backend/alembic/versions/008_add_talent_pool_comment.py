"""add talent_pool_comment to candidates

Revision ID: 008_add_talent_pool_comment
Revises: 007_add_candidate_created_by
Create Date: 2026-03-26
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = '008_add_talent_pool_comment'
down_revision: Union[str, None] = '007_add_candidate_created_by'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('candidates', sa.Column('talent_pool_comment', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('candidates', 'talent_pool_comment')
