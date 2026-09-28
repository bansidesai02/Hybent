"""Stripe payments for plans, extra seats and AI credit top-ups.

- Plans are sold after a demo, not self-serve. A super admin creates a
  payment link for a client (plan + extra admin/recruiter seats), and the
  client pays it on /pay/<token> with Stripe Checkout. For published plans
  that starts a Stripe subscription renewing every term; a Custom plan is a
  one-off payment for its term. Paying activates the organization and its
  admin, who gets an email to set their password.
- Org admins buy extra seats themselves, paying for the rest of the current
  term; the seats are added to the Stripe subscription so later renewals
  include them. They buy AI credit top-ups the same way.
- Stripe reports each payment by webhook, and returning from Checkout checks
  the session too, so a slow webhook doesn't keep anyone waiting.
  fulfill_session applies each payment exactly once, whichever comes first.
"""
import asyncio
import html
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.organization import Organization
from app.models.password_reset import PasswordResetToken
from app.models.payment import Payment
from app.models.super_admin import CompanySubscription, SubscriptionPlan
from app.models.user import User
from app.services import billing_service, stripe_gateway
from app.services.ai_credit_service import TOPUP_PACKS, AICreditsService
from app.services.email_service import send_email
from app.tasks.notifications import notify_organization_roles

logger = logging.getLogger(__name__)

# A client's payment link stays usable this long; Checkout sessions behind
# it are created on demand, so Stripe's 24-hour session expiry doesn't matter.
PAY_LINK_VALID_DAYS = 30
# How long the new admin's set-password link lasts.
WELCOME_LINK_VALID_DAYS = 7
# Stripe won't charge less than $0.50.
MIN_CHARGE_USD = 0.50
CUSTOM_TERMS = (1, 6, 12)
SEAT_ITEM = {"admin": "admin_seat", "recruiter": "recruiter_seat"}


def require_stripe() -> None:
    if not settings.stripe_enabled:
        raise HTTPException(
            status_code=503,
            detail="Online payments aren't available right now. Please email info@hybent.com.",
        )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cents(usd: float) -> int:
    return int(round(usd * 100))


def _term_label(months: int) -> str:
    return {1: "month", 6: "6 months", 12: "year"}.get(months, f"{months} months")


def _seat_phrase(role: str, n: int) -> str:
    return f"{n} extra {role} seat{'' if n == 1 else 's'}"


# ── Pricing ──────────────────────────────────────────────────────────────────

def subscription_quote(
    plan: SubscriptionPlan,
    extra_admin_seats: int = 0,
    extra_recruiter_seats: int = 0,
    custom_amount_usd: float | None = None,
    custom_term_months: int | None = None,
) -> dict:
    """What a subscription link charges each term: the plan's term price plus
    each extra seat's monthly price times the term. A Custom plan is priced
    by sales, so it takes an agreed amount and term instead."""
    seats = {"admin": extra_admin_seats, "recruiter": extra_recruiter_seats}
    for role, n in seats.items():
        if not isinstance(n, int) or isinstance(n, bool) or not 0 <= n <= billing_service.MAX_EXTRA_SEATS:
            raise HTTPException(status_code=400, detail=f"Extra {role} seats must be between 0 and {billing_service.MAX_EXTRA_SEATS}.")

    if plan.term_months is None:
        if custom_term_months not in CUSTOM_TERMS:
            raise HTTPException(status_code=400, detail="Choose a term of 1, 6 or 12 months for a Custom plan.")
        if not custom_amount_usd or custom_amount_usd < MIN_CHARGE_USD:
            raise HTTPException(status_code=400, detail="Enter the agreed amount for the Custom plan.")
        amount = round(float(custom_amount_usd), 2)
        return {
            "term_months": custom_term_months,
            "recurring": False,
            "amount_usd": amount,
            "lines": [{"label": f"Custom plan, {_term_label(custom_term_months)}", "amount_usd": amount}],
        }

    term = plan.term_months
    lines = [{"label": f"{plan.name} plan", "amount_usd": round(plan.price_monthly * term, 2)}]
    for role, n in seats.items():
        if n:
            per_term = billing_service.EXTRA_SEATS[role][0] * term
            lines.append({"label": _seat_phrase(role, n), "amount_usd": round(per_term * n, 2), "quantity": n})
    return {
        "term_months": term,
        "recurring": True,
        "amount_usd": round(sum(line["amount_usd"] for line in lines), 2),
        "lines": lines,
    }


