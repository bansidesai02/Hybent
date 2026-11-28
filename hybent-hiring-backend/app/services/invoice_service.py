"""
Invoices for free trials that end without an online payment.

One day before a 7-day trial ends (Day 6) the organization gets an invoice
for the plan it trialled. The admins are emailed a link to it (a public page
with the PDF), the Hybent team is told by email and a super admin alert, and
the workspace keeps working until the invoice is due: trial end + GRACE_DAYS.
A super admin marks it paid once the money reaches Hybent's account, which
activates the plan exactly as a Stripe payment would.

An invoice is a Payment row (kind "subscription", status "pending") with a
`token` for its public page; the invoice number, due date and who it's billed
to live in Payment.details. Hybent's bank / UPI details are a platform
setting edited by super admins (PAYMENT_DETAILS_KEY).

Hybent has no GSTIN yet, so invoices carry no tax and say "Invoice", not
"Tax Invoice".
"""
import asyncio
import html
import re
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.super_admin import CompanySubscription, PlatformSetting
from app.models.trial_request import TrialRequest
from app.models.user import User
from app.services import billing_service
from app.services.email_service import _get_base_template, send_email

logger = logging.getLogger(__name__)

GRACE_DAYS = 3
TEAM_EMAIL = "info@hybent.com"
CONTACT_PHONE = "+91 87990 29798"
PAYMENT_DETAILS_KEY = "invoice_payment_details"
# Fields super admins fill in on the Invoices page (all optional).
PAYMENT_DETAIL_FIELDS = (
    "account_name", "bank_name", "account_number", "ifsc", "branch", "upi_id", "note",
)
BUSINESS = {
    "name": "HYBENT",
    "udyam": "UDYAM-GJ-11-0046361",
    "address": "Keshod, Junagadh, Gujarat 362220, India",
    "email": TEAM_EMAIL,
    "phone": CONTACT_PHONE,
    "website": "hybent.com",
}
# Prices in India, as on the pricing page (the plans themselves are in USD).
INR_PLAN_PRICES = {"Standard": 2799.0, "Pro": 3799.0}
INR_SEAT_PRICES = {"admin": None, "recruiter": 999.0}
CURRENCY_SYMBOL = {"INR": "₹", "USD": "$"}
INVOICE_LOCK_ID = 74_210_001  # pg advisory lock for numbering


def _now() -> datetime:
    return datetime.now(timezone.utc)


def is_india(country: str | None) -> bool:
    return (country or "").strip().lower() in ("india", "in", "ind", "bharat")


def money(amount: float, currency: str) -> str:
    symbol = CURRENCY_SYMBOL.get(currency, currency + " ")
    return f"{symbol}{amount:,.0f}" if float(amount).is_integer() else f"{symbol}{amount:,.2f}"


def is_invoice(payment: Payment) -> bool:
    return bool((payment.details or {}).get("invoice_number"))


# ── Hybent's payment details ─────────────────────────────────────────────────

async def get_payment_details(db: AsyncSession) -> dict:
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == PAYMENT_DETAILS_KEY)
    )).scalar_one_or_none()
    stored = dict(row.setting_value) if row else {}
    return {k: str(stored.get(k) or "").strip() for k in PAYMENT_DETAIL_FIELDS}


IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
ACCOUNT_RE = re.compile(r"^\d{9,18}$")
UPI_RE = re.compile(r"^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{2,64}$")
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9 .,&'()-]{2,99}$")


class PaymentDetailsError(ValueError):
    """Field -> message for details that can't go on an invoice."""

    def __init__(self, errors: dict[str, str]):
        super().__init__("; ".join(errors.values()))
        self.errors = errors


