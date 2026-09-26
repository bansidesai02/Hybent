"""Plans and billing: the org admin's view and change requests, and the
super admin assigning plans and seats."""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.super_admin import CompanySubscription, SubscriptionPlan
from app.services import billing_service


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
    sub = CompanySubscription(organization_id=organization.id, plan_id=plans["Standard"].id, status="active")
    billing_service.assign_plan(sub, plans["Standard"])
    db_session.add(sub)
    await db_session.commit()
    return sub


def test_billed_labels(plans):
    assert billing_service.billed_label(plans["Standard"]) == "Billed $69 monthly"
    assert billing_service.billed_label(plans["6 months"]) == "Billed $396 every 6 months"
    assert billing_service.billed_label(plans["12 months"]) == "Billed $744 per year"
    assert billing_service.billed_label(plans["Custom"]) == "Custom pricing"


def test_discount_against_standard(plans):
    d = billing_service.plan_to_dict(plans["12 months"], standard_price=69.0)
    assert d["discount_pct"] == 10
    # $66 is 4.3% off, but the published discount is 5%.
    assert billing_service.plan_to_dict(plans["6 months"], standard_price=69.0)["discount_pct"] == 5


async def test_admin_sees_plan_seats_and_credits(client, admin_user, recruiter_user, admin_headers, subscription):
    res = await client.get("/v1/billing", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["subscription"]["plan"]["name"] == "Standard"
    assert data["subscription"]["seats"] == {
        "included_admins": 1, "included_recruiters": 2,
        "extra_admin_seats": 0, "extra_recruiter_seats": 0,
        "admins_allowed": 1, "recruiters_allowed": 2,
        "admins_over": 0, "recruiters_over": 0,
    }
    assert data["seats_used"]["admins"] == 1 and data["seats_used"]["recruiters"] == 1
    assert "interviewers" not in data["seats_used"]
    assert data["extra_seats"] == {
        "admin": {"price_usd": 15.0, "ai_credits": 1500},
        "recruiter": {"price_usd": 10.0, "ai_credits": 1000},
    }
    assert data["monthly_total_usd"] == 69.0
    assert data["ai_credits"]["monthly"] == 10_000
    assert [p["name"] for p in data["plans"]] == ["Standard", "6 months", "12 months", "Custom"]


async def test_admin_without_plan_still_sees_options(client, admin_headers, plans):
    res = await client.get("/v1/billing", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["data"]["subscription"] is None
    assert len(res.json()["data"]["plans"]) == 4


async def test_billing_is_admin_only(client, recruiter_headers, plans):
    assert (await client.get("/v1/billing", headers=recruiter_headers)).status_code == 403
    assert (await client.post("/v1/billing/request-change", headers=recruiter_headers, json={"plan_name": "Custom"})).status_code == 403


async def test_change_request_emails_hybent(client, admin_headers, subscription, monkeypatch):
    import app.routers.billing as billing_router
    sent = []
    monkeypatch.setattr(billing_router, "send_email", lambda to, subject, body: sent.append((to, body)) or True)

    assert (await client.post("/v1/billing/request-change", headers=admin_headers, json={})).status_code == 400
    assert (await client.post("/v1/billing/request-change", headers=admin_headers, json={"plan_name": "Gold"})).status_code == 400
    assert (await client.post("/v1/billing/request-change", headers=admin_headers, json={"extra_admin_seats": -1})).status_code == 400

    res = await client.post(
        "/v1/billing/request-change", headers=admin_headers,
        json={"plan_name": "12 months", "extra_admin_seats": 1, "extra_recruiter_seats": 3, "note": "Growing team"},
    )
    assert res.status_code == 200
    assert sent[0][0] == "info@hybent.com"
    body = sent[0][1]
    assert "12 months" in body and "Growing team" in body
    assert "Extra admin seats: 0 → <b>1</b> ($15/month" in body
    assert "Extra recruiter seats: 0 → <b>3</b> ($10/month" in body


async def test_super_admin_assigns_plan_and_seats(client, db_session, organization, subscription, super_admin_headers):
    res = await client.put(
        f"/v1/super-admin/clients/{organization.id}", headers=super_admin_headers,
        json={"plan_name": "12 months", "extra_admin_seats": 1, "extra_recruiter_seats": 2},
    )
    assert res.status_code == 200
    await db_session.refresh(subscription)
    plan = await db_session.get(SubscriptionPlan, subscription.plan_id)
    assert plan.name == "12 months"
    assert subscription.billing_cycle == "yearly"
    assert (subscription.extra_admin_seats, subscription.extra_recruiter_seats) == (1, 2)

    # 1 admin seat (+1,500, +$15) and 2 recruiter seats (+2,000, +$20).
    from app.models.organization_ai_credits import OrganizationAICredits
    pool = (await db_session.execute(
        select(OrganizationAICredits).where(OrganizationAICredits.organization_id == organization.id)
    )).scalar_one()
    await db_session.refresh(pool)
    assert pool.allowed_credits == 13_500
    clients = (await client.get("/v1/super-admin/clients", headers=super_admin_headers)).json()["data"]
    row = next(c for c in clients if c["id"] == str(organization.id))
    assert row["mrr"] == 62.0 + 15.0 + 20.0
    assert (row["extra_admin_seats"], row["extra_recruiter_seats"]) == (1, 2)

    listing = await client.get("/v1/super-admin/plans", headers=super_admin_headers)
    by_name = {p["name"]: p for p in listing.json()["data"]}
    assert by_name["12 months"]["subscribers"] == 1
    assert by_name["Standard"]["subscribers"] == 0


async def test_super_admin_rejects_unknown_plan(client, organization, subscription, super_admin_headers):
    res = await client.put(
        f"/v1/super-admin/clients/{organization.id}", headers=super_admin_headers, json={"plan_name": "Pro"},
    )
    assert res.status_code == 400


# ── Seats ────────────────────────────────────────────────────────────────────

def _invite(role):
    return {"email": f"{role}-{uuid.uuid4().hex[:6]}@example.com", "full_name": f"New {role}", "role": role}


async def test_seats_block_members_beyond_plan(client, admin_user, recruiter_user, second_recruiter_user, admin_headers, subscription):
    # 1 admin + 2 recruiters: the plan's seats are full.
    res = await client.post("/v1/users/invite", headers=admin_headers, json=_invite("recruiter"))
    assert res.status_code == 402
    assert "No recruiter seat available" in res.json()["message"]
    assert "$10/month" in res.json()["message"]
    res = await client.post("/v1/users/invite", headers=admin_headers, json=_invite("admin"))
    assert res.status_code == 402
    assert "No admin seat available" in res.json()["message"]
    assert "$15/month" in res.json()["message"]
    # Interviewers never need a seat.
    res = await client.post("/v1/users/invite", headers=admin_headers, json=_invite("interviewer"))
    assert res.status_code == 200


async def test_extra_seats_are_per_role(client, db_session, admin_user, recruiter_user, second_recruiter_user, admin_headers, subscription):
    subscription.extra_admin_seats = 1
    await db_session.commit()

    # An extra admin seat takes an admin...
    assert (await client.post("/v1/users/invite", headers=admin_headers, json=_invite("admin"))).status_code == 200
    # ...but not a recruiter, and only one.
    assert (await client.post("/v1/users/invite", headers=admin_headers, json=_invite("recruiter"))).status_code == 402
    assert (await client.post("/v1/users/invite", headers=admin_headers, json=_invite("admin"))).status_code == 402

    subscription.extra_recruiter_seats = 1
    await db_session.commit()
    assert (await client.post("/v1/users/invite", headers=admin_headers, json=_invite("recruiter"))).status_code == 200


async def test_role_change_needs_a_seat(client, db_session, admin_user, recruiter_user, second_recruiter_user, admin_headers, subscription):
    res = await client.post("/v1/users/invite", headers=admin_headers, json=_invite("interviewer"))
    interviewer_id = res.json()["data"]["id"]

    blocked = await client.put(f"/v1/users/{interviewer_id}", headers=admin_headers, json={"role": "admin"})
    assert blocked.status_code == 402

    # Swapping a recruiter to admin is seat-neutral only if an admin seat is free — it isn't.
    swap = await client.put(f"/v1/users/{recruiter_user.id}", headers=admin_headers, json={"role": "admin"})
    assert swap.status_code == 402
    # Renaming someone doesn't touch seats.
    assert (await client.put(f"/v1/users/{recruiter_user.id}", headers=admin_headers, json={"full_name": "Renamed"})).status_code == 200


async def test_seat_summary_is_per_role(plans):
    sub = CompanySubscription(extra_admin_seats=1, extra_recruiter_seats=1)
    summary = billing_service.seats_summary(plans["Standard"], sub, {"admins": 2, "recruiters": 3})
    assert (summary["admins_allowed"], summary["recruiters_allowed"]) == (2, 3)
    assert summary["admins_over"] == 0 and summary["recruiters_over"] == 0
    # A spare recruiter seat doesn't cover a third admin.
    summary = billing_service.seats_summary(plans["Standard"], sub, {"admins": 3, "recruiters": 2})
    assert summary["admins_over"] == 1 and summary["recruiters_over"] == 0
