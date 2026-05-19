"""
Admin-only endpoints: audit logs, org settings, team management.
"""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query, Depends
from sqlalchemy import select, func, or_
from app.dependencies import DB, require_admin
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.ai_usage import AIUsage
from app.utils.pagination import paginate
from app.schemas.response import APIResponse
from typing import Annotated

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/audit-logs")
async def list_audit_logs(
    current_user: Annotated[User, Depends(require_admin)],
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    search: str | None = None,      # filter by user name (partial, case-insensitive)
    date_from: str | None = None,   # ISO date e.g. 2025-01-01
    date_to: str | None = None,     # ISO date e.g. 2025-12-31
):
    # Base query joining User so we can filter by user name
    query = (
        select(AuditLog, User.full_name.label("user_name"), User.role.label("user_role"))
        .outerjoin(User, AuditLog.user_id == User.id)
        .where(AuditLog.organization_id == current_user.organization_id)
    )

    if action:
        query = query.where(AuditLog.action == action.upper())
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.where(AuditLog.resource_id == resource_id)
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%"))
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.where(AuditLog.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            # Include the full end date by going to end of day
            from datetime import timedelta
            dt_to = dt_to + timedelta(days=1)
            query = query.where(AuditLog.created_at < dt_to)
        except ValueError:
            pass

    query = query.order_by(AuditLog.created_at.desc())

    # Count total for pagination
    count_query = select(func.count()).select_from(
        select(AuditLog)
        .outerjoin(User, AuditLog.user_id == User.id)
        .where(AuditLog.organization_id == current_user.organization_id)
        .where(*([AuditLog.action == action.upper()] if action else []))
        .where(*([AuditLog.resource_type == resource_type] if resource_type else []))
        .where(*([AuditLog.resource_id == resource_id] if resource_id else []))
        .where(*([User.full_name.ilike(f"%{search}%")] if search else []))
        .subquery()
    )
    total = (await db.execute(count_query)).scalar()

    rows = (await db.execute(query.offset((page - 1) * limit).limit(limit))).all()

    return APIResponse.success(message="Audit logs retrieved successfully.", data=paginate([
        {
            "id": str(row.AuditLog.id),
            "action": row.AuditLog.action,
            "resource_type": row.AuditLog.resource_type,
            "resource_id": row.AuditLog.resource_id,
            "user_id": str(row.AuditLog.user_id) if row.AuditLog.user_id else None,
            "user_name": row.user_name,
            "user_role": row.user_role,
            "details": row.AuditLog.details,
            "ip_address": row.AuditLog.ip_address,
            "created_at": row.AuditLog.created_at.isoformat(),
        }
        for row in rows
    ], total, page, limit))


@router.get("/ai-usage")
async def list_ai_usage(
    current_user: Annotated[User, Depends(require_admin)],
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    provider: str | None = Query(None, description="Filter by provider (Gemini, Groq, etc.)"),
    feature: str | None = Query(None, description="Filter by feature (jd_generation, etc.)"),
    date_from: str | None = None,
    date_to: str | None = None,
):
    """
    Retrieve detailed AI usage logs for the organization.
    """
    query = (
        select(AIUsage, User.full_name.label("user_name"))
        .outerjoin(User, AIUsage.user_id == User.id)
        .where(AIUsage.organization_id == current_user.organization_id)
    )

    if provider:
        query = query.where(AIUsage.provider.ilike(f"%{provider}%"))
    if feature:
        query = query.where(AIUsage.feature == feature)
    
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.where(AIUsage.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            dt_to = dt_to + timedelta(days=1)
            query = query.where(AIUsage.created_at < dt_to)
        except ValueError:
            pass

    query = query.order_by(AIUsage.created_at.desc())

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Data
    rows = (await db.execute(query.offset((page - 1) * limit).limit(limit))).all()

    return APIResponse.success(message="AI usage logs retrieved successfully.", data=paginate([
        {
            "id": str(row.AIUsage.id),
            "provider": row.AIUsage.provider,
            "model": row.AIUsage.model,
            "feature": row.AIUsage.feature,
            "prompt_tokens": row.AIUsage.prompt_tokens,
            "completion_tokens": row.AIUsage.completion_tokens,
            "total_tokens": row.AIUsage.total_tokens,
            "duration_ms": row.AIUsage.duration_ms,
            "status": row.AIUsage.status,
            "user_name": row.user_name,
            "created_at": row.AIUsage.created_at.isoformat(),
        }
        for row in rows
    ], total, page, limit))


@router.get("/stats")
async def org_stats(current_user: Annotated[User, Depends(require_admin)], db: DB):
    """Admin dashboard stats."""
    total_users = (await db.execute(
        select(func.count(User.id)).where(User.organization_id == current_user.organization_id)
    )).scalar()
    active_users = (await db.execute(
        select(func.count(User.id)).where(
            User.organization_id == current_user.organization_id,
            User.is_active == True,
        )
    )).scalar()
    return APIResponse.success(message="Stats retrieved successfully.", data={"total_users": total_users, "active_users": active_users})


@router.get("/dashboard-stats")
async def dashboard_stats(current_user: Annotated[User, Depends(require_admin)], db: DB):
    """
    Extended dashboard stats including AI usage.
    """
    # User stats
    total_users = (await db.execute(
        select(func.count(User.id)).where(User.organization_id == current_user.organization_id)
    )).scalar()
    
    # AI usage stats (Last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    ai_stats = (await db.execute(
        select(
            func.sum(AIUsage.total_tokens).label("total_tokens"),
            func.count(AIUsage.id).label("total_requests")
        ).where(
            AIUsage.organization_id == current_user.organization_id,
            AIUsage.created_at >= thirty_days_ago
        )
    )).first()

    return APIResponse.success(message="Dashboard stats retrieved successfully.", data={
        "users": {
            "total": total_users,
        },
        "ai_usage_30d": {
            "total_tokens": ai_stats.total_tokens or 0,
            "total_requests": ai_stats.total_requests or 0
        }
    })


