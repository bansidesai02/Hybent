"""global search runs: charged and hidden flags

charged marks the searches that used a free-trial company's Global (PDL)
searches, so the trial allowance is counted from the database. hidden marks
runs removed from history; a charged run is hidden rather than deleted so
removing it can't hand the trial its search back.

Revision ID: 079_global_search_charged
"""
import sqlalchemy as sa
from alembic import op

revision = '079_global_search_charged'
down_revision = '078_global_search_runs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('global_search_runs',
                  sa.Column('charged', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('global_search_runs',
                  sa.Column('hidden', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('global_search_runs', 'hidden')
    op.drop_column('global_search_runs', 'charged')
