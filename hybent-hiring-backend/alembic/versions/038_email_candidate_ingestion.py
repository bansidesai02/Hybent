"""Add auto-candidate-ingestion tracking to email_messages + provenance to candidates

Revision ID: 038_email_candidate_ingestion
Revises: 037_email_scope_and_inbox
Create Date: 2026-09-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '038_email_candidate_ingestion'
down_revision = '037_email_scope_and_inbox'
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


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, 'email_messages', 'has_attachments'):
        op.add_column(
            'email_messages',
            sa.Column('has_attachments', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        )

    if not _has_column(conn, 'email_messages', 'ingestion_status'):
        op.add_column('email_messages', sa.Column('ingestion_status', sa.String(30), nullable=True))
        op.create_index('ix_email_messages_ingestion_status', 'email_messages', ['ingestion_status'])

    if not _has_column(conn, 'email_messages', 'ingestion_result_candidate_id'):
        op.add_column(
            'email_messages',
            sa.Column(
                'ingestion_result_candidate_id',
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey(
                    'candidates.id',
                    ondelete='SET NULL',
                    use_alter=True,
                    name='fk_email_messages_ingestion_result_candidate_id',
                ),
                nullable=True,
            ),
        )
        op.create_index(
            'ix_email_messages_ingestion_result_candidate_id', 'email_messages', ['ingestion_result_candidate_id']
        )

    if not _has_column(conn, 'email_messages', 'ingestion_error'):
        op.add_column('email_messages', sa.Column('ingestion_error', sa.Text(), nullable=True))

    if not _has_column(conn, 'email_messages', 'ingestion_processed_at'):
        op.add_column('email_messages', sa.Column('ingestion_processed_at', sa.DateTime(timezone=True), nullable=True))

    if not _has_column(conn, 'email_messages', 'ingestion_locked_at'):
        op.add_column('email_messages', sa.Column('ingestion_locked_at', sa.DateTime(timezone=True), nullable=True))

    if not _has_column(conn, 'candidates', 'source_email_message_id'):
        op.add_column(
            'candidates',
            sa.Column(
                'source_email_message_id',
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey('email_messages.id', ondelete='SET NULL'),
                nullable=True,
            ),
        )
        op.create_index('ix_candidates_source_email_message_id', 'candidates', ['source_email_message_id'])

    if not _has_column(conn, 'candidates', 'source_email_account_id'):
        op.add_column(
            'candidates',
            sa.Column(
                'source_email_account_id',
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey('email_accounts.id', ondelete='SET NULL'),
                nullable=True,
            ),
        )
        op.create_index('ix_candidates_source_email_account_id', 'candidates', ['source_email_account_id'])


def downgrade() -> None:
    op.drop_index('ix_candidates_source_email_account_id', table_name='candidates')
    op.drop_column('candidates', 'source_email_account_id')
    op.drop_index('ix_candidates_source_email_message_id', table_name='candidates')
    op.drop_column('candidates', 'source_email_message_id')

    op.drop_column('email_messages', 'ingestion_locked_at')
    op.drop_column('email_messages', 'ingestion_processed_at')
    op.drop_column('email_messages', 'ingestion_error')
    op.drop_index('ix_email_messages_ingestion_result_candidate_id', table_name='email_messages')
    op.drop_column('email_messages', 'ingestion_result_candidate_id')
    op.drop_index('ix_email_messages_ingestion_status', table_name='email_messages')
    op.drop_column('email_messages', 'ingestion_status')
    op.drop_column('email_messages', 'has_attachments')
