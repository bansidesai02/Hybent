"""Track ingestion attempts on email_messages so transient parse failures retry

Revision ID: 040_email_ingestion_attempts
Revises: 039_copilot_context_and_rag
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = '040_email_ingestion_attempts'
down_revision = '039_copilot_context_and_rag'
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
    if not _has_column(conn, 'email_messages', 'ingestion_attempts'):
        op.add_column(
            'email_messages',
            sa.Column('ingestion_attempts', sa.Integer(), server_default=sa.text('0'), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _has_column(conn, 'email_messages', 'ingestion_attempts'):
        op.drop_column('email_messages', 'ingestion_attempts')