async def lookup_ifsc(ifsc: str) -> dict | None:
    """Bank and branch for an IFSC from Razorpay's public IFSC directory.
    {} if the code doesn't exist, None if the directory couldn't be reached
    (then only the format is checked)."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=6) as client:
            r = await client.get(f"https://ifsc.razorpay.com/{ifsc}")
    except httpx.HTTPError:
        return None
    if r.status_code == 404:
        return {}
    if r.status_code != 200:
        return None
    data = r.json()
    return {"bank": data.get("BANK") or "", "branch": data.get("BRANCH") or "", "city": data.get("CITY") or ""}


async def validate_payment_details(values: dict) -> dict:
    """Clean and check what super admins entered. A bank account needs all of
    name, number and a real IFSC (its bank and branch are taken from the IFSC
    directory); a UPI ID is enough on its own. Raises PaymentDetailsError."""
    v = {k: " ".join(str(values.get(k) or "").split())[:200] for k in PAYMENT_DETAIL_FIELDS}
    v["ifsc"] = v["ifsc"].upper()
    v["account_number"] = v["account_number"].replace(" ", "")
    errors: dict[str, str] = {}

    bank_fields = ("account_name", "account_number", "ifsc", "bank_name", "branch")
    has_bank = any(v[k] for k in bank_fields)
    if not has_bank and not v["upi_id"]:
        errors["upi_id"] = "Add a bank account or a UPI ID, so clients know how to pay."

    if has_bank:
        if not NAME_RE.match(v["account_name"]):
            errors["account_name"] = "Enter the account holder's name exactly as the bank has it."
        if not ACCOUNT_RE.match(v["account_number"]):
            errors["account_number"] = "An account number is 9 to 18 digits."
        elif str(values.get("account_number_confirm") or "").replace(" ", "") != v["account_number"]:
            errors["account_number_confirm"] = "The account numbers don't match."
        if not IFSC_RE.match(v["ifsc"]):
            errors["ifsc"] = "An IFSC is 11 characters, like SBIN0001234 (5th character is zero)."
        else:
            found = await lookup_ifsc(v["ifsc"])
            if found == {}:
                errors["ifsc"] = f"{v['ifsc']} isn't a real IFSC. Check it on your cheque book or bank app."
            elif found:
                # The directory is the source of truth for these two.
                v["bank_name"] = found["bank"] or v["bank_name"]
                v["branch"] = ", ".join(p for p in (found["branch"], found["city"]) if p) or v["branch"]
            elif not NAME_RE.match(v["bank_name"]):
                errors["bank_name"] = "Enter the bank's name."
    if v["upi_id"] and not UPI_RE.match(v["upi_id"]):
        errors["upi_id"] = "A UPI ID looks like name@bank (e.g. hybent@okhdfcbank)."
    if errors:
        raise PaymentDetailsError(errors)
    return v


async def clear_payment_details(db: AsyncSession) -> None:
    """Remove Hybent's bank / UPI details. Invoices then ask clients to
    contact Hybent for them (payment_details_html's fallback)."""
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == PAYMENT_DETAILS_KEY)
    )).scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.commit()


async def save_payment_details(db: AsyncSession, values: dict) -> dict:
    clean = await validate_payment_details(values)
    row = (await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == PAYMENT_DETAILS_KEY)
    )).scalar_one_or_none()
    if row is None:
        db.add(PlatformSetting(setting_key=PAYMENT_DETAILS_KEY, setting_value=clean))
    else:
        row.setting_value = clean
    await db.commit()
    return clean


# ── Creating a trial's invoice ───────────────────────────────────────────────

async def _next_number(db: AsyncSession) -> str:
    """HYB-<year>-0001, counting every invoice ever issued. Serialised with an
    advisory lock held until the transaction commits."""
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": INVOICE_LOCK_ID})
    count = (await db.execute(
        select(func.count()).select_from(Payment).where(Payment.details.has_key("invoice_number"))
    )).scalar() or 0
    return f"HYB-{_now():%Y}-{count + 1:04d}"


