"""Stripe payments: plan links sent to clients after a demo, admins buying
seats and AI credit top-ups, renewals. Stripe itself is replaced by a fake
gateway; the webhook signature check is bypassed except where tested."""
import json
import time
import types
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select

import app.services.payment_service as payment_service
import app.services.stripe_gateway as stripe_gateway
from app.core.config import settings
from app.models.organization import Organization
from app.models.organization_ai_credits import OrganizationAICredits
from app.models.payment import Payment
from app.models.super_admin import CompanySubscription, SubscriptionPlan
from app.models.user import User
from app.services import ai_metering, billing_service


class FakeStripe:
    """Records Checkout sessions and lets a test complete them."""

    def __init__(self):
        self.sessions: dict[str, dict] = {}
        self.subscriptions: dict[str, dict] = {}
        self.item_updates: list[tuple[str, dict]] = []
        self.expired: list[str] = []

    async def create_checkout_session(self, params):
        sid = f"cs_test_{uuid.uuid4().hex[:10]}"
        session = {
            **params, "id": sid, "url": f"https://checkout.stripe.test/{sid}",
            "status": "open", "payment_status": "unpaid",
        }
        self.sessions[sid] = session
        return session

    async def retrieve_checkout_session(self, sid):
        return self.sessions[sid]

    async def expire_checkout_session(self, sid):
        self.expired.append(sid)
        if sid in self.sessions and self.sessions[sid]["status"] == "open":
            self.sessions[sid]["status"] = "expired"

    async def retrieve_subscription(self, sub_id):
        return self.subscriptions[sub_id]

    async def recurring_price(self, lookup_key, product_name, unit_amount_cents, currency, interval_count, item):
        return f"price_{lookup_key}"

    async def set_subscription_items(self, sub_id, quantities):
        self.item_updates.append((sub_id, quantities))

    def complete(self, sid, amount_cents=None) -> dict:
        """Pay a session, as Stripe would when the customer finishes Checkout."""
        session = self.sessions[sid]
        session.update(status="complete", payment_status="paid", customer="cus_test_1")
        session["amount_total"] = amount_cents if amount_cents is not None else sum(
            int(li["price_data"]["unit_amount"]) * li["quantity"] for li in session["line_items"] if "price_data" in li
        )
        if session["mode"] == "subscription":
            sub_id = f"sub_test_{uuid.uuid4().hex[:8]}"
            now = int(time.time())
            # Newer Stripe API versions keep the period on the items.
            self.subscriptions[sub_id] = {"id": sub_id, "items": {"data": [
                {"current_period_start": now, "current_period_end": now + 30 * 86400},
            ]}}
            session["subscription"] = sub_id
        return session


@pytest.fixture
def fake_stripe(monkeypatch):
    fake = FakeStripe()
    for name in ("create_checkout_session", "retrieve_checkout_session", "expire_checkout_session",
                 "retrieve_subscription", "recurring_price", "set_subscription_items"):
        monkeypatch.setattr(stripe_gateway, name, getattr(fake, name))
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_fake")
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_fake")
    monkeypatch.setattr(stripe_gateway, "construct_event", lambda payload, sig: json.loads(payload))
    return fake


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch):
    """No Celery broker or SMTP in tests; emails are captured instead."""
    import app.services.ai_credit_service as credit_svc
    import app.tasks.notifications as notifications
    fake = types.SimpleNamespace(delay=lambda *a, **k: None)
    for mod in (credit_svc, notifications, payment_service):
        monkeypatch.setattr(mod, "notify_organization_roles", fake)
    sent = []
    monkeypatch.setattr(payment_service, "send_email", lambda to, subject, body: sent.append((to, subject, body)) or True)
    ai_metering._blocked.clear()
    yield sent
    ai_metering._blocked.clear()


@pytest_asyncio.fixture
async def plans(db_session):
    rows = [
        SubscriptionPlan(name="Standard", term_months=1, price_monthly=69.0, price_yearly=828.0, sort_order=1),
        SubscriptionPlan(name="6 months", term_months=6, price_monthly=66.0, price_yearly=792.0, sort_order=2),
        SubscriptionPlan(name="12 months", term_months=12, price_monthly=62.0, price_yearly=744.0, sort_order=3),
        SubscriptionPlan(name="Custom", term_months=None, price_monthly=0.0, price_yearly=0.0, sort_order=4),
    ]
    db_session.add_all(rows)
    await db_session.commit()
    return {p.name: p for p in rows}


