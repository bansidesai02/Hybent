import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import DB, SuperAdminUser, CurrentUser
from app.models.organization import Organization
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.super_admin import (
    SubscriptionPlan, CompanySubscription, CompanyFeatureFlag,
    SuperAdminAuditLog, ImpersonationLog, PlatformSetting
)
from app.schemas.super_admin import (
    ClientCreate, ClientUpdate, PlatformSettingsUpdate, ImpersonationStartRequest
)
from app.schemas.response import APIResponse
from app.utils.security import create_access_token, hash_password
from app.utils.permissions import UserRole
from app.services import billing_service

logger = logging.getLogger(__name__)
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


# ── 1. DASHBOARD OVERVIEW ─────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_dashboard_overview(db: DB, current_user: SuperAdminUser):
    from app.models.offer import Offer

    # Total Companies
    total_companies = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    # Total Users
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    # Total Jobs
    total_jobs = (await db.execute(select(func.count(Job.id)))).scalar() or 0
    # Total Candidates
    total_candidates = (await db.execute(select(func.count(Candidate.id)))).scalar() or 0
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
    jobs_this_week = (await db.execute(select(func.count(Job.id)).where(Job.created_at >= seven_days_ago))).scalar() or 0

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
        "growth_metrics": {
            "clients_delta": f"+{clients_this_month} this month",
            "users_delta": f"+{users_this_week} this week",
            "jobs_delta": f"+{jobs_this_week} this week",
            "mrr_delta": "Stable"
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
        select(Job.organization_id, func.count(Job.id)).where(Job.organization_id.in_(org_ids)).group_by(Job.organization_id)
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
        
        flags = flags_map.get(org.id, {})
        for k in ["ai", "video", "bulk", "domain", "analytics"]:
            if k not in flags:
                flags[k] = (k in ["ai", "bulk"])

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
            "status": sub_status if org.is_active else "suspended",
            "mrr": mrr,
            "users_count": users_cnt,
            "users_limit": users_limit,
            "seats_used": seats_counts.get(org.id, 0),
            "jobs_count": jobs_cnt,
            "jobs_limit": jobs_limit,
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

    # Create Organization
    org = Organization(
        name=data.name,
        slug=data.slug,
        industry=data.industry,
        size=data.size,
        is_active=True
    )
    db.add(org)
    await db.flush()

    # Create Admin User
    admin = User(
        organization_id=org.id,
        email=data.admin_email,
        full_name=data.name + " Admin",
        hashed_password=hash_password("password123"),  # default password
        role=UserRole.ADMIN.value,
        is_active=True,
        is_verified=True
    )
    db.add(admin)
    await db.flush()

    # Subscription plan (Standard, 6 months, 12 months, Custom)
    plan = await billing_service.find_plan(db, data.plan_name)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{data.plan_name}'.")
    plan_name = plan.name

    sub = CompanySubscription(
        organization_id=org.id,
        plan_id=plan.id,
        status="active",
        trial_end=datetime.now(timezone.utc) + timedelta(days=data.trial_days) if data.trial_days > 0 else None
    )
    billing_service.assign_plan(sub, plan)
    db.add(sub)

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
    return APIResponse.success(message="Client created successfully.", data={"org_id": str(org.id)})


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

    org.is_active = False
    
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
    if sub:
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
    return APIResponse.success(message="Client activated successfully.")


# ── 3. FEATURE FLAGS OVERRIDES ────────────────────────────────────────────────
@router.get("/clients/{client_id}/flags")
async def get_client_feature_flags(client_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    flags_res = await db.execute(
        select(CompanyFeatureFlag).where(CompanyFeatureFlag.organization_id == client_id)
    )
    flags = {f.flag_key: f.is_enabled for f in flags_res.scalars().all()}
    return APIResponse.success(data=flags)


@router.put("/clients/{client_id}/flags")
async def update_client_feature_flags(client_id: uuid.UUID, flags_update: dict[str, bool], db: DB, current_user: SuperAdminUser, request: Request):
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
        action=f"Updated feature flags for client {client_id}",
        module="Feature Flags",
        request=request,
        metadata=flags_update
    )

    await db.commit()
    return APIResponse.success(message="Feature flags updated successfully.")


# ── 4. GLOBAL FEATURE FLAGS ───────────────────────────────────────────────────
@router.get("/flags")
async def get_global_flags(db: DB, current_user: CurrentUser):
    settings_res = await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == "global_feature_flags")
    )
    setting = settings_res.scalar_one_or_none()
    if not setting:
        defaults = {"ai": True, "video": True, "bulk": True, "domain": False, "analytics": False}
        setting = PlatformSetting(setting_key="global_feature_flags", setting_value=defaults)
        db.add(setting)
        await db.commit()
        return APIResponse.success(data=defaults)

    return APIResponse.success(data=setting.setting_value)


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
    return APIResponse.success(message="Global feature flags updated successfully.")


