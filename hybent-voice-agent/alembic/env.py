"""
Alembic for the engine's own schema ("voice"). Its version table lives in
that schema too, so it never collides with the Hiring backend's migrations.
"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text

import voice.models  # noqa: F401  registers tables on Base.metadata
from voice.config import settings
from voice.db import SCHEMA, Base, make_engine

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name == SCHEMA
    return True


def _configure(connection=None, **kw):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
        include_name=include_name,
        **kw,
    )


def run_migrations_offline() -> None:
    _configure(url=settings.database_url, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
    _configure(connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = make_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