@pytest_asyncio.fixture
async def subscription(db_session, organization, plans):
    """A Standard subscription half-way through its 30-day term."""
    now = datetime.now(timezone.utc)
    sub = CompanySubscription(
        organization_id=organization.id, plan_id=plans["Standard"].id, status="active",
        current_period_start=now - timedelta(days=15), current_period_end=now + timedelta(days=15),
    )
    db_session.add(sub)
    await db_session.commit()
    return sub


async def _webhook(client, event_type, obj):
    return await client.post(
        "/v1/stripe/webhook",
        content=json.dumps({"type": event_type, "data": {"object": obj}}),
        headers={"stripe-signature": "t=1,v1=fake"},
    )


# ── Pricing ──────────────────────────────────────────────────────────────────

def test_link_quote_is_plan_plus_seats_for_the_term(plans):
    q = payment_service.subscription_quote(plans["Standard"], 1, 2)
    assert q["amount_usd"] == 69 + 15 + 2 * 10
    assert q["recurring"] and q["term_months"] == 1
    q = payment_service.subscription_quote(plans["12 months"], 1, 2)
    assert q["amount_usd"] == 744 + 15 * 12 + 2 * 10 * 12


def test_custom_plan_needs_an_agreed_amount_and_term(plans):
    with pytest.raises(Exception):
        payment_service.subscription_quote(plans["Custom"])
    q = payment_service.subscription_quote(plans["Custom"], custom_amount_usd=2500, custom_term_months=12)
    assert q == {
        "term_months": 12, "recurring": False, "amount_usd": 2500.0,
        "lines": [{"label": "Custom plan, year", "amount_usd": 2500.0}],
    }


async def test_seats_are_prorated_to_the_end_of_the_term(subscription):
    prices = payment_service.prorated_seat_prices(subscription)
    assert prices == {"admin": pytest.approx(7.5, abs=0.01), "recruiter": pytest.approx(5.0, abs=0.01)}


async def test_no_online_seats_on_custom_or_ended_terms(db_session, subscription, plans):
    subscription.plan_id = plans["Custom"].id
    subscription.plan = plans["Custom"]
    assert payment_service.prorated_seat_prices(subscription) is None
    subscription.plan = plans["Standard"]
    subscription.current_period_end = datetime.now(timezone.utc) - timedelta(days=1)
    assert payment_service.prorated_seat_prices(subscription) is None


# ── Onboarding: a plan link for a new client ─────────────────────────────────