def seat_proration(sub: CompanySubscription | None, now: datetime | None = None) -> float | None:
    """Share of the current term still to run, or None when seats can't be
    bought online: no plan, a Custom plan (priced by sales), or a term that
    has already ended."""
    if not sub or not sub.plan or sub.plan.term_months is None or sub.status not in ("active", "past_due"):
        return None
    now = now or _now()
    start, end = sub.current_period_start, sub.current_period_end
    if not start or not end or end <= now:
        return None
    return min(1.0, (end - now) / (end - start))


def prorated_seat_prices(sub: CompanySubscription | None, now: datetime | None = None) -> dict[str, float] | None:
    """Price of one extra seat per role for the rest of the current term."""
    fraction = seat_proration(sub, now)
    if fraction is None:
        return None
    term = sub.plan.term_months
    return {
        role: round(price * term * fraction, 2)
        for role, (price, _credits) in billing_service.EXTRA_SEATS.items()
    }


# ── Creating payments ────────────────────────────────────────────────────────

def pay_url(payment: Payment) -> str:
    return f"{settings.frontend_url.rstrip('/')}/pay/{payment.token}"


async def _get_subscription(db: AsyncSession, organization_id: uuid.UUID) -> CompanySubscription | None:
    return (await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == organization_id)
    )).scalar_one_or_none()


async def _org_admin(db: AsyncSession, organization_id: uuid.UUID) -> User | None:
    return (await db.execute(
        select(User)
        .where(User.organization_id == organization_id, User.role == "admin")
        .order_by(User.created_at)
        .limit(1)
    )).scalar_one_or_none()


async def create_subscription_link(
    db: AsyncSession,
    org: Organization,
    plan: SubscriptionPlan,
    created_by: User,
    extra_admin_seats: int = 0,
    extra_recruiter_seats: int = 0,
    custom_amount_usd: float | None = None,
    custom_term_months: int | None = None,
    activate_user_id: uuid.UUID | None = None,
) -> Payment:
    """A payment link for `plan` plus extra seats, for a super admin to send
    to the client. Replaces any unpaid link the organization already has.
    `activate_user_id` is an admin created inactive with the client, who is
    activated and emailed a set-password link once it's paid."""
    require_stripe()
    quote = subscription_quote(plan, extra_admin_seats, extra_recruiter_seats, custom_amount_usd, custom_term_months)

    sub = await _get_subscription(db, org.id)
    if sub and sub.stripe_subscription_id and sub.status in ("active", "past_due"):
        raise HTTPException(
            status_code=409,
            detail="This client already has a Stripe subscription. Cancel it in Stripe before sending a new plan link.",
        )

    for old in (await db.execute(
        select(Payment).where(
            Payment.organization_id == org.id, Payment.kind == "subscription", Payment.status == "pending"
        )
    )).scalars().all():
        old.status = "canceled"
        if old.stripe_session_id:
            await stripe_gateway.expire_checkout_session(old.stripe_session_id)

    parts = [f"{plan.name} plan"]
    parts += [_seat_phrase(role, n) for role, n in (("admin", extra_admin_seats), ("recruiter", extra_recruiter_seats)) if n]
    payment = Payment(
        organization_id=org.id,
        kind="subscription",
        status="pending",
        amount_usd=quote["amount_usd"],
        currency=plan.currency or "USD",
        description=" · ".join(parts),
        details={
            "plan_name": plan.name,
            "term_months": quote["term_months"],
            "recurring": quote["recurring"],
            "extra_admin_seats": extra_admin_seats,
            "extra_recruiter_seats": extra_recruiter_seats,
            "lines": quote["lines"],
            "activate_user_id": str(activate_user_id) if activate_user_id else None,
        },
        token=secrets.token_urlsafe(32),
        created_by_id=created_by.id,
        expires_at=_now() + timedelta(days=PAY_LINK_VALID_DAYS),
    )
    db.add(payment)
    await db.flush()
    return payment


