"""Stripe payments: the webhook, the public /pay/<token> page a client pays
a plan link on, org admins' seat and top-up checkouts, and the super
admin's payment links. See app/services/payment_service.py for the flow."""
import logging
import uuid
from typing import Annotated

import stripe
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import select

from app.core.config import settings
from app.dependencies import DB, SuperAdminUser, require_admin
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.user import User
from app.schemas.response import APIResponse
from app.services import billing_service, payment_service, stripe_gateway

logger = logging.getLogger(__name__)

router = APIRouter(tags=["payments"])


# ── Stripe webhook ───────────────────────────────────────────────────────────

@router.post("/v1/stripe/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: DB):
    payload = await request.body()
    try:
        event = stripe_gateway.construct_event(payload, request.headers.get("stripe-signature"))
    except stripe_gateway.StripeNotConfigured:
        raise HTTPException(status_code=503, detail="Stripe webhooks are not configured.")
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature.")

    # An exception here returns 500 and Stripe retries; applying a payment
    # is idempotent, so a retry can't apply it twice.
    await payment_service.handle_event(db, event)
    return {"received": True}


# ── Public payment link (/pay/<token>) ───────────────────────────────────────

async def _link(db, token: str, lock: bool = False) -> Payment:
    query = select(Payment).where(Payment.token == token, Payment.kind == "subscription")
    if lock:
        query = query.with_for_update()
    payment = (await db.execute(query)).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=404, detail="This payment link isn't valid.")
    return payment


def _public_link(payment: Payment, org_name: str | None) -> dict:
    expired = payment.status == "pending" and payment.expires_at and payment.expires_at < payment_service._now()
    return {
        "status": "expired" if expired else payment.status,
        "organization_name": org_name,
        "description": payment.description,
        "amount_usd": payment.amount_usd,
        "currency": payment.currency,
        "term_months": payment.details.get("term_months"),
        "recurring": bool(payment.details.get("recurring")),
        "lines": payment.details.get("lines", []),
        "expires_at": payment.expires_at,
        "paid_at": payment.paid_at,
    }


@router.get("/v1/payments/{token}")
async def get_payment_link(token: str, db: DB):
    payment = await _link(db, token)
    org = await db.get(Organization, payment.organization_id)
    return APIResponse.success(message="Payment link retrieved.", data=_public_link(payment, org.name if org else None))


@router.post("/v1/payments/{token}/checkout")
async def start_payment_link_checkout(token: str, db: DB):
    # Locked so two clicks at once share one Checkout session.
    payment = await _link(db, token, lock=True)
    url = await payment_service.start_link_checkout(db, payment)
    return APIResponse.success(message="Checkout started.", data={"url": url})


@router.post("/v1/payments/{token}/confirm")
async def confirm_payment_link(token: str, db: DB, payload: dict = Body(...)):
    """Called on return from Checkout: checks the session with Stripe and
    applies it if the webhook hasn't yet."""
    payment = await _link(db, token)
    session_id = str(payload.get("session_id") or "")
    if payment.status == "pending" and session_id:
        payment_service.require_stripe()
        session = await stripe_gateway.retrieve_checkout_session(session_id)
        if (session.get("metadata") or {}).get("payment_id") != str(payment.id):
            raise HTTPException(status_code=400, detail="That checkout doesn't belong to this payment link.")
        await payment_service.fulfill_session(db, session)
        await db.refresh(payment)
    org = await db.get(Organization, payment.organization_id)
    return APIResponse.success(message="Payment status retrieved.", data=_public_link(payment, org.name if org else None))


# ── Org admin: seats and top-ups ─────────────────────────────────────────────

AdminUser = Annotated[User, Depends(require_admin)]


@router.post("/v1/billing/checkout/seats")
async def checkout_seats(db: DB, current_user: AdminUser, payload: dict = Body(...)):
    """Pay for extra seats for the rest of the current term. They're added
    as soon as Stripe confirms the payment, and renew with the plan."""
    url = await payment_service.seats_checkout(
        db, current_user, payload.get("admin", 0), payload.get("recruiter", 0)
    )
    return APIResponse.success(message="Checkout started.", data={"url": url})


@router.post("/v1/billing/checkout/topup")
async def checkout_topup(db: DB, current_user: AdminUser, payload: dict = Body(...)):
    url = await payment_service.topup_checkout(db, current_user, payload.get("credits"))
    return APIResponse.success(message="Checkout started.", data={"url": url})


@router.post("/v1/billing/checkout/confirm")
async def confirm_checkout(db: DB, current_user: AdminUser, payload: dict = Body(...)):
    """Called on return from Checkout: applies the payment if the webhook
    hasn't yet, and says whether it went through."""
    payment_service.require_stripe()
    session_id = str(payload.get("session_id") or "")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    payment = (await db.execute(
        select(Payment).where(Payment.stripe_session_id == session_id)
    )).scalar_one_or_none()
    if payment is None or payment.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if payment.status == "pending":
        await payment_service.fulfill_session(db, await stripe_gateway.retrieve_checkout_session(session_id))
        await db.refresh(payment)
    return APIResponse.success(message="Payment status retrieved.", data=payment_service.payment_to_dict(payment))


