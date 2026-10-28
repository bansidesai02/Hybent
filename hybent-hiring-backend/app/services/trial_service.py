"""The 7-day free trial.

1. A company requests a trial on hybent.com/free-trial (routers/trials.py).
   Only business email domains are accepted, and a domain gets one trial.
2. A super admin approves it: the organization and its admin are created on
   the hidden Trial plan (Pro features, 1 admin + 1 recruiter seat, 500 AI
   credits) with company_subscriptions.is_trial set and trial_end 7 days out.
3. process_lifecycle (Celery beat, every 5 minutes) sends the 1-day and
   1-hour reminders, marks the trial expired, warns 7 days before the purge,
   and purges the organization 30 days after expiry.
4. Access ends exactly at trial_end whatever the job's timing: trial_access
   is checked on every request (dependencies.get_current_user). After that
   only admins get in, and only to billing, export and their account.
5. Paying for Standard or Pro (payment_service._apply_subscription) calls
   mark_converted, which ends the trial and keeps the data.

Only subscriptions with is_trial are affected. trial_end on older
subscriptions was never enforced and still isn't.
"""
import asyncio
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.organization import Organization
from app.models.super_admin import CompanyFeatureFlag, CompanySubscription
from app.models.trial_request import OPEN_STATUSES, TrialEmailOTP, TrialRequest
from app.models.user import RefreshToken, User
from app.services import billing_service, email_service, lead_checks
from app.utils.permissions import UserRole
from app.utils.security import hash_password

logger = logging.getLogger(__name__)

TRIAL_DAYS = 7
# The plan a trial upgrades to by default, by the plan it was requested for.
PLAN_LABELS = {"standard": "Standard", "pro": "Pro"}
# Expired trial data is kept this long for an upgrade, then deleted.
RETENTION_DAYS = 30
PURGE_WARNING_DAYS = 7
# Email verification on the trial form.
OTP_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60
OTP_MAX_PER_HOUR = 5
# A verified email must be used for a request within this long.
VERIFIED_VALID_MINUTES = 60

# After expiry an admin can still reach these, to upgrade or export.
EXPIRED_ALLOWED_PREFIXES = (
    "/v1/billing", "/v1/trial", "/v1/auth/", "/v1/users/me", "/v1/notifications", "/v1/payments",
)
EXPIRED_DETAIL = {
    "code": "trial_expired",
    "message": "Your free trial has ended. Choose a plan on the Billing page to continue.",
}
EXPIRED_MEMBER_DETAIL = {
    "code": "trial_expired",
    "message": "Your organization's free trial has ended. Ask your admin to choose a plan.",
}

# Trials that have ever been granted: a domain in one of these can't have another.
USED_STATUSES = ("active", "expired", "converted", "purged")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Request ──────────────────────────────────────────────────────────────────

