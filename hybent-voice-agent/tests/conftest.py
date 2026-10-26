"""
Tests run on SQLite (schema "voice" translated away), with the scheduler
off and the fake dialer, so no Postgres, LiveKit or model keys are needed.
Set VOICE_TEST_DATABASE_URL to a throwaway Postgres database to run the
same suite against Postgres (row locking, JSONB) — it is wiped each test.
"""
import os
import tempfile

os.environ["DATABASE_URL"] = os.environ.get("VOICE_TEST_DATABASE_URL") or (
    "sqlite+aiosqlite:///" + os.path.join(tempfile.mkdtemp(), "voice_test.db")
)
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["DIALER"] = "fake"
os.environ["GROQ_API_KEY"] = ""

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from voice.api import app  # noqa: E402
from voice.db import Base, SessionLocal, engine, get_db  # noqa: E402
from voice.models import Client  # noqa: E402
from voice.security import generate_key, generate_secret, hash_key  # noqa: E402


@pytest_asyncio.fixture
async def sessions():
    async with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS voice"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield SessionLocal
    # Each test runs on its own event loop; pooled asyncpg connections can't cross loops.
    await engine.dispose()


@pytest_asyncio.fixture
async def make_client(sessions):
    async def _make(name="hiring", max_concurrent=5):
        key = generate_key()
        async with sessions() as s:
            client = Client(
                name=name,
                key_hash=hash_key(key),
                callback_url=f"https://{name}.test/callbacks",
                callback_secret=generate_secret(),
                max_concurrent_calls=max_concurrent,
            )
            s.add(client)
            await s.commit()
        return client, key

    return _make


@pytest_asyncio.fixture
async def api(sessions):
    async def _get_db():
        async with sessions() as s:
            yield s

    app.dependency_overrides[get_db] = _get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def task_body(**overrides) -> dict:
    body = {
        "client_ref": "hiring:org1:cand1:prescreen:1",
        "type": "PRESCREEN",
        "scope_id": "org1",
        "callee": {"name": "Riya Shah", "phone_e164": "+919812345678", "timezone": "Asia/Kolkata"},
        "context": {"job": {"title": "Backend Developer"}},
        "consent": {"type": "APPLICATION_FORM", "captured_at": "2026-10-18T10:00:00Z"},
        "schedule_at": "2026-10-20T04:00:00Z",          # 09:30 IST
        "config": {"window_start": "00:00", "window_end": "23:59"},
    }
    body.update(overrides)
    return body