async def email_payment_link(db: AsyncSession, payment: Payment, to_email: str | None = None) -> bool:
    org = await db.get(Organization, payment.organization_id)
    if to_email is None:
        admin = await _org_admin(db, payment.organization_id)
        to_email = admin.email if admin else None
    if not to_email:
        return False
    lines = "".join(
        f"<li>{html.escape(line['label'])}: ${line['amount_usd']:,.2f}</li>" for line in payment.details.get("lines", [])
    )
    term = payment.details.get("term_months") or 1
    renews = (
        f"It renews every {_term_label(term)} until cancelled."
        if payment.details.get("recurring") else
        f"It covers {_term_label(term)}."
    )
    body = (
        f"<p>Hello,</p><p>Thanks for choosing Hybent. Here is the payment link for "
        f"<b>{html.escape(org.name if org else 'your organization')}</b>:</p>"
        f"<ul>{lines}</ul>"
        f"<p><b>Total: ${payment.amount_usd:,.2f} per {_term_label(term)}</b>. {renews}</p>"
        f"<p><a href=\"{pay_url(payment)}\">Review and pay securely with Stripe</a></p>"
        f"<p>The link is valid until {payment.expires_at:%d %B %Y}. Once it's paid, your account is "
        "activated and you'll get an email to set your password.</p>"
        "<p>Questions? Reply to this email or write to info@hybent.com.</p>"
    )
    return await asyncio.to_thread(send_email, to_email, "Your Hybent subscription: payment link", body)


def _success_url(path: str) -> str:
    sep = "&" if "?" in path else "?"
    return f"{settings.frontend_url.rstrip('/')}{path}{sep}checkout=success&session_id={{CHECKOUT_SESSION_ID}}"


def _cancel_url(path: str) -> str:
    sep = "&" if "?" in path else "?"
    return f"{settings.frontend_url.rstrip('/')}{path}{sep}checkout=canceled"


async def _customer_params(db: AsyncSession, org: Organization, mode: str) -> dict:
    if org.stripe_customer_id:
        return {"customer": org.stripe_customer_id}
    admin = await _org_admin(db, org.id)
    params = {"customer_email": admin.email} if admin else {}
    if mode == "payment":
        params["customer_creation"] = "always"
    return params


def _metadata(payment: Payment) -> dict:
    return {"payment_id": str(payment.id), "kind": payment.kind, "organization_id": str(payment.organization_id)}


async def _subscription_line_items(plan: SubscriptionPlan, details: dict) -> list[dict]:
    term = plan.term_months
    currency = plan.currency or "USD"
    slug = plan.name.lower().replace(" ", "_")
    items = [{
        "price": await stripe_gateway.recurring_price(
            f"hybent_plan_{slug}_{_cents(plan.price_monthly * term)}_{term}m",
            f"Hybent {plan.name} plan", _cents(plan.price_monthly * term), currency, term, "plan",
        ),
        "quantity": 1,
    }]
    for role in ("admin", "recruiter"):
        n = details.get(f"extra_{role}_seats") or 0
        if n:
            items.append({"price": await seat_price_id(role, term, currency), "quantity": n})
    return items


async def seat_price_id(role: str, term: int, currency: str = "USD") -> str:
    per_term = billing_service.EXTRA_SEATS[role][0] * term
    return await stripe_gateway.recurring_price(
        f"hybent_seat_{role}_{_cents(per_term)}_{term}m",
        f"Hybent extra {role} seat", _cents(per_term), currency, term, SEAT_ITEM[role],
    )