def website_domain(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _same_company(email_domain: str, site_domain: str) -> bool:
    """acme.com matches acme.com, careers.acme.com and the other way round."""
    if not email_domain or not site_domain:
        return False
    return (
        email_domain == site_domain
        or email_domain.endswith("." + site_domain)
        or site_domain.endswith("." + email_domain)
    )


def field_error(field: str, message: str, status_code: int = 422) -> HTTPException:
    """An error the form shows under the field it names."""
    return HTTPException(status_code=status_code, detail={"message": message, "field": field})


async def ensure_can_request(db: AsyncSession, domain: str, email: str) -> None:
    """One open request or trial per domain, one trial per domain ever, and
    no trial for someone who already has a Hybent account."""
    if await db.scalar(select(func.count(User.id)).where(func.lower(User.email) == email)):
        raise field_error(
            "contact_email", "This email already has a Hybent account. Sign in, or use another work email.", 409,
        )
    if settings.trial_testing_mode:
        return  # testing: a company may request again (see _supersede_for_testing)
    prior = (await db.execute(
        select(TrialRequest.status).where(
            or_(TrialRequest.company_domain == domain, TrialRequest.contact_email == email),
            TrialRequest.status.in_(OPEN_STATUSES + USED_STATUSES),
        )
    )).scalars().all()
    if any(s == "pending" for s in prior):
        raise field_error(
            "contact_email", "A trial request for your company is already being reviewed. We'll email you soon.", 409,
        )
    if prior:
        raise field_error(
            "contact_email",
            "Your company has already had a free trial. Contact info@hybent.com to talk about a plan.", 409,
        )


async def validate_email_domain(email: str) -> str:
    domain = lead_checks.email_domain(email)
    if domain in lead_checks.FREE_EMAIL_DOMAINS or domain in lead_checks.DISPOSABLE_DOMAINS:
        raise field_error("contact_email", "Please use your work email. Personal and temporary email addresses can't start a trial.")
    if not await lead_checks.domain_accepts_mail(domain):
        raise field_error("contact_email", f"{domain} can't receive email. Please check the spelling.")
    return domain


def _hash_code(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code}:{settings.secret_key}".encode()).hexdigest()


async def send_code(db: AsyncSession, email: str, ip: str | None) -> None:
    """Email a 6-digit code to a work address, after the same checks a
    request gets (so nobody verifies an address that can't have a trial)."""
    domain = await validate_email_domain(email)
    await ensure_can_request(db, domain, email)
    now = _now()
    recent = list((await db.execute(
        select(TrialEmailOTP).where(TrialEmailOTP.email == email, TrialEmailOTP.created_at > now - timedelta(hours=1))
        .order_by(TrialEmailOTP.created_at.desc())
    )).scalars().all())
    if recent and (now - recent[0].created_at).total_seconds() < OTP_RESEND_SECONDS:
        wait = OTP_RESEND_SECONDS - int((now - recent[0].created_at).total_seconds())
        raise field_error("contact_email", f"Please wait {wait} seconds before asking for another code.", 429)
    if len(recent) >= OTP_MAX_PER_HOUR and not settings.trial_testing_mode:
        raise field_error("contact_email", "Too many codes sent to this email. Please try again in an hour.", 429)

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(TrialEmailOTP(
        email=email, code_hash=_hash_code(email, code), expires_at=now + timedelta(minutes=OTP_MINUTES), ip_address=ip,
    ))
    await db.commit()
    sent = await asyncio.to_thread(email_service.send_trial_otp_email, email, code, OTP_MINUTES)
    if not sent:
        raise field_error("contact_email", "We couldn't send the code. Please try again, or email info@hybent.com.", 502)


async def verify_code(db: AsyncSession, email: str, code: str) -> str:
    """Check the latest code for the email; returns a token the form submits."""
    otp = (await db.execute(
        select(TrialEmailOTP).where(TrialEmailOTP.email == email, TrialEmailOTP.verified_at.is_(None))
        .order_by(TrialEmailOTP.created_at.desc()).limit(1).with_for_update()
    )).scalar_one_or_none()
    if otp is None or otp.expires_at <= _now():
        raise field_error("otp", "This code has expired. Ask for a new one.")
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        raise field_error("otp", "Too many wrong attempts. Ask for a new code.")
    if not hmac.compare_digest(otp.code_hash, _hash_code(email, code.strip())):
        otp.attempts += 1
        await db.commit()
        left = OTP_MAX_ATTEMPTS - otp.attempts
        if not left:
            raise field_error("otp", "Too many wrong attempts. Ask for a new code.")
        raise field_error("otp", f"That code isn't right. {left} attempt{'s' if left != 1 else ''} left.")
    otp.verified_at = _now()
    otp.verification_token = secrets.token_urlsafe(32)
    await db.commit()
    return otp.verification_token


async def _take_verification(db: AsyncSession, email: str, token: str | None) -> TrialEmailOTP:
    """The verified, unused code behind a request's token; marks it used."""
    otp = None
    if token:
        otp = (await db.execute(
            select(TrialEmailOTP).where(TrialEmailOTP.verification_token == token).with_for_update()
        )).scalar_one_or_none()
    if (
        otp is None or otp.email != email or otp.used_at is not None or otp.verified_at is None
        or otp.verified_at < _now() - timedelta(minutes=VERIFIED_VALID_MINUTES)
    ):
        raise field_error("contact_email", "Please verify your work email with the code we send you.")
    otp.used_at = _now()
    return otp


# ── Organization setup (/setup?token=...) ────────────────────────────────────

async def setup_request(db: AsyncSession, token: str, lock: bool = False) -> TrialRequest:
    """The approved trial behind a setup link, if the link still works."""
    if not token:
        raise HTTPException(status_code=404, detail="This setup link isn't valid.")
    query = select(TrialRequest).where(TrialRequest.setup_token == token)
    if lock:
        query = query.with_for_update()
    req = (await db.execute(query)).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="This setup link isn't valid or has already been used. Sign in to continue.")
    if req.status != "active" or not req.trial_end or req.trial_end <= _now():
        raise HTTPException(
            status_code=410,
            detail="This setup link has expired with the trial. Email info@hybent.com to talk about a plan.",
        )
    return req


