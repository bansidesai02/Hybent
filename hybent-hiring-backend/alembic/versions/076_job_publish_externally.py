"""job: publish_externally

Whether a job is listed on Google for Jobs and in the job-board XML feed.
On by default for new jobs; recruiters switch it off for confidential hiring.
Jobs that existed before this switch start OFF, so no customer's open roles
are made public without a recruiter choosing it.

Revision ID: 076_job_publish_externally
"""
import sqlalchemy as sa
from alembic import op

revision = '076_job_publish_externally'
down_revision = '075_trial_whatsapp_opt_in'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('jobs', sa.Column('publish_externally', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute("UPDATE jobs SET publish_externally = false")


def downgrade():
    op.drop_column('jobs', 'publish_externally')