@router.post("/es/reindex")
async def es_reindex_all(current_user: Annotated[User, Depends(require_admin)], db: DB):
    """
    Bulk-index all existing Postgres data into Elasticsearch.
    Run once after the first deployment. New records are indexed automatically.
    Scoped to the current admin's organization.
    """
    from app.models.candidate import Candidate
    from app.models.job import Job
    from app.models.interview import Interview
    from app.models.user import User
    from app.models.candidate import Candidate as CandidateModel
    from app.services import elasticsearch_service as es_service
    from sqlalchemy import select

    org_id = current_user.organization_id
    counts = {"candidates": 0, "jobs": 0, "interviews": 0, "users": 0}

    # ── Candidates ──────────────────────────────────────────────────────────
    cand_rows = (
        await db.execute(select(Candidate).where(Candidate.organization_id == org_id))
    ).scalars().all()
    for c in cand_rows:
        await es_service.index_candidate(c)
        counts["candidates"] += 1

    # ── Jobs ────────────────────────────────────────────────────────────────
    job_rows = (
        await db.execute(select(Job).where(Job.organization_id == org_id))
    ).scalars().all()
    for j in job_rows:
        await es_service.index_job(j)
        counts["jobs"] += 1

    # ── Interviews ──────────────────────────────────────────────────────────
    ivw_rows = (
        await db.execute(select(Interview).where(Interview.organization_id == org_id))
    ).scalars().all()
    for iv in ivw_rows:
        # Resolve candidate name
        cand = (
            await db.execute(select(CandidateModel).where(CandidateModel.id == iv.candidate_id))
        ).scalar_one_or_none()
        await es_service.index_interview(iv, cand.full_name if cand else "")
        counts["interviews"] += 1

    # ── Users ───────────────────────────────────────────────────────────────
    user_rows = (
        await db.execute(select(User).where(User.organization_id == org_id))
    ).scalars().all()
    for u in user_rows:
        await es_service.index_user(u)
        counts["users"] += 1

    total = sum(counts.values())
    return APIResponse.success(
        message=f"Elasticsearch reindex complete. {total} documents indexed.",
        data=counts,
    )


@router.post("/test-email")
async def test_email(
    current_user: Annotated[User, Depends(require_admin)],
    recipient: str | None = Query(None, description="Override recipient email. Defaults to current admin's email.")
):
    """
    Admin-only: send a test email to verify SMTP is working.
    Optionally pass ?recipient=your@email.com to send to a specific address.
    Check backend logs for ✅ or ❌ status after calling this endpoint.
    """
    from fastapi import HTTPException
    from app.config import settings
    from app.services.email_service import send_email

    # Quick SMTP configuration check before attempting
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(
            status_code=503,
            detail="SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in your environment."
        )

    target_email = recipient or current_user.email
    send_email(
        to=target_email,
        subject="✅ Hireon Email Test — SMTP Working",
        html_body=f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #dadce0;border-radius:12px;">
            <h2 style="color:#6c47ff;margin-top:0;">✅ SMTP is Working!</h2>
            <p style="color:#3c4043;">This test email was sent from the Hireon backend to confirm that SMTP is correctly configured.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <tr><td style="padding:6px 0;color:#70757a;font-size:13px;">From</td><td style="padding:6px 0;font-size:13px;">{settings.smtp_user}</td></tr>
                <tr><td style="padding:6px 0;color:#70757a;font-size:13px;">To</td><td style="padding:6px 0;font-size:13px;">{target_email}</td></tr>
                <tr><td style="padding:6px 0;color:#70757a;font-size:13px;">SMTP Host</td><td style="padding:6px 0;font-size:13px;">{settings.smtp_host}:{settings.smtp_port}</td></tr>
            </table>
            <p style="margin-top:24px;font-size:12px;color:#70757a;">Triggered by admin: {current_user.full_name}</p>
        </div>
        """
    )

    return APIResponse.success(
        message=f"Test email triggered to {target_email}. Check backend logs for delivery status.",
        data={"smtp_user": settings.smtp_user, "smtp_host": settings.smtp_host, "recipient": target_email}
    )