async def complete_setup(db: AsyncSession, req: TrialRequest, data) -> User:
    """Set the admin's password and the organization's profile and branding."""
    org = await db.get(Organization, req.organization_id)
    admin = (await db.execute(
        select(User).where(User.organization_id == req.organization_id, func.lower(User.email) == req.contact_email)
    )).scalar_one_or_none()
    if org is None or admin is None:
        raise HTTPException(status_code=409, detail="This trial workspace no longer exists. Email info@hybent.com.")
    admin.hashed_password = hash_password(data.password)
    admin.full_name = data.full_name.strip() or admin.full_name
    admin.is_active = True
    org.name = data.company_name.strip()
    org.website = data.website or org.website
    org.industry = data.industry or org.industry
    org.size = data.size or org.size
    if data.timezone:
        org.timezone = data.timezone
    org.logo_url = data.logo_url or org.logo_url
    org.brand_color = data.brand_color
    org.email_sender_name = (data.email_sender_name or "").strip() or None
    req.setup_completed_at = _now()
    req.setup_token = None
    return admin


async def _supersede_for_testing(db: AsyncSession, domain: str) -> None:
    """Testing mode only: close the domain's open request or running trial so
    a new request fits the one-open-request-per-domain index."""
    for old in (await db.execute(
        select(TrialRequest).where(TrialRequest.company_domain == domain, TrialRequest.status.in_(OPEN_STATUSES))
    )).scalars().all():
        old.admin_notes = ((old.admin_notes or "") + "\n[testing] Superseded by a newer request.").strip()
        old.status = "rejected" if old.status == "pending" else "expired"
        old.setup_token = None
    await db.flush()


async def create_request(db: AsyncSession, body, ip: str | None, user_agent: str | None) -> TrialRequest:
    email = body.contact_email
    domain = await validate_email_domain(email)

    phone = lead_checks.parse_phone(body.contact_phone)
    if phone is None:
        raise field_error("contact_phone", "That phone number isn't valid for the selected country.")

    await ensure_can_request(db, domain, email)
    otp = await _take_verification(db, email, body.email_verification_token)
    if settings.trial_testing_mode:
        await _supersede_for_testing(db, domain)

    site = website_domain(body.company_website)
    flags = []
    if not _same_company(domain, site):
        flags.append(f"Email domain ({domain}) doesn't match the website ({site or 'none'})")
        # domain_accepts_mail falls back to the A record, so this is "the site exists".
        if site and not await lead_checks.domain_accepts_mail(site):
            flags.append(f"Website domain {site} doesn't resolve")

    req = TrialRequest(
        company_name=body.company_name,
        company_website=body.company_website,
        company_domain=domain,
        company_linkedin_url=body.company_linkedin_url,
        company_size=body.company_size,
        industry=body.industry,
        country=body.country,
        hires_per_year=body.hires_per_year,
        contact_name=body.contact_name,
        contact_title=body.contact_title,
        contact_email=email,
        contact_phone=phone[0],
        contact_linkedin_url=body.contact_linkedin_url,
        hiring_needs=body.hiring_needs,
        plan_interest=body.plan,
        ip_address=ip,
        user_agent=(user_agent or "")[:500] or None,
        risk_flags=flags,
        status="pending",
        email_verified_at=otp.verified_at,
    )
    db.add(req)
    try:
        await db.commit()
    except Exception:
        # The partial unique index: another request for this domain landed first.
        await db.rollback()
        raise field_error(
            "contact_email", "A trial request for your company is already being reviewed. We'll email you soon.", 409,
        )
    await db.refresh(req)
    return req


