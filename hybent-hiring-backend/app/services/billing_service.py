"""Subscription plans, seats and plan assignment, shared by the super-admin
and the organization-admin billing endpoints."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.super_admin import CompanySubscription, SubscriptionPlan
from app.models.user import User

BILLING_CYCLE_FOR_TERM = {1: "monthly", 6: "6_months", 12: "yearly"}
DEFAULT_PLAN_NAME = "Standard"
PLAN_REQUEST_EMAIL = "info@hybent.com"

# Extra seats bought on top of the plan's 1 admin + 2 recruiters, per role:
# (price per month in USD, AI credits added to the monthly pool).
EXTRA_SEATS = {
    "admin": (15.0, 1_500),
    "recruiter": (10.0, 1_000),
}

# Roles that take a paid seat. Interviewers and candidates don't.
SEAT_ROLES = ("admin", "recruiter")


def extra_seat_counts(sub: CompanySubscription | None) -> dict[str, int]:
    return {
        "admin": (sub.extra_admin_seats or 0) if sub else 0,
        "recruiter": (sub.extra_recruiter_seats or 0) if sub else 0,
    }


def extra_seat_credits(sub: CompanySubscription | None) -> int:
    counts = extra_seat_counts(sub)
    return sum(EXTRA_SEATS[role][1] * n for role, n in counts.items())


def extra_seat_pricing() -> dict[str, dict]:
    return {role: {"price_usd": price, "ai_credits": credits} for role, (price, credits) in EXTRA_SEATS.items()}

# Advertised on hybent.com/pricing. Monthly rates are rounded to whole
# dollars ($66 is 4.3% off $69), so the badge uses the advertised figure.
ADVERTISED_DISCOUNT_PCT = {6: 5, 12: 10}


def billed_label(plan: SubscriptionPlan) -> str:
    if plan.term_months is None:
        return "Custom pricing"
    total = plan.price_monthly * plan.term_months
    if plan.term_months == 1:
        return f"Billed ${total:,.0f} monthly"
    if plan.term_months == 12:
        return f"Billed ${total:,.0f} per year"
    return f"Billed ${total:,.0f} every {plan.term_months} months"


def plan_to_dict(plan: SubscriptionPlan, standard_price: float | None = None) -> dict:
    discount = None
    if standard_price and plan.term_months and plan.price_monthly < standard_price:
        discount = ADVERTISED_DISCOUNT_PCT.get(
            plan.term_months, round((1 - plan.price_monthly / standard_price) * 100)
        )
    return {
        "id": str(plan.id),
        "name": plan.name,
        "term_months": plan.term_months,
        "is_custom": plan.term_months is None,
        "price_monthly": plan.price_monthly,
        "currency": plan.currency,
        "billed_amount": plan.price_monthly * plan.term_months if plan.term_months else None,
        "billed_label": billed_label(plan),
        "discount_pct": discount,
        "included_admins": plan.included_admins,
        "included_recruiters": plan.included_recruiters,
        "ai_credits_monthly": plan.ai_credits_monthly,
    }


async def list_plans(db: AsyncSession) -> list[SubscriptionPlan]:
    return list((await db.execute(
        select(SubscriptionPlan).order_by(SubscriptionPlan.sort_order, SubscriptionPlan.name)
    )).scalars().all())


def standard_price(plans: list[SubscriptionPlan]) -> float | None:
    monthly = [p.price_monthly for p in plans if p.term_months == 1]
    return monthly[0] if monthly else None


async def find_plan(db: AsyncSession, name: str) -> SubscriptionPlan | None:
    return (await db.execute(
        select(SubscriptionPlan).where(func.lower(SubscriptionPlan.name) == name.strip().lower())
    )).scalar_one_or_none()


async def seat_usage(db: AsyncSession, organization_id: uuid.UUID) -> dict[str, int]:
    rows = (await db.execute(
        select(User.role, func.count())
        .where(User.organization_id == organization_id, User.is_active.is_(True))
        .group_by(User.role)
    )).all()
    counts = {getattr(role, "value", role): n for role, n in rows}
    return {
        "admins": counts.get("admin", 0),
        "recruiters": counts.get("recruiter", 0),
    }


def monthly_revenue(plan: SubscriptionPlan, sub: CompanySubscription | None) -> float:
    """Per-month rate for the plan's term plus extra seats."""
    counts = extra_seat_counts(sub)
    return plan.price_monthly + sum(EXTRA_SEATS[role][0] * n for role, n in counts.items())


def seats_summary(plan: SubscriptionPlan, sub: CompanySubscription | None, used: dict[str, int]) -> dict[str, int]:
    """Seats per role: the plan's included ones plus that role's extra seats.
    An admin can't use a recruiter seat or the other way round."""
    extra = extra_seat_counts(sub)
    admins_allowed = plan.included_admins + extra["admin"]
    recruiters_allowed = plan.included_recruiters + extra["recruiter"]
    return {
        "included_admins": plan.included_admins,
        "included_recruiters": plan.included_recruiters,
        "extra_admin_seats": extra["admin"],
        "extra_recruiter_seats": extra["recruiter"],
        "admins_allowed": admins_allowed,
        "recruiters_allowed": recruiters_allowed,
        "admins_over": max(0, used.get("admins", 0) - admins_allowed),
        "recruiters_over": max(0, used.get("recruiters", 0) - recruiters_allowed),
    }


async def ensure_seat_available(
    db: AsyncSession, organization_id: uuid.UUID, role: str, previous_role: str | None = None
) -> None:
    """Raise if giving someone `role` (a new member, or an existing one moving
    from `previous_role`) would need more seats than the organization has.
    Organizations without a plan aren't limited."""
    from fastapi import HTTPException

    role = getattr(role, "value", role)
    previous_role = getattr(previous_role, "value", previous_role)
    if role not in SEAT_ROLES or role == previous_role:
        return
    sub = (await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == organization_id)
    )).scalar_one_or_none()
    if not sub or not sub.plan:
        return

    used = await seat_usage(db, organization_id)
    used[f"{role}s"] += 1
    if previous_role in SEAT_ROLES:
        used[f"{previous_role}s"] -= 1
    summary = seats_summary(sub.plan, sub, used)
    if summary[f"{role}s_over"] > 0:
        price = EXTRA_SEATS[role][0]
        raise HTTPException(
            status_code=402,
            detail=(
                f"No {role} seat available. All {summary[f'{role}s_allowed']} {role} seat(s) on your plan are in use. "
                f"Request an extra {role} seat (${price:,.0f}/month) from the Billing page."
            ),
        )


def assign_plan(sub: CompanySubscription, plan: SubscriptionPlan) -> None:
    """Move a subscription onto `plan`, starting a new term today."""
    now = datetime.now(timezone.utc)
    changed = sub.plan_id != plan.id
    sub.plan_id = plan.id
    sub.billing_cycle = BILLING_CYCLE_FOR_TERM.get(plan.term_months, "custom")
    if changed or not sub.current_period_end:
        sub.current_period_start = now
        sub.current_period_end = now + timedelta(days=30 * (plan.term_months or 1))
