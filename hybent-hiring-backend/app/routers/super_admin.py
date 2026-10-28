import uuid
import logging
import time
import secrets
from datetime import datetime, timezone, timedelta
import csv
import io

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import String, cast, select, func, text, update, or_
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import DB, SuperAdminUser, CurrentUser
from app.models.organization import Organization
from app.models.user import User, RefreshToken
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.import_batch import ImportBatch
from app.models.login_event import LoginEvent
from app.core.config import settings
from app.services import feature_flags, impersonation, platform_security
from app.models.super_admin import (
    SubscriptionPlan, CompanySubscription, CompanyFeatureFlag,
    SuperAdminAuditLog, ImpersonationLog, PlatformSetting
)
from app.schemas.super_admin import (
    ClientCreate, ClientUpdate, PlatformSettingsUpdate, ImpersonationStartRequest,
    ImpersonationEndRequest,
)
from app.schemas.response import APIResponse
from app.utils.security import create_access_token, hash_password
from app.utils.permissions import UserRole
from app.services import billing_service, payment_service

logger = logging.getLogger(__name__)
_PROCESS_STARTED_AT = time.time()
router = APIRouter(prefix="/v1/super-admin", tags=["super-admin"])

# Helper: Log super admin actions
async def log_super_admin_action(
    db: AsyncSession,
    user_id: uuid.UUID,
    user_email: str,
    action: str,
    module: str,
    request: Request,
    metadata: dict | None = None
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    log_entry = SuperAdminAuditLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        module=module,
        ip_address=ip,
        user_agent=ua,
        action_metadata=metadata
    )
    db.add(log_entry)
    await db.flush()


async def _ensure_not_platform_org(db: AsyncSession, org_id: uuid.UUID, action: str) -> None:
    """Super admin accounts belong to an organization too. Deleting that one
    cascades to them; suspending it is pointless (they're exempt) and confusing."""
    has_super_admin = await db.scalar(
        select(func.count(User.id)).where(
            User.organization_id == org_id, User.role == UserRole.SUPER_ADMIN.value
        )
    )
    if has_super_admin:
        raise HTTPException(
            status_code=400,
            detail=f"This organization holds super admin accounts and cannot be {action}.",
        )


# ── 1. DASHBOARD OVERVIEW ─────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_dashboard_overview(db: DB, current_user: SuperAdminUser):
    from app.models.offer import Offer

    # Total Companies
    total_companies = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    # Total Users
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    # Total Jobs
    total_jobs = (await db.execute(select(func.count(Job.id)).where(Job.is_deleted == False))).scalar() or 0
    # Total Candidates
    total_candidates = (await db.execute(select(func.count(Candidate.id)).where(Candidate.is_deleted == False))).scalar() or 0
    # Total Interviews
    total_interviews = (await db.execute(select(func.count(Interview.id)))).scalar() or 0
    # Total Offers
    total_offers = (await db.execute(select(func.count(Offer.id)))).scalar() or 0

    # Total MRR
    mrr_query = select(func.sum(SubscriptionPlan.price_monthly)).join(
        CompanySubscription, CompanySubscription.plan_id == SubscriptionPlan.id
    ).where(CompanySubscription.status == "active")
    total_mrr = (await db.execute(mrr_query)).scalar() or 0.0

    # Active Users (logged in last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.last_login >= seven_days_ago)
    )).scalar() or 0

    # API / AI Usage
    from app.models.ai_usage import AIUsage
    ai_usage = (await db.execute(select(func.count(AIUsage.id)))).scalar() or 0

    # Role Distribution
    role_dist_res = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    role_counts = {role: count for role, count in role_dist_res.all()}

    # Growth Metrics (comparing current month to last month)
    now = datetime.now(timezone.utc)
    first_day_current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_day_last_month = (first_day_current_month - timedelta(days=1)).replace(day=1)

    clients_this_month = (await db.execute(select(func.count(Organization.id)).where(Organization.created_at >= first_day_current_month))).scalar() or 0
    users_this_week = (await db.execute(select(func.count(User.id)).where(User.created_at >= seven_days_ago))).scalar() or 0
    jobs_this_week = (await db.execute(select(func.count(Job.id)).where(Job.created_at >= seven_days_ago, Job.is_deleted == False))).scalar() or 0

    org_status = (await db.execute(
        select(
            func.count(Organization.id).filter(Organization.is_active == True),
            func.count(Organization.id).filter(Organization.is_active == False),
        )
    )).one()
    user_status = (await db.execute(
        select(
            func.count(User.id).filter(User.is_active == True),
            func.count(User.id).filter(User.is_active == False),
            func.count(User.id).filter(User.last_login.is_(None)),
        )
    )).one()
    day_ago = now - timedelta(hours=24)
    failed_logins_24h = (await db.execute(
        select(func.count(LoginEvent.id)).where(
            LoginEvent.success == False, LoginEvent.created_at >= day_ago,
            LoginEvent.reason != "mfa_required",
        )
    )).scalar() or 0
    total_applications = (await db.execute(select(func.count(Application.id)))).scalar() or 0

    return APIResponse.success(data={
        "total_clients": total_companies,
        "total_users": total_users,
        "total_jobs": total_jobs,
        "total_candidates": total_candidates,
        "total_interviews": total_interviews,
        "total_offers": total_offers,
        "total_mrr": total_mrr,
        "active_users": active_users,
        "api_usage": ai_usage,
        "role_distribution": role_counts,
        "active_clients": org_status[0],
        "suspended_clients": org_status[1],
        "active_accounts": user_status[0],
        "suspended_accounts": user_status[1],
        "never_signed_in": user_status[2],
        "failed_logins_24h": failed_logins_24h,
        "total_applications": total_applications,
        "growth_metrics": {
            "clients_delta": f"+{clients_this_month} this month",
            "users_delta": f"+{users_this_week} this week",
            "jobs_delta": f"+{jobs_this_week} this week",
        }
    })