async def start_link_checkout(db: AsyncSession, payment: Payment) -> str:
    """Checkout URL for a subscription link: the open session if there is
    one, so two tabs can't start two subscriptions, or a new one."""
    require_stripe()
    if payment.status != "pending":
        raise HTTPException(status_code=409, detail="This payment link has already been used or cancelled.")
    if payment.expires_at and payment.expires_at < _now():
        raise HTTPException(status_code=410, detail="This payment link has expired. Please ask Hybent for a new one.")

    if payment.stripe_session_id:
        session = await stripe_gateway.retrieve_checkout_session(payment.stripe_session_id)
        if session.get("status") == "open" and session.get("url"):
            return session["url"]
        if session.get("status") == "complete":
            await fulfill_session(db, session)
            raise HTTPException(status_code=409, detail="This payment link has already been paid.")

    org = await db.get(Organization, payment.organization_id)
    plan = await billing_service.find_plan(db, payment.details["plan_name"])
    if not org or not plan:
        raise HTTPException(status_code=409, detail="This payment link is no longer valid. Please ask Hybent for a new one.")

    return_path = f"/pay/{payment.token}"
    params = {
        "success_url": _success_url(return_path),
        "cancel_url": _cancel_url(return_path),
        "client_reference_id": str(payment.id),
        "metadata": _metadata(payment),
        "allow_promotion_codes": True,
        "billing_address_collection": "auto",
    }
    if payment.details.get("recurring"):
        mode = "subscription"
        params["line_items"] = await _subscription_line_items(plan, payment.details)
        params["subscription_data"] = {"metadata": _metadata(payment), "description": payment.description}
    else:
        mode = "payment"
        params["line_items"] = [{
            "price_data": {
                "currency": payment.currency.lower(),
                "unit_amount": _cents(payment.amount_usd),
                "product_data": {"name": f"Hybent {payment.description}, {_term_label(payment.details['term_months'])}"},
            },
            "quantity": 1,
        }]
        params["invoice_creation"] = {"enabled": True, "invoice_data": {"metadata": _metadata(payment)}}
        params["payment_intent_data"] = {"metadata": _metadata(payment), "description": payment.description}
    params["mode"] = mode
    params.update(await _customer_params(db, org, mode))

    session = await stripe_gateway.create_checkout_session(params)
    payment.stripe_session_id = session["id"]
    await db.commit()
    return session["url"]


async def _one_off_checkout(
    db: AsyncSession, org: Organization, user: User, kind: str,
    amount_usd: float, description: str, details: dict, return_path: str,
) -> str:
    payment = Payment(
        organization_id=org.id, kind=kind, status="pending", amount_usd=amount_usd, currency="USD",
        description=description, details=details, created_by_id=user.id,
    )
    db.add(payment)
    await db.flush()
    params = {
        "mode": "payment",
        "line_items": [{
            "price_data": {
                "currency": "usd",
                "unit_amount": _cents(amount_usd),
                "product_data": {"name": f"Hybent: {description}"},
            },
            "quantity": 1,
        }],
        "success_url": _success_url(return_path),
        "cancel_url": _cancel_url(return_path),
        "client_reference_id": str(payment.id),
        "metadata": _metadata(payment),
        "payment_intent_data": {"metadata": _metadata(payment), "description": description},
        "invoice_creation": {"enabled": True, "invoice_data": {"metadata": _metadata(payment)}},
        **(await _customer_params(db, org, "payment")),
    }
    session = await stripe_gateway.create_checkout_session(params)
    payment.stripe_session_id = session["id"]
    await db.commit()
    return session["url"]


