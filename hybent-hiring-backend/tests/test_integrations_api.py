"""Integration keys against a real (test) Postgres: who can manage keys, how a
key authenticates, the kill switch, scopes, org isolation, and the platform
maintenance endpoints being closed to tenant admins."""
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.dependencies import IntegrationPrincipal, require_scopes
from app.models.audit_log import AuditLog
from app.models.integration_key import IntegrationKey
from app.utils.integration_keys import parse_key


@pytest.fixture
def integrations_on(monkeypatch):
    monkeypatch.setattr(settings, "integrations_enabled", True)


async def _create_key(client, headers, scopes=("reports:read",), **extra):
    resp = await client.post("/v1/integrations/keys", headers=headers,
                             json={"name": "n8n", "scopes": list(scopes), **extra})
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]


def _key_headers(full_key: str) -> dict:
    return {"X-Hybent-Key": full_key}


# ── Managing keys ──────────────────────────────────────────────────────────────

async def test_admin_creates_key_and_only_hash_is_stored(client, db_session, admin_headers, organization):
    data = await _create_key(client, admin_headers, scopes=["ops:read", "reports:read"])
    assert data["scopes"] == ["ops:read", "reports:read"]
    secret = parse_key(data["key"]).secret

    row = (await db_session.execute(select(IntegrationKey).where(IntegrationKey.key_id == data["key_id"]))).scalar_one()
    assert row.organization_id == organization.id
    assert secret not in row.secret_hash

    audit = (await db_session.execute(select(AuditLog).where(AuditLog.resource_type == "integration_key"))).scalars().all()
    assert audit and secret not in str(audit[0].details)


async def test_list_never_returns_the_key(client, admin_headers):
    await _create_key(client, admin_headers)
    resp = await client.get("/v1/integrations/keys", headers=admin_headers)
    assert resp.status_code == 200
    (item,) = resp.json()["data"]
    assert "key" not in item and "secret_hash" not in item


async def test_recruiter_cannot_manage_keys(client, recruiter_headers):
    resp = await client.post("/v1/integrations/keys", headers=recruiter_headers,
                             json={"name": "n8n", "scopes": ["reports:read"]})
    assert resp.status_code == 403


async def test_unknown_scope_is_rejected(client, admin_headers):
    resp = await client.post("/v1/integrations/keys", headers=admin_headers,
                             json={"name": "n8n", "scopes": ["everything"]})
    assert resp.status_code == 422


async def test_other_org_admin_cannot_see_or_revoke(client, admin_headers, other_org_admin_headers):
    data = await _create_key(client, admin_headers)
    listed = await client.get("/v1/integrations/keys", headers=other_org_admin_headers)
    assert listed.json()["data"] == []
    resp = await client.delete(f"/v1/integrations/keys/{data['id']}", headers=other_org_admin_headers)
    assert resp.status_code == 404


async def test_active_key_limit(client, admin_headers):
    from app.routers.integrations import MAX_ACTIVE_KEYS_PER_ORG
    for _ in range(MAX_ACTIVE_KEYS_PER_ORG):
        await _create_key(client, admin_headers)
    resp = await client.post("/v1/integrations/keys", headers=admin_headers,
                             json={"name": "one too many", "scopes": ["reports:read"]})
    assert resp.status_code == 400


# ── Authenticating with a key ──────────────────────────────────────────────────

async def test_whoami_returns_org_from_key(client, admin_headers, organization, integrations_on):
    data = await _create_key(client, admin_headers, scopes=["ops:read"])
    resp = await client.get("/v1/integrations/whoami", headers=_key_headers(data["key"]))
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    assert body["organization_id"] == str(organization.id)
    assert body["scopes"] == ["ops:read"]


async def test_kill_switch_blocks_valid_keys(client, admin_headers, monkeypatch):
    data = await _create_key(client, admin_headers)
    monkeypatch.setattr(settings, "integrations_enabled", False)
    resp = await client.get("/v1/integrations/whoami", headers=_key_headers(data["key"]))
    assert resp.status_code == 503
    assert resp.json()["details"]["error_code"] == "INTEGRATIONS_DISABLED"


@pytest.mark.parametrize("header", [None, "", "not-a-key", "hyb_live_0123456789abcdef_" + "0" * 64])
async def test_missing_or_unknown_key_is_401(client, integrations_on, header):
    headers = {} if header is None else _key_headers(header)
    resp = await client.get("/v1/integrations/whoami", headers=headers)
    assert resp.status_code == 401
    assert resp.json()["details"]["error_code"] == "INVALID_KEY"