# ── 2. CLIENT MANAGEMENT ──────────────────────────────────────────────────────
@router.get("/clients")
async def list_clients(db: DB, current_user: SuperAdminUser):
    # Query all organizations
    orgs_res = await db.execute(select(Organization).order_by(Organization.name))
    orgs = orgs_res.scalars().all()
    org_ids = [org.id for org in orgs]

    if not org_ids:
        return APIResponse.success(data=[])

    # Fetch aggregate counts in single queries
    users_counts = dict((await db.execute(
        select(User.organization_id, func.count(User.id)).where(User.organization_id.in_(org_ids)).group_by(User.organization_id)
    )).all())

    # Paid seats: active admins and recruiters (interviewers and candidates don't use one).
    seats_counts = dict((await db.execute(
        select(User.organization_id, func.count(User.id))
        .where(User.organization_id.in_(org_ids))
        .where(User.is_active.is_(True))
        .where(User.role.in_(("admin", "recruiter")))
        .group_by(User.organization_id)
    )).all())

    jobs_counts = dict((await db.execute(
        select(Job.organization_id, func.count(Job.id))
        .where(Job.organization_id.in_(org_ids), Job.is_deleted == False)
        .group_by(Job.organization_id)
    )).all())
    candidates_counts = dict((await db.execute(
        select(Candidate.organization_id, func.count(Candidate.id))
        .where(Candidate.organization_id.in_(org_ids), Candidate.is_deleted == False)
        .group_by(Candidate.organization_id)
    )).all())
    interviews_counts = dict((await db.execute(
        select(Interview.organization_id, func.count(Interview.id))
        .where(Interview.organization_id.in_(org_ids))
        .group_by(Interview.organization_id)
    )).all())
    last_logins = dict((await db.execute(
        select(User.organization_id, func.max(User.last_login))
        .where(User.organization_id.in_(org_ids))
        .group_by(User.organization_id)
    )).all())

    # Fetch subscriptions and plans
    sub_res = await db.execute(
        select(CompanySubscription, SubscriptionPlan)
        .join(SubscriptionPlan, CompanySubscription.plan_id == SubscriptionPlan.id)
        .where(CompanySubscription.organization_id.in_(org_ids))
    )
    subs_map = {sub.organization_id: (sub, plan) for sub, plan in sub_res.all()}

    # Fetch all feature flags
    flags_res = await db.execute(
        select(CompanyFeatureFlag).where(CompanyFeatureFlag.organization_id.in_(org_ids))
    )
    flags_map = {}
    for flag in flags_res.scalars().all():
        if flag.organization_id not in flags_map:
            flags_map[flag.organization_id] = {}
        flags_map[flag.organization_id][flag.flag_key] = flag.is_enabled

    flag_defaults = await feature_flags.effective_flags(db, None)
    clients_list = []
    for org in orgs:
        # Default limits
        plan_name = "No plan"
        sub_status = "pending"
        mrr = 0.0
        users_limit = 0
        jobs_limit = 0
        term_months = None
        extra_seats = {"admin": 0, "recruiter": 0}
        period_end = None

        if org.id in subs_map:
            sub, plan = subs_map[org.id]
            plan_name = plan.name
            sub_status = sub.status
            # Per-month rate for the plan's term, plus extra admin ($15) and
            # recruiter ($10) seats.
            mrr = billing_service.monthly_revenue(plan, sub)
            extra_seats = billing_service.extra_seat_counts(sub)
            users_limit = plan.included_admins + plan.included_recruiters + sum(extra_seats.values())
            jobs_limit = plan.max_jobs
            term_months = plan.term_months
            period_end = sub.current_period_end

        users_cnt = users_counts.get(org.id, 0)
        jobs_cnt = jobs_counts.get(org.id, 0)
        
        # What the client actually gets: its own setting, else the platform default.
        own = flags_map.get(org.id, {})
        flags = {**flag_defaults, **{k: v for k, v in own.items() if k in feature_flags.ENFORCED}}
        # The client's own switch, else the env default (voice_calls.ai_calls_enabled).
        flags["ai_calls"] = bool(own["ai_calls"]) if "ai_calls" in own else settings.ai_calls_enabled_for(org.id)

        clients_list.append({
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "logo_url": org.logo_url,
            "website": org.website,
            "industry": org.industry,
            "size": org.size,
            "is_active": org.is_active,
            "created_at": org.created_at,
            "plan": plan_name,
            "term_months": term_months,
            "extra_admin_seats": extra_seats["admin"],
            "extra_recruiter_seats": extra_seats["recruiter"],
            "current_period_end": period_end,
            "status": sub_status if org.is_active or sub_status == "pending" else "suspended",
            "mrr": mrr,
            "users_count": users_cnt,
            "users_limit": users_limit,
            "seats_used": seats_counts.get(org.id, 0),
            "jobs_count": jobs_cnt,
            "jobs_limit": jobs_limit,
            "candidates_count": candidates_counts.get(org.id, 0),
            "interviews_count": interviews_counts.get(org.id, 0),
            "last_login": last_logins.get(org.id),
            "flags": flags
        })

    return APIResponse.success(data=clients_list)


@router.post("/clients", status_code=201)
async def create_client(data: ClientCreate, db: DB, current_user: SuperAdminUser, request: Request):
    # Check duplicate slug
    slug_check = (await db.execute(
        select(Organization).where(Organization.slug == data.slug)
    )).scalar_one_or_none()
    if slug_check:
        raise HTTPException(status_code=400, detail="Subdomain/slug is already taken.")

    # Check duplicate admin email
    email_check = (await db.execute(
        select(User).where(User.email == data.admin_email)
    )).scalar_one_or_none()
    if email_check:
        raise HTTPException(status_code=400, detail="Admin email is already registered.")

    # Subscription plan (Standard, 6 months, 12 months, Custom)
    plan = await billing_service.find_plan(db, data.plan_name)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{data.plan_name}'.")
    plan_name = plan.name
    if data.collect_payment:
        payment_service.require_stripe()
        # Checked before anything is created, so a bad quote leaves no half-made client.
        payment_service.subscription_quote(
            plan, data.extra_admin_seats, data.extra_recruiter_seats,
            data.custom_amount_usd, data.custom_term_months,
        )

    # When the client pays by link, the organization and admin stay inactive
    # until Stripe confirms the payment; the admin then sets a password from
    # the welcome email.
    active = not data.collect_payment
    org = Organization(
        name=data.name,
        slug=data.slug,
        industry=data.industry,
        size=data.size,
        is_active=active
    )
    db.add(org)
    await db.flush()

    admin = User(
        organization_id=org.id,
        email=data.admin_email,
        full_name=(data.admin_name or "").strip() or data.name + " Admin",
        hashed_password=hash_password(secrets.token_urlsafe(24)),
        role=UserRole.ADMIN.value,
        is_active=active,
        is_verified=True
    )
    db.add(admin)
    await db.flush()

    sub = CompanySubscription(
        organization_id=org.id,
        plan_id=plan.id,
        status="pending" if data.collect_payment else "active",
        trial_end=(
            datetime.now(timezone.utc) + timedelta(days=data.trial_days)
            if data.trial_days > 0 and not data.collect_payment else None
        ),
    )
    billing_service.assign_plan(sub, plan)
    db.add(sub)

    payment = None
    if data.collect_payment:
        payment = await payment_service.create_subscription_link(
            db, org, plan, current_user,
            extra_admin_seats=data.extra_admin_seats,
            extra_recruiter_seats=data.extra_recruiter_seats,
            custom_amount_usd=data.custom_amount_usd,
            custom_term_months=data.custom_term_months,
            activate_user_id=admin.id,
        )

    setup_token = None
    if not data.collect_payment:
        # Active immediately: the admin sets their own password from an emailed link.
        from app.models.password_reset import PasswordResetToken
        setup_token = secrets.token_urlsafe(48)
        db.add(PasswordResetToken(
            user_id=admin.id,
            token=setup_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=3),
        ))

    # Setup Feature Flags
    default_flags = data.flags or {"ai": True, "video": True, "bulk": True, "domain": False, "analytics": False}
    for flag, enabled in default_flags.items():
        db.add(CompanyFeatureFlag(
            organization_id=org.id,
            flag_key=flag,
            is_enabled=enabled
        ))

    # Log action
    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Created client {data.name}",
        module="Client Management",
        request=request,
        metadata={"client_slug": data.slug, "plan": plan_name}
    )

    await db.commit()

    if setup_token:
        from app.core.config import settings as cfg
        from app.services.email_service import send_password_reset_email
        send_password_reset_email(
            to_email=admin.email,
            to_name=admin.full_name,
            reset_url=f"{cfg.frontend_url}/reset-password?token={setup_token}",
            org_name=org.name,
        )
    if payment is None:
        return APIResponse.success(message="Client created successfully.", data={"org_id": str(org.id)})

    emailed = data.send_payment_email and await payment_service.email_payment_link(db, payment, data.admin_email)
    return APIResponse.success(
        message="Client created. They'll be activated once the payment link is paid.",
        data={
            "org_id": str(org.id),
            "payment": payment_service.payment_to_dict(payment, org.name),
            "emailed": bool(emailed),
        },
    )