@router.get("/v1/billing/payments")
async def list_my_payments(db: DB, current_user: AdminUser):
    payments = (await db.execute(
        select(Payment)
        .where(Payment.organization_id == current_user.organization_id, Payment.status == "paid")
        .order_by(Payment.paid_at.desc())
        .limit(50)
    )).scalars().all()
    data = []
    for p in payments:
        item = payment_service.payment_to_dict(p)
        item.pop("pay_url", None)
        data.append(item)
    return APIResponse.success(message="Payments retrieved.", data=data)


# ── Super admin: payment links ───────────────────────────────────────────────

def _int(payload: dict, key: str) -> int:
    value = payload.get(key, 0)
    if value is None:
        return 0
    if not isinstance(value, int) or isinstance(value, bool):
        raise HTTPException(status_code=400, detail=f"{key} must be a whole number.")
    return value


async def _plan_from(db, payload: dict):
    plan = await billing_service.find_plan(db, str(payload.get("plan_name") or ""))
    if not plan:
        raise HTTPException(status_code=400, detail="Choose one of the available plans.")
    return plan


@router.post("/v1/super-admin/payments/quote")
async def quote_payment_link(db: DB, current_user: SuperAdminUser, payload: dict = Body(...)):
    plan = await _plan_from(db, payload)
    quote = payment_service.subscription_quote(
        plan, _int(payload, "extra_admin_seats"), _int(payload, "extra_recruiter_seats"),
        payload.get("custom_amount_usd"), payload.get("custom_term_months"),
    )
    return APIResponse.success(message="Quote calculated.", data={**quote, "payments_enabled": settings.stripe_enabled})


@router.post("/v1/super-admin/clients/{client_id}/payment-links", status_code=201)
async def create_payment_link(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser, payload: dict = Body(...)):
    """A plan payment link for an existing client (a new plan, or moving a
    manually invoiced client onto Stripe). Emailed to the client's admin
    unless `send_email` is false."""
    org = await db.get(Organization, client_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")
    plan = await _plan_from(db, payload)
    payment = await payment_service.create_subscription_link(
        db, org, plan, current_user,
        extra_admin_seats=_int(payload, "extra_admin_seats"),
        extra_recruiter_seats=_int(payload, "extra_recruiter_seats"),
        custom_amount_usd=payload.get("custom_amount_usd"),
        custom_term_months=payload.get("custom_term_months"),
    )
    await db.commit()
    emailed = False
    if payload.get("send_email", True):
        emailed = await payment_service.email_payment_link(db, payment)
    logger.info(f"Super admin {current_user.id} created payment link {payment.id} for org {org.id}.")
    return APIResponse.success(
        message="Payment link created." + (" It was emailed to the client's admin." if emailed else ""),
        data={**payment_service.payment_to_dict(payment, org.name), "emailed": emailed},
    )


@router.get("/v1/super-admin/payments")
async def list_payments(db: DB, current_user: SuperAdminUser, organization_id: uuid.UUID | None = None):
    query = (
        select(Payment, Organization.name)
        .join(Organization, Organization.id == Payment.organization_id)
        .order_by(Payment.created_at.desc())
        .limit(200)
    )
    if organization_id:
        query = query.where(Payment.organization_id == organization_id)
    rows = (await db.execute(query)).all()
    return APIResponse.success(
        message="Payments retrieved.",
        data=[payment_service.payment_to_dict(p, name) for p, name in rows],
    )


async def _pending_link(db, payment_id: uuid.UUID) -> Payment:
    payment = (await db.execute(select(Payment).where(Payment.id == payment_id).with_for_update())).scalar_one_or_none()
    if payment is None or payment.kind != "subscription":
        raise HTTPException(status_code=404, detail="Payment link not found.")
    if payment.status != "pending":
        raise HTTPException(status_code=409, detail=f"This payment link is {payment.status}.")
    return payment


@router.post("/v1/super-admin/payments/{payment_id}/cancel")
async def cancel_payment_link(payment_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    payment = await _pending_link(db, payment_id)
    if payment.stripe_session_id and settings.stripe_enabled:
        await stripe_gateway.expire_checkout_session(payment.stripe_session_id)
    payment.status = "canceled"
    await db.commit()
    return APIResponse.success(message="Payment link cancelled.", data=payment_service.payment_to_dict(payment))


@router.post("/v1/super-admin/payments/{payment_id}/resend")
async def resend_payment_link(payment_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    payment = await _pending_link(db, payment_id)
    if not await payment_service.email_payment_link(db, payment):
        raise HTTPException(status_code=502, detail="Couldn't send the email. Copy the link and send it yourself.")
    await db.commit()
    return APIResponse.success(message="Payment link emailed to the client's admin.")
