"""AI credit metering: pricing, pool/limit accounting, the central meter, and
the credit endpoints."""
import time
import types
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.ai_usage import AIUsage
from app.models.organization_ai_credits import OrganizationAICredits
from app.models.user_ai_credits import UserAICredits
from app.services import ai_metering, ai_pricing
from app.services.ai_credit_service import AICreditsService, daily_limit_for
from app.utils.exceptions import InsufficientCreditsException
from tests.conftest import auth_headers


@pytest.fixture(autouse=True)
def _no_celery(monkeypatch):
    """Alerts enqueue Celery tasks; tests don't need a broker."""
    import app.services.ai_credit_service as svc
    import app.tasks.notifications as notifications
    fake = types.SimpleNamespace(delay=lambda *a, **k: None)
    monkeypatch.setattr(svc, "notify_organization_roles", fake)
    monkeypatch.setattr(notifications, "notify_organization_roles", fake)
    ai_metering._blocked.clear()
    yield
    ai_metering._blocked.clear()


# ── Pricing ──────────────────────────────────────────────────────────────────

def test_credit_is_a_tenth_of_a_cent_sold_at_double():
    assert ai_pricing.CREDIT_PRICE_USD == 2 * ai_pricing.CREDIT_COST_USD


def test_credits_round_up_and_never_zero():
    assert ai_pricing.credits_for_cost(0) == 1
    assert ai_pricing.credits_for_cost(0.0001) == 1
    assert ai_pricing.credits_for_cost(0.001) == 1
    assert ai_pricing.credits_for_cost(0.0011) == 2
    assert ai_pricing.credits_for_cost(0.0042) == 5


def test_text_cost_uses_model_price():
    # gpt-oss-120b: $0.15 in / $0.60 out per 1M tokens
    cost = ai_pricing.text_cost_usd("openai/gpt-oss-120b", 4000, 1500)
    assert cost == pytest.approx(4000 * 0.15 / 1e6 + 1500 * 0.60 / 1e6)
    assert ai_pricing.text_cost_usd("models/gemini-2.5-flash", 1000, 0) == pytest.approx(0.0003)


def test_unknown_model_charged_at_default_rate():
    assert ai_pricing.text_cost_usd("some-new-model", 1_000_000, 0) == pytest.approx(ai_pricing.DEFAULT_TEXT_PRICE[0])


def test_audio_has_ten_second_minimum():
    assert ai_pricing.audio_cost_usd("whisper-large-v3", 2) == pytest.approx(10 / 3600 * 0.111)
    assert ai_pricing.audio_cost_usd("whisper-large-v3-turbo", 360) == pytest.approx(0.1 * 0.04)


# ── Pools and limits ─────────────────────────────────────────────────────────

async def test_new_org_gets_ten_thousand_credits(db_session, organization):
    pool = await AICreditsService.get_or_create_org_credits(db_session, organization.id)
    assert pool.allowed_credits == 10_000
    assert pool.used_credits == 0
    assert pool.purchased_credits == 0


async def test_user_defaults_follow_role(db_session, organization, admin_user, recruiter_user, super_admin_user):
    admin_row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, admin_user.id)
    rec_row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, recruiter_user.id)
    assert admin_row.monthly_limit == 1_000
    assert rec_row.monthly_limit == 4_500
    assert await AICreditsService.get_or_create_user_credits(db_session, organization.id, super_admin_user.id) is None


async def test_interviewers_and_candidates_get_no_ai(db_session, organization):
    from tests.conftest import _make_user
    interviewer = await _make_user(db_session, organization, "interviewer")
    candidate = await _make_user(db_session, organization, "candidate")
    for u in (interviewer, candidate):
        assert await AICreditsService.get_or_create_user_credits(db_session, organization.id, u.id) is None
        with pytest.raises(InsufficientCreditsException, match="admins and recruiters"):
            await AICreditsService.check_credits_available(db_session, organization.id, "x", user_id=u.id)