async def trial_invoice(db: AsyncSession, organization_id) -> Payment | None:
    """The organization's most recent trial invoice, if any."""
    return (await db.execute(
        select(Payment).where(
            Payment.organization_id == organization_id,
            Payment.details.has_key("invoice_number"),
        ).order_by(Payment.created_at.desc()).limit(1)
    )).scalar_one_or_none()


def _lines(plan_name: str, seats: dict[str, int], currency: str, plan_usd: float) -> list[dict]:
    if currency == "INR":
        plan_amount = INR_PLAN_PRICES.get(plan_name, round(plan_usd * 96))
    else:
        plan_amount = plan_usd
    lines = [{"label": f"Hybent Hiring {plan_name} plan, 1 month", "quantity": 1, "amount": plan_amount}]
    for role, n in seats.items():
        if not n:
            continue
        usd = billing_service.EXTRA_SEATS[role][0]
        each = (INR_SEAT_PRICES.get(role) or round(usd * 96)) if currency == "INR" else usd
        lines.append({"label": f"Extra {role} seat{'s' if n > 1 else ''}, 1 month", "quantity": n, "amount": each * n})
    return lines


async def create_trial_invoice(db: AsyncSession, req: TrialRequest, sub: CompanySubscription) -> Payment:
    """Issue the invoice for a trial ending tomorrow and extend the workspace's
    access to the due date. Caller commits."""
    from app.services.trial_service import PLAN_LABELS

    plan_name = PLAN_LABELS.get(req.plan_interest, "Pro")
    plan = await billing_service.find_plan(db, plan_name)
    if plan is None:
        raise RuntimeError(f"Plan {plan_name!r} not found for the trial invoice.")
    seats = billing_service.extra_seat_counts(sub)
    currency = "INR" if is_india(req.country) else "USD"
    lines = _lines(plan.name, seats, currency, plan.price_monthly)
    total = round(sum(line["amount"] for line in lines), 2)
    issued = _now()
    due = req.trial_end + timedelta(days=GRACE_DAYS)

    payment = Payment(
        organization_id=req.organization_id,
        kind="subscription",
        status="pending",
        # The field predates other currencies: it holds the amount in `currency`.
        amount_usd=total,
        currency=currency,
        description=f"{plan.name} plan (invoice)",
        details={
            "invoice_number": await _next_number(db),
            "source": "trial",
            "method": "manual",
            "trial_request_id": str(req.id),
            "plan_name": plan.name,
            "term_months": 1,
            "recurring": False,
            "extra_admin_seats": seats.get("admin", 0),
            "extra_recruiter_seats": seats.get("recruiter", 0),
            "lines": lines,
            "issued_at": issued.isoformat(),
            "due_at": due.isoformat(),
            "billed_to": {
                "company": req.company_name,
                "contact": req.contact_name,
                "email": req.contact_email,
                "phone": req.contact_phone,
                "country": req.country or "",
                "website": req.company_website,
            },
        },
        token=secrets.token_urlsafe(32),
        expires_at=due,
    )
    db.add(payment)
    # Grace: the workspace keeps working until the invoice is due.
    sub.trial_end = max(sub.trial_end or req.trial_end, due)
    await db.flush()
    return payment


# ── Public view / PDF ────────────────────────────────────────────────────────

def invoice_url(payment: Payment) -> str:
    return f"{settings.frontend_url.rstrip('/')}/invoice/{payment.token}"


def _dt(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value) if value else None
    except ValueError:
        return None


