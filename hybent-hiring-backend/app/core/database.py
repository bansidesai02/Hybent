"""
Async SQLAlchemy 2.0 setup.
Provides engine, session factory, and Base declarative class.
"""
import asyncio
import logging
import os
from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Base (defined early for models) ──────────────────────────────────────────
class Base(DeclarativeBase):
    pass

# ── Lazy Components ────────────────────────────────────────────────────────────
_engine = None
_session_factory = None
_pid = None
_loop = None

def get_engine():
    """Lazily create the engine within the current event loop and process."""
    global _engine, _pid, _loop, _session_factory
    current_pid = os.getpid()
    
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    # Re-initialize if engine is missing, PID changed (fork), or Event Loop changed (Celery)
    if (_engine is None or 
        _pid != current_pid or 
        (current_loop is not None and _loop is not current_loop)):
        
        connect_args = {"statement_cache_size": 0}

        _engine = create_async_engine(
            settings.database_url,
            echo=False,
            pool_size=20,
            max_overflow=40,
            pool_recycle=1800,
            pool_timeout=30,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        _pid = current_pid
        _loop = current_loop
        _session_factory = None  # Force factory to rebuild with new engine
        
    return _engine

def get_session_factory():
    """Lazily create the session factory, ensuring it's bound to the correct engine."""
    global _session_factory
    # Always check if engine needs refreshing before returning factory
    engine = get_engine()
    
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _session_factory

# ── Sync Engine for LangChain ────────────────────────────────────────────────
_sync_engine = None

def get_sync_engine():
    """Lazily create a synchronous engine for LangChain SQL Toolkit."""
    global _sync_engine, _pid
    from sqlalchemy import create_engine
    current_pid = os.getpid()
    
    if _sync_engine is None or _pid != current_pid:
        sync_url = settings.database_url.replace("+asyncpg", "")
        if not sync_url.startswith("postgresql://") and sync_url.startswith("postgres://"):
            # Ensure proper dialect string
            pass
        _sync_engine = create_engine(sync_url, echo=False)
        _pid = current_pid
    
    return _sync_engine


# ── Proxy Definitions ─────────────────────────────────────────────────────────
class AsyncEngineProxy:
    """A proxy that always delegates to the engine valid for the current event loop."""
    def __getattr__(self, name):
        return getattr(get_engine(), name)

class AsyncSessionProxy:
    """A proxy that always delegates to the session factory valid for the current loop."""
    def __call__(self, **local_kw):
        return get_session_factory()(**local_kw)
    
    def __getattr__(self, name):
        return getattr(get_session_factory(), name)

# These objects can be imported once and used in any event loop/process context.
# They will always resolve to the correct SQLAlchemy components.
engine = AsyncEngineProxy()
AsyncSessionLocal = AsyncSessionProxy()

# This ensures that internal references (like get_db) can use these names 
# even before external callers trigger __getattr__.
def get_db_factory():
    return get_session_factory()

# ── Write Tracking Event Listeners ───────────────────────────────────────────
@event.listens_for(Session, "after_flush")
def receive_after_flush(session, flush_context):
    session.info["has_writes"] = True

@event.listens_for(Session, "after_bulk_update")
def receive_after_bulk_update(update_context):
    update_context.session.info["has_writes"] = True

@event.listens_for(Session, "after_bulk_delete")
def receive_after_bulk_delete(delete_context):
    delete_context.session.info["has_writes"] = True

# ── Dependency ─────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session, rolls back on error."""
    # We use get_session_factory() directly to be safe internally
    async with get_session_factory()() as session:
        try:
            yield session
            # Only commit if session has undergone writes or holds pending changes
            if (
                session.info.get("has_writes", False)
                or session.new
                or session.deleted
                or session.dirty
            ):
                await session.commit()
        except Exception:
            await session.rollback()
            raise

