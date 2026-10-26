"""Super admin controls: org suspension lockout, password reset, impersonation guards."""
from sqlalchemy import select

from app.models.password_reset import PasswordResetToken
from app.models.user import RefreshToken
from app.utils.security import verify_password
from tests.conftest import _make_user, auth_headers


async def _login(client, user):
    return await client.post("/v1/auth/login", json={"email": user.email, "password": "password123"})


async def test_super_admin_endpoints_reject_org_admin(client, admin_user):
    for path in ("/v1/super-admin/dashboard", "/v1/super-admin/users", "/v1/super-admin/health"):
        r = await client.get(path, headers=auth_headers(admin_user))
        assert r.status_code == 403, path


async def test_suspended_org_locks_out_members(client, db_session, super_admin_user, other_org_admin, other_organization):
    assert (await _login(client, other_org_admin)).status_code == 200

    r = await client.post(f"/v1/super-admin/clients/{other_organization.id}/suspend", headers=auth_headers(super_admin_user))
    assert r.status_code == 200

    assert (await _login(client, other_org_admin)).status_code == 403
    r = await client.get("/v1/auth/me", headers=auth_headers(other_org_admin))
    assert r.status_code == 403
    tokens = (await db_session.execute(
        select(RefreshToken).where(RefreshToken.user_id == other_org_admin.id)
    )).scalars().all()
    assert tokens and all(t.is_revoked for t in tokens)

    await client.post(f"/v1/super-admin/clients/{other_organization.id}/activate", headers=auth_headers(super_admin_user))
    assert (await _login(client, other_org_admin)).status_code == 200


async def test_reset_password_emails_link_instead_of_default(client, db_session, monkeypatch, super_admin_user, admin_user):
    sent = []
    monkeypatch.setattr(
        "app.services.email_service.send_password_reset_email",
        lambda **kw: sent.append(kw),
    )
    r = await client.post(f"/v1/super-admin/users/{admin_user.id}/reset-password", headers=auth_headers(super_admin_user))
    assert r.status_code == 200
    assert "password123" not in r.text
    assert sent and sent[0]["to_email"] == admin_user.email

    await db_session.refresh(admin_user)
    assert verify_password("password123", admin_user.hashed_password)  # unchanged until link used
    tok = (await db_session.execute(
        select(PasswordResetToken).where(PasswordResetToken.user_id == admin_user.id, PasswordResetToken.is_used == False)
    )).scalar_one()
    assert tok.token in sent[0]["reset_url"]


async def test_cannot_suspend_self(client, super_admin_user):
    r = await client.put(
        f"/v1/super-admin/users/{super_admin_user.id}/status", params={"is_active": False},
        headers=auth_headers(super_admin_user),
    )
    assert r.status_code == 400


async def test_cannot_impersonate_super_admin(client, db_session, super_admin_user, organization):
    other = await _make_user(db_session, organization, "super_admin")
    r = await client.post(
        f"/v1/super-admin/impersonate/{other.id}", json={"reason": "support ticket"},
        headers=auth_headers(super_admin_user),
    )
    assert r.status_code == 403


async def test_health_reports_real_fields(client, super_admin_user):
    r = await client.get("/v1/super-admin/health", headers=auth_headers(super_admin_user))
    assert r.status_code == 200
    data = r.json()["data"]
    assert "api_uptime" not in data and "uptime_seconds" in data
    assert {s["name"] for s in data["services"]} == {"API", "Database", "Redis"}


# ── Sign-in history ──────────────────────────────────────────────────────────

async def test_sign_ins_are_recorded(client, db_session, super_admin_user, admin_user):
    from app.models.login_event import LoginEvent

    assert (await _login(client, admin_user)).status_code == 200
    bad = await client.post("/v1/auth/login", json={"email": admin_user.email, "password": "wrong"})
    assert bad.status_code == 401
    await client.post("/v1/auth/login", json={"email": "nobody@example.com", "password": "x"})

    events = (await db_session.execute(select(LoginEvent).order_by(LoginEvent.created_at))).scalars().all()
    assert [(e.success, e.reason) for e in events] == [(True, None), (False, "bad_credentials"), (False, "bad_credentials")]
    assert events[2].user_id is None and events[0].organization_id == admin_user.organization_id

    r = await client.get(f"/v1/super-admin/users/{admin_user.id}/logins", headers=auth_headers(super_admin_user))
    assert r.status_code == 200 and len(r.json()["data"]["events"]) == 2
    r = await client.get("/v1/super-admin/login-events", params={"outcome": "failure"}, headers=auth_headers(super_admin_user))
    assert r.json()["data"]["total"] == 2


# ── Security settings ────────────────────────────────────────────────────────