def invoice_to_dict(payment: Payment, org_name: str | None = None, payment_details: dict | None = None) -> dict:
    d = payment.details or {}
    data = {
        "id": str(payment.id),
        "organization_id": str(payment.organization_id),
        "organization_name": org_name,
        "invoice_number": d.get("invoice_number"),
        "status": "overdue" if payment.status == "pending" and _dt(d.get("due_at")) and _dt(d["due_at"]) < _now()
        else payment.status,
        "currency": payment.currency,
        "total": payment.amount_usd,
        "total_label": money(payment.amount_usd, payment.currency),
        "lines": [{**line, "amount_label": money(line["amount"], payment.currency)} for line in d.get("lines", [])],
        "plan_name": d.get("plan_name"),
        "issued_at": d.get("issued_at"),
        "due_at": d.get("due_at"),
        "paid_at": payment.paid_at,
        "billed_to": d.get("billed_to", {}),
        "paid_method": d.get("paid_method"),
        "paid_reference": d.get("paid_reference"),
        "business": BUSINESS,
        "url": invoice_url(payment) if payment.token else None,
    }
    if payment_details is not None:
        data["payment_details"] = payment_details
    return data


def _row(label: str, value: str) -> str:
    return (f"<tr><td style='padding:3px 14px 3px 0;color:#6b7280'>{html.escape(label)}</td>"
            f"<td style='padding:3px 0'>{html.escape(value)}</td></tr>") if value else ""


def payment_details_html(pd: dict) -> str:
    rows = "".join([
        _row("Account name", pd.get("account_name", "")),
        _row("Bank", pd.get("bank_name", "")),
        _row("Account number", pd.get("account_number", "")),
        _row("IFSC", pd.get("ifsc", "")),
        _row("Branch", pd.get("branch", "")),
        _row("UPI ID", pd.get("upi_id", "")),
    ])
    note = f"<p style='color:#6b7280'>{html.escape(pd['note'])}</p>" if pd.get("note") else ""
    if not rows:
        rows = _row("Payment details", f"Reply to this email or WhatsApp {CONTACT_PHONE} for payment details.")
    return f"<table style='border-collapse:collapse;font-size:14px'>{rows}</table>{note}"


def invoice_html(inv: dict) -> str:
    """A self-contained A4 invoice (also rendered to PDF by xhtml2pdf, so
    plain tables and inline styles only)."""
    b, to = inv["business"], inv["billed_to"]
    issued = _dt(inv["issued_at"])
    due = _dt(inv["due_at"])
    lines = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #e5e7eb'>{html.escape(line['label'])}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;text-align:center'>{line.get('quantity', 1)}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;text-align:right'>{html.escape(line['amount_label'])}</td></tr>"
        for line in inv["lines"]
    )
    paid = (f"<p style='color:#047857;font-weight:bold'>PAID on {inv['paid_at']:%d %b %Y}</p>"
            if inv["status"] == "paid" and inv.get("paid_at") else "")
    pay = (f"<h3 style='margin:24px 0 6px'>How to pay</h3>{payment_details_html(inv.get('payment_details') or {})}"
           f"<p style='font-size:13px;color:#6b7280'>Please mention <b>{html.escape(inv['invoice_number'])}</b> "
           f"in the payment reference, then send the receipt to {b['email']} or WhatsApp {b['phone']}.</p>"
           if inv["status"] != "paid" else "")
    return f"""<html><head><meta charset="utf-8"><style>
      @page {{ size: A4; margin: 18mm; }}
      body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 14px; }}
    </style></head><body>
    <table width="100%"><tr>
      <td><div style="font-size:26px;font-weight:bold;letter-spacing:2px">{html.escape(b['name'])}</div>
          <div style="color:#6b7280">{html.escape(b['address'])}</div>
          <div style="color:#6b7280">Udyam: {html.escape(b['udyam'])}</div>
          <div style="color:#6b7280">{html.escape(b['email'])} · {html.escape(b['phone'])}</div></td>
      <td style="text-align:right;vertical-align:top">
          <div style="font-size:22px;font-weight:bold">INVOICE</div>
          <div>{html.escape(inv['invoice_number'])}</div>
          <div style="color:#6b7280">Issued {issued:%d %b %Y}</div>
          <div style="color:#6b7280">Due {due:%d %b %Y}</div></td>
    </tr></table>
    <h3 style="margin:24px 0 6px">Billed to</h3>
    <div><b>{html.escape(to.get('company', ''))}</b></div>
    <div>{html.escape(to.get('contact', ''))} · {html.escape(to.get('email', ''))}</div>
    <div style="color:#6b7280">{html.escape(to.get('country', ''))}</div>
    <table width="100%" style="border-collapse:collapse;margin-top:22px">
      <tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Description</th>
        <th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Amount</th></tr>
      {lines}
      <tr><td></td><td style="padding:10px 8px;text-align:right;font-weight:bold">Total</td>
        <td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px">{html.escape(inv['total_label'])}</td></tr>
    </table>
    {paid}{pay}
    <p style="font-size:12px;color:#9ca3af;margin-top:28px">No GST is charged: the supplier is not registered under GST.
    Thank you for choosing Hybent.</p>
    </body></html>"""


