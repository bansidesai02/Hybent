"""An organization admin's view of their own subscription.

Admins can see their plan, seats, renewal date and AI credits, and ask for a
different plan or more recruiter seats. Plans aren't self-serve (no payment
is taken on the site): a request emails the Hybent team, who invoice and
apply it from the super-admin panel.
"""
import asyncio
import html
import logging
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select

from app.dependencies import DB, require_admin
from app.models.organization import Organization
from app.models.super_admin import CompanySubscription
from app.models.user import User
from app.schemas.response import APIResponse
from app.services import billing_service
from app.services.ai_credit_service import AICreditsService
from app.services.email_service import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/billing", tags=["billing"])

MAX_EXTRA_SEATS = 100


@router.get("")
async def get_billing(db: DB, current_user: Annotated[User, Depends(require_admin)]):
    org_id = current_user.organization_id
    sub = (await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == org_id)
    )).scalar_one_or_none()
    plans = await billing_service.list_plans(db)
    std = billing_service.standard_price(plans)
    credits = await AICreditsService.get_or_create_org_credits(db, org_id)
    usage = await billing_service.seat_usage(db, org_id)
    await db.commit()

    current = None
    if sub and sub.plan:
        current = {
            "plan": billing_service.plan_to_dict(sub.plan, std),
            "status": sub.status,
            "current_period_start": sub.current_period_start,
            "current_period_end": sub.current_period_end,
            "trial_end": sub.trial_end,
            "seats": billing_service.seats_summary(sub.plan, sub, usage),
        }

    return APIResponse.success(
        message="Billing details retrieved.",
        data={
            "subscription": current,
            "seats_used": usage,
            "ai_credits": {
                "monthly": credits.allowed_credits,
                "used": credits.used_credits,
                "purchased": max(0, credits.purchased_credits or 0),
                "reset_at": credits.reset_at,
            },
            "plans": [billing_service.plan_to_dict(p, std) for p in plans],
            "extra_seats": billing_service.extra_seat_pricing(),
            "monthly_total_usd": billing_service.monthly_revenue(sub.plan, sub) if sub and sub.plan else None,
        },
    )


@router.post("/request-change")
async def request_change(
    db: DB,
    current_user: Annotated[User, Depends(require_admin)],
    payload: dict = Body(...),
):
    """Ask Hybent to move the organization to another plan and/or change its
    extra admin seats ($15/month, +1,500 credits each) and extra recruiter
    seats ($10/month, +1,000 credits each)."""
    plan_name = payload.get("plan_name")
    requested = {
        "admin": payload.get("extra_admin_seats"),
        "recruiter": payload.get("extra_recruiter_seats"),
    }
    note = (payload.get("note") or "").strip()[:1000]

    plan = None
    if plan_name:
        plan = await billing_service.find_plan(db, str(plan_name))
        if not plan:
            raise HTTPException(status_code=400, detail="Choose one of the available plans.")
    for role, n in requested.items():
        if n is not None and (not isinstance(n, int) or isinstance(n, bool) or not 0 <= n <= MAX_EXTRA_SEATS):
            raise HTTPException(status_code=400, detail=f"Extra {role} seats must be between 0 and {MAX_EXTRA_SEATS}.")
    if plan is None and all(n is None for n in requested.values()):
        raise HTTPException(status_code=400, detail="Choose a plan or a number of extra seats.")

    org = await db.get(Organization, current_user.organization_id)
    sub = (await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == current_user.organization_id)
    )).scalar_one_or_none()
    org_name = org.name if org else str(current_user.organization_id)
    current_plan = sub.plan.name if sub and sub.plan else "none"
    current = billing_service.extra_seat_counts(sub)

    lines = [f"<p><b>{html.escape(org_name)}</b> requested a subscription change.</p><p>"]
    if plan:
        lines.append(f"Plan: {html.escape(current_plan)} → <b>{html.escape(plan.name)}</b> ({html.escape(billing_service.billed_label(plan))})<br/>")
    for role, n in requested.items():
        if n is not None:
            price, credits = billing_service.EXTRA_SEATS[role]
            lines.append(
                f"Extra {role} seats: {current[role]} → <b>{n}</b> "
                f"(${price:,.0f}/month and {credits:,} AI credits each)<br/>"
            )
    lines.append(
        f"Requested by: {html.escape(current_user.full_name or '')} &lt;{html.escape(current_user.email)}&gt;<br/>"
        f"Organization ID: {current_user.organization_id}</p>"
    )
    if note:
        lines.append(f"<p>Note: {html.escape(note)}</p>")
    lines.append("<p>Apply it from the super-admin Billing page once invoiced.</p>")

    sent = await asyncio.to_thread(
        send_email, billing_service.PLAN_REQUEST_EMAIL,
        f"Subscription change request: {org_name}", "".join(lines),
    )
    if not sent:
        raise HTTPException(status_code=502, detail="We couldn't send your request. Please email info@hybent.com.")

    logger.info(f"Billing change requested by {current_user.id} for org {current_user.organization_id}: {payload}")
    return APIResponse.success(
        message="Request sent. The Hybent team will contact you to confirm the change.",
        data={
            "plan_name": plan.name if plan else None,
            "extra_admin_seats": requested["admin"],
            "extra_recruiter_seats": requested["recruiter"],
        },
    )