def request_rows(req: TrialRequest) -> list[tuple[str, str]]:
    return [
        ("Company", req.company_name),
        ("Website", req.company_website),
        ("Company LinkedIn", req.company_linkedin_url),
        ("Size", req.company_size or ""),
        ("Industry", req.industry or ""),
        ("Country", req.country or ""),
        ("Hires per year", req.hires_per_year or ""),
        ("Plan to try", PLAN_LABELS.get(req.plan_interest, req.plan_interest)),
        ("Contact", f"{req.contact_name}, {req.contact_title}"),
        ("Email", req.contact_email),
        ("Phone", req.contact_phone),
        ("LinkedIn", req.contact_linkedin_url),
        ("Hiring needs", req.hiring_needs or ""),
        ("Checks", " · ".join(req.risk_flags) if req.risk_flags else "✅ Email domain matches website"),
    ]


# ── Review ───────────────────────────────────────────────────────────────────

async def lock_request(db: AsyncSession, request_id: uuid.UUID) -> TrialRequest:
    req = (await db.execute(
        select(TrialRequest).where(TrialRequest.id == request_id).with_for_update()
    )).scalar_one_or_none()
    if req is None:
        raise HTTPException(status_code=404, detail="Trial request not found.")
    return req


async def _unique_slug(db: AsyncSession, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "company"
    while True:
        slug = f"{base}-{secrets.token_hex(3)}"
        if not await db.scalar(select(func.count(Organization.id)).where(Organization.slug == slug)):
            return slug


async def approve(db: AsyncSession, req: TrialRequest, reviewer: User) -> str:
    """Create the trial organization and its admin. Returns the admin's
    set-password token; the caller commits and then emails it."""
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"This request is already {req.status}.")
    # Things may have changed since the request came in.
    if await db.scalar(select(func.count(User.id)).where(func.lower(User.email) == req.contact_email)):
        raise HTTPException(status_code=409, detail="This email already has a Hybent account.")
    if not settings.trial_testing_mode and await db.scalar(select(func.count(TrialRequest.id)).where(
        TrialRequest.company_domain == req.company_domain,
        TrialRequest.id != req.id,
        TrialRequest.status.in_(USED_STATUSES),
    )):
        raise HTTPException(status_code=409, detail="This company domain has already had a trial.")

    plan_name = billing_service.TRIAL_PLANS.get(req.plan_interest, billing_service.TRIAL_PLANS["pro"])
    plan = await billing_service.find_plan(db, plan_name)
    if plan is None:
        raise HTTPException(status_code=500, detail=f"The {plan_name} plan is missing. Run the database migrations.")

    now = _now()
    trial_end = now + timedelta(days=TRIAL_DAYS)

    org = Organization(
        name=req.company_name,
        slug=await _unique_slug(db, req.company_name),
        industry=req.industry,
        size=req.company_size,
        is_active=True,
    )
    db.add(org)
    await db.flush()

    admin = User(
        organization_id=org.id,
        email=req.contact_email,
        full_name=req.contact_name,
        hashed_password=hash_password(secrets.token_urlsafe(24)),
        role=UserRole.ADMIN.value,
        is_active=True,
        is_verified=True,
    )
    db.add(admin)
    await db.flush()

    sub = CompanySubscription(organization_id=org.id, plan_id=plan.id, status="active", is_trial=True)
    billing_service.assign_plan(sub, plan)
    sub.current_period_start = now
    sub.current_period_end = trial_end
    sub.trial_end = trial_end
    db.add(sub)

    # Org flags override the plan, so the plan's own features are written
    # (create_client's defaults would turn analytics off).
    # AI phone calls cost per minute: off for trials until a super admin turns them on.
    for flag, enabled in {**(plan.features or {}), "ai_calls": False}.items():
        db.add(CompanyFeatureFlag(organization_id=org.id, flag_key=flag, is_enabled=enabled))

    # The organization setup link (/setup?token=...): one use, until the trial ends.
    token = secrets.token_urlsafe(32)
    req.setup_token = token

    req.status = "active"
    req.organization_id = org.id
    req.reviewed_by_id = reviewer.id
    req.reviewed_at = now
    req.trial_start = now
    req.trial_end = trial_end
    await db.flush()
    return token