@router.get("/clients/{client_id}/overview")
async def get_client_overview(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    """Everything the client detail page shows, in one call: members with
    their last sign-in, hiring volumes, imports, recent activity and sign-ins."""
    org = await db.get(Organization, client_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")

    members = (await db.execute(
        select(User).where(User.organization_id == org.id)
        .order_by(User.last_login.desc().nullslast(), User.created_at.desc())
    )).scalars().all()

    def _count(model, *where):
        return select(func.count(model.id)).where(model.organization_id == org.id, *where)

    jobs_total = await db.scalar(_count(Job, Job.is_deleted == False)) or 0
    jobs_open = await db.scalar(_count(Job, Job.is_deleted == False, Job.status == "active")) or 0
    candidates = await db.scalar(_count(Candidate, Candidate.is_deleted == False)) or 0
    applications = await db.scalar(_count(Application)) or 0
    interviews = await db.scalar(_count(Interview)) or 0
    since_30 = datetime.now(timezone.utc) - timedelta(days=30)
    interviews_30d = await db.scalar(_count(Interview, Interview.created_at >= since_30)) or 0
    candidates_30d = await db.scalar(_count(Candidate, Candidate.is_deleted == False, Candidate.created_at >= since_30)) or 0

    sub_row = (await db.execute(
        select(CompanySubscription, SubscriptionPlan)
        .join(SubscriptionPlan, CompanySubscription.plan_id == SubscriptionPlan.id)
        .where(CompanySubscription.organization_id == org.id)
    )).first()
    subscription = None
    if sub_row:
        sub, plan = sub_row
        subscription = {
            "plan": plan.name,
            "status": sub.status,
            "max_jobs": plan.max_jobs,
            "seats_limit": plan.included_admins + plan.included_recruiters
                           + sum(billing_service.extra_seat_counts(sub).values()),
            "trial_end": sub.trial_end,
            "current_period_end": sub.current_period_end,
            "mrr": billing_service.monthly_revenue(plan, sub),
        }

    imports = (await db.execute(
        select(ImportBatch).where(ImportBatch.organization_id == org.id, ImportBatch.deleted_at.is_(None))
        .order_by(ImportBatch.created_at.desc()).limit(20)
    )).scalars().all()

    activity = (await db.execute(
        select(AuditLog, User.email)
        .join(User, User.id == AuditLog.user_id, isouter=True)
        .where(AuditLog.organization_id == org.id)
        .order_by(AuditLog.created_at.desc()).limit(50)
    )).all()

    logins = (await db.execute(
        select(LoginEvent).where(LoginEvent.organization_id == org.id)
        .order_by(LoginEvent.created_at.desc()).limit(50)
    )).scalars().all()

    flags = dict((await db.execute(
        select(CompanyFeatureFlag.flag_key, CompanyFeatureFlag.is_enabled)
        .where(CompanyFeatureFlag.organization_id == org.id)
    )).all())

    status_counts = {"active": 0, "suspended": 0, "never_signed_in": 0}
    for m in members:
        status_counts["active" if m.is_active else "suspended"] += 1
        if m.last_login is None:
            status_counts["never_signed_in"] += 1

    last_activity_at = activity[0][0].created_at if activity else None

    return APIResponse.success(data={
        "organization": {
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "industry": org.industry,
            "size": org.size,
            "website": org.website,
            "is_active": org.is_active,
            "created_at": org.created_at,
            "is_platform_org": any(m.role == UserRole.SUPER_ADMIN.value for m in members),
        },
        "subscription": subscription,
        "members": [
            {
                "id": str(m.id),
                "full_name": m.full_name,
                "email": m.email,
                "role": m.role,
                "is_active": m.is_active,
                "is_verified": m.is_verified,
                "last_login": m.last_login,
                "created_at": m.created_at,
            }
            for m in members
        ],
        "member_counts": status_counts,
        "hiring": {
            "jobs": jobs_total,
            "open_jobs": jobs_open,
            "candidates": candidates,
            "candidates_30d": candidates_30d,
            "applications": applications,
            "interviews": interviews,
            "interviews_30d": interviews_30d,
        },
        "last_login": max((m.last_login for m in members if m.last_login), default=None),
        "last_activity_at": last_activity_at,
        "imports": [
            {
                "id": str(b.id),
                "file_name": b.file_name,
                "status": b.status,
                "total_rows": b.total_rows,
                "success_count": b.success_count,
                "failed_count": b.failed_count,
                "duplicate_count": b.duplicate_count,
                "created_at": b.created_at,
            }
            for b in imports
        ],
        "activity": [
            {
                "id": str(a.id),
                "action": a.action,
                "resource_type": a.resource_type,
                "actor": email,
                "impersonated_by": (a.details or {}).get("impersonated_by"),
                "created_at": a.created_at,
            }
            for a, email in activity
        ],
        "logins": [_login_event_out(e) for e in logins],
        "flags": flags,
    })


def _login_event_out(e: LoginEvent) -> dict:
    return {
        "id": str(e.id),
        "email": e.email,
        "user_id": str(e.user_id) if e.user_id else None,
        "organization_id": str(e.organization_id) if e.organization_id else None,
        "method": e.method,
        "success": e.success,
        "reason": e.reason,
        "ip_address": e.ip_address,
        "user_agent": e.user_agent,
        "created_at": e.created_at,
    }


@router.put("/clients/{client_id}")
async def update_client(client_id: uuid.UUID, data: ClientUpdate, db: DB, current_user: SuperAdminUser, request: Request):
    org = await db.get(Organization, client_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")

    if data.name:
        org.name = data.name
    if data.industry:
        org.industry = data.industry
    if data.size:
        org.size = data.size
    if data.location:
        org.timezone = data.location
    if data.is_active is not None:
        org.is_active = data.is_active

    # Plan and seats
    seat_changes = {
        "extra_admin_seats": data.extra_admin_seats,
        "extra_recruiter_seats": data.extra_recruiter_seats,
    }
    if data.plan_name or any(v is not None for v in seat_changes.values()):
        sub = (await db.execute(
            select(CompanySubscription).where(CompanySubscription.organization_id == org.id)
        )).scalar_one_or_none()
        if data.plan_name:
            plan = await billing_service.find_plan(db, data.plan_name)
            if not plan:
                raise HTTPException(status_code=400, detail=f"Unknown plan '{data.plan_name}'.")
            if sub is None:
                sub = CompanySubscription(organization_id=org.id, plan_id=plan.id, status="active")
                db.add(sub)
            billing_service.assign_plan(sub, plan)
        for field, value in seat_changes.items():
            if value is None:
                continue
            if value < 0 or sub is None:
                raise HTTPException(status_code=400, detail="Extra seats need a plan and must be 0 or more.")
            setattr(sub, field, value)

        # The plan and extra seats (admin +1,500, recruiter +1,000) set the AI pool.
        from app.services.ai_credit_service import AICreditsService
        from app.services.ai_metering import clear_blocked
        await db.flush()
        org_credits = await AICreditsService.get_or_create_org_credits(db, org.id)
        await AICreditsService.resync_monthly_allowance(db, org_credits)
        clear_blocked(organization_id=org.id)

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Updated client details for {org.name}",
        module="Client Management",
        request=request,
        metadata={"client_id": str(client_id)}
    )

    await db.commit()
    return APIResponse.success(message="Client updated successfully.")


@router.delete("/clients/{client_id}")
async def delete_client(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    org = await db.get(Organization, client_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")
    await _ensure_not_platform_org(db, org.id, "deleted")

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Permanently deleted client {org.name}",
        module="Client Management",
        request=request,
        metadata={"deleted_client_name": org.name, "client_id": str(client_id)}
    )

    await db.delete(org)
    await db.commit()
    return APIResponse.success(message="Client deleted successfully.")


@router.post("/clients/{client_id}/suspend")
async def suspend_client(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    org = await db.get(Organization, client_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")
    await _ensure_not_platform_org(db, org.id, "suspended")

    org.is_active = False
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.is_revoked == False,
            RefreshToken.user_id.in_(select(User.id).where(User.organization_id == org.id)),
        )
        .values(is_revoked=True)
    )

    sub_res = await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == org.id)
    )
    sub = sub_res.scalar_one_or_none()
    if sub:
        sub.status = "suspended"

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Suspended client {org.name}",
        module="Client Management",
        request=request,
        metadata={"client_id": str(client_id)}
    )

    await db.commit()
    return APIResponse.success(message="Client suspended successfully.")