async def test_meter_refuses_interviewer_scope(monkeypatch):
    from app.services import groq_client
    monkeypatch.setattr(groq_client, "Groq", _FakeGroqClient)
    ai_metering.bind_request_scope(uuid.uuid4(), uuid.uuid4(), "interviewer")
    try:
        with pytest.raises(InsufficientCreditsException):
            groq_client.SafeGroq().chat.completions.create(model="openai/gpt-oss-120b", messages=[])
    finally:
        ai_metering._scope.set(None)


async def test_extra_seat_adds_credits_and_caps_new_limit(db_session, organization, admin_user, recruiter_user, second_recruiter_user):
    from app.models.super_admin import CompanySubscription, SubscriptionPlan
    from app.services import billing_service
    from tests.conftest import _make_user
    plan = SubscriptionPlan(name="Standard", term_months=1, price_monthly=69.0, price_yearly=828.0)
    db_session.add(plan)
    await db_session.flush()
    sub = CompanySubscription(
        organization_id=organization.id, plan_id=plan.id, status="active",
        extra_admin_seats=1, extra_recruiter_seats=1,
    )
    billing_service.assign_plan(sub, plan)
    db_session.add(sub)
    await db_session.commit()

    # 10,000 + 1,500 (admin seat) + 1,000 (recruiter seat)
    pool = await AICreditsService.get_or_create_org_credits(db_session, organization.id)
    assert pool.allowed_credits == 12_500
    for u in (admin_user, recruiter_user, second_recruiter_user):
        await AICreditsService.get_or_create_user_credits(db_session, organization.id, u.id)

    # Members beyond the included seats get their extra seat's credits.
    third_recruiter = await _make_user(db_session, organization, "recruiter")
    row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, third_recruiter.id)
    assert row.monthly_limit == 1_000
    second_admin = await _make_user(db_session, organization, "admin")
    row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, second_admin.id)
    assert row.monthly_limit == 1_500
    # $69 + $15 + $10
    assert billing_service.monthly_revenue(plan, sub) == 94.0


async def test_charge_prices_real_usage_and_logs_it(db_session, organization, recruiter_user):
    credits = await AICreditsService.charge(
        db_session, organization_id=organization.id, user_id=recruiter_user.id,
        feature="resume_parsing", provider="groq", model="openai/gpt-oss-120b",
        prompt_tokens=4000, completion_tokens=1500,
    )
    # $0.0015 → 2 credits
    assert credits == 2
    pool = await AICreditsService.get_or_create_org_credits(db_session, organization.id)
    assert pool.used_credits == 2
    row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, recruiter_user.id)
    assert row.used_credits == 2 and row.daily_used == 2
    usage = (await db_session.execute(select(AIUsage))).scalars().one()
    assert usage.credits_used == 2
    assert usage.cost == pytest.approx(0.0015)
    assert usage.feature == "resume_parsing"


async def test_monthly_credits_spent_before_purchased(db_session, organization):
    pool = await AICreditsService.get_or_create_org_credits(db_session, organization.id)
    pool.used_credits = 9_998
    pool.purchased_credits = 100
    await db_session.commit()

    await AICreditsService.charge(
        db_session, organization_id=organization.id, user_id=None, feature="x",
        provider="groq", model="openai/gpt-oss-120b", cost_usd=0.005,  # 5 credits
    )
    await db_session.refresh(pool)
    assert pool.used_credits == 10_000   # 2 from the monthly allowance
    assert pool.purchased_credits == 97  # 3 from the top-up


async def test_check_blocks_when_org_pool_spent(db_session, organization):
    pool = await AICreditsService.get_or_create_org_credits(db_session, organization.id)
    pool.used_credits = pool.allowed_credits
    await db_session.commit()
    with pytest.raises(InsufficientCreditsException):
        await AICreditsService.check_credits_available(db_session, organization.id, "resume_parsing")

    pool.purchased_credits = 50
    await db_session.commit()
    await AICreditsService.check_credits_available(db_session, organization.id, "resume_parsing")