async def _save_settings(client, super_admin_user, **payload):
    return await client.put("/v1/super-admin/settings", json=payload, headers=auth_headers(super_admin_user))


async def test_unconfirmed_default_settings_are_not_enforced(client, db_session, admin_user, super_admin_user):
    from app.models.super_admin import PlatformSetting

    # What the old Settings page wrote on first view, without anyone choosing it.
    db_session.add(PlatformSetting(setting_key="platform_branding_smtp",
                                   setting_value={"require_2fa": True, "session_timeout": True}))
    await db_session.commit()
    r = await _login(client, admin_user)
    assert r.status_code == 200 and r.json()["data"]["access_token"]
    s = (await client.get("/v1/super-admin/settings", headers=auth_headers(super_admin_user))).json()["data"]
    assert s["require_2fa"] is False and s["session_timeout"] is False


async def test_require_2fa_for_tenant_admins(client, monkeypatch, admin_user, recruiter_user, super_admin_user):
    import re

    sent = []
    monkeypatch.setattr("app.services.email_service.send_email",
                        lambda to, subject, html_body, **kw: sent.append(html_body))
    assert (await _save_settings(client, super_admin_user, require_2fa=True)).status_code == 200

    # Recruiters are not covered by the switch.
    assert "access_token" in (await _login(client, recruiter_user)).json()["data"]

    r = await _login(client, admin_user)
    data = r.json()["data"]
    assert r.status_code == 200 and data["mfa_required"] and "access_token" not in data
    code = re.search(r"<strong[^>]*>(\d{6})</strong>", sent[-1]).group(1)

    # A code alone (the old email-only flow) never signs anyone in.
    r = await client.post("/v1/auth/2fa/verify", json={"email": admin_user.email, "otp": code})
    assert r.status_code == 401
    wrong = "000000" if code != "000000" else "111111"
    r = await client.post("/v1/auth/2fa/verify", json={"mfa_token": data["mfa_token"], "otp": wrong})
    assert r.status_code == 400
    r = await client.post("/v1/auth/2fa/verify", json={"mfa_token": data["mfa_token"], "otp": code})
    assert r.status_code == 200 and r.json()["data"]["access_token"]
    # Single use.
    r = await client.post("/v1/auth/2fa/verify", json={"mfa_token": data["mfa_token"], "otp": code})
    assert r.status_code == 400


async def test_2fa_locks_after_repeated_wrong_codes(client, monkeypatch, admin_user, super_admin_user):
    monkeypatch.setattr("app.services.email_service.send_email", lambda *a, **kw: None)
    await _save_settings(client, super_admin_user, require_2fa=True)
    token = (await _login(client, admin_user)).json()["data"]["mfa_token"]
    for _ in range(5):
        await client.post("/v1/auth/2fa/verify", json={"mfa_token": token, "otp": "999999"})
    r = await client.post("/v1/auth/2fa/verify", json={"mfa_token": token, "otp": "999999"})
    assert r.status_code == 429


async def test_ip_allowlist(client, super_admin_user):
    h = auth_headers(super_admin_user)
    me = (await client.get("/v1/super-admin/settings", headers=h)).json()["data"]["current_ip"]

    assert (await _save_settings(client, super_admin_user, ip_whitelist=True, ip_allowlist=[])).status_code == 400
    r = await _save_settings(client, super_admin_user, ip_whitelist=True, ip_allowlist=["203.0.113.0/24"])
    assert r.status_code == 400 and "lock you out" in r.json()["message"]
    assert (await _save_settings(client, super_admin_user, ip_allowlist=["not-an-ip"])).status_code == 400
    r = await _save_settings(client, super_admin_user, ip_whitelist=True, ip_allowlist=[me, "203.0.113.0/24"])
    assert r.status_code == 200

    assert (await client.get("/v1/super-admin/dashboard", headers=h)).status_code == 200
    elsewhere = {**h, "X-Forwarded-For": "198.51.100.7"}
    assert (await client.get("/v1/super-admin/dashboard", headers=elsewhere)).status_code == 403
    r = await client.post("/v1/auth/login", json={"email": super_admin_user.email, "password": "password123"},
                          headers={"X-Forwarded-For": "198.51.100.7"})
    assert r.status_code == 403


async def test_session_timeout_rejects_stale_refresh(client, db_session, admin_user, super_admin_user):
    from datetime import datetime, timedelta, timezone

    await _save_settings(client, super_admin_user, session_timeout=True)
    refresh = (await _login(client, admin_user)).json()["data"]["refresh_token"]
    tok = (await db_session.execute(select(RefreshToken).where(RefreshToken.token == refresh))).scalar_one()
    tok.created_at = datetime.now(timezone.utc) - timedelta(hours=3)
    await db_session.commit()
    assert (await client.post("/v1/auth/refresh", json={"refresh_token": refresh})).status_code == 401

    fresh = (await _login(client, admin_user)).json()["data"]["refresh_token"]
    assert (await client.post("/v1/auth/refresh", json={"refresh_token": fresh})).status_code == 200