async def seats_checkout(db: AsyncSession, user: User, add_admin: int, add_recruiter: int) -> str:
    """Checkout for extra seats, charged for the rest of the current term."""
    require_stripe()
    add = {"admin": add_admin, "recruiter": add_recruiter}
    for role, n in add.items():
        if not isinstance(n, int) or isinstance(n, bool) or n < 0:
            raise HTTPException(status_code=400, detail=f"Extra {role} seats to add must be 0 or more.")
    if not any(add.values()):
        raise HTTPException(status_code=400, detail="Choose how many seats to add.")

    sub = await _get_subscription(db, user.organization_id)
    prices = prorated_seat_prices(sub)
    if prices is None:
        raise HTTPException(
            status_code=409,
            detail="Seats on this plan can't be bought online. Send a request and the Hybent team will set them up.",
        )
    current = billing_service.extra_seat_counts(sub)
    for role, n in add.items():
        if current[role] + n > billing_service.MAX_EXTRA_SEATS:
            raise HTTPException(status_code=400, detail=f"You can have at most {billing_service.MAX_EXTRA_SEATS} extra {role} seats.")

    amount = max(MIN_CHARGE_USD, round(sum(prices[role] * n for role, n in add.items()), 2))
    parts = [_seat_phrase(role, n) for role, n in add.items() if n]
    description = f"{' and '.join(parts)} until {sub.current_period_end:%d %b %Y}"
    org = await db.get(Organization, user.organization_id)
    return await _one_off_checkout(
        db, org, user, "seats", amount, description,
        {"add_admin_seats": add_admin, "add_recruiter_seats": add_recruiter},
        "/hiring/admin/billing",
    )


async def topup_checkout(db: AsyncSession, user: User, credits: int) -> str:
    require_stripe()
    pack = next(((c, p) for c, p in TOPUP_PACKS if c == credits), None)
    if pack is None:
        raise HTTPException(status_code=400, detail="Choose one of the available top-up packs.")
    org = await db.get(Organization, user.organization_id)
    return await _one_off_checkout(
        db, org, user, "topup", pack[1], f"{pack[0]:,} AI credits", {"credits": pack[0]},
        "/hiring/admin/ai-credits",
    )


# ── Applying payments ────────────────────────────────────────────────────────

def _ts(value) -> datetime | None:
    return datetime.fromtimestamp(value, tz=timezone.utc) if value else None


def subscription_period(stripe_sub: dict) -> tuple[datetime, datetime] | None:
    """A Stripe subscription's current term. Newer API versions keep it on
    each item rather than the subscription."""
    start, end = stripe_sub.get("current_period_start"), stripe_sub.get("current_period_end")
    if not end:
        items = (stripe_sub.get("items") or {}).get("data") or []
        starts = [i["current_period_start"] for i in items if i.get("current_period_start")]
        ends = [i["current_period_end"] for i in items if i.get("current_period_end")]
        start, end = (min(starts) if starts else None), (max(ends) if ends else None)
    if not start or not end:
        return None
    return _ts(start), _ts(end)


async def _lock_payment(db: AsyncSession, payment_id) -> Payment | None:
    try:
        pid = uuid.UUID(str(payment_id))
    except (TypeError, ValueError):
        return None
    return (await db.execute(select(Payment).where(Payment.id == pid).with_for_update())).scalar_one_or_none()


async def fulfill_session(db: AsyncSession, session: dict) -> Payment | None:
    """Apply a completed Checkout session's payment, once. Returns the
    payment, or None if the session isn't ours or isn't paid yet (bank
    debits settle later and arrive as async_payment_succeeded)."""
    payment = await _lock_payment(db, (session.get("metadata") or {}).get("payment_id"))
    if payment is None:
        logger.warning(f"Stripe session {session.get('id')} has no matching payment.")
        return None
    if payment.status == "paid":
        return payment
    if session.get("status") != "complete" or session.get("payment_status") not in ("paid", "no_payment_required"):
        await db.commit()
        return None

    org = await db.get(Organization, payment.organization_id)
    if session.get("customer") and org and not org.stripe_customer_id:
        org.stripe_customer_id = session["customer"]

    welcome_user = None
    if payment.kind == "subscription":
        welcome_user = await _apply_subscription(db, payment, org, session)
    elif payment.kind == "seats":
        await _apply_seats(db, payment)
    elif payment.kind == "topup":
        await _apply_topup(db, payment)

    payment.status = "paid"
    payment.paid_at = _now()
    payment.stripe_session_id = session.get("id") or payment.stripe_session_id
    if session.get("amount_total") is not None:
        payment.amount_usd = session["amount_total"] / 100
    if session.get("invoice") and isinstance(session["invoice"], str):
        payment.stripe_invoice_id = session["invoice"]
    await db.commit()
    logger.info(f"Applied Stripe payment {payment.id} ({payment.kind}) for org {payment.organization_id}.")

    await _after_payment(db, payment, welcome_user)
    return payment