async def test_check_blocks_user_over_monthly_limit(db_session, organization, recruiter_user):
    row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, recruiter_user.id)
    row.used_credits = row.monthly_limit
    await db_session.commit()
    with pytest.raises(InsufficientCreditsException, match="monthly AI credit limit"):
        await AICreditsService.check_credits_available(db_session, organization.id, "x", user_id=recruiter_user.id)


async def test_check_blocks_user_over_daily_limit(db_session, organization, recruiter_user):
    row = await AICreditsService.get_or_create_user_credits(db_session, organization.id, recruiter_user.id)
    row.daily_used = daily_limit_for(row.monthly_limit)
    row.daily_date = datetime.now(timezone.utc).date()
    await db_session.commit()
    with pytest.raises(InsufficientCreditsException, match="today's AI credit limit"):
        await AICreditsService.check_credits_available(db_session, organization.id, "x", user_id=recruiter_user.id)

    # Yesterday's usage doesn't count against today.
    row.daily_date = date.today() - timedelta(days=2)
    await db_session.commit()
    await AICreditsService.check_credits_available(db_session, organization.id, "x", user_id=recruiter_user.id)


# ── Central meter ────────────────────────────────────────────────────────────

class _FakeGroqClient:
    def __init__(self, api_key=None, **kwargs):
        usage = types.SimpleNamespace(prompt_tokens=1200, completion_tokens=300)
        response = types.SimpleNamespace(usage=usage, model="openai/gpt-oss-120b", choices=[])
        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=lambda *a, **k: response)
        )


async def test_groq_calls_are_charged_to_the_scope(monkeypatch):
    from app.services import groq_client

    charged = []

    async def fake_charge(db, **kwargs):
        charged.append(kwargs)
        return 1

    async def no_refresh(scope):
        return None

    monkeypatch.setattr(groq_client, "Groq", _FakeGroqClient)
    monkeypatch.setattr(groq_client, "_ordered_keys", lambda: ["gsk_test"])
    monkeypatch.setattr(AICreditsService, "charge", staticmethod(fake_charge))
    monkeypatch.setattr(ai_metering, "_refresh_blocks", no_refresh)

    org_id, user_id = uuid.uuid4(), uuid.uuid4()
    async with ai_metering.ai_scope(org_id, user_id):
        with ai_metering.feature("resume_parsing"):
            groq_client.SafeGroq().chat.completions.create(model="openai/gpt-oss-120b", messages=[])

    assert len(charged) == 1
    c = charged[0]
    assert c["organization_id"] == org_id and c["user_id"] == user_id
    assert c["feature"] == "resume_parsing"
    assert (c["prompt_tokens"], c["completion_tokens"]) == (1200, 300)


async def test_calls_refused_once_pool_known_spent(monkeypatch):
    from app.services import groq_client

    monkeypatch.setattr(groq_client, "Groq", _FakeGroqClient)
    org_id = uuid.uuid4()
    ai_metering.mark_blocked("org", org_id, "out of credits")
    async with ai_metering.ai_scope(org_id):
        with pytest.raises(InsufficientCreditsException):
            groq_client.SafeGroq().chat.completions.create(model="openai/gpt-oss-120b", messages=[])

    ai_metering.clear_blocked(organization_id=org_id)
    async with ai_metering.ai_scope(org_id):
        ai_metering.ensure_not_blocked()


async def test_blocks_expire(monkeypatch):
    org_id = uuid.uuid4()
    ai_metering.mark_blocked("org", org_id, "out", until=time.time() - 1)
    async with ai_metering.ai_scope(org_id):
        ai_metering.ensure_not_blocked()


async def test_ai_feature_decorator_names_calls():
    seen = []

    @ai_metering.ai_feature("jd_generation")
    async def work():
        seen.append(ai_metering.current_feature())

    await work()
    assert seen == ["jd_generation"]
    assert ai_metering.current_feature() == "general"


# ── Endpoints ────────────────────────────────────────────────────────────────