async def test_wrong_secret_for_real_key_id_is_401(client, admin_headers, integrations_on):
    data = await _create_key(client, admin_headers)
    forged = f"hyb_test_{data['key_id']}_" + "f" * 64
    resp = await client.get("/v1/integrations/whoami", headers=_key_headers(forged))
    assert resp.status_code == 401


async def test_revoked_key_stops_working(client, admin_headers, integrations_on):
    data = await _create_key(client, admin_headers)
    assert (await client.delete(f"/v1/integrations/keys/{data['id']}", headers=admin_headers)).status_code == 200
    resp = await client.get("/v1/integrations/whoami", headers=_key_headers(data["key"]))
    assert resp.status_code == 401


async def test_expired_key_is_401(client, db_session, admin_headers, integrations_on):
    data = await _create_key(client, admin_headers)
    row = (await db_session.execute(select(IntegrationKey).where(IntegrationKey.key_id == data["key_id"]))).scalar_one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.commit()
    resp = await client.get("/v1/integrations/whoami", headers=_key_headers(data["key"]))
    assert resp.status_code == 401


async def test_key_of_inactive_org_is_401(client, db_session, admin_headers, organization, integrations_on):
    data = await _create_key(client, admin_headers)
    organization.is_active = False
    await db_session.commit()
    resp = await client.get("/v1/integrations/whoami", headers=_key_headers(data["key"]))
    assert resp.status_code == 401


async def test_user_jwt_is_not_an_integration_key(client, admin_headers, integrations_on):
    resp = await client.get("/v1/integrations/whoami", headers=admin_headers)
    assert resp.status_code == 401


async def test_last_used_is_recorded(client, db_session, admin_headers, integrations_on):
    data = await _create_key(client, admin_headers)
    await client.get("/v1/integrations/whoami", headers=_key_headers(data["key"]))
    row = (await db_session.execute(select(IntegrationKey).where(IntegrationKey.key_id == data["key_id"]))).scalar_one()
    await db_session.refresh(row)
    assert row.last_used_at is not None


# ── Scopes ─────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def scoped_app(db_session):
    """A throwaway app with one endpoint that needs reports:read."""
    app = FastAPI()

    @app.get("/v1/integrations/needs-reports")
    async def needs_reports(p: IntegrationPrincipal = Depends(require_scopes("reports:read"))):
        return {"org": str(p.organization_id)}

    async def _db():
        yield db_session

    app.dependency_overrides[get_db] = _db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def test_scope_required(client, scoped_app, admin_headers, organization, integrations_on):
    with_scope = await _create_key(client, admin_headers, scopes=["reports:read"])
    without = await _create_key(client, admin_headers, scopes=["ops:read"])

    ok = await scoped_app.get("/v1/integrations/needs-reports", headers=_key_headers(with_scope["key"]))
    assert ok.status_code == 200 and ok.json() == {"org": str(organization.id)}

    denied = await scoped_app.get("/v1/integrations/needs-reports", headers=_key_headers(without["key"]))
    assert denied.status_code == 403
    assert denied.json()["detail"]["error_code"] == "SCOPE_MISSING"


# ── Platform maintenance endpoints ─────────────────────────────────────────────

@pytest.mark.parametrize("path", ["/v1/admin/run-migrations", "/v1/admin/repair-db-schema"])
async def test_tenant_admin_cannot_run_schema_maintenance(client, admin_headers, path):
    resp = await client.post(path, headers=admin_headers)
    assert resp.status_code == 403


async def test_debug_db_is_super_admin_only(client, admin_headers, super_admin_headers):
    assert (await client.get("/v1/admin/debug-db", headers=admin_headers)).status_code == 403
    assert (await client.get("/v1/admin/debug-db", headers=super_admin_headers)).status_code == 200


# ── Error code for exhausted AI credits ────────────────────────────────────────

async def test_credits_exhausted_carries_error_code():
    import json

    from app.main import insufficient_credits_handler
    from app.utils.exceptions import InsufficientCreditsException

    resp = await insufficient_credits_handler(None, InsufficientCreditsException())
    assert resp.status_code == 403
    assert json.loads(resp.body)["details"]["error_code"] == "AI_CREDITS_EXHAUSTED"


def test_key_ids_are_unique_across_orgs():
    # Sanity on the generator the router relies on for the unique key_id index.
    from app.utils.integration_keys import generate_key
    ids = {generate_key(False).key_id for _ in range(500)}
    assert len(ids) == 500
    assert all(len(i) == 16 for i in ids)
