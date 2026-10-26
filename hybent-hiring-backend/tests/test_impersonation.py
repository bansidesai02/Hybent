"""Super admin support sessions: time limit, view-only mode, end of session,
and every change audited under the super admin."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.models.audit_log import AuditLog
from app.models.super_admin import ImpersonationLog, SuperAdminAuditLog
from app.models.user import User
from app.services import impersonation
from app.utils.security import create_access_token, decode_access_token
from tests.conftest import _make_user, auth_headers


async def _start(client, super_admin, target, *, allow_changes=False, reason="Support ticket 42"):
    r = await client.post(
        f"/v1/super-admin/impersonate/{target.id}",
        json={"reason": reason, "allow_changes": allow_changes},
        headers=auth_headers(super_admin),
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    return data, {"Authorization": f"Bearer {data['access_token']}"}


async def _end(client, super_admin, session_id, reason="exit"):
    return await client.post(
        f"/v1/super-admin/impersonations/{session_id}/end", json={"reason": reason},
        headers=auth_headers(super_admin),
    )


@pytest.fixture
def commit_like_production(client, db_session):
    """conftest's get_db override never commits; the real one commits at the
    end of every request that wrote, which is when changes get recorded."""
    from app.core.database import get_db
    from app.main import app

    async def _get_db():
        try:
            yield db_session
            if db_session.info.get("has_writes") or db_session.new or db_session.dirty or db_session.deleted:
                await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _get_db


@pytest.fixture
def quiet_candidate_side_effects(monkeypatch):
    import app.routers.candidates as cand_router
    from app.tasks import notifications

    async def noop(*a, **k):
        return None

    monkeypatch.setattr(notifications.notify_organization_roles, "delay", lambda *a, **k: None)
    monkeypatch.setattr(cand_router.es_service, "index_candidate", noop)


async def test_session_token_is_time_limited(client, super_admin_user, other_org_admin):
    data, _ = await _start(client, super_admin_user, other_org_admin)
    claims = decode_access_token(data["access_token"])
    assert claims["imp_sid"] == data["session"]["id"]
    lifetime = claims["exp"] - datetime.now(timezone.utc).timestamp()
    assert 29 * 60 < lifetime <= 30 * 60
    assert data["session"]["allow_changes"] is False


async def test_view_only_session_reads_but_cannot_change(client, db_session, super_admin_user, other_org_admin):
    _, h = await _start(client, super_admin_user, other_org_admin)

    r = await client.get("/v1/auth/me", headers=h)
    assert r.status_code == 200 and r.json()["data"]["email"] == other_org_admin.email

    r = await client.put("/v1/users/me", json={"full_name": "Changed by support"}, headers=h)
    assert r.status_code == 403 and "view-only" in r.json()["message"]
    r = await client.post("/v1/candidates", json={"email": "c1@example.com", "full_name": "C One"}, headers=h)
    assert r.status_code == 403

    await db_session.refresh(other_org_admin)
    assert other_org_admin.full_name != "Changed by support"


async def test_changes_are_audited_under_the_super_admin(
    client, db_session, super_admin_user, other_org_admin, other_organization, quiet_candidate_side_effects,
    commit_like_production,
):
    data, h = await _start(client, super_admin_user, other_org_admin, allow_changes=True)
    sid = data["session"]["id"]

    r = await client.put("/v1/users/me", json={"full_name": "Renamed by support"}, headers=h)
    assert r.status_code == 200, r.text
    r = await client.post("/v1/candidates", json={"email": "c2@example.com", "full_name": "C Two"}, headers=h)
    assert r.status_code in (200, 201), r.text

    rows = (await db_session.execute(
        select(SuperAdminAuditLog)
        .where(SuperAdminAuditLog.module == "Impersonation", SuperAdminAuditLog.action.like("Changed data%"))
        .order_by(SuperAdminAuditLog.created_at)
    )).scalars().all()
    assert len(rows) == 2
    assert all(row.user_id == super_admin_user.id and row.user_email == super_admin_user.email for row in rows)
    assert all(row.action_metadata["session_id"] == sid for row in rows)
    assert rows[0].action_metadata["changes"]["users"]["updated"] == 1
    assert rows[0].action_metadata["request"] == "PUT /v1/users/me"
    assert rows[1].action_metadata["changes"]["candidates"]["inserted"] == 1
    assert rows[1].action_metadata["organization_id"] == str(other_organization.id)

    # The organization's own activity log names the super admin too.
    activity = (await db_session.execute(
        select(AuditLog).where(AuditLog.organization_id == other_organization.id, AuditLog.resource_type == "candidate")
    )).scalar_one()
    assert activity.details["impersonated_by"] == super_admin_user.email

    r = await client.get("/v1/super-admin/impersonations", headers=auth_headers(super_admin_user))
    session = r.json()["data"]["sessions"][0]
    assert session["id"] == sid and session["status"] == "active" and session["changes"] == 2


async def test_ending_a_session_cuts_off_its_token(client, db_session, super_admin_user, other_org_admin):
    data, h = await _start(client, super_admin_user, other_org_admin)
    sid = data["session"]["id"]
    assert (await client.get("/v1/auth/me", headers=h)).status_code == 200

    r = await _end(client, super_admin_user, sid)
    assert r.status_code == 200 and r.json()["data"]["end_reason"] == "exit"
    assert (await client.get("/v1/auth/me", headers=h)).status_code == 401

    # Ending twice changes nothing and logs once.
    assert (await _end(client, super_admin_user, sid)).status_code == 200
    ended = (await db_session.execute(
        select(SuperAdminAuditLog).where(SuperAdminAuditLog.action.like("Impersonation of % ended"))
    )).scalars().all()
    assert len(ended) == 1 and ended[0].action_metadata["session_id"] == sid


async def test_expired_session_is_refused_and_recorded(client, db_session, super_admin_user, other_org_admin):
    data, h = await _start(client, super_admin_user, other_org_admin)
    sid = uuid.UUID(data["session"]["id"])
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db_session.execute(update(ImpersonationLog).where(ImpersonationLog.id == sid).values(expires_at=past))
    await db_session.commit()

    assert (await client.get("/v1/auth/me", headers=h)).status_code == 401

    r = await client.get("/v1/super-admin/impersonations", headers=auth_headers(super_admin_user))
    session = r.json()["data"]["sessions"][0]
    assert session["status"] == "ended" and session["end_reason"] == "expired"
    expired = (await db_session.execute(
        select(SuperAdminAuditLog).where(SuperAdminAuditLog.action.like("%expired (time limit)"))
    )).scalars().all()
    assert len(expired) == 1


async def test_new_session_replaces_the_open_one(client, super_admin_user, other_org_admin, recruiter_user):
    first, first_h = await _start(client, super_admin_user, other_org_admin)
    await _start(client, super_admin_user, recruiter_user)
    assert (await client.get("/v1/auth/me", headers=first_h)).status_code == 401

    r = await client.get("/v1/super-admin/impersonations", params={"status": "ended"}, headers=auth_headers(super_admin_user))
    ended = r.json()["data"]["sessions"]
    assert [s["id"] for s in ended] == [first["session"]["id"]] and ended[0]["end_reason"] == "replaced"


async def test_another_super_admin_can_end_a_session(client, db_session, super_admin_user, other_org_admin, organization):
    data, h = await _start(client, super_admin_user, other_org_admin)
    lead = await _make_user(db_session, organization, "super_admin")
    r = await _end(client, lead, data["session"]["id"])
    assert r.status_code == 200 and r.json()["data"]["end_reason"] == "ended_by_admin"
    assert (await client.get("/v1/auth/me", headers=h)).status_code == 401


async def test_suspending_the_super_admin_ends_their_access(client, db_session, super_admin_user, other_org_admin):
    _, h = await _start(client, super_admin_user, other_org_admin)
    await db_session.execute(update(User).where(User.id == super_admin_user.id).values(is_active=False))
    await db_session.commit()
    assert (await client.get("/v1/auth/me", headers=h)).status_code == 401


async def test_untracked_impersonation_tokens_are_refused(client, super_admin_user, other_org_admin):
    # What the endpoint issued before sessions were tracked: no session id.
    legacy = create_access_token({
        "sub": str(other_org_admin.id), "org": str(other_org_admin.organization_id),
        "impersonator_id": str(super_admin_user.id),
    })
    r = await client.get("/v1/auth/me", headers={"Authorization": f"Bearer {legacy}"})
    assert r.status_code == 401


async def test_impersonated_user_cannot_manage_sessions(client, super_admin_user, other_org_admin):
    data, h = await _start(client, super_admin_user, other_org_admin, allow_changes=True)
    r = await client.post(f"/v1/super-admin/impersonations/{data['session']['id']}/end", json={}, headers=h)
    assert r.status_code == 403
    assert (await client.get("/v1/super-admin/impersonations", headers=h)).status_code == 403
    assert (await client.get("/v1/super-admin/impersonations", headers=auth_headers(other_org_admin))).status_code == 403


async def test_start_requires_a_reason_and_an_active_organization(client, super_admin_user, other_org_admin, other_organization):
    r = await client.post(
        f"/v1/super-admin/impersonate/{other_org_admin.id}", json={"reason": ""},
        headers=auth_headers(super_admin_user),
    )
    assert r.status_code == 422
    await client.post(f"/v1/super-admin/clients/{other_organization.id}/suspend", headers=auth_headers(super_admin_user))
    r = await client.post(
        f"/v1/super-admin/impersonate/{other_org_admin.id}", json={"reason": "Check the bug"},
        headers=auth_headers(super_admin_user),
    )
    assert r.status_code == 400


def _support(allow_changes: bool, method: str) -> impersonation.SupportSession:
    return impersonation.SupportSession(
        id=uuid.uuid4(), super_admin_id=uuid.uuid4(), super_admin_email="sa@example.com",
        target_user_id=uuid.uuid4(), target_email="t@example.com", organization_id=None,
        allow_changes=allow_changes, method=method, path="/v1/test", ip=None, user_agent=None,
    )


async def test_database_refuses_writes_in_view_only_requests(db_session, other_org_admin):
    """The backstop for read-only POSTs that are let through to the endpoint."""
    user_id = other_org_admin.id
    token = impersonation.bind(_support(allow_changes=False, method="POST"))
    try:
        user = await db_session.get(User, user_id)
        user.full_name = "Sneaky"
        with pytest.raises(impersonation.ViewOnlySession):
            await db_session.flush()
        await db_session.rollback()
        with pytest.raises(impersonation.ViewOnlySession):
            await db_session.execute(update(User).where(User.id == user_id).values(full_name="Bulk"))
        await db_session.rollback()
    finally:
        impersonation.reset(token)

    # A plain read (GET) may still write incidentally, e.g. a read receipt.
    token = impersonation.bind(_support(allow_changes=False, method="GET"))
    try:
        user = await db_session.get(User, user_id)
        user.full_name = "Read-time write"
        await db_session.flush()
    finally:
        impersonation.reset(token)
    await db_session.rollback()