def reject(req: TrialRequest, reviewer: User, reason: str) -> None:
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"This request is already {req.status}.")
    req.status = "rejected"
    req.rejection_reason = reason
    req.reviewed_by_id = reviewer.id
    req.reviewed_at = _now()


async def extend(db: AsyncSession, req: TrialRequest, days: int) -> None:
    """More trial time while it runs, or more time to upgrade once expired."""
    delta = timedelta(days=days)
    if req.status == "active":
        sub = await _subscription(db, req.organization_id)
        base = max(req.trial_end, _now())
        req.trial_end = base + delta
        if sub:
            sub.trial_end = req.trial_end
            sub.current_period_end = req.trial_end
        req.reminder_1d_sent_at = None
        req.reminder_1h_sent_at = None
    elif req.status == "expired":
        req.data_purge_at = max(req.data_purge_at or _now(), _now()) + delta
        req.purge_warning_sent_at = None
    else:
        raise HTTPException(status_code=409, detail="Only active or expired trials can be extended.")


# ── Access ───────────────────────────────────────────────────────────────────

async def _subscription(db: AsyncSession, organization_id) -> CompanySubscription | None:
    if organization_id is None:
        return None
    return (await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == organization_id)
    )).scalar_one_or_none()


async def trial_access(db: AsyncSession, organization_id) -> str | None:
    """None for organizations not on a trial, else "active" or "expired"."""
    row = (await db.execute(
        select(CompanySubscription.trial_end).where(
            CompanySubscription.organization_id == organization_id,
            CompanySubscription.is_trial.is_(True),
        )
    )).first()
    if row is None:
        return None
    trial_end = row[0]
    return "expired" if trial_end is None or _now() >= trial_end else "active"


def check_expired_access(role: str, path: str) -> None:
    """Raise for a request an expired trial organization can't make."""
    if role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail=EXPIRED_MEMBER_DETAIL)
    if not path.startswith(EXPIRED_ALLOWED_PREFIXES):
        raise HTTPException(status_code=402, detail=EXPIRED_DETAIL)


async def org_is_usable(db: AsyncSession, organization_id) -> bool:
    """For background work done on an organization's behalf."""
    return await trial_access(db, organization_id) != "expired"


async def status_for_org(db: AsyncSession, organization_id) -> dict | None:
    sub = await _subscription(db, organization_id)
    if not sub or not sub.is_trial:
        return None
    req = (await db.execute(
        select(TrialRequest).where(TrialRequest.organization_id == organization_id)
    )).scalar_one_or_none()
    state = "expired" if not sub.trial_end or _now() >= sub.trial_end else "active"
    purge_at = req.data_purge_at if req else None
    if state == "expired" and purge_at is None and sub.trial_end:
        purge_at = sub.trial_end + timedelta(days=RETENTION_DAYS)
    return {
        "is_trial": True,
        "status": state,
        "trial_start": req.trial_start if req else sub.current_period_start,
        "trial_end": sub.trial_end,
        "data_purge_at": purge_at,
        "seconds_left": max(0, int((sub.trial_end - _now()).total_seconds())) if sub.trial_end else 0,
        "upgrade_plans": list(billing_service.SELF_SERVE_PLANS),
        # The plan this trial mirrors, suggested first when upgrading.
        "plan": PLAN_LABELS.get(req.plan_interest, "Pro") if req else "Pro",
        # Upgrading online needs Stripe; otherwise it's arranged by email.
        "payments_enabled": settings.stripe_enabled,
    }