@router.post("/clients/{client_id}/activate")
async def activate_client(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    org = await db.get(Organization, client_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")

    org.is_active = True
    
    sub_res = await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == org.id)
    )
    sub = sub_res.scalar_one_or_none()
    welcome = []
    if sub:
        if sub.status == "pending":
            # Was waiting on a payment link; paid some other way.
            welcome = await payment_service.activate_without_payment(db, org.id)
        sub.status = "active"

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Activated client {org.name}",
        module="Client Management",
        request=request,
        metadata={"client_id": str(client_id)}
    )

    await db.commit()
    for user in welcome:
        await payment_service.send_welcome(db, user)
    return APIResponse.success(message="Client activated successfully.")


# ── 3. FEATURE FLAGS OVERRIDES ────────────────────────────────────────────────
@router.get("/clients/{client_id}/flags")
async def get_client_feature_flags(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    flags = await feature_flags.effective_flags(db, client_id)
    own = await db.scalar(
        select(CompanyFeatureFlag.is_enabled).where(
            CompanyFeatureFlag.organization_id == client_id, CompanyFeatureFlag.flag_key == "ai_calls"
        )
    )
    # The client's own switch, else the env default (voice_calls.ai_calls_enabled).
    flags["ai_calls"] = bool(own) if own is not None else settings.ai_calls_enabled_for(client_id)
    return APIResponse.success(data=flags)


async def _plan_has_copilot(db, client_id: uuid.UUID) -> tuple[bool, str | None]:
    """(the client's plan includes the Copilot, plan name). Pro and Custom do;
    Standard and the Standard trial don't."""
    sub = (await db.execute(
        select(CompanySubscription).where(CompanySubscription.organization_id == client_id)
    )).scalar_one_or_none()
    if not sub or not sub.plan:
        return True, None  # no plan: nothing to protect
    plan = sub.plan
    return plan.term_months is None or bool((plan.features or {}).get("copilot")), plan.name


@router.get("/clients/{client_id}/plan-features")
async def get_client_plan_features(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    """What the client's plan includes, for the feature switches."""
    copilot, plan_name = await _plan_has_copilot(db, client_id)
    return APIResponse.success(data={"plan_name": plan_name, "copilot_in_plan": copilot})


@router.put("/clients/{client_id}/flags")
async def update_client_feature_flags(
    client_id: uuid.UUID, flags_update: dict[str, bool], db: DB, current_user: SuperAdminUser, request: Request,
    force: bool = Query(False, description="Turn on the Copilot for a plan that doesn't include it"),
):
    # The Copilot is a Pro feature. Switching it on for a client whose plan
    # doesn't include it needs an explicit force, recorded in the audit log.
    forced = False
    if flags_update.get("copilot") is True:
        current = await db.scalar(select(CompanyFeatureFlag.is_enabled).where(
            CompanyFeatureFlag.organization_id == client_id, CompanyFeatureFlag.flag_key == "copilot"))
        in_plan, plan_name = await _plan_has_copilot(db, client_id)
        if current is not True and not in_plan:
            if not force:
                raise HTTPException(status_code=409, detail={
                    "code": "copilot_requires_pro",
                    "message": f"The Copilot is a Pro feature and this client is on {plan_name}. Force-enable it to turn it on anyway.",
                })
            forced = True

    for key, val in flags_update.items():
        flag_res = await db.execute(
            select(CompanyFeatureFlag).where(
                CompanyFeatureFlag.organization_id == client_id,
                CompanyFeatureFlag.flag_key == key
            )
        )
        flag = flag_res.scalar_one_or_none()
        if flag:
            flag.is_enabled = val
        else:
            db.add(CompanyFeatureFlag(
                organization_id=client_id,
                flag_key=key,
                is_enabled=val
            ))

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=(f"Force-enabled the Copilot outside its plan for client {client_id}" if forced
                else f"Updated feature flags for client {client_id}"),
        module="Feature Flags",
        request=request,
        metadata={**flags_update, **({"forced_copilot": True} if forced else {})}
    )

    await db.commit()
    await _announce_features_changed([client_id])
    return APIResponse.success(message="Feature flags updated successfully.")


async def _announce_features_changed(org_ids) -> None:
    """Tell open workspaces to re-read their features, so a switch takes
    effect without the client refreshing. Best effort."""
    from app.websocket.manager import ws_manager
    for org_id in org_ids:
        try:
            await ws_manager.broadcast_to_org(str(org_id), "features_updated", {})
        except Exception as e:
            logger.warning(f"Could not announce feature change to {org_id}: {e}")


# ── 4. GLOBAL FEATURE FLAGS ───────────────────────────────────────────────────
@router.get("/flags")
async def get_global_flags(db: DB, current_user: CurrentUser):
    settings_res = await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == "global_feature_flags")
    )
    setting = settings_res.scalar_one_or_none()
    if not setting:
        return APIResponse.success(data=dict(feature_flags.BUILT_IN_DEFAULTS))

    # What applies: built-in defaults for anything never saved (e.g. copilot).
    return APIResponse.success(data={
        **feature_flags.BUILT_IN_DEFAULTS,
        **{k: v for k, v in (setting.setting_value or {}).items() if k in feature_flags.ENFORCED},
    })


@router.put("/flags")
async def update_global_flags(flags_update: dict[str, bool], db: DB, current_user: SuperAdminUser, request: Request):
    setting_res = await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == "global_feature_flags")
    )
    setting = setting_res.scalar_one_or_none()
    if not setting:
        setting = PlatformSetting(setting_key="global_feature_flags", setting_value=flags_update)
        db.add(setting)
    else:
        setting.setting_value = flags_update

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="Updated global default feature flags",
        module="Feature Flags",
        request=request,
        metadata=flags_update
    )

    await db.commit()
    await _announce_features_changed((await db.execute(select(Organization.id))).scalars().all())
    return APIResponse.success(message="Global feature flags updated successfully.")