async def invoice_pdf(inv: dict) -> bytes:
    from app.services.offer_generator import generate_offer_pdf

    # The PDF's built-in fonts have no ₹ glyph (it prints as a box).
    return await generate_offer_pdf(invoice_html(inv).replace("₹", "Rs. "))


# ── Emails and alerts ────────────────────────────────────────────────────────

def _customer_email(to: str, name: str | None, inv: dict) -> bool:
    first = html.escape((name or "").split()[0] if name and name.split() else "there")
    due = _dt(inv["due_at"])
    content = f"""
        <h2 style="margin-top:20px">Your Hybent invoice {html.escape(inv['invoice_number'])}</h2>
        <p>Hi {first},</p>
        <p>Your 7-day free trial of Hybent Hiring for <b>{html.escape(inv['billed_to'].get('company', ''))}</b>
        ends tomorrow. To keep your workspace and everything in it, here is the invoice for the
        <b>{html.escape(inv['plan_name'] or '')}</b> plan: <b>{html.escape(inv['total_label'])}</b>,
        due by <b>{due:%d %B %Y}</b>.</p>
        <p>Your team keeps full access until then.</p>
        <div class="button-wrap"><a href="{inv['url']}" class="button">View &amp; download invoice</a></div>
        <h3>How to pay</h3>
        {payment_details_html(inv.get('payment_details') or {})}
        <p>Please mention <b>{html.escape(inv['invoice_number'])}</b> in the payment reference and send the
        receipt by replying to this email or on WhatsApp at <b>{CONTACT_PHONE}</b>. We'll activate your plan
        as soon as it arrives.</p>
        <p>Questions? Reply to this email or call/WhatsApp {CONTACT_PHONE}.</p>
    """
    return send_email(to, f"Invoice {inv['invoice_number']}: your Hybent plan", _get_base_template(content, org_name="Hybent Hiring"),
                      from_name="Hybent", reply_to=TEAM_EMAIL)


def _team_email(inv: dict) -> bool:
    to = inv["billed_to"]
    content = f"""
        <h2 style="margin-top:20px">Trial invoice sent: {html.escape(inv['invoice_number'])}</h2>
        <table>{_row('Company', to.get('company', ''))}{_row('Contact', to.get('contact', ''))}
        {_row('Email', to.get('email', ''))}{_row('Phone', to.get('phone', ''))}{_row('Country', to.get('country', ''))}
        {_row('Plan', inv['plan_name'] or '')}{_row('Amount', inv['total_label'])}
        {_row('Due', f"{_dt(inv['due_at']):%d %B %Y}")}</table>
        <div class="button-wrap"><a href="{settings.frontend_url.rstrip('/')}/hiring/super-admin/invoices" class="button">Open invoices</a></div>
        <p>When the money arrives, mark it paid there to activate their plan.</p>
    """
    return send_email(TEAM_EMAIL, f"Trial invoice {inv['invoice_number']} sent to {to.get('company', '')}",
                      _get_base_template(content, org_name="Hybent"))


