"""Super admin feature switches are enforced per client."""
from tests.conftest import auth_headers


async def _set(client, super_admin, org, force=False, **flags):
    r = await client.put(f"/v1/super-admin/clients/{org.id}/flags", json=flags, headers=auth_headers(super_admin),
                         params={"force": "true"} if force else None)
    assert r.status_code == 200, r.text


async def test_defaults_keep_everything_on(client, admin_user):
    r = await client.get("/v1/auth/features", headers=auth_headers(admin_user))
    data = r.json()["data"]
    assert data["ai"] and data["bulk"] and data["analytics"] and data["copilot"]


async def test_switched_off_features_are_refused(client, super_admin_user, other_org_admin, other_organization, admin_user):
    await _set(client, super_admin_user, other_organization, copilot=False, bulk=False, analytics=False, ai=False)
    h = auth_headers(other_org_admin)

    flags = (await client.get("/v1/auth/features", headers=h)).json()["data"]
    assert not any(flags[k] for k in ("ai", "bulk", "analytics", "copilot"))

    for path in ("/v1/copilot/conversations", "/v1/bulk-import/history", "/v1/reports/export", "/v1/screening/queue"):
        r = await client.get(path, headers=h)
        assert r.status_code == 403, (path, r.status_code)
        assert "turned off" in r.json()["message"]

    # Another organization is unaffected.
    r = await client.get("/v1/copilot/conversations", headers=auth_headers(admin_user))
    assert r.status_code != 403


async def test_global_default_applies_without_a_client_setting(client, super_admin_user, admin_user):
    r = await client.put("/v1/super-admin/flags", json={"copilot": False}, headers=auth_headers(super_admin_user))
    assert r.status_code == 200
    flags = (await client.get("/v1/auth/features", headers=auth_headers(admin_user))).json()["data"]
    assert flags["copilot"] is False and flags["ai"] is True


async def test_super_admin_sees_effective_flags(client, super_admin_user, other_organization, monkeypatch):
    # AI calls off by default here, whatever the developer's .env says.
    from app.core.config import settings
    monkeypatch.setattr(settings, "ai_calls", False)
    monkeypatch.setattr(settings, "ai_calls_orgs", "")
    await _set(client, super_admin_user, other_organization, copilot=False)
    r = await client.get(f"/v1/super-admin/clients/{other_organization.id}/flags", headers=auth_headers(super_admin_user))
    data = r.json()["data"]
    assert data["copilot"] is False and data["ai"] is True and data["ai_calls"] is False
    assert "video" not in data and "domain" not in data


async def _subscribe(db_session, org, name, features):
    from app.models.super_admin import CompanySubscription, SubscriptionPlan
    plan = SubscriptionPlan(name=name, term_months=1, price_monthly=29.0, price_yearly=348.0, features=features)
    db_session.add(plan)
    await db_session.flush()
    from app.services import billing_service
    sub = CompanySubscription(organization_id=org.id, plan_id=plan.id, status="active")
    billing_service.assign_plan(sub, plan)
    db_session.add(sub)
    await db_session.commit()


async def test_standard_plan_has_no_copilot(client, db_session, admin_user, organization):
    await _subscribe(db_session, organization, "Standard", {"ai": True, "copilot": False})
    h = auth_headers(admin_user)
    flags = (await client.get("/v1/auth/features", headers=h)).json()["data"]
    assert flags["copilot"] is False and flags["ai"] is True
    assert (await client.get("/v1/copilot/conversations", headers=h)).status_code == 403


async def test_pro_plan_has_copilot(client, db_session, admin_user, organization):
    await _subscribe(db_session, organization, "Pro", {"ai": True, "copilot": True})
    flags = (await client.get("/v1/auth/features", headers=auth_headers(admin_user))).json()["data"]
    assert flags["copilot"] is True


async def test_client_switch_overrides_the_plan(client, db_session, super_admin_user, admin_user, organization):
    await _subscribe(db_session, organization, "Standard", {"copilot": False})
    # The Copilot isn't in Standard: a super admin turns it on by force.
    await _set(client, super_admin_user, organization, force=True, copilot=True)
    flags = (await client.get("/v1/auth/features", headers=auth_headers(admin_user))).json()["data"]
    assert flags["copilot"] is True



async def test_super_admin_switch_overrides_the_env_default(client, super_admin_user, other_organization, monkeypatch):
    """AI_CALLS=true is only the default: switching a client off hides AI Calls for it."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "ai_calls", True)
    monkeypatch.setattr(settings, "voice_api_key", "k")
    monkeypatch.setattr(settings, "voice_callback_secret", "s")
    h = auth_headers(super_admin_user)
    url = f"/v1/super-admin/clients/{other_organization.id}/flags"
    assert (await client.get(url, headers=h)).json()["data"]["ai_calls"] is True
    await _set(client, super_admin_user, other_organization, ai_calls=False)
    assert (await client.get(url, headers=h)).json()["data"]["ai_calls"] is False


async def test_usage_logs_can_be_hidden_for_everyone_or_one_client(client, super_admin_user, admin_user, organization):
    h_admin = auth_headers(admin_user)
    assert (await client.get("/v1/auth/features", headers=h_admin)).json()["data"]["usage_logs"] is True
    assert (await client.get("/v1/ai/credits/history", headers=h_admin)).status_code == 200

    # Off for every client from Super Admin → Feature flags.
    r = await client.put("/v1/super-admin/flags", json={"usage_logs": False}, headers=auth_headers(super_admin_user))
    assert r.status_code == 200, r.text
    assert (await client.get("/v1/auth/features", headers=h_admin)).json()["data"]["usage_logs"] is False
    assert (await client.get("/v1/ai/credits/history", headers=h_admin)).status_code == 403

    # One client switched back on.
    await _set(client, super_admin_user, organization, usage_logs=True)
    assert (await client.get("/v1/ai/credits/history", headers=h_admin)).status_code == 200