# ── 5. GLOBAL USER MANAGEMENT ─────────────────────────────────────────────────
@router.get("/users")
async def list_global_users(
    db: DB,
    current_user: SuperAdminUser,
    role: str | None = None,
    client: str | None = None,
    organization_id: uuid.UUID | None = None,
    q: str | None = Query(None, max_length=200),
    status: str | None = Query(None, pattern="^(all|active|suspended)$"),
    last_login: str | None = Query(None, pattern="^(all|7d|30d|stale_30d|never)$"),
    sort: str = Query("created_at", pattern="^(created_at|last_login|name|email)$"),
    direction: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    conditions = []
    if role and role != "all":
        conditions.append(User.role == role.lower())
    if organization_id:
        conditions.append(User.organization_id == organization_id)
    elif client and client != "all":  # legacy: filter by organization name
        conditions.append(Organization.name == client)
    if q and q.strip():
        term = f"%{q.strip()}%"
        conditions.append(or_(User.full_name.ilike(term), User.email.ilike(term)))
    if status == "active":
        conditions.append(User.is_active == True)
    elif status == "suspended":
        conditions.append(User.is_active == False)
    now = datetime.now(timezone.utc)
    if last_login == "7d":
        conditions.append(User.last_login >= now - timedelta(days=7))
    elif last_login == "30d":
        conditions.append(User.last_login >= now - timedelta(days=30))
    elif last_login == "stale_30d":
        conditions.append(User.last_login < now - timedelta(days=30))
    elif last_login == "never":
        conditions.append(User.last_login.is_(None))

    def _scoped(query):
        return query.join(Organization, Organization.id == User.organization_id, isouter=True).where(*conditions)

    total = (await db.execute(_scoped(select(func.count(User.id))))).scalar() or 0

    sort_col = {
        "created_at": User.created_at,
        "last_login": User.last_login,
        "name": User.full_name,
        "email": User.email,
    }[sort]
    order = sort_col.asc().nullsfirst() if direction == "asc" else sort_col.desc().nullslast()
    res = await db.execute(
        _scoped(select(User, Organization.name.label("org_name")))
        .order_by(order, User.id).limit(limit).offset(offset)
    )
    users_list = []
    for user, org_name in res.all():
        users_list.append({
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "client": org_name or "System",
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "online": bool(user.last_login and now - user.last_login < timedelta(minutes=15)),
        })
    return APIResponse.success(data={"users": users_list, "total": total, "limit": limit, "offset": offset})


@router.get("/users/{user_id}/logins")
async def list_user_logins(
    user_id: uuid.UUID, db: DB, current_user: SuperAdminUser,
    limit: int = Query(50, ge=1, le=200),
):
    """A user's recorded sign-in attempts, newest first. Recording began with
    the login_events table; there is no history from before it."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    events = (await db.execute(
        select(LoginEvent)
        .where(or_(LoginEvent.user_id == user.id, LoginEvent.email == user.email.lower()))
        .order_by(LoginEvent.created_at.desc()).limit(limit)
    )).scalars().all()
    return APIResponse.success(data={
        "user": {"id": str(user.id), "email": user.email, "full_name": user.full_name,
                 "last_login": user.last_login},
        "events": [_login_event_out(e) for e in events],
    })


@router.get("/login-events")
async def list_login_events(
    db: DB,
    current_user: SuperAdminUser,
    organization_id: uuid.UUID | None = None,
    q: str | None = Query(None, max_length=200),
    outcome: str | None = Query(None, pattern="^(all|success|failure)$"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    conditions = []
    if organization_id:
        conditions.append(LoginEvent.organization_id == organization_id)
    if q and q.strip():
        conditions.append(LoginEvent.email.ilike(f"%{q.strip().lower()}%"))
    if outcome == "success":
        conditions.append(LoginEvent.success == True)
    elif outcome == "failure":
        conditions.append(LoginEvent.success == False)
    if date_from:
        conditions.append(LoginEvent.created_at >= date_from)
    if date_to:
        conditions.append(LoginEvent.created_at <= date_to)
    total = await db.scalar(select(func.count(LoginEvent.id)).where(*conditions)) or 0
    rows = (await db.execute(
        select(LoginEvent, Organization.name)
        .join(Organization, Organization.id == LoginEvent.organization_id, isouter=True)
        .where(*conditions)
        .order_by(LoginEvent.created_at.desc()).limit(limit).offset(offset)
    )).all()
    return APIResponse.success(data={
        "events": [{**_login_event_out(e), "organization": org_name} for e, org_name in rows],
        "total": total, "limit": limit, "offset": offset,
    })


@router.put("/users/{user_id}/status")
async def update_user_status(user_id: uuid.UUID, is_active: bool, db: DB, current_user: SuperAdminUser, request: Request):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_user.id and not is_active:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account.")

    user.is_active = is_active
    if not is_active:
        # End existing sessions so suspension takes effect at the next refresh.
        await db.execute(
            update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)
            .values(is_revoked=True)
        )
    
    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"{'Activated' if is_active else 'Suspended'} user {user.email}",
        module="User Management",
        request=request,
        metadata={"target_user_id": str(user_id)}
    )

    await db.commit()
    return APIResponse.success(message="User status updated successfully.")


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Reactivate the user before resetting their password.")

    # Email a single-use reset link; never set a known default password.
    from app.core.config import settings as cfg
    from app.models.password_reset import PasswordResetToken
    from app.services.email_service import send_password_reset_email

    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used == False)
        .values(is_used=True)
    )
    token = secrets.token_urlsafe(48)
    db.add(PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    ))
    org = await db.get(Organization, user.organization_id) if user.organization_id else None
    send_password_reset_email(
        to_email=user.email,
        to_name=user.full_name,
        reset_url=f"{cfg.frontend_url}/reset-password?token={token}",
        org_logo_url=org.logo_url if org else None,
        org_name=org.name if org else None,
    )

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Reset password for user {user.email}",
        module="User Management",
        request=request,
        metadata={"target_user_id": str(user_id)}
    )

    await db.commit()
    return APIResponse.success(message=f"Password reset link sent to {user.email}.")


# ── 6. AUDIT LOGS ─────────────────────────────────────────────────────────────
_AUDIT_CATEGORIES = {
    "impersonation": ["%impersonat%"],
    "billing": ["%payment%", "%plan%", "%credit%", "%billing%", "%subscription%"],
    "user": ["%user%", "%password%"],
    "client": ["%client%"],
    "settings": ["%setting%", "%flag%"],
}
_SENSITIVE_KEYS = ("password", "token", "secret", "otp", "api_key", "authorization")


def _safe_metadata(meta: dict | None) -> dict | None:
    if not meta:
        return meta
    return {
        k: ("[redacted]" if any(s in k.lower() for s in _SENSITIVE_KEYS) else v)
        for k, v in meta.items()
    }


def _audit_conditions(client, category, q, module, actor, organization_id, date_from, date_to):
    conditions = []
    if client:  # legacy: free text against the module name
        conditions.append(SuperAdminAuditLog.module.ilike(f"%{client}%"))
    if category and category != "all":
        patterns = _AUDIT_CATEGORIES.get(category, [f"%{category}%"])
        conditions.append(or_(*[SuperAdminAuditLog.action.ilike(pat) for pat in patterns]))
    if q and q.strip():
        term = f"%{q.strip()}%"
        conditions.append(or_(SuperAdminAuditLog.action.ilike(term), SuperAdminAuditLog.user_email.ilike(term)))
    if module and module != "all":
        conditions.append(SuperAdminAuditLog.module == module)
    if actor:
        conditions.append(SuperAdminAuditLog.user_email.ilike(f"%{actor.strip()}%"))
    if organization_id:
        oid = str(organization_id)
        conditions.append(or_(
            SuperAdminAuditLog.action_metadata["client_id"].astext == oid,
            SuperAdminAuditLog.action_metadata["organization_id"].astext == oid,
        ))
    if date_from:
        conditions.append(SuperAdminAuditLog.created_at >= date_from)
    if date_to:
        conditions.append(SuperAdminAuditLog.created_at <= date_to)
    return conditions


@router.get("/audit-logs")
async def list_audit_logs(
    db: DB,
    current_user: SuperAdminUser,
    client: str | None = None,
    category: str | None = None,
    q: str | None = Query(None, max_length=200),
    module: str | None = Query(None, max_length=100),
    actor: str | None = Query(None, max_length=255),
    organization_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    conditions = _audit_conditions(client, category, q, module, actor, organization_id, date_from, date_to)
    total_logs = await db.scalar(select(func.count(SuperAdminAuditLog.id)).where(*conditions)) or 0
    logs = (await db.execute(
        select(SuperAdminAuditLog).where(*conditions)
        .order_by(SuperAdminAuditLog.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    modules = (await db.execute(
        select(SuperAdminAuditLog.module).distinct().order_by(SuperAdminAuditLog.module)
    )).scalars().all()

    formatted_logs = [
        {
            "id": str(log.id),
            "action": log.action,
            "client": log.module,
            "module": log.module,
            "actor": log.user_email,
            "ip_address": log.ip_address,
            "metadata": _safe_metadata(log.action_metadata),
            "created_at": log.created_at,
            "time": log.created_at.strftime("%Y-%m-%d %I:%M %p"),
            "type": "impersonation" if "impersonat" in log.action.lower() else "user",
        }
        for log in logs
    ]
    return APIResponse.success(data={
        "logs": formatted_logs,
        "total": total_logs,
        "limit": limit,
        "offset": offset,
        "modules": modules,
    })


_EXPORT_MAX_ROWS = 10_000


@router.get("/audit-logs/export")
async def export_audit_logs(
    request: Request,
    db: DB,
    current_user: SuperAdminUser,
    category: str | None = None,
    q: str | None = Query(None, max_length=200),
    module: str | None = Query(None, max_length=100),
    actor: str | None = Query(None, max_length=255),
    organization_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    """CSV of the filtered audit trail (newest first, capped at 10,000 rows).
    The export itself is audited."""
    conditions = _audit_conditions(None, category, q, module, actor, organization_id, date_from, date_to)
    logs = (await db.execute(
        select(SuperAdminAuditLog).where(*conditions)
        .order_by(SuperAdminAuditLog.created_at.desc()).limit(_EXPORT_MAX_ROWS)
    )).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp_utc", "actor", "module", "action", "ip_address"])
    for log in logs:
        # Leading =,+,-,@ would make spreadsheet apps evaluate the cell.
        cells = [log.created_at.isoformat(), log.user_email, log.module, log.action, log.ip_address or ""]
        writer.writerow([("'" + c) if c[:1] in ("=", "+", "-", "@") else c for c in cells])

    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Exported {len(logs)} audit log entries",
        module="Audit Logs", request=request,
        metadata={"filters": {k: v for k, v in {
            "category": category, "q": q, "module": module, "actor": actor,
            "organization_id": str(organization_id) if organization_id else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        }.items() if v}},
    )
    await db.commit()

    filename = f"hybent-audit-{datetime.now(timezone.utc):%Y%m%d-%H%M}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Activity rankings ────────────────────────────────────────────────────────
@router.get("/activity")
async def get_activity_rankings(
    db: DB, current_user: SuperAdminUser,
    days: int = Query(30, ge=1, le=365),
):
    """Per-organization activity over the window: successful sign-ins,
    recorded actions (org audit log), new candidates and interviews.
    Ranked by a plain sum of those counts."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    orgs = (await db.execute(select(Organization.id, Organization.name, Organization.is_active))).all()

    async def per_org(stmt):
        return dict((await db.execute(stmt)).all())

    logins = await per_org(
        select(LoginEvent.organization_id, func.count(LoginEvent.id))
        .where(LoginEvent.success == True, LoginEvent.created_at >= since, LoginEvent.organization_id.isnot(None))
        .group_by(LoginEvent.organization_id)
    )
    active_users = await per_org(
        select(User.organization_id, func.count(User.id))
        .where(User.last_login >= since).group_by(User.organization_id)
    )
    actions = await per_org(
        select(AuditLog.organization_id, func.count(AuditLog.id))
        .where(AuditLog.created_at >= since).group_by(AuditLog.organization_id)
    )
    candidates = await per_org(
        select(Candidate.organization_id, func.count(Candidate.id))
        .where(Candidate.created_at >= since, Candidate.is_deleted == False).group_by(Candidate.organization_id)
    )
    interviews = await per_org(
        select(Interview.organization_id, func.count(Interview.id))
        .where(Interview.created_at >= since).group_by(Interview.organization_id)
    )
    last_login = await per_org(select(User.organization_id, func.max(User.last_login)).group_by(User.organization_id))
    last_action = await per_org(select(AuditLog.organization_id, func.max(AuditLog.created_at)).group_by(AuditLog.organization_id))

    rows = []
    for oid, name, is_active in orgs:
        r = {
            "organization_id": str(oid),
            "name": name,
            "is_active": is_active,
            "logins": logins.get(oid, 0),
            "active_users": active_users.get(oid, 0),
            "actions": actions.get(oid, 0),
            "candidates_added": candidates.get(oid, 0),
            "interviews_scheduled": interviews.get(oid, 0),
            "last_login": last_login.get(oid),
            "last_activity_at": last_action.get(oid),
        }
        r["score"] = r["logins"] + r["actions"] + r["candidates_added"] + r["interviews_scheduled"]
        rows.append(r)
    rows.sort(key=lambda r: (-r["score"], r["name"].lower()))

    recent_users = (await db.execute(
        select(User.id, User.full_name, User.email, User.role, User.last_login, Organization.name)
        .join(Organization, Organization.id == User.organization_id, isouter=True)
        .where(User.last_login.isnot(None))
        .order_by(User.last_login.desc()).limit(10)
    )).all()

    return APIResponse.success(data={
        "days": days,
        "organizations": rows,
        "recent_users": [
            {"id": str(uid), "full_name": fn, "email": em, "role": role, "last_login": ll, "client": org}
            for uid, fn, em, role, ll, org in recent_users
        ],
        "login_tracking_since": await db.scalar(select(func.min(LoginEvent.created_at))),
    })


# ── 7. SYSTEM HEALTH MONITORING ───────────────────────────────────────────────
@router.get("/health")
async def get_system_health(db: DB, current_user: SuperAdminUser):
    import time
    
    # Try getting real system metrics
    cpu = 0.0
    memory = 0.0
    disk = 0.0
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent
        metrics_available = True
    except ImportError:
        metrics_available = False

    # Real DB latency
    start_time = time.time()
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    latency_ms = round((time.time() - start_time) * 1000)

    # Redis backs rate limiting and background work; ping it directly.
    redis_status = "Down"
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings as cfg
        r = aioredis.from_url(cfg.redis_url, socket_connect_timeout=1, socket_timeout=1)
        try:
            await r.ping()
            redis_status = "Operational"
        finally:
            await r.aclose()
    except Exception:
        pass

    twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    from app.models.import_batch import ImportBatch
    failed_imports_24h = (await db.execute(
        select(func.count(ImportBatch.id)).where(
            ImportBatch.created_at >= twenty_four_hours_ago,
            ImportBatch.failed_count > 0,
        )
    )).scalar() or 0
    failed_rows_24h = (await db.execute(
        select(func.coalesce(func.sum(ImportBatch.failed_count), 0)).where(
            ImportBatch.created_at >= twenty_four_hours_ago,
        )
    )).scalar() or 0

    services = [
        {"name": "API", "status": "Operational"},  # this request was served
        {"name": "Database", "status": ("Operational" if latency_ms < 1000 else "Degraded") if db_ok else "Down"},
        {"name": "Redis", "status": redis_status},
    ]

    return APIResponse.success(data={
        "uptime_seconds": int(time.time() - _PROCESS_STARTED_AT),
        "avg_latency": f"{latency_ms}ms",
        "failed_imports_24h": failed_imports_24h,
        "failed_import_rows_24h": int(failed_rows_24h),
        "cpu_percent": cpu,
        "memory_percent": memory,
        "disk_percent": disk,
        "metrics_available": metrics_available,
        "services": services
    })


# ── 8. GLOBAL PLATFORM SETTINGS ───────────────────────────────────────────────
_SETTINGS_DEFAULTS = {
    "smtp_provider": "SendGrid",
    "smtp_sender_name": "Hybent Support",
    "smtp_sender_email": "no-reply@hybent.com",
    "require_2fa": False,
    "session_timeout": False,
    "ip_whitelist": False,
    "ip_allowlist": [],
    "platform_name": "Hybent",
    "logo_url": "",
    "primary_color": "#534AB7",
}


async def _settings_payload(db: AsyncSession, stored: dict, request: Request) -> dict:
    """Stored settings, with the security switches shown as actually enforced."""
    effective = await platform_security.get_security_settings(db)
    return {
        **_SETTINGS_DEFAULTS,
        **{k: v for k, v in stored.items() if k != platform_security.SAVED_MARKER},
        **effective,
        "current_ip": platform_security.client_ip(request),
        "session_idle_minutes": platform_security.SESSION_IDLE_MINUTES,
    }


@router.get("/settings")
async def get_platform_settings(db: DB, current_user: SuperAdminUser, request: Request):
    stored = await db.scalar(
        select(PlatformSetting.setting_value).where(PlatformSetting.setting_key == platform_security.SETTINGS_KEY)
    ) or {}
    # Reading no longer writes defaults: that is how require_2fa=true got saved
    # without anyone choosing it.
    return APIResponse.success(data=await _settings_payload(db, stored, request))


@router.put("/settings")
async def update_platform_settings(data: PlatformSettingsUpdate, db: DB, current_user: SuperAdminUser, request: Request):
    setting = await db.scalar(
        select(PlatformSetting).where(PlatformSetting.setting_key == platform_security.SETTINGS_KEY)
    )
    current_val = dict(setting.setting_value) if setting else {}
    update_dict = data.model_dump(exclude_unset=True)

    if "ip_allowlist" in update_dict:
        try:
            update_dict["ip_allowlist"] = platform_security.normalize_allowlist(update_dict["ip_allowlist"] or [])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    touches_security = any(k in update_dict for k in platform_security.SECURITY_KEYS)
    if touches_security:
        # Saving the section confirms all three switches as shown on the page.
        effective = await platform_security.get_security_settings(db)
        new_val = {**current_val, **effective, **update_dict,
                   platform_security.SAVED_MARKER: datetime.now(timezone.utc).isoformat()}
        if new_val.get("ip_whitelist"):
            allow = new_val.get("ip_allowlist") or []
            if not allow:
                raise HTTPException(status_code=400, detail="Add at least one IP address or range before restricting super admin access.")
            if not platform_security.ip_allowed(platform_security.client_ip(request), allow):
                raise HTTPException(
                    status_code=400,
                    detail=f"Your current IP ({platform_security.client_ip(request)}) is not in the list; saving would lock you out.",
                )
    else:
        new_val = {**current_val, **update_dict}

    if not setting:
        db.add(PlatformSetting(setting_key=platform_security.SETTINGS_KEY, setting_value=new_val))
    else:
        setting.setting_value = new_val

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="Updated platform settings",
        module="Global Settings",
        request=request,
        metadata=update_dict,
    )
    await db.commit()
    return APIResponse.success(message="Settings saved successfully.", data=await _settings_payload(db, new_val, request))