async def test_session_policy_is_public(client, super_admin_user):
    assert (await client.get("/v1/auth/session-policy")).json()["data"]["idle_timeout_minutes"] is None
    await _save_settings(client, super_admin_user, session_timeout=True)
    assert (await client.get("/v1/auth/session-policy")).json()["data"]["idle_timeout_minutes"] == 30


# ── Directory, organization detail, audit, rankings ──────────────────────────

async def test_user_directory_filters(client, db_session, super_admin_user, admin_user, recruiter_user,
                                      other_org_admin, other_organization):
    from datetime import datetime, timezone

    recruiter_user.is_active = False
    admin_user.last_login = datetime.now(timezone.utc)
    await db_session.commit()
    h = auth_headers(super_admin_user)

    async def emails(**params):
        r = await client.get("/v1/super-admin/users", params=params, headers=h)
        assert r.status_code == 200, r.text
        return {u["email"] for u in r.json()["data"]["users"]}

    assert await emails(organization_id=str(other_organization.id)) == {other_org_admin.email}
    assert await emails(status="suspended") == {recruiter_user.email}
    assert await emails(q=admin_user.email[:12]) == {admin_user.email}
    assert admin_user.email not in await emails(last_login="never")
    r = await client.get("/v1/super-admin/users", params={"sort": "last_login; drop table users"}, headers=h)
    assert r.status_code == 422


async def test_client_overview(client, super_admin_user, other_org_admin, other_organization, organization):
    import uuid

    h = auth_headers(super_admin_user)
    r = await client.get(f"/v1/super-admin/clients/{other_organization.id}/overview", headers=h)
    assert r.status_code == 200
    data = r.json()["data"]
    assert [m["email"] for m in data["members"]] == [other_org_admin.email]
    assert data["member_counts"] == {"active": 1, "suspended": 0, "never_signed_in": 1}
    assert data["hiring"]["jobs"] == 0 and data["organization"]["is_platform_org"] is False

    assert (await client.get(f"/v1/super-admin/clients/{uuid.uuid4()}/overview", headers=h)).status_code == 404
    # The organization holding the super admin can't be deleted or suspended.
    assert (await client.delete(f"/v1/super-admin/clients/{organization.id}", headers=h)).status_code == 400
    assert (await client.post(f"/v1/super-admin/clients/{organization.id}/suspend", headers=h)).status_code == 400


async def test_audit_filters_and_csv_export(client, super_admin_user, other_organization):
    h = auth_headers(super_admin_user)
    await client.post(f"/v1/super-admin/clients/{other_organization.id}/suspend", headers=h)
    await _save_settings(client, super_admin_user, platform_name="Hybent")

    r = await client.get("/v1/super-admin/audit-logs", params={"organization_id": str(other_organization.id)}, headers=h)
    logs = r.json()["data"]["logs"]
    assert len(logs) == 1 and logs[0]["action"].startswith("Suspended client")
    r = await client.get("/v1/super-admin/audit-logs", params={"module": "Global Settings"}, headers=h)
    assert r.json()["data"]["total"] == 1

    r = await client.get("/v1/super-admin/audit-logs/export", headers=h)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0] == "timestamp_utc,actor,module,action,ip_address" and len(lines) == 3
    # The export is itself audited.
    r = await client.get("/v1/super-admin/audit-logs", params={"module": "Audit Logs"}, headers=h)
    assert r.json()["data"]["total"] == 1


async def test_activity_rankings(client, super_admin_user, other_org_admin, other_organization):
    await _login(client, other_org_admin)
    r = await client.get("/v1/super-admin/activity", params={"days": 7}, headers=auth_headers(super_admin_user))
    assert r.status_code == 200
    top = r.json()["data"]["organizations"][0]
    assert top["organization_id"] == str(other_organization.id) and top["logins"] == 1


async def test_new_endpoints_reject_org_admins(client, admin_user, organization):
    h = auth_headers(admin_user)
    for path in (
        f"/v1/super-admin/clients/{organization.id}/overview",
        f"/v1/super-admin/users/{admin_user.id}/logins",
        "/v1/super-admin/login-events",
        "/v1/super-admin/audit-logs/export",
        "/v1/super-admin/activity",
        "/v1/super-admin/settings",
    ):
        assert (await client.get(path, headers=h)).status_code == 403, path