async def _apply_subscription(db: AsyncSession, payment: Payment, org: Organization | None, session: dict) -> User | None:
    details = payment.details
    plan = await billing_service.find_plan(db, details["plan_name"])
    if plan is None:
        raise RuntimeError(f"Plan {details['plan_name']!r} for payment {payment.id} no longer exists.")

    sub = await _get_subscription(db, payment.organization_id)
    if sub is None:
        sub = CompanySubscription(organization_id=payment.organization_id, plan_id=plan.id, status="active")
        db.add(sub)
    now = _now()
    sub.plan_id = plan.id
    sub.plan = plan
    sub.billing_cycle = billing_service.BILLING_CYCLE_FOR_TERM.get(plan.term_months, "custom")
    sub.extra_admin_seats = details.get("extra_admin_seats") or 0
    sub.extra_recruiter_seats = details.get("extra_recruiter_seats") or 0
    sub.status = "active"
    sub.trial_end = None
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=30 * (details.get("term_months") or 1))

    stripe_sub_id = session.get("subscription")
    if isinstance(stripe_sub_id, dict):
        stripe_sub_id = stripe_sub_id.get("id")
    if stripe_sub_id:
        sub.stripe_subscription_id = stripe_sub_id
        try:
            period = subscription_period(await stripe_gateway.retrieve_subscription(stripe_sub_id))
            if period:
                sub.current_period_start, sub.current_period_end = period
        except Exception as e:
            logger.warning(f"Couldn't read Stripe subscription {stripe_sub_id}: {e}")

    if org:
        org.is_active = True
    welcome_user = None
    if details.get("activate_user_id"):
        welcome_user = await db.get(User, uuid.UUID(details["activate_user_id"]))
        if welcome_user and not welcome_user.is_active:
            welcome_user.is_active = True
        else:
            welcome_user = None

    await db.flush()
    await _resync_credits(db, payment.organization_id)
    return welcome_user


async def _apply_seats(db: AsyncSession, payment: Payment) -> None:
    sub = await _get_subscription(db, payment.organization_id)
    if sub is None:
        raise RuntimeError(f"Seats paid by {payment.id} but organization {payment.organization_id} has no subscription.")
    sub.extra_admin_seats = (sub.extra_admin_seats or 0) + (payment.details.get("add_admin_seats") or 0)
    sub.extra_recruiter_seats = (sub.extra_recruiter_seats or 0) + (payment.details.get("add_recruiter_seats") or 0)
    await db.flush()
    await _resync_credits(db, payment.organization_id)


async def _apply_topup(db: AsyncSession, payment: Payment) -> None:
    credits = await AICreditsService.get_or_create_org_credits(db, payment.organization_id, for_update=True)
    credits.purchased_credits = (credits.purchased_credits or 0) + int(payment.details["credits"])
    credits.warning_0_sent = False


async def _resync_credits(db: AsyncSession, organization_id: uuid.UUID) -> None:
    """The plan and extra seats set the monthly AI pool."""
    org_credits = await AICreditsService.get_or_create_org_credits(db, organization_id, for_update=True)
    await AICreditsService.resync_monthly_allowance(db, org_credits)
    if AICreditsService.org_remaining(org_credits) > 0:
        org_credits.warning_0_sent = False