# ── 9. SYSTEM-WIDE ANALYTICS ──────────────────────────────────────────────────
@router.get("/analytics")
async def get_growth_analytics(db: DB, current_user: SuperAdminUser):
    # Fetch real user growth grouped by month
    user_query = select(
        func.date_trunc('month', User.created_at).label('month'),
        func.count(User.id).label('count')
    ).group_by('month').order_by('month')
    
    candidate_query = select(
        func.date_trunc('month', Candidate.created_at).label('month'),
        func.count(Candidate.id).label('count')
    ).where(Candidate.is_deleted == False).group_by('month').order_by('month')

    user_res = await db.execute(user_query)
    candidate_res = await db.execute(candidate_query)

    user_growth = []
    cumulative_users = 0
    for row in user_res.all():
        cumulative_users += row.count
        user_growth.append({
            "date": row.month.strftime("%b %Y") if row.month else "Unknown",
            "count": cumulative_users
        })

    candidate_growth = []
    cumulative_candidates = 0
    for row in candidate_res.all():
        cumulative_candidates += row.count
        candidate_growth.append({
            "date": row.month.strftime("%b %Y") if row.month else "Unknown",
            "count": cumulative_candidates
        })

    mrr_query = select(func.sum(SubscriptionPlan.price_monthly)).join(
        CompanySubscription, CompanySubscription.plan_id == SubscriptionPlan.id
    ).where(CompanySubscription.status == "active")
    total_mrr = (await db.execute(mrr_query)).scalar() or 0.0

    # No MRR history table exists, so only the current month's MRR is real.
    revenue_growth = [{"date": datetime.now(timezone.utc).strftime("%b %Y"), "amount": total_mrr}]

    return APIResponse.success(data={
        "user_growth": user_growth,
        "candidate_growth": candidate_growth,
        "revenue_growth": revenue_growth
    })


