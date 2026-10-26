"""
Async SQLAlchemy setup. Every engine table lives in the Postgres schema
"voice", so it can share the Hiring database without touching its tables.
SQLite (tests) has no schemas, so the schema is translated away there.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from voice.config import settings

SCHEMA = "voice"


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> AsyncEngine:
    if url.startswith("sqlite"):
        return create_async_engine(url, execution_options={"schema_translate_map": {SCHEMA: None}})
    connect_args = {"statement_cache_size": 0}
    if settings.is_production:
        connect_args["ssl"] = "require"
    return create_async_engine(url, pool_pre_ping=True, connect_args=connect_args)


engine = make_engine(settings.database_url)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