# ── 5. GLOBAL USER MANAGEMENT ─────────────────────────────────────────────────
@router.get("/users")
async def list_global_users(
    db: DB,
    current_user: SuperAdminUser,
    role: str | None = None,
    client: str | None = None,
    limit: int = 100,
    offset: int = 0
):
    base_query = select(User, Organization.name.label("org_name")).join(
        Organization, Organization.id == User.organization_id, isouter=True
    )
    if role and role != "all":
        base_query = base_query.where(User.role == role.lower())
    if client and client != "all":
        base_query = base_query.where(Organization.name == client)

    # Count total before pagination
    count_query = select(func.count(User.id)).join(
        Organization, Organization.id == User.organization_id, isouter=True
    )
    if role and role != "all":
        count_query = count_query.where(User.role == role.lower())
    if client and client != "all":
        count_query = count_query.where(Organization.name == client)
    total = (await db.execute(count_query)).scalar() or 0

    paginated_query = base_query.order_by(User.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(paginated_query)
    users_list = []
    now = datetime.now(timezone.utc)
    for user, org_name in res.all():
        users_list.append({
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "client": org_name or "System",
            "is_active": user.is_active,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "online": True if (user.last_login and now - user.last_login < timedelta(minutes=15)) else False
        })
    return APIResponse.success(data={"users": users_list, "total": total, "limit": limit, "offset": offset})


@router.put("/users/{user_id}/status")
async def update_user_status(user_id: uuid.UUID, is_active: bool, db: DB, current_user: SuperAdminUser, request: Request):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = is_active
    
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

    # Reset to default password
    user.hashed_password = hash_password("password123")
    
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
    return APIResponse.success(message="User password reset to default: password123")


# ── 6. AUDIT LOGS ─────────────────────────────────────────────────────────────
@router.get("/audit-logs")
async def list_audit_logs(
    db: DB, 
    current_user: SuperAdminUser, 
    client: str | None = None, 
    category: str | None = None,
    limit: int = 50,
    offset: int = 0
):
    query = select(SuperAdminAuditLog)
    
    if client:
        query = query.where(SuperAdminAuditLog.module.ilike(f"%{client}%"))
    if category:
        query = query.where(SuperAdminAuditLog.action.ilike(f"%{category}%"))

    query = query.order_by(SuperAdminAuditLog.created_at.desc()).limit(limit).offset(offset)
    
    # Get total count for pagination metadata
    count_query = select(func.count(SuperAdminAuditLog.id))
    if client:
        count_query = count_query.where(SuperAdminAuditLog.module.ilike(f"%{client}%"))
    if category:
        count_query = count_query.where(SuperAdminAuditLog.action.ilike(f"%{category}%"))
    
    total_logs = (await db.execute(count_query)).scalar() or 0
    res = await db.execute(query)
    logs = res.scalars().all()

    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "action": log.action,
            "client": log.module,
            "actor": log.user_email,
            "time": log.created_at.strftime("%Y-%m-%d %I:%M %p"),
            "type": "impersonation" if "impersonate" in log.action.lower() else "user"
        })

    return APIResponse.success(data={
        "logs": formatted_logs,
        "total": total_logs,
        "limit": limit,
        "offset": offset
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
    except ImportError:
        pass

    # Real DB Latency and Activity
    start_time = time.time()
    await db.execute(text("SELECT 1"))
    latency_ms = round((time.time() - start_time) * 1000)
    
    # Get recent errors from SuperAdmin audit log (admin-level error actions in last 24h)
    twenty_four_hours_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    errors_count = (await db.execute(
        select(func.count(SuperAdminAuditLog.id)).where(
            SuperAdminAuditLog.action.ilike("%error%"),
            SuperAdminAuditLog.created_at >= twenty_four_hours_ago
        )
    )).scalar() or 0

    # Mock Services Status for now (or could check Redis etc.)
    services = [
        {"name": "API gateway", "status": "Operational"},
        {"name": "Auth service", "status": "Operational"},
        {"name": "Database", "status": "Operational" if latency_ms < 1000 else "Degraded"},
        {"name": "Background jobs", "status": "Operational"}
    ]

    return APIResponse.success(data={
        "api_uptime": "99.99%",
        "avg_latency": f"{latency_ms}ms",
        "errors_24h": errors_count,
        "db_queries_sec": "N/A",  # Hard to get without extensions like pg_stat_statements
        "cpu_percent": cpu,
        "memory_percent": memory,
        "disk_percent": disk,
        "services": services
    })


# ── 8. GLOBAL PLATFORM SETTINGS ───────────────────────────────────────────────
@router.get("/settings")
async def get_platform_settings(db: DB, current_user: SuperAdminUser):
    settings_res = await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == "platform_branding_smtp")
    )
    setting = settings_res.scalar_one_or_none()
    if not setting:
        defaults = {
            "smtp_provider": "SendGrid",
            "smtp_sender_name": "Hybent Support",
            "smtp_sender_email": "no-reply@hybent.com",
            "require_2fa": True,
            "session_timeout": True,
            "ip_whitelist": False,
            "platform_name": "Hybent",
            "logo_url": "",
            "primary_color": "#534AB7"
        }
        setting = PlatformSetting(setting_key="platform_branding_smtp", setting_value=defaults)
        db.add(setting)
        await db.commit()
        return APIResponse.success(data=defaults)

    return APIResponse.success(data=setting.setting_value)