# ── 10. SUPPORT SESSIONS (IMPERSONATION) ──────────────────────────────────────
# See app/services/impersonation.py for how a session's token is checked,
# kept view-only, and audited on every request.

def _session_out(log: ImpersonationLog, *, admin_email=None, target=None, org_name=None,
                 ended_by_email=None, changes=None) -> dict:
    now = datetime.now(timezone.utc)
    if log.ended_at is not None:
        status = "ended"
    elif log.expires_at is None:
        status = "unknown"  # started before sessions were tracked; end never recorded
    elif log.expires_at <= now:
        status = "ended"
    else:
        status = "active"
    return {
        "id": str(log.id),
        "super_admin_email": admin_email,
        "target": target,
        "organization_id": str(log.organization_id) if log.organization_id else None,
        "organization": org_name,
        "reason": log.reason,
        "allow_changes": log.allow_changes,
        "started_at": log.started_at,
        "expires_at": log.expires_at,
        "ended_at": log.ended_at,
        "end_reason": log.end_reason,
        "ended_by_email": ended_by_email,
        "status": status,
        "changes": changes,
    }


@router.post("/impersonate/{user_id}")
async def impersonate_user(user_id: uuid.UUID, payload: ImpersonationStartRequest, db: DB, current_user: SuperAdminUser, request: Request):
    """Start a time-limited support session as another user. View only unless
    `allow_changes`; either way every change is audited under the super admin."""
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")
    if target_user.role == UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin accounts cannot be impersonated.")
    if not target_user.is_active:
        raise HTTPException(status_code=400, detail="Cannot impersonate a suspended user.")
    org = await db.get(Organization, target_user.organization_id) if target_user.organization_id else None
    if org is not None and not org.is_active:
        raise HTTPException(status_code=400, detail="This organization is suspended; its users can't be impersonated.")

    reason = payload.reason.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="Give a reason for this support session.")

    now = datetime.now(timezone.utc)
    await impersonation.close_expired_sessions(db)
    # One support session per super admin: a new one ends any still open.
    await db.execute(
        update(ImpersonationLog)
        .where(ImpersonationLog.super_admin_id == current_user.id, ImpersonationLog.ended_at.is_(None))
        .values(ended_at=now, end_reason="replaced", ended_by_id=current_user.id)
    )

    minutes = settings.impersonation_session_minutes
    log = ImpersonationLog(
        super_admin_id=current_user.id,
        impersonated_user_id=target_user.id,
        organization_id=target_user.organization_id,
        reason=reason,
        started_at=now,
        expires_at=now + timedelta(minutes=minutes),
        allow_changes=payload.allow_changes,
    )
    db.add(log)
    await db.flush()

    mode = "changes allowed" if payload.allow_changes else "view only"
    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Started impersonation of {target_user.email} ({mode}, {minutes} min). Reason: {reason}"[:255],
        module="Impersonation",
        request=request,
        metadata={
            "session_id": str(log.id),
            "impersonated_user_id": str(user_id),
            "organization_id": str(target_user.organization_id) if target_user.organization_id else None,
            "reason": reason,
            "allow_changes": payload.allow_changes,
            "expires_at": log.expires_at.isoformat(),
        },
    )

    # The token carries the session id: get_current_user refuses it once the
    # session ends, and it expires with the session (it can't be refreshed).
    token = create_access_token(
        {
            "sub": str(target_user.id),
            "org": str(target_user.organization_id),
            "impersonator_id": str(current_user.id),
            "imp_sid": str(log.id),
        },
        expires_minutes=minutes,
    )

    await db.commit()
    return APIResponse.success(message="Support session started.", data={
        "access_token": token,
        "token_type": "bearer",
        "session": {
            "id": str(log.id),
            "expires_at": log.expires_at,
            "allow_changes": log.allow_changes,
            "minutes": minutes,
        },
        "user": {
            "id": str(target_user.id),
            "email": target_user.email,
            "full_name": target_user.full_name,
            "role": target_user.role,
            "organization_id": str(target_user.organization_id),
            "organization_name": org.name if org else None,
            "is_active": target_user.is_active,
            "is_impersonating": True,
            "impersonator_id": str(current_user.id),
        },
    })


