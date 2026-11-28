"""Trial invoices: the public invoice page and PDF, the client's own list, and
the super admin's list, mark-paid, resend and payment-details settings.
The work is in services/invoice_service.py."""
import logging
import uuid

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import Response
from sqlalchemy import select

from app.dependencies import DB, AdminUser, SuperAdminUser
from app.models.organization import Organization
from app.models.payment import Payment
from app.schemas.response import APIResponse
from app.services import invoice_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invoices"])

PAID_METHODS = ("bank_transfer", "upi", "cash", "cheque", "other")


async def _by_token(db, token: str) -> tuple[Payment, Organization | None]:
    payment = (await db.execute(select(Payment).where(Payment.token == token))).scalar_one_or_none()
    if payment is None or not invoice_service.is_invoice(payment) or payment.status == "canceled":
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return payment, await db.get(Organization, payment.organization_id)


async def _public(db, payment: Payment, org: Organization | None) -> dict:
    details = await invoice_service.get_payment_details(db) if payment.status != "paid" else None
    return invoice_service.invoice_to_dict(payment, org.name if org else None, details)


# ── Public: the link in the invoice email ────────────────────────────────────

@router.get("/v1/invoices/{token}")
async def get_invoice(token: str, db: DB):
    payment, org = await _by_token(db, token)
    return APIResponse.success(message="Invoice retrieved.", data=await _public(db, payment, org))


@router.get("/v1/invoices/{token}/pdf")
async def get_invoice_pdf(token: str, db: DB):
    payment, org = await _by_token(db, token)
    inv = await _public(db, payment, org)
    pdf = await invoice_service.invoice_pdf(inv)
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv["invoice_number"]}.pdf"'},
    )


# ── The client's admin ───────────────────────────────────────────────────────

@router.get("/v1/billing/invoices")
async def my_invoices(db: DB, current_user: AdminUser):
    rows = (await db.execute(
        select(Payment).where(
            Payment.organization_id == current_user.organization_id,
            Payment.details.has_key("invoice_number"), Payment.status != "canceled",
        ).order_by(Payment.created_at.desc())
    )).scalars().all()
    return APIResponse.success(message="Invoices retrieved.", data=[invoice_service.invoice_to_dict(p) for p in rows])


# ── Super admin ──────────────────────────────────────────────────────────────

@router.get("/v1/super-admin/invoices")
async def list_invoices(db: DB, current_user: SuperAdminUser):
    rows = (await db.execute(
        select(Payment, Organization.name)
        .join(Organization, Organization.id == Payment.organization_id)
        .where(Payment.details.has_key("invoice_number"))
        .order_by(Payment.created_at.desc())
        .limit(300)
    )).all()
    return APIResponse.success(
        message="Invoices retrieved.", data=[invoice_service.invoice_to_dict(p, name) for p, name in rows],
    )


@router.post("/v1/super-admin/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(invoice_id: uuid.UUID, db: DB, current_user: SuperAdminUser, payload: dict = Body(...)):
    """The money reached Hybent's account: record it and activate the plan."""
    method = str(payload.get("method") or "bank_transfer")
    if method not in PAID_METHODS:
        raise HTTPException(status_code=400, detail=f"Method must be one of: {', '.join(PAID_METHODS)}.")
    payment = (await db.execute(
        select(Payment).where(Payment.id == invoice_id).with_for_update()
    )).scalar_one_or_none()
    if payment is None or not invoice_service.is_invoice(payment):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if payment.status == "canceled":
        raise HTTPException(status_code=409, detail="This invoice was cancelled.")
    await invoice_service.mark_paid(db, payment, current_user, method, payload.get("reference"))
    logger.info(f"Super admin {current_user.id} marked invoice {payment.id} paid ({method}).")
    org = await db.get(Organization, payment.organization_id)
    return APIResponse.success(
        message="Marked as paid. The client's plan is active and a receipt was emailed.",
        data=invoice_service.invoice_to_dict(payment, org.name if org else None),
    )


@router.post("/v1/super-admin/invoices/{invoice_id}/resend")
async def resend_invoice(invoice_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    payment = await db.get(Payment, invoice_id)
    if payment is None or not invoice_service.is_invoice(payment):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if payment.status != "pending":
        raise HTTPException(status_code=409, detail="Only unpaid invoices can be resent.")
    sent = await invoice_service.send_invoice(db, payment)
    return APIResponse.success(message=f"Invoice emailed to {sent} admin{'s' if sent != 1 else ''}.", data={"sent": sent})


@router.post("/v1/super-admin/invoices/{invoice_id}/cancel")
async def cancel_invoice(invoice_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    payment = await db.get(Payment, invoice_id)
    if payment is None or not invoice_service.is_invoice(payment):
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if payment.status == "paid":
        raise HTTPException(status_code=409, detail="A paid invoice can't be cancelled.")
    payment.status = "canceled"
    await db.commit()
    return APIResponse.success(message="Invoice cancelled.", data={"id": str(payment.id)})


@router.get("/v1/super-admin/invoice-settings")
async def get_invoice_settings(db: DB, current_user: SuperAdminUser):
    return APIResponse.success(message="Invoice settings retrieved.", data={
        "payment_details": await invoice_service.get_payment_details(db),
        "grace_days": invoice_service.GRACE_DAYS,
        "business": invoice_service.BUSINESS,
    })


@router.put("/v1/super-admin/invoice-settings")
async def update_invoice_settings(db: DB, current_user: SuperAdminUser, payload: dict = Body(...)):
    try:
        saved = await invoice_service.save_payment_details(db, payload.get("payment_details") or {})
    except invoice_service.PaymentDetailsError as exc:
        raise HTTPException(status_code=422, detail={
            "message": "Some payment details need fixing before they go on invoices.", "fields": exc.errors,
        })
    logger.info(f"Super admin {current_user.id} updated invoice payment details.")
    return APIResponse.success(message="Payment details saved.", data={"payment_details": saved})


@router.delete("/v1/super-admin/invoice-settings/payment-details")
async def delete_payment_details(db: DB, current_user: SuperAdminUser):
    await invoice_service.clear_payment_details(db)
    logger.info(f"Super admin {current_user.id} removed invoice payment details.")
    return APIResponse.success(
        message="Payment details removed. Invoices now ask clients to contact Hybent for them.",
        data={"payment_details": await invoice_service.get_payment_details(db)},
    )
