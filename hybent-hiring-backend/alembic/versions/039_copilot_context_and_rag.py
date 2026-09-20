"""Add copilot conversation follow-up context + candidate resume RAG chunks

Revision ID: 039_copilot_context_and_rag
Revises: 038_email_candidate_ingestion
Create Date: 2026-09-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '039_copilot_context_and_rag'
down_revision = '038_email_candidate_ingestion'
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    return bool(
        conn.execute(
            sa.text(
                "SELECT EXISTS (SELECT FROM information_schema.columns "
                "WHERE table_name = :table AND column_name = :column)"
            ),
            {"table": table, "column": column},
        ).scalar()
    )


def _has_table(conn, table: str) -> bool:
    return bool(
        conn.execute(
            sa.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :table)"),
            {"table": table},
        ).scalar()
    )


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, 'copilot_conversations', 'last_context'):
        op.add_column(
            'copilot_conversations',
            sa.Column('last_context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )

    if not _has_table(conn, 'candidate_resume_chunks'):
        op.create_table(
            'candidate_resume_chunks',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                'organization_id',
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey('organizations.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column(
                'candidate_id',
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey('candidates.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column('section', sa.String(50), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('embedding', postgresql.ARRAY(sa.Float()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(
            'ix_candidate_resume_chunks_org_candidate',
            'candidate_resume_chunks',
            ['organization_id', 'candidate_id'],
        )
        op.create_index(
            'ix_candidate_resume_chunks_candidate_id', 'candidate_resume_chunks', ['candidate_id']
        )


def downgrade() -> None:
    op.drop_index('ix_candidate_resume_chunks_candidate_id', table_name='candidate_resume_chunks')
    op.drop_index('ix_candidate_resume_chunks_org_candidate', table_name='candidate_resume_chunks')
    op.drop_table('candidate_resume_chunks')
    op.drop_column('copilot_conversations', 'last_context')