@router.post("/impersonations/{session_id}/end")
async def end_impersonation(
    session_id: uuid.UUID, payload: ImpersonationEndRequest, db: DB, current_user: SuperAdminUser, request: Request,
):
    """End a support session. Called by the super admin's browser on exit or
    when the time runs out, or by any super admin to cut one off. The
    session's token stops working immediately. Ending twice is harmless."""
    log = await db.get(ImpersonationLog, session_id)
    if not log:
        raise HTTPException(status_code=404, detail="Support session not found.")

    if log.ended_at is None:
        now = datetime.now(timezone.utc)
        own = log.super_admin_id == current_user.id
        log.ended_at = min(now, log.expires_at) if log.expires_at else now
        log.end_reason = payload.reason if own else "ended_by_admin"
        log.ended_by_id = current_user.id
        target = await db.get(User, log.impersonated_user_id)
        target_email = target.email if target else str(log.impersonated_user_id)
        label = {"exit": "ended", "expired": "expired (time limit)", "ended_by_admin": "ended by another super admin"}
        await log_super_admin_action(
            db=db,
            user_id=current_user.id,
            user_email=current_user.email,
            action=f"Impersonation of {target_email} {label[log.end_reason]}"[:255],
            module="Impersonation",
            request=request,
            metadata={
                "session_id": str(log.id),
                "organization_id": str(log.organization_id) if log.organization_id else None,
                "end_reason": log.end_reason,
                "duration_seconds": int((log.ended_at - log.started_at).total_seconds()),
            },
        )
        await db.commit()

    return APIResponse.success(message="Support session ended.", data=_session_out(log))


@router.get("/impersonations")
async def list_impersonations(
    db: DB,
    current_user: SuperAdminUser,
    status: str = Query("all", pattern="^(all|active|ended)$"),
    organization_id: uuid.UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Support sessions, newest first, with how many audited changes each made."""
    if await impersonation.close_expired_sessions(db):
        await db.commit()

    admin, target, ender = aliased(User), aliased(User), aliased(User)
    now = datetime.now(timezone.utc)
    conditions = []
    if status == "active":
        conditions += [ImpersonationLog.ended_at.is_(None), ImpersonationLog.expires_at > now]
    elif status == "ended":
        conditions.append(ImpersonationLog.ended_at.isnot(None))
    if organization_id:
        conditions.append(ImpersonationLog.organization_id == organization_id)

    changes = (
        select(func.count(SuperAdminAuditLog.id))
        .where(
            SuperAdminAuditLog.module == "Impersonation",
            SuperAdminAuditLog.action.like("Changed data%"),
            SuperAdminAuditLog.action_metadata["session_id"].astext == cast(ImpersonationLog.id, String),
        )
        .correlate(ImpersonationLog)
        .scalar_subquery()
    )
    total = await db.scalar(select(func.count(ImpersonationLog.id)).where(*conditions)) or 0
    rows = (await db.execute(
        select(
            ImpersonationLog, admin.email, target.id, target.email, target.full_name, target.role,
            Organization.name, ender.email, changes,
        )
        .join(admin, admin.id == ImpersonationLog.super_admin_id)
        .join(target, target.id == ImpersonationLog.impersonated_user_id)
        .join(Organization, Organization.id == ImpersonationLog.organization_id, isouter=True)
        .join(ender, ender.id == ImpersonationLog.ended_by_id, isouter=True)
        .where(*conditions)
        .order_by(ImpersonationLog.started_at.desc())
        .limit(limit).offset(offset)
    )).all()
    return APIResponse.success(data={
        "sessions": [
            _session_out(
                log,
                admin_email=admin_email,
                target={"id": str(tid), "email": temail, "full_name": tname, "role": trole},
                org_name=org_name,
                ended_by_email=ended_by,
                changes=n_changes,
            )
            for log, admin_email, tid, temail, tname, trole, org_name, ended_by, n_changes in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
        "minutes": settings.impersonation_session_minutes,
    })


# ── Plans ────────────────────────────────────────────────────────────────────

@router.get("/plans")
async def list_plans(db: DB, current_user: SuperAdminUser):
    """The published plans and how many organizations are on each."""
    plans = await billing_service.list_plans(db)
    counts = dict((await db.execute(
        select(CompanySubscription.plan_id, func.count()).group_by(CompanySubscription.plan_id)
    )).all())
    std = billing_service.standard_price(plans)
    return APIResponse.success(
        message="Plans retrieved.",
        data=[{**billing_service.plan_to_dict(p, std), "subscribers": counts.get(p.id, 0)} for p in plans],
    )


# ── AI credits ───────────────────────────────────────────────────────────────

@router.get("/ai-credits")
async def list_ai_credits(db: DB, current_user: SuperAdminUser):
    """Every organization's AI credit pool for the current period, with the
    provider cost behind it and what those credits are worth to the client."""
    from app.models.organization_ai_credits import OrganizationAICredits
    from app.models.ai_usage import AIUsage
    from app.services import ai_pricing

    rows = (await db.execute(
        select(Organization, OrganizationAICredits, SubscriptionPlan.name)
        .outerjoin(OrganizationAICredits, OrganizationAICredits.organization_id == Organization.id)
        .outerjoin(CompanySubscription, CompanySubscription.organization_id == Organization.id)
        .outerjoin(SubscriptionPlan, SubscriptionPlan.id == CompanySubscription.plan_id)
        .order_by(Organization.name)
    )).all()

    items = []
    for org, credits, plan_name in rows:
        period_start = (credits.reset_at - timedelta(days=30)) if credits else None
        cost = 0.0
        if period_start:
            cost = (await db.execute(
                select(func.coalesce(func.sum(AIUsage.cost), 0.0))
                .where(AIUsage.organization_id == org.id)
                .where(AIUsage.status == "success")
                .where(AIUsage.created_at >= period_start)
            )).scalar() or 0.0
        used = credits.used_credits if credits else 0
        items.append({
            "organization_id": str(org.id),
            "organization_name": org.name,
            "plan": plan_name,
            "monthly_credits": credits.allowed_credits if credits else None,
            "custom_monthly_credits": credits.custom_monthly_credits if credits else None,
            "used_credits": used,
            "purchased_credits": credits.purchased_credits if credits else 0,
            "reset_at": credits.reset_at if credits else None,
            "provider_cost_usd": round(float(cost), 4),
            "credits_value_usd": round(used * ai_pricing.CREDIT_PRICE_USD, 2),
        })
    return APIResponse.success(message="AI credits retrieved.", data=items)


@router.put("/organizations/{org_id}/ai-credits")
async def update_ai_credits(org_id: uuid.UUID, db: DB, current_user: SuperAdminUser, payload: dict):
    """Set a custom monthly allowance (`monthly_credits`; null returns to the
    plan's), and/or add paid top-up credits (`add_purchased`)."""
    from app.services.ai_credit_service import AICreditsService
    from app.services.ai_metering import clear_blocked

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    credits = await AICreditsService.get_or_create_org_credits(db, org_id, for_update=True)

    if "monthly_credits" in payload:
        monthly = payload["monthly_credits"]
        if monthly is not None and (not isinstance(monthly, int) or isinstance(monthly, bool) or monthly < 0):
            raise HTTPException(status_code=400, detail="monthly_credits must be a whole number (0 or more) or null.")
        credits.custom_monthly_credits = monthly
        await AICreditsService.resync_monthly_allowance(db, credits)

    add = payload.get("add_purchased", 0)
    if not isinstance(add, int) or isinstance(add, bool) or add < 0:
        raise HTTPException(status_code=400, detail="add_purchased must be a whole number (0 or more).")
    credits.purchased_credits = (credits.purchased_credits or 0) + add

    if AICreditsService.org_remaining(credits) > 0:
        credits.warning_0_sent = False
    await db.commit()
    clear_blocked(organization_id=org_id)

    if add:
        from app.tasks.notifications import notify_organization_roles
        notify_organization_roles.delay(
            str(org_id), ["admin"], "system", "AI credits added",
            f"{add:,} AI credits were added to your organization.",
            {"added_credits": add},
        )
    logger.info(f"Super admin {current_user.id} updated AI credits for org {org_id}: {payload}")
    return APIResponse.success(
        message="AI credits updated.",
        data={
            "monthly_credits": credits.allowed_credits,
            "custom_monthly_credits": credits.custom_monthly_credits,
            "purchased_credits": credits.purchased_credits,
            "used_credits": credits.used_credits,
        },
    )
