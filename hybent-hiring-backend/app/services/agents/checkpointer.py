"""
LangGraph checkpointer shared by every agent graph.

Agent state (messages, pending approvals) is saved to the app's own Postgres
through psycopg3, so a run paused for approval survives a server restart.
Tables are created once by `AsyncPostgresSaver.setup()` at startup.

If Postgres can't be reached at startup we fall back to an in-memory saver:
approvals still work inside one process, they just don't survive a restart.
"""
import logging
from typing import Optional

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool = None
_saver: Optional[BaseCheckpointSaver] = None


def _psycopg_dsn() -> str:
    """settings.database_url is SQLAlchemy-flavoured (postgresql+asyncpg://);
    psycopg wants a plain libpq URL."""
    url = settings.database_url
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
            break
    if settings.is_production and "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


async def init_checkpointer() -> BaseCheckpointSaver:
    global _pool, _saver
    if _saver is not None:
        return _saver
    try:
        from psycopg.rows import dict_row
        from psycopg_pool import AsyncConnectionPool
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        _pool = AsyncConnectionPool(
            conninfo=_psycopg_dsn(),
            min_size=1,
            # Small on purpose — Supabase's pooler has a low connection
            # ceiling, shared with the SQLAlchemy pool (app/core/database.py),
            # and each uvicorn worker opens its own pool.
            max_size=2,
            open=False,
            # prepare_threshold=None: no server-side prepared statements, which
            # break behind PgBouncer-style poolers.
            kwargs={"autocommit": True, "prepare_threshold": None, "row_factory": dict_row},
        )
        await _pool.open(wait=True, timeout=15)
        saver = AsyncPostgresSaver(_pool)
        await saver.setup()
        _saver = saver
        logger.info("Agent checkpointer: Postgres ready.")
    except Exception as exc:
        logger.warning("Agent checkpointer: Postgres unavailable (%s); using in-memory saver.", exc)
        if _pool is not None:
            try:
                await _pool.close()
            except Exception:
                pass
            _pool = None
        _saver = InMemorySaver()
    return _saver


def get_checkpointer() -> BaseCheckpointSaver:
    """The saver initialised at startup, or an in-memory one (tests, scripts)."""
    global _saver
    if _saver is None:
        _saver = InMemorySaver()
    return _saver


async def close_checkpointer() -> None:
    global _pool, _saver
    if _pool is not None:
        await _pool.close()
    _pool = None
    _saver = None
