"""
Async SQLAlchemy 2.0 setup.
Provides engine, session factory, and Base declarative class.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

# ── Base (defined early for models) ──────────────────────────────────────────
class Base(DeclarativeBase):
    pass

# ── Lazy Components ────────────────────────────────────────────────────────────
_engine = None
_session_factory = None

def get_engine():
    """Lazily create the engine within the current event loop."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.database_url,
            echo=False,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
        )
    return _engine

def get_session_factory():
    """Lazily create the session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _session_factory

# ── Proxy / Helper Definitions ────────────────────────────────────────────────
def __getattr__(name):
    """Lazy initialization of module attributes to ensure loop safety."""
    if name == "engine":
        return get_engine()
    if name == "AsyncSessionLocal":
        return get_session_factory()
    raise AttributeError(f"module {__name__} has no attribute {name}")

# This ensures that internal references (like get_db) can use these names 
# even before external callers trigger __getattr__.
def get_db_factory():
    return get_session_factory()

# ── Dependency ─────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session, rolls back on error."""
    # We use get_session_factory() directly to be safe internally
    async with get_session_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