def _receipt_email(to: str, name: str | None, inv: dict) -> bool:
    first = html.escape((name or "").split()[0] if name and name.split() else "there")
    content = f"""
        <h2 style="margin-top:20px">Payment received, thank you</h2>
        <p>Hi {first},</p>
        <p>We've received {html.escape(inv['total_label'])} for invoice <b>{html.escape(inv['invoice_number'])}</b>.
        <b>{html.escape(inv['billed_to'].get('company', ''))}</b> is now on the <b>{html.escape(inv['plan_name'] or '')}</b> plan,
        with everything from your trial kept.</p>
        <div class="button-wrap"><a href="{inv['url']}" class="button">View paid invoice</a></div>
        <p>Questions? Reply to this email or call/WhatsApp {CONTACT_PHONE}.</p>
    """
    return send_email(to, f"Payment received: invoice {inv['invoice_number']}",
                      _get_base_template(content, org_name="Hybent Hiring"), from_name="Hybent", reply_to=TEAM_EMAIL)


async def _admins(db: AsyncSession, organization_id) -> list[User]:
    return list((await db.execute(
        select(User).where(User.organization_id == organization_id, User.role == "admin", User.is_active.is_(True))
    )).scalars().all())


WHATSAPP_TEMPLATE = "trial_invoice"


async def _whatsapp_invoice(db: AsyncSession, payment: Payment, inv: dict) -> bool:
    """The invoice on WhatsApp too, only if the company agreed to WhatsApp
    updates on the trial form and the template is approved. Email stays the
    main channel; this never raises."""
    from app.services import whatsapp_service
    from app.services.sms_service import msisdn

    try:
        req_id = (payment.details or {}).get("trial_request_id")
        req = await db.get(TrialRequest, uuid_or_none(req_id)) if req_id else None
        to = msisdn(req.contact_phone) if req else None
        if not (req and req.whatsapp_opt_in and to and whatsapp_service.configured()):
            return False
        name = f"hybent_{WHATSAPP_TEMPLATE}"
        status = (await asyncio.to_thread(whatsapp_service.template_status)).get(name)
        if status != "APPROVED":
            logger.info(f"Invoice WhatsApp skipped: template {name} is {status or 'missing'}.")
            return False
        variables = ("name", "number", "amount", "due", "link")
        values = {
            "name": (req.contact_name or "").split(" ")[0] or "there",
            "number": inv["invoice_number"],
            # Template text can't hold ₹ reliably on every phone.
            "amount": inv["total_label"].replace("₹", "Rs. "),
            "due": f"{_dt(inv['due_at']):%d %b %Y}",
            "link": inv["url"],
        }
        await asyncio.to_thread(whatsapp_service.send_event, WHATSAPP_TEMPLATE, to, variables, values)
        return True
    except Exception:
        logger.exception(f"Invoice WhatsApp for payment {payment.id} failed; the email went out.")
        return False


def uuid_or_none(value):
    import uuid

    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


async def send_invoice(db: AsyncSession, payment: Payment) -> int:
    """Email the invoice to the organization's admins (or the trial contact),
    tell the Hybent team, and raise a super admin alert. Returns how many
    customer emails went out. Never raises."""
    from app.tasks.notifications import alert_super_admins, notify_organization_roles

    org = await db.get(Organization, payment.organization_id)
    inv = invoice_to_dict(payment, org.name if org else None, await get_payment_details(db))
    recipients = {u.email: u.full_name for u in await _admins(db, payment.organization_id)}
    if not recipients and inv["billed_to"].get("email"):
        recipients[inv["billed_to"]["email"]] = inv["billed_to"].get("contact")
    sent = 0
    for email, name in recipients.items():
        try:
            if await asyncio.to_thread(_customer_email, email, name, inv):
                sent += 1
        except Exception:
            logger.exception(f"Invoice email to {email} failed.")
    try:
        await asyncio.to_thread(_team_email, inv)
    except Exception:
        logger.exception("Invoice team email failed.")
    await _whatsapp_invoice(db, payment, inv)
    alert_super_admins(
        "Trial invoice sent",
        f"{inv['billed_to'].get('company', 'A client')}: {inv['invoice_number']} for {inv['total_label']}, "
        f"due {_dt(inv['due_at']):%d %b}.",
        "/hiring/super-admin/invoices", event="trial_invoice",
    )
    try:
        notify_organization_roles.delay(
            str(payment.organization_id), ["admin"], "trial", f"Invoice {inv['invoice_number']}",
            f"Your trial ends tomorrow. Pay {inv['total_label']} by {_dt(inv['due_at']):%d %b} to keep your workspace.",
            {"kind": "trial_invoice", "url": inv["url"]},
        )
    except Exception:
        logger.warning("Couldn't queue the invoice notification.")
    return sent