# ── Conversion ───────────────────────────────────────────────────────────────

async def mark_converted(db: AsyncSession, organization_id, sub: CompanySubscription) -> bool:
    """A trial organization paid for a plan: end the trial, keep the data,
    and start the new plan's credits from zero used."""
    if not sub.is_trial:
        return False
    sub.is_trial = False
    req = (await db.execute(
        select(TrialRequest).where(TrialRequest.organization_id == organization_id).with_for_update()
    )).scalar_one_or_none()
    if req:
        req.status = "converted"
        req.converted_at = _now()
        req.data_purge_at = None
    from app.services.ai_credit_service import AICreditsService
    credits = await AICreditsService.get_or_create_org_credits(db, organization_id, for_update=True)
    credits.used_credits = 0
    credits.reset_at = sub.current_period_end or (_now() + timedelta(days=30))
    from app.models.user_ai_credits import UserAICredits
    await db.execute(
        update(UserAICredits).where(UserAICredits.organization_id == organization_id).values(used_credits=0, daily_used=0)
    )
    logger.info(f"Trial organization {organization_id} converted to a paid plan.")
    return True


# ── Lifecycle (Celery beat) ──────────────────────────────────────────────────

async def _org_recipients(db: AsyncSession, organization_id, roles=("admin", "recruiter")) -> list[User]:
    return list((await db.execute(
        select(User).where(
            User.organization_id == organization_id, User.role.in_(roles), User.is_active.is_(True),
        )
    )).scalars().all())


def _notify(org_id, roles: list[str], title: str, message: str, data: dict) -> None:
    from app.tasks.notifications import notify_organization_roles
    from app.utils.permissions import NotificationType
    try:
        notify_organization_roles.delay(str(org_id), roles, NotificationType.TRIAL.value, title, message, data)
    except Exception:
        logger.exception(f"Couldn't queue the trial notification for {org_id}.")


async def _email_each(users: list[User], send, *args) -> None:
    for user in users:
        try:
            await asyncio.to_thread(send, user.email, user.full_name, *args)
        except Exception:
            logger.exception(f"Trial email to {user.email} failed.")


async def purge_org(db: AsyncSession, organization_id) -> None:
    """Delete a trial organization and everything in it. Every foreign key
    to organizations (and on to users, candidates, jobs...) is ON DELETE
    CASCADE or SET NULL, so one DELETE removes the tenant's rows, as the
    super admin's Delete client does. Stored resumes are removed first."""
    from app.services import supabase_storage_service

    candidate_ids = (await db.execute(
        select(Candidate.id).where(Candidate.organization_id == organization_id)
    )).scalars().all()
    for cid in candidate_ids:
        try:
            await supabase_storage_service.delete_candidate_files(str(organization_id), str(cid))
        except Exception:
            logger.exception(f"Couldn't delete stored files of candidate {cid}; continuing the purge.")
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id.in_(select(User.id).where(User.organization_id == organization_id)))
        .values(is_revoked=True)
    )
    await db.execute(delete(Organization).where(Organization.id == organization_id))


