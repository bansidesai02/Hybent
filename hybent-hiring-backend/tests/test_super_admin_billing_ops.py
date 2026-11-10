"""Super admin: edit plans, refund payments, export CSVs."""
import pytest

from app.models.payment import Payment
from app.models.super_admin import SubscriptionPlan
from tests.conftest import auth_headers


@pytest.fixture
async def plan(db_session):
    p = SubscriptionPlan(name="Pro Test", term_months=1, price_monthly=49.0, price_yearly=0.0, features={"copilot": True})
    db_session.add(p)
    await db_session.commit()
    return p


@pytest.fixture
async def paid(db_session, organization):
    p = Payment(organization_id=organization.id, kind="topup", status="paid", amount_usd=100.0,
                description="AI credits", details={"credits": 5000}, stripe_session_id="cs_test_1")
    db_session.add(p)
    await db_session.commit()
    return p


async def test_edit_plan(client, plan, super_admin_user, admin_user):
    h = auth_headers(super_admin_user)
    r = await client.put(f"/v1/super-admin/plans/{plan.id}", json={"price_monthly": 59, "copilot": False}, headers=h)
    assert r.status_code == 200
    assert r.json()["data"]["price_monthly"] == 59 and r.json()["data"]["copilot"] is False
    assert (await client.put(f"/v1/super-admin/plans/{plan.id}", json={"price_monthly": -1}, headers=h)).status_code == 422
    assert (await client.put(f"/v1/super-admin/plans/{plan.id}", json={"price_monthly": 1}, headers=auth_headers(admin_user))).status_code == 403


async def test_partial_then_full_refund(client, monkeypatch, paid, super_admin_user):
    from app.core.config import settings
    from app.services import stripe_gateway
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_x")
    calls = []

    async def fake_refund(session_id, invoice_id, amount_cents=None):
        calls.append((session_id, amount_cents))
        return {"id": f"re_{len(calls)}"}
    monkeypatch.setattr(stripe_gateway, "refund", fake_refund)
    h = auth_headers(super_admin_user)
    url = f"/v1/super-admin/payments/{paid.id}/refund"

    r = await client.post(url, json={"amount_usd": 30, "reason": "goodwill"}, headers=h)
    assert r.status_code == 200 and r.json()["data"]["status"] == "paid"
    assert (await client.post(url, json={"amount_usd": 80}, headers=h)).status_code == 400  # only $70 left
    r = await client.post(url, json={}, headers=h)  # the rest
    assert r.status_code == 200 and r.json()["data"]["status"] == "refunded"
    assert calls == [("cs_test_1", 3000), ("cs_test_1", 7000)]
    assert (await client.post(url, json={}, headers=h)).status_code == 400


async def test_refund_reports_stripe_errors(client, monkeypatch, paid, super_admin_user):
    from app.core.config import settings
    from app.services import stripe_gateway
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_x")

    async def broken(*a, **k):
        raise ValueError("Stripe has no charge for this payment.")
    monkeypatch.setattr(stripe_gateway, "refund", broken)
    r = await client.post(f"/v1/super-admin/payments/{paid.id}/refund", json={}, headers=auth_headers(super_admin_user))
    assert r.status_code == 502 and "no charge" in r.json()["message"]


async def test_exports(client, paid, super_admin_user, admin_user):
    h = auth_headers(super_admin_user)
    for kind, header in (("clients", "name,slug"), ("users", "name,email"), ("payments", "client,kind")):
        r = await client.get(f"/v1/super-admin/exports/{kind}", headers=h)
        assert r.status_code == 200 and r.text.startswith(header), kind
    assert admin_user.email in (await client.get("/v1/super-admin/exports/users", headers=h)).text
    assert (await client.get("/v1/super-admin/exports/secrets", headers=h)).status_code == 422
    assert (await client.get("/v1/super-admin/exports/users", headers=auth_headers(admin_user))).status_code == 403