async def test_balance_reports_pool_and_my_limit(client, recruiter_user, recruiter_headers):
    res = await client.get("/v1/ai/credits/balance", headers=recruiter_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["allowed_credits"] == 10_000
    assert data["remaining_credits"] == 10_000
    assert data["my"]["monthly_limit"] == 4_500
    assert data["my"]["daily_limit"] == 900
    assert [p["credits"] for p in data["topup_packs"]] == [5_000, 20_000, 50_000]


async def test_buy_no_longer_adds_free_credits(client, db_session, organization, admin_headers):
    res = await client.post("/v1/ai/credits/buy", headers=admin_headers, json={"amount": 100000})
    assert res.status_code == 410
    pool = (await db_session.execute(select(OrganizationAICredits))).scalars().first()
    assert pool is None or pool.allowed_credits == 10_000


async def test_topup_request_is_admin_only(client, recruiter_headers, admin_headers, monkeypatch):
    import app.routers.ai as ai_router
    sent = []
    monkeypatch.setattr(ai_router, "send_email", lambda to, subject, body: sent.append((to, subject)) or True)

    assert (await client.post("/v1/ai/credits/request-topup", headers=recruiter_headers, json={"credits": 5000})).status_code == 403
    assert (await client.post("/v1/ai/credits/request-topup", headers=admin_headers, json={"credits": 1234})).status_code == 400
    res = await client.post("/v1/ai/credits/request-topup", headers=admin_headers, json={"credits": 20000})
    assert res.status_code == 200
    assert sent and sent[0][0] == "info@hybent.com"


async def test_admin_sets_limits_within_pool(client, admin_user, recruiter_user, admin_headers):
    listing = await client.get("/v1/ai/credits/users", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["data"]["allocated"] == 1_000 + 4_500

    ok = await client.put(f"/v1/ai/credits/users/{recruiter_user.id}", headers=admin_headers, json={"monthly_limit": 8_000})
    assert ok.status_code == 200

    too_much = await client.put(f"/v1/ai/credits/users/{recruiter_user.id}", headers=admin_headers, json={"monthly_limit": 9_500})
    assert too_much.status_code == 400

    # Lowering is always allowed.
    lower = await client.put(f"/v1/ai/credits/users/{recruiter_user.id}", headers=admin_headers, json={"monthly_limit": 2_000})
    assert lower.status_code == 200


async def test_lowering_allowed_when_defaults_exceed_pool(
    client, admin_user, recruiter_user, second_recruiter_user, admin_headers
):
    # 1,000 + 4,500 + 4,500 + a third recruiter would pass 10,000; simulate by
    # listing (creates rows) then checking a decrease still works.
    await client.get("/v1/ai/credits/users", headers=admin_headers)
    res = await client.put(f"/v1/ai/credits/users/{recruiter_user.id}", headers=admin_headers, json={"monthly_limit": 4_000})
    assert res.status_code == 200


async def test_admin_cannot_touch_other_org_users(client, admin_headers, other_org_admin):
    res = await client.put(f"/v1/ai/credits/users/{other_org_admin.id}", headers=admin_headers, json={"monthly_limit": 10})
    assert res.status_code == 404


async def test_super_admin_adds_topup_and_custom_allowance(client, db_session, organization, super_admin_headers, admin_headers):
    res = await client.put(
        f"/v1/super-admin/organizations/{organization.id}/ai-credits",
        headers=super_admin_headers, json={"monthly_credits": 25_000, "add_purchased": 5_000},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["monthly_credits"] == 25_000 and data["purchased_credits"] == 5_000

    assert (await client.put(
        f"/v1/super-admin/organizations/{organization.id}/ai-credits",
        headers=admin_headers, json={"add_purchased": 1},
    )).status_code == 403

    listing = await client.get("/v1/super-admin/ai-credits", headers=super_admin_headers)
    assert listing.status_code == 200
    assert any(i["organization_id"] == str(organization.id) for i in listing.json()["data"])