@router.put("/settings")
async def update_platform_settings(data: PlatformSettingsUpdate, db: DB, current_user: SuperAdminUser, request: Request):
    setting_res = await db.execute(
        select(PlatformSetting).where(PlatformSetting.setting_key == "platform_branding_smtp")
    )
    setting = setting_res.scalar_one_or_none()
    
    current_val = setting.setting_value if setting else {}
    update_dict = data.model_dump(exclude_unset=True)
    new_val = {**current_val, **update_dict}

    if not setting:
        setting = PlatformSetting(setting_key="platform_branding_smtp", setting_value=new_val)
        db.add(setting)
    else:
        setting.setting_value = new_val

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action="Updated platform global configurations & branding settings",
        module="Global Settings",
        request=request,
        metadata=update_dict
    )

    await db.commit()
    return APIResponse.success(message="Settings saved successfully.", data=new_val)


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
    ).group_by('month').order_by('month')

    user_res = await db.execute(user_query)
    candidate_res = await db.execute(candidate_query)

    user_growth = []
    cumulative_users = 0
    for row in user_res.all():
        cumulative_users += row.count
        user_growth.append({
            "date": row.month.strftime("%b") if row.month else "Unknown",
            "count": cumulative_users
        })

    candidate_growth = []
    cumulative_candidates = 0
    for row in candidate_res.all():
        cumulative_candidates += row.count
        candidate_growth.append({
            "date": row.month.strftime("%b") if row.month else "Unknown",
            "count": cumulative_candidates
        })

    # For revenue, we simulate cumulative growth since MRR doesn't have a history table here
    # A real billing implementation would have an Invoice or Payment table.
    revenue_growth = []
    
    # Just to show *something* that isn't hardcoded entirely, we map the latest MRR
    mrr_query = select(func.sum(SubscriptionPlan.price_monthly)).join(
        CompanySubscription, CompanySubscription.plan_id == SubscriptionPlan.id
    ).where(CompanySubscription.status == "active")
    total_mrr = (await db.execute(mrr_query)).scalar() or 0.0

    # Ensure arrays have at least some fallback if data is empty (for UI charts)
    if not user_growth:
        user_growth = [{"date": datetime.now(timezone.utc).strftime("%b"), "count": 0}]
    if not candidate_growth:
        candidate_growth = [{"date": datetime.now(timezone.utc).strftime("%b"), "count": 0}]
        
    revenue_growth = [{"date": datetime.now(timezone.utc).strftime("%b"), "amount": total_mrr}]

    return APIResponse.success(data={
        "user_growth": user_growth,
        "candidate_growth": candidate_growth,
        "revenue_growth": revenue_growth
    })


# ── 10. IMPERSONATION FLOW ────────────────────────────────────────────────────
@router.post("/impersonate/{user_id}")
async def impersonate_user(user_id: uuid.UUID, payload: ImpersonationStartRequest, db: DB, current_user: SuperAdminUser, request: Request):
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")

    # Record Impersonation Log
    log = ImpersonationLog(
        super_admin_id=current_user.id,
        impersonated_user_id=target_user.id,
        reason=payload.reason,
        started_at=datetime.now(timezone.utc)
    )
    db.add(log)
    await db.flush()

    await log_super_admin_action(
        db=db,
        user_id=current_user.id,
        user_email=current_user.email,
        action=f"Started impersonation of user {target_user.email} (Reason: {payload.reason})",
        module="Impersonation",
        request=request,
        metadata={"impersonated_user_id": str(user_id), "reason": payload.reason}
    )

    # Issue access token containing impersonator_id claim
    token_data = {
        "sub": str(target_user.id),
        "org": str(target_user.organization_id),
        "impersonator_id": str(current_user.id)
    }
    token = create_access_token(token_data)

    await db.commit()
    return APIResponse.success(message=f"Impersonation session created.", data={
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(target_user.id),
            "email": target_user.email,
            "full_name": target_user.full_name,
            "role": target_user.role,
            "organization_id": str(target_user.organization_id),
            "is_active": target_user.is_active,
            "is_impersonating": True,
            "impersonator_id": str(current_user.id)
        }
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