async def test_new_client_pays_link_and_is_activated(client, db_session, fake_stripe, plans, super_admin_headers, _no_side_effects):
    res = await client.post("/v1/super-admin/clients", headers=super_admin_headers, json={
        "name": "Globex", "slug": "globex", "admin_email": "owner@globex-example.com", "admin_name": "Hank Scorpio",
        "plan_name": "Standard", "collect_payment": True, "extra_admin_seats": 1, "extra_recruiter_seats": 2,
    })
    assert res.status_code in (200, 201), res.text
    data = res.json()["data"]
    assert data["emailed"] is True
    link = data["payment"]
    assert link["amount_usd"] == 104.0 and link["status"] == "pending"
    token = link["pay_url"].rsplit("/", 1)[1]
    assert _no_side_effects[0][0] == "owner@globex-example.com"

    org = await db_session.get(Organization, uuid.UUID(data["org_id"]))
    admin = (await db_session.execute(select(User).where(User.email == "owner@globex-example.com"))).scalar_one()
    assert org.is_active is False and admin.is_active is False
    # Not paid, so the admin can't sign in with the old default password.
    login = await client.post("/v1/auth/login", json={"email": "owner@globex-example.com", "password": "password123"})
    assert login.status_code in (401, 403)

    # The client opens the public page and starts Checkout.
    page = await client.get(f"/v1/payments/{token}")
    assert page.status_code == 200 and page.json()["data"]["amount_usd"] == 104.0
    url = (await client.post(f"/v1/payments/{token}/checkout")).json()["data"]["url"]
    sid = url.rsplit("/", 1)[1]
    session = fake_stripe.sessions[sid]
    assert session["mode"] == "subscription"
    assert session["customer_email"] == "owner@globex-example.com"
    assert [li["quantity"] for li in session["line_items"]] == [1, 1, 2]
    # A second click reuses the open session rather than starting another subscription.
    assert (await client.post(f"/v1/payments/{token}/checkout")).json()["data"]["url"] == url

    paid = fake_stripe.complete(sid, amount_cents=10400)
    assert (await _webhook(client, "checkout.session.completed", paid)).status_code == 200
    # Stripe retries webhooks; the second delivery changes nothing.
    assert (await _webhook(client, "checkout.session.completed", paid)).status_code == 200

    org_id, admin_id = org.id, admin.id
    db_session.expire_all()
    org = await db_session.get(Organization, org_id)
    admin = await db_session.get(User, admin_id)
    sub = (await db_session.execute(select(CompanySubscription).where(CompanySubscription.organization_id == org.id))).scalar_one()
    assert org.is_active and admin.is_active
    assert org.stripe_customer_id == "cus_test_1"
    assert sub.status == "active" and sub.trial_end is None
    assert sub.stripe_subscription_id == paid["subscription"]
    assert (sub.extra_admin_seats, sub.extra_recruiter_seats) == (1, 2)
    credits = (await db_session.execute(select(OrganizationAICredits).where(OrganizationAICredits.organization_id == org.id))).scalar_one()
    assert credits.allowed_credits == 10_000 + 1_500 + 2 * 1_000

    welcome = [m for m in _no_side_effects if "set your password" in m[1]]
    assert len(welcome) == 1 and "/reset-password?token=" in welcome[0][2]
    status = (await client.get(f"/v1/payments/{token}")).json()["data"]
    assert status["status"] == "paid"
    assert (await client.post(f"/v1/payments/{token}/checkout")).status_code == 409


async def test_return_from_checkout_applies_payment_without_webhook(client, db_session, fake_stripe, plans, organization, admin_user, super_admin_headers):
    res = await client.post(f"/v1/super-admin/clients/{organization.id}/payment-links", headers=super_admin_headers,
                            json={"plan_name": "6 months", "send_email": False})
    assert res.status_code in (200, 201), res.text
    token = res.json()["data"]["pay_url"].rsplit("/", 1)[1]
    sid = (await client.post(f"/v1/payments/{token}/checkout")).json()["data"]["url"].rsplit("/", 1)[1]
    fake_stripe.complete(sid)

    res = await client.post(f"/v1/payments/{token}/confirm", json={"session_id": sid})
    assert res.json()["data"]["status"] == "paid"
    sub = (await db_session.execute(select(CompanySubscription).where(CompanySubscription.organization_id == organization.id))).scalar_one()
    await db_session.refresh(sub)
    assert sub.billing_cycle == "6_months" and sub.stripe_subscription_id


async def test_new_link_replaces_unpaid_one(client, db_session, fake_stripe, plans, organization, admin_user, super_admin_headers):
    first = (await client.post(f"/v1/super-admin/clients/{organization.id}/payment-links", headers=super_admin_headers,
                               json={"plan_name": "Standard", "send_email": False})).json()["data"]
    await client.post(f"/v1/super-admin/clients/{organization.id}/payment-links", headers=super_admin_headers,
                      json={"plan_name": "12 months", "send_email": False})
    token = first["pay_url"].rsplit("/", 1)[1]
    assert (await client.get(f"/v1/payments/{token}")).json()["data"]["status"] == "canceled"
    assert (await client.post(f"/v1/payments/{token}/checkout")).status_code == 409


async def test_custom_plan_link_is_a_one_off_payment(client, fake_stripe, plans, organization, admin_user, super_admin_headers):
    res = await client.post(f"/v1/super-admin/clients/{organization.id}/payment-links", headers=super_admin_headers,
                            json={"plan_name": "Custom", "custom_amount_usd": 3000, "custom_term_months": 12, "send_email": False})
    assert res.status_code in (200, 201), res.text
    token = res.json()["data"]["pay_url"].rsplit("/", 1)[1]
    sid = (await client.post(f"/v1/payments/{token}/checkout")).json()["data"]["url"].rsplit("/", 1)[1]
    assert fake_stripe.sessions[sid]["mode"] == "payment"
    assert fake_stripe.sessions[sid]["line_items"][0]["price_data"]["unit_amount"] == 300_000