def _overdue_email(to: str, name: str | None, inv: dict, purge_at: datetime) -> bool:
    first = html.escape((name or "").split()[0] if name and name.split() else "there")
    content = f"""
        <h2 style="margin-top:20px">Your Hybent workspace is paused</h2>
        <p>Hi {first},</p>
        <p>Invoice <b>{html.escape(inv['invoice_number'])}</b> ({html.escape(inv['total_label'])}) wasn't paid by its
        due date, so your team's access is paused. Your data is safe until <b>{purge_at:%d %B %Y}</b>.</p>
        <p>Pay the invoice and send us the receipt, and we'll restore everything straight away.</p>
        <div class="button-wrap"><a href="{inv['url']}" class="button">View invoice &amp; payment details</a></div>
        <p>Need more time or have a question? Reply to this email or call/WhatsApp {CONTACT_PHONE}.</p>
    """
    return send_email(to, f"Workspace paused: invoice {inv['invoice_number']} is overdue",
                      _get_base_template(content, org_name="Hybent Hiring"), from_name="Hybent", reply_to=TEAM_EMAIL)


async def send_overdue(db: AsyncSession, payment: Payment, purge_at: datetime) -> None:
    """The due date passed unpaid: tell the admins (access is now paused) and the team. Never raises."""
    from app.tasks.notifications import alert_super_admins

    try:
        org = await db.get(Organization, payment.organization_id)
        inv = invoice_to_dict(payment, org.name if org else None)
        for user in await _admins(db, payment.organization_id):
            await asyncio.to_thread(_overdue_email, user.email, user.full_name, inv, purge_at)
        alert_super_admins(
            "Trial invoice overdue",
            f"{inv['billed_to'].get('company', 'A client')}: {inv['invoice_number']} ({inv['total_label']}) unpaid; access paused.",
            "/hiring/super-admin/invoices", event="trial_invoice",
        )
    except Exception:
        logger.exception(f"Overdue notice for payment {payment.id} failed.")


# ── Marking paid ─────────────────────────────────────────────────────────────

async def mark_paid(db: AsyncSession, payment: Payment, by: User, method: str, reference: str | None) -> Payment:
    """Record a manual payment for an invoice and activate the plan, the same
    way a Stripe payment is applied. Caller holds a lock on `payment`."""
    from app.services import payment_service

    if payment.status == "paid":
        return payment
    org = await db.get(Organization, payment.organization_id)
    payment.status = "paid"
    payment.paid_at = _now()
    payment.details = {
        **payment.details,
        "paid_method": (method or "bank_transfer")[:40],
        "paid_reference": (reference or "")[:120],
        "marked_paid_by": str(by.id),
    }
    welcome = await payment_service._apply_subscription(db, payment, org, {})
    await db.commit()
    await payment_service._after_payment(db, payment, welcome)
    inv = invoice_to_dict(payment, org.name if org else None)
    for user in await _admins(db, payment.organization_id):
        try:
            await asyncio.to_thread(_receipt_email, user.email, user.full_name, inv)
        except Exception:
            logger.exception(f"Receipt email to {user.email} failed.")
    return payment