async def _after_payment(db: AsyncSession, payment: Payment, welcome_user: User | None) -> None:
    """Side effects once the payment is saved. Failures are logged, not
    raised: the payment is applied and Stripe mustn't retry it."""
    from app.services.ai_metering import clear_blocked
    clear_blocked(organization_id=payment.organization_id)
    org_id = str(payment.organization_id)
    try:
        if payment.kind == "seats":
            sub = await _get_subscription(db, payment.organization_id)
            if sub and sub.stripe_subscription_id and sub.plan and sub.plan.term_months:
                term = sub.plan.term_months
                await stripe_gateway.set_subscription_items(sub.stripe_subscription_id, {
                    SEAT_ITEM[role]: (await seat_price_id(role, term, sub.plan.currency or "USD"), count)
                    for role, count in billing_service.extra_seat_counts(sub).items()
                })
            notify_organization_roles.delay(
                org_id, ["admin"], "system", "Seats added", f"Payment received: {payment.description}.",
                {"payment_id": str(payment.id)},
            )
        elif payment.kind == "topup":
            notify_organization_roles.delay(
                org_id, ["admin"], "system", "AI credits added",
                f"{payment.details['credits']:,} AI credits were added to your organization.",
                {"added_credits": payment.details["credits"]},
            )
        elif payment.kind == "subscription" and welcome_user is not None:
            await _send_welcome(db, welcome_user)
    except Exception:
        logger.exception(f"Follow-up after payment {payment.id} failed; the payment itself is applied.")


async def _send_welcome(db: AsyncSession, user: User) -> None:
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used.is_(False))
        .values(is_used=True)
    )
    token = secrets.token_urlsafe(48)
    db.add(PasswordResetToken(
        user_id=user.id, token=token, expires_at=_now() + timedelta(days=WELCOME_LINK_VALID_DAYS),
    ))
    await db.commit()
    org = await db.get(Organization, user.organization_id)
    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    body = (
        f"<p>Hi {html.escape(user.full_name or '')},</p>"
        f"<p>Payment received, thank you. Your Hybent workspace for <b>{html.escape(org.name if org else '')}</b> is ready.</p>"
        f"<p><a href=\"{link}\">Set your password and sign in</a> (this link is valid for {WELCOME_LINK_VALID_DAYS} days).</p>"
        f"<p>Your sign-in email is {html.escape(user.email)}.</p>"
    )
    await asyncio.to_thread(send_email, user.email, "Welcome to Hybent: set your password", body)


async def activate_without_payment(db: AsyncSession, organization_id: uuid.UUID) -> list[User]:
    """A super admin activated a client that was waiting on a payment link
    (e.g. paid by bank transfer): cancel the link and activate the admin it
    was holding back. Returns admins to send the welcome email to."""
    users = []
    for payment in (await db.execute(
        select(Payment).where(
            Payment.organization_id == organization_id, Payment.kind == "subscription", Payment.status == "pending"
        )
    )).scalars().all():
        payment.status = "canceled"
        if payment.stripe_session_id and settings.stripe_enabled:
            await stripe_gateway.expire_checkout_session(payment.stripe_session_id)
        user_id = payment.details.get("activate_user_id")
        user = await db.get(User, uuid.UUID(user_id)) if user_id else None
        if user and not user.is_active:
            user.is_active = True
            users.append(user)
    return users


async def send_welcome(db: AsyncSession, user: User) -> None:
    try:
        await _send_welcome(db, user)
    except Exception:
        logger.exception(f"Couldn't send the welcome email to {user.id}.")


# ── Webhooks ─────────────────────────────────────────────────────────────────

def _invoice_subscription_id(invoice: dict) -> str | None:
    sub = invoice.get("subscription")
    if not sub:
        sub = (((invoice.get("parent") or {}).get("subscription_details")) or {}).get("subscription")
    if isinstance(sub, dict):
        sub = sub.get("id")
    return sub


async def _sub_by_stripe_id(db: AsyncSession, stripe_sub_id: str | None) -> CompanySubscription | None:
    if not stripe_sub_id:
        return None
    return (await db.execute(
        select(CompanySubscription).where(CompanySubscription.stripe_subscription_id == stripe_sub_id)
    )).scalar_one_or_none()