async def test_activating_pending_client_by_hand_lets_admin_in(client, db_session, fake_stripe, plans, super_admin_headers, _no_side_effects):
    """Paid by bank transfer instead: activating cancels the link and sends the welcome."""
    data = (await client.post("/v1/super-admin/clients", headers=super_admin_headers, json={
        "name": "Initech", "slug": "initech", "admin_email": "bill@initech-example.com",
        "plan_name": "Standard", "collect_payment": True, "send_payment_email": False,
    })).json()["data"]
    assert (await client.post(f"/v1/super-admin/clients/{data['org_id']}/activate", headers=super_admin_headers)).status_code == 200
    admin = (await db_session.execute(select(User).where(User.email == "bill@initech-example.com"))).scalar_one()
    await db_session.refresh(admin)
    assert admin.is_active
    link = await db_session.get(Payment, uuid.UUID(data["payment"]["id"]))
    await db_session.refresh(link)
    assert link.status == "canceled"
    assert any("set your password" in subject for _to, subject, _b in _no_side_effects)


async def test_payment_links_are_super_admin_only(client, plans, organization, admin_headers):
    res = await client.post(f"/v1/super-admin/clients/{organization.id}/payment-links", headers=admin_headers,
                            json={"plan_name": "Standard"})
    assert res.status_code == 403


# ── Admins buying seats and top-ups ──────────────────────────────────────────

async def test_admin_buys_seats_prorated(client, db_session, fake_stripe, subscription, admin_user, admin_headers):
    subscription.stripe_subscription_id = "sub_existing"
    await db_session.commit()

    overview = (await client.get("/v1/billing", headers=admin_headers)).json()["data"]
    assert overview["payments_enabled"] and overview["stripe_managed"]
    assert overview["seat_prices_now"]["recruiter"] == pytest.approx(5.0, abs=0.01)

    res = await client.post("/v1/billing/checkout/seats", headers=admin_headers, json={"recruiter": 2, "admin": 1})
    assert res.status_code == 200, res.text
    sid = res.json()["data"]["url"].rsplit("/", 1)[1]
    session = fake_stripe.sessions[sid]
    assert session["mode"] == "payment"
    assert session["line_items"][0]["price_data"]["unit_amount"] == pytest.approx(1750, abs=2)
    assert "/hiring/admin/billing?checkout=success" in session["success_url"]

    fake_stripe.complete(sid)
    res = await client.post("/v1/billing/checkout/confirm", headers=admin_headers, json={"session_id": sid})
    assert res.json()["data"]["status"] == "paid"
    await db_session.refresh(subscription)
    assert (subscription.extra_admin_seats, subscription.extra_recruiter_seats) == (1, 2)
    # Renewals now bill the new seats.
    assert fake_stripe.item_updates == [("sub_existing", {
        "admin_seat": ("price_hybent_seat_admin_1500_1m", 1),
        "recruiter_seat": ("price_hybent_seat_recruiter_1000_1m", 2),
    })]
    # The webhook arriving afterwards doesn't add them again.
    await _webhook(client, "checkout.session.completed", fake_stripe.sessions[sid])
    await db_session.refresh(subscription)
    assert subscription.extra_recruiter_seats == 2


async def test_seats_need_a_plan_that_can_be_bought_online(client, fake_stripe, plans, admin_headers):
    res = await client.post("/v1/billing/checkout/seats", headers=admin_headers, json={"recruiter": 1})
    assert res.status_code == 409


async def test_admin_buys_topup(client, db_session, fake_stripe, organization, admin_user, admin_headers):
    res = await client.post("/v1/billing/checkout/topup", headers=admin_headers, json={"credits": 20_000})
    assert res.status_code == 200, res.text
    sid = res.json()["data"]["url"].rsplit("/", 1)[1]
    assert fake_stripe.sessions[sid]["line_items"][0]["price_data"]["unit_amount"] == 4000

    paid = fake_stripe.complete(sid)
    await _webhook(client, "checkout.session.completed", paid)
    await _webhook(client, "checkout.session.completed", paid)
    credits = (await db_session.execute(select(OrganizationAICredits).where(OrganizationAICredits.organization_id == organization.id))).scalar_one()
    await db_session.refresh(credits)
    assert credits.purchased_credits == 20_000

    history = (await client.get("/v1/billing/payments", headers=admin_headers)).json()["data"]
    assert [(p["kind"], p["amount_usd"]) for p in history] == [("topup", 40.0)]