async def process_lifecycle(db: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Send due reminders, expire ended trials, warn about and run purges.
    Each step stamps its row in the same commit as it acts, so a retry or an
    overlapping run doesn't send anything twice."""
    now = now or _now()
    done = {"reminder_1d": 0, "reminder_1h": 0, "expired": 0, "purge_warning": 0, "purged": 0}

    async def due(*conditions):
        return list((await db.execute(
            select(TrialRequest).where(*conditions).with_for_update(skip_locked=True)
        )).scalars().all())

    # 1 day left (and more than an hour, or the 1-hour reminder covers it).
    for req in await due(
        TrialRequest.status == "active", TrialRequest.reminder_1d_sent_at.is_(None),
        TrialRequest.trial_end <= now + timedelta(days=1), TrialRequest.trial_end > now + timedelta(hours=1),
    ):
        req.reminder_1d_sent_at = now
        await db.commit()
        await _email_each(await _org_recipients(db, req.organization_id, ("admin",)),
                          email_service.send_trial_reminder_email, req.company_name, req.trial_end, "1 day")
        _notify(req.organization_id, ["admin", "recruiter"], "Your free trial ends in 1 day",
                "Upgrade to Standard or Pro from the Billing page to keep your workspace. You can also export your data there.",
                {"trial_end": req.trial_end.isoformat(), "kind": "trial_reminder"})
        done["reminder_1d"] += 1

    for req in await due(
        TrialRequest.status == "active", TrialRequest.reminder_1h_sent_at.is_(None),
        TrialRequest.trial_end <= now + timedelta(hours=1), TrialRequest.trial_end > now,
    ):
        req.reminder_1h_sent_at = now
        await db.commit()
        await _email_each(await _org_recipients(db, req.organization_id, ("admin",)),
                          email_service.send_trial_reminder_email, req.company_name, req.trial_end, "1 hour")
        _notify(req.organization_id, ["admin", "recruiter"], "Your free trial ends in 1 hour",
                "Upgrade now to avoid any interruption. Export your data from the Billing page if you need a copy.",
                {"trial_end": req.trial_end.isoformat(), "kind": "trial_reminder"})
        done["reminder_1h"] += 1

    for req in await due(TrialRequest.status == "active", TrialRequest.trial_end <= now):
        sub = await _subscription(db, req.organization_id)
        if sub is not None and not sub.is_trial:
            # Paid already; the payment's conversion didn't find this row.
            req.status = "converted"
            req.converted_at = req.converted_at or now
            await db.commit()
            continue
        req.status = "expired"
        req.data_purge_at = req.trial_end + timedelta(days=RETENTION_DAYS)
        req.expired_notice_sent_at = now
        if sub is not None:
            sub.status = "expired"
        await db.commit()
        await _email_each(await _org_recipients(db, req.organization_id, ("admin",)),
                          email_service.send_trial_expired_email, req.company_name, req.data_purge_at)
        _notify(req.organization_id, ["admin"], "Your free trial has ended",
                "Choose Standard or Pro on the Billing page to restore access for your team. "
                f"Your data is kept until {req.data_purge_at:%d %B %Y}.",
                {"kind": "trial_expired", "data_purge_at": req.data_purge_at.isoformat()})
        done["expired"] += 1

    for req in await due(
        TrialRequest.status == "expired", TrialRequest.purge_warning_sent_at.is_(None),
        TrialRequest.data_purge_at <= now + timedelta(days=PURGE_WARNING_DAYS), TrialRequest.data_purge_at > now,
    ):
        req.purge_warning_sent_at = now
        await db.commit()
        await _email_each(await _org_recipients(db, req.organization_id, ("admin",)),
                          email_service.send_trial_purge_warning_email, req.company_name, req.data_purge_at)
        done["purge_warning"] += 1

    for req in await due(TrialRequest.status == "expired", TrialRequest.data_purge_at <= now):
        sub = await _subscription(db, req.organization_id)
        if sub is not None and not sub.is_trial:
            req.status = "converted"
            req.converted_at = req.converted_at or now
            req.data_purge_at = None
            await db.commit()
            continue
        org_id = req.organization_id
        if org_id is not None:
            await purge_org(db, org_id)
        req.status = "purged"
        req.purged_at = now
        req.organization_id = None
        await db.commit()
        logger.info(f"Purged expired trial organization {org_id} ({req.company_domain}).")
        done["purged"] += 1

    await db.commit()
    return done