async def handle_event(db: AsyncSession, event: dict) -> None:
    kind = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        await fulfill_session(db, obj)
    elif kind in ("checkout.session.expired", "checkout.session.async_payment_failed"):
        await _session_ended(db, obj, "expired" if kind.endswith("expired") else "failed")
    elif kind == "invoice.paid":
        await _renewal_paid(db, obj)
    elif kind == "invoice.payment_failed":
        await _renewal_failed(db, obj)
    elif kind == "customer.subscription.deleted":
        sub = await _sub_by_stripe_id(db, obj.get("id"))
        if sub:
            sub.status = "expired"
            sub.stripe_subscription_id = None
            await db.commit()
            logger.info(f"Stripe subscription {obj.get('id')} ended for org {sub.organization_id}.")


async def _session_ended(db: AsyncSession, session: dict, status: str) -> None:
    payment = await _lock_payment(db, (session.get("metadata") or {}).get("payment_id"))
    if payment is None or payment.status != "pending" or payment.stripe_session_id != session.get("id"):
        return
    if payment.kind == "subscription":
        # The link stays usable; the next visit starts a fresh session.
        payment.stripe_session_id = None
    else:
        payment.status = status
    await db.commit()


async def _renewal_paid(db: AsyncSession, invoice: dict) -> None:
    # The first invoice is the Checkout payment, applied by fulfill_session.
    if invoice.get("billing_reason") == "subscription_create":
        return
    sub = await _sub_by_stripe_id(db, _invoice_subscription_id(invoice))
    if sub is None:
        return
    if (await db.execute(select(Payment.id).where(Payment.stripe_invoice_id == invoice.get("id")))).first():
        return

    ends = [line.get("period", {}).get("end") for line in (invoice.get("lines") or {}).get("data", [])]
    starts = [line.get("period", {}).get("start") for line in (invoice.get("lines") or {}).get("data", [])]
    ends, starts = [e for e in ends if e], [s for s in starts if s]
    if ends and starts:
        sub.current_period_start, sub.current_period_end = _ts(min(starts)), _ts(max(ends))
    sub.status = "active"
    db.add(Payment(
        organization_id=sub.organization_id,
        kind="renewal",
        status="paid",
        amount_usd=(invoice.get("amount_paid") or 0) / 100,
        currency=(invoice.get("currency") or "usd").upper(),
        description=f"Renewal: {sub.plan.name if sub.plan else 'subscription'}",
        details={"billing_reason": invoice.get("billing_reason")},
        stripe_invoice_id=invoice.get("id"),
        receipt_url=invoice.get("hosted_invoice_url"),
        paid_at=_now(),
    ))
    await db.commit()
    logger.info(f"Renewal paid for org {sub.organization_id}: {invoice.get('id')}.")


async def _renewal_failed(db: AsyncSession, invoice: dict) -> None:
    sub = await _sub_by_stripe_id(db, _invoice_subscription_id(invoice))
    if sub is None:
        return
    sub.status = "past_due"
    await db.commit()
    link = invoice.get("hosted_invoice_url")
    notify_organization_roles.delay(
        str(sub.organization_id), ["admin"], "system", "Payment failed",
        "We couldn't take your subscription payment. Please update your card to keep your plan active.",
        {"invoice_url": link} if link else {},
    )


def payment_to_dict(payment: Payment, org_name: str | None = None) -> dict:
    data = {
        "id": str(payment.id),
        "organization_id": str(payment.organization_id),
        "kind": payment.kind,
        "status": payment.status,
        "amount_usd": payment.amount_usd,
        "currency": payment.currency,
        "description": payment.description,
        "details": payment.details,
        "receipt_url": payment.receipt_url,
        "expires_at": payment.expires_at,
        "paid_at": payment.paid_at,
        "created_at": payment.created_at,
    }
    if payment.token:
        data["pay_url"] = pay_url(payment)
    if org_name is not None:
        data["organization_name"] = org_name
    return data