async def test_unknown_pack_and_recruiters_are_refused(client, fake_stripe, admin_headers, recruiter_headers):
    assert (await client.post("/v1/billing/checkout/topup", headers=admin_headers, json={"credits": 7})).status_code == 400
    assert (await client.post("/v1/billing/checkout/topup", headers=recruiter_headers, json={"credits": 5000})).status_code == 403


async def test_admin_cant_confirm_another_orgs_session(client, fake_stripe, admin_user, admin_headers, other_org_admin, other_org_admin_headers):
    sid = (await client.post("/v1/billing/checkout/topup", headers=admin_headers, json={"credits": 5000})).json()["data"]["url"].rsplit("/", 1)[1]
    res = await client.post("/v1/billing/checkout/confirm", headers=other_org_admin_headers, json={"session_id": sid})
    assert res.status_code == 404


async def test_abandoned_checkout_expires(client, db_session, fake_stripe, organization, admin_user, admin_headers):
    sid = (await client.post("/v1/billing/checkout/topup", headers=admin_headers, json={"credits": 5000})).json()["data"]["url"].rsplit("/", 1)[1]
    await _webhook(client, "checkout.session.expired", {**fake_stripe.sessions[sid], "status": "expired"})
    payment = (await db_session.execute(select(Payment).where(Payment.stripe_session_id == sid))).scalar_one()
    await db_session.refresh(payment)
    assert payment.status == "expired"


async def test_without_stripe_checkout_is_unavailable(client, subscription, admin_headers, monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", "")
    assert (await client.post("/v1/billing/checkout/topup", headers=admin_headers, json={"credits": 5000})).status_code == 503
    overview = (await client.get("/v1/billing", headers=admin_headers)).json()["data"]
    assert overview["payments_enabled"] is False and overview["seat_prices_now"] is None


# ── Renewals ─────────────────────────────────────────────────────────────────

async def test_renewal_extends_the_term_once(client, db_session, fake_stripe, subscription, admin_user):
    subscription.stripe_subscription_id = "sub_renewing"
    await db_session.commit()
    start = int(time.time()) + 15 * 86400
    invoice = {
        "id": "in_1", "billing_reason": "subscription_cycle", "amount_paid": 6900, "currency": "usd",
        "hosted_invoice_url": "https://invoice.stripe.test/in_1",
        # Newer API versions: the subscription is under parent.subscription_details.
        "parent": {"subscription_details": {"subscription": "sub_renewing"}},
        "lines": {"data": [{"period": {"start": start, "end": start + 30 * 86400}}]},
    }
    await _webhook(client, "invoice.paid", invoice)
    await _webhook(client, "invoice.paid", invoice)
    await db_session.refresh(subscription)
    assert int(subscription.current_period_end.timestamp()) == start + 30 * 86400
    renewals = (await db_session.execute(select(Payment).where(Payment.kind == "renewal"))).scalars().all()
    assert len(renewals) == 1 and renewals[0].amount_usd == 69.0


async def test_failed_renewal_and_cancellation(client, db_session, fake_stripe, subscription):
    subscription.stripe_subscription_id = "sub_x"
    await db_session.commit()
    await _webhook(client, "invoice.payment_failed", {"id": "in_2", "subscription": "sub_x"})
    await db_session.refresh(subscription)
    assert subscription.status == "past_due"
    await _webhook(client, "customer.subscription.deleted", {"id": "sub_x"})
    await db_session.refresh(subscription)
    assert subscription.status == "expired" and subscription.stripe_subscription_id is None


async def test_webhook_rejects_bad_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_real")
    res = await client.post("/v1/stripe/webhook", content=b'{"type": "invoice.paid"}', headers={"stripe-signature": "t=1,v1=forged"})
    assert res.status_code == 400
