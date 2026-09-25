"""
Shared async DB + HTTP test fixtures. Built from scratch for the
email-accounts feature — no DB/HTTP test infra existed in this repo before.

Uses a dedicated Postgres test database (never the dev/prod one), created via:
    docker exec hybent_hiring_postgres psql -U hybent_hiring -d hybent_hiring_db \
        -c "CREATE DATABASE hybent_hiring_test_db"

Override with TEST_DATABASE_URL if your setup differs.
"""
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault("EMAIL_ACCOUNTS_ENCRYPTION_KEY", "test-encryption-key-for-pytest")

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://hybent_hiring:admin123@localhost:5433/hybent_hiring_test_db",
)

from app.core.database import Base, get_db  # noqa: E402
import app.models  # noqa: E402, F401  registers all models on Base.metadata
from app.main import app  # noqa: E402  must be imported after app.models (binds `app` name last)
from app.models.organization import Organization  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.permissions import UserRole  # noqa: E402
from app.utils.security import create_access_token, hash_password  # noqa: E402

test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=None)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
async def _create_schema():
    """Only pulled in by db_session (and its dependents) — pure unit tests
    elsewhere in tests/ never touch Postgres."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(_create_schema):
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
        # Truncate everything between tests so each test starts clean.
        async with test_engine.begin() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(table.delete())


@pytest_asyncio.fixture
async def client(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def organization(db_session) -> Organization:
    org = Organization(name="Acme Recruiting", slug=f"acme-{uuid.uuid4().hex[:8]}")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest_asyncio.fixture
async def other_organization(db_session) -> Organization:
    org = Organization(name="Other Org", slug=f"other-{uuid.uuid4().hex[:8]}")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


async def _make_user(db_session, organization, role: str) -> User:
    user = User(
        organization_id=organization.id,
        email=f"{role}-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("password123"),
        full_name=f"Test {role.title()}",
        role=role,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session, organization) -> User:
    return await _make_user(db_session, organization, UserRole.ADMIN.value)


@pytest_asyncio.fixture
async def recruiter_user(db_session, organization) -> User:
    return await _make_user(db_session, organization, UserRole.RECRUITER.value)


@pytest_asyncio.fixture
async def second_admin_user(db_session, organization) -> User:
    """Another admin in the same org — for mailbox privacy between members."""
    return await _make_user(db_session, organization, UserRole.ADMIN.value)


@pytest_asyncio.fixture
async def second_recruiter_user(db_session, organization) -> User:
    return await _make_user(db_session, organization, UserRole.RECRUITER.value)


@pytest_asyncio.fixture
async def other_org_admin(db_session, other_organization) -> User:
    return await _make_user(db_session, other_organization, UserRole.ADMIN.value)


@pytest_asyncio.fixture
async def super_admin_user(db_session, organization) -> User:
    return await _make_user(db_session, organization, UserRole.SUPER_ADMIN.value)


def auth_headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.id), "org": str(user.organization_id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    return auth_headers(admin_user)


@pytest.fixture
def recruiter_headers(recruiter_user):
    return auth_headers(recruiter_user)


@pytest.fixture
def other_org_admin_headers(other_org_admin):
    return auth_headers(other_org_admin)


@pytest.fixture
def super_admin_headers(super_admin_user):
    return auth_headers(super_admin_user)
