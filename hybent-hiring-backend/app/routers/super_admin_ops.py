"""Super admin operations: run the platform from the portal, without the server.

Email log, errors and failed jobs, failed imports, phone devices, contact
messages, and creating or correcting team accounts.
"""
import asyncio
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.dependencies import DB, SuperAdminUser
from app.models.email_message import EmailIngestionStatus, EmailMessage
from app.models.import_batch import ImportBatch
from app.models.operations import ContactMessage, EmailLog, PlatformError
from app.models.organization import Organization
from app.models.password_reset import PasswordResetToken
from app.models.push import PushSubscription
from app.models.user import User
from app.routers.super_admin import log_super_admin_action
from app.routers.users import INVITE_LINK_VALID_DAYS, invalidate_users_cache
from app.schemas.response import APIResponse
from app.services import billing_service, push_service
from app.services import elasticsearch_service as es_service
from app.services.email_service import send_email, send_team_invite
from app.utils.security import hash_password

router = APIRouter(prefix="/v1/super-admin", tags=["super-admin-operations"])

# Team roles a super admin can give. Never super_admin: that stays a deliberate
# server-side step, so a stolen portal session can't mint another one.
TeamRole = Literal["admin", "recruiter", "interviewer"]


def _status_counts(rows) -> dict:
    return {status: count for status, count in rows}


# ── Email log ─────────────────────────────────────────────────────────────────
def _email_out(e: EmailLog) -> dict:
    return {
        "id": str(e.id), "to": e.to_address, "subject": e.subject, "provider": e.provider, "status": e.status,
        "error": e.error, "can_resend": e.status == "failed" and bool(e.html_body), "created_at": e.created_at,
    }


@router.get("/email-logs")
async def list_email_logs(
    db: DB, current_user: SuperAdminUser,
    status: str = Query("all", pattern="^(all|sent|failed|resent)$"),
    q: str | None = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
):
    conditions = []
    if status != "all":
        conditions.append(EmailLog.status == status)
    if q and q.strip():
        term = f"%{q.strip()}%"
        conditions.append(or_(EmailLog.to_address.ilike(term), EmailLog.subject.ilike(term)))
    total = await db.scalar(select(func.count(EmailLog.id)).where(*conditions)) or 0
    rows = (await db.execute(
        select(EmailLog).where(*conditions).order_by(EmailLog.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    counts = _status_counts((await db.execute(select(EmailLog.status, func.count(EmailLog.id)).group_by(EmailLog.status))).all())
    return APIResponse.success(data={"emails": [_email_out(e) for e in rows], "total": total, "counts": counts})


@router.post("/email-logs/{log_id}/resend")
async def resend_email(log_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    log = await db.get(EmailLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Email not found.")
    if log.status != "failed" or not log.html_body:
        raise HTTPException(
            status_code=400,
            detail="This email can't be sent again from here. If it held a one-time link, send a new one from where it started.",
        )
    if not await asyncio.to_thread(send_email, log.to_address, log.subject, log.html_body):
        raise HTTPException(status_code=502, detail="Sending failed again. Check Errors and try shortly.")
    log.status, log.html_body = "resent", None
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Resent failed email to {log.to_address}"[:255], module="Email", request=request,
        metadata={"email_log_id": str(log.id)},
    )
    await db.commit()
    return APIResponse.success(message=f"Sent to {log.to_address}.", data=_email_out(log))


# ── Errors and failed background jobs ─────────────────────────────────────────
def _error_out(e: PlatformError) -> dict:
    return {
        "id": str(e.id), "kind": e.kind, "source": e.source, "error": e.error, "status": e.status, "count": e.count,
        "can_retry": e.kind == "task" and e.status == "open" and e.task_args is not None,
        "created_at": e.created_at, "last_seen_at": e.last_seen_at,
    }


@router.get("/errors")
async def list_errors(
    db: DB, current_user: SuperAdminUser,
    status: str = Query("open", pattern="^(all|open|resolved)$"),
    kind: str = Query("all", pattern="^(all|api|task)$"),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
):
    conditions = []
    if status != "all":
        conditions.append(PlatformError.status == status)
    if kind != "all":
        conditions.append(PlatformError.kind == kind)
    total = await db.scalar(select(func.count(PlatformError.id)).where(*conditions)) or 0
    rows = (await db.execute(
        select(PlatformError).where(*conditions).order_by(PlatformError.last_seen_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return APIResponse.success(data={"errors": [_error_out(e) for e in rows], "total": total})


@router.post("/errors/{error_id}/retry")
async def retry_job(error_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    err = await db.get(PlatformError, error_id)
    if not err:
        raise HTTPException(status_code=404, detail="Error not found.")
    if err.kind != "task" or err.task_args is None:
        raise HTTPException(status_code=400, detail="Only a failed background job can be run again.")
    if err.source not in celery_app.tasks:
        raise HTTPException(status_code=400, detail="This job no longer exists.")
    celery_app.send_task(err.source, args=err.task_args.get("args", []), kwargs=err.task_args.get("kwargs", {}))
    err.status = "resolved"
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Retried failed job {err.source}"[:255], module="Operations", request=request,
        metadata={"error_id": str(err.id)},
    )
    await db.commit()
    return APIResponse.success(message="Job queued again. If it fails again it will reappear here.", data=_error_out(err))


@router.post("/errors/{error_id}/resolve")
async def resolve_error(error_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    err = await db.get(PlatformError, error_id)
    if not err:
        raise HTTPException(status_code=404, detail="Error not found.")
    err.status = "resolved"
    await db.commit()
    return APIResponse.success(data=_error_out(err))


# ── Failed imports ────────────────────────────────────────────────────────────
@router.get("/failed-imports")
async def list_failed_imports(db: DB, current_user: SuperAdminUser, limit: int = Query(50, ge=1, le=200)):
    """Spreadsheet imports with failed rows, and resumes from email that failed."""
    sheets = (await db.execute(
        select(ImportBatch, Organization.name)
        .join(Organization, Organization.id == ImportBatch.organization_id)
        .where(ImportBatch.failed_count > 0, ImportBatch.deleted_at.is_(None))
        .order_by(ImportBatch.created_at.desc()).limit(limit)
    )).all()
    inbox = (await db.execute(
        select(EmailMessage, Organization.name)
        .join(Organization, Organization.id == EmailMessage.organization_id)
        .where(EmailMessage.ingestion_status == EmailIngestionStatus.FAILED)
        .order_by(EmailMessage.created_at.desc()).limit(limit)
    )).all()
    return APIResponse.success(data={
        "sheets": [
            {"id": str(b.id), "organization": org, "organization_id": str(b.organization_id), "file_name": b.file_name,
             "total_rows": b.total_rows, "failed_count": b.failed_count, "created_at": b.created_at}
            for b, org in sheets
        ],
        "inbox": [
            {"id": str(m.id), "organization": org, "organization_id": str(m.organization_id), "from": m.from_address,
             "subject": m.subject, "error": (m.ingestion_error or "")[:500], "created_at": m.created_at}
            for m, org in inbox
        ],
    })


@router.post("/failed-imports/inbox/{message_id}/retry")
async def retry_inbox_import(message_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    """Put a resume email that failed back in line; the next ingestion run takes it."""
    msg = await db.get(EmailMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Email not found.")
    if msg.ingestion_status != EmailIngestionStatus.FAILED:
        raise HTTPException(status_code=400, detail="This email isn't in a failed state.")
    msg.ingestion_status = EmailIngestionStatus.RETRY_PENDING
    msg.ingestion_attempts = 0
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action="Retried a failed resume email", module="Operations", request=request,
        metadata={"email_message_id": str(msg.id), "organization_id": str(msg.organization_id)},
    )
    await db.commit()
    return APIResponse.success(message="Queued. The next inbox run will process it.")


# ── Phones ────────────────────────────────────────────────────────────────────
@router.get("/push-devices")
async def list_push_devices(db: DB, current_user: SuperAdminUser, limit: int = Query(100, ge=1, le=200)):
    rows = (await db.execute(
        select(PushSubscription, User.id, User.full_name, User.email, User.role, Organization.name)
        .join(User, User.id == PushSubscription.user_id)
        .join(Organization, Organization.id == User.organization_id, isouter=True)
        .order_by(PushSubscription.created_at.desc()).limit(limit)
    )).all()
    return APIResponse.success(data={
        "enabled": push_service.push_enabled(),
        "devices": [
            {"id": str(s.id), "user_id": str(uid), "full_name": name, "email": email, "role": role, "organization": org,
             "user_agent": s.user_agent, "created_at": s.created_at, "last_sent_at": s.last_sent_at}
            for s, uid, name, email, role, org in rows
        ],
    })


@router.post("/users/{user_id}/test-push")
async def test_push(user_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    result = await push_service.send_to_users(db, [user.id], {
        "title": "Hybent test notification", "body": "Sent by your Hybent administrator.", "url": "/", "tag": "hybent-admin-test",
    })
    if not result["devices"]:
        raise HTTPException(status_code=404, detail=f"{user.full_name} hasn't turned on notifications on any device.")
    if not result["delivered"]:
        raise HTTPException(status_code=502, detail="Not delivered: " + ("; ".join(e for e in result["errors"] if e)[:300] or "the device is no longer registered."))
    message = f"Sent to {result['delivered']} of {result['devices']} device(s)."
    return APIResponse.success(message=message, data={"message": message, **result})


# ── Contact messages ──────────────────────────────────────────────────────────
ContactStatus = Literal["new", "replied", "closed"]


def _contact_out(c: ContactMessage) -> dict:
    return {
        "id": str(c.id), "topic": c.topic, "name": c.name, "email": c.email, "phone": c.phone, "company": c.company,
        "location": c.location, "message": c.message, "status": c.status, "notes": c.notes, "created_at": c.created_at,
    }


@router.get("/contact-messages")
async def list_contact_messages(
    db: DB, current_user: SuperAdminUser,
    status: str = Query("all", pattern="^(all|new|replied|closed)$"),
    q: str | None = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
):
    conditions = []
    if status != "all":
        conditions.append(ContactMessage.status == status)
    if q and q.strip():
        term = f"%{q.strip()}%"
        conditions.append(or_(ContactMessage.name.ilike(term), ContactMessage.email.ilike(term), ContactMessage.company.ilike(term)))
    total = await db.scalar(select(func.count(ContactMessage.id)).where(*conditions)) or 0
    rows = (await db.execute(
        select(ContactMessage).where(*conditions).order_by(ContactMessage.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    counts = _status_counts((await db.execute(select(ContactMessage.status, func.count(ContactMessage.id)).group_by(ContactMessage.status))).all())
    return APIResponse.success(data={"messages": [_contact_out(c) for c in rows], "total": total, "counts": counts})


class ContactUpdate(BaseModel):
    status: ContactStatus | None = None
    notes: str | None = Field(None, max_length=5000)


@router.patch("/contact-messages/{message_id}")
async def update_contact_message(message_id: uuid.UUID, payload: ContactUpdate, db: DB, current_user: SuperAdminUser):
    msg = await db.get(ContactMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(msg, key, value)
    msg.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return APIResponse.success(data=_contact_out(msg))


# ── Team accounts ─────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    organization_id: uuid.UUID
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    role: TeamRole


class UserEdit(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role: TeamRole | None = None


async def _email_taken(db, email: str, exclude: uuid.UUID | None = None) -> bool:
    query = select(User.id).where(func.lower(User.email) == email.lower())
    if exclude:
        query = query.where(User.id != exclude)
    return await db.scalar(query.limit(1)) is not None


async def _send_invite(db, user: User, invited_by: str) -> bool:
    token = secrets.token_urlsafe(48)
    db.add(PasswordResetToken(
        user_id=user.id, token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_LINK_VALID_DAYS),
    ))
    await db.commit()
    org = await db.get(Organization, user.organization_id)
    return await asyncio.to_thread(
        send_team_invite,
        to_email=user.email, to_name=user.full_name, invited_by=invited_by,
        company_name=org.name if org else "Hybent", role=user.role,
        setup_url=f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}",
        valid_days=INVITE_LINK_VALID_DAYS, org_logo_url=org.logo_url if org else None,
    )


@router.post("/users", status_code=201)
async def create_user(payload: UserCreate, db: DB, current_user: SuperAdminUser, request: Request, background_tasks: BackgroundTasks):
    org = await db.get(Organization, payload.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Client not found.")
    email = str(payload.email).lower()
    if await _email_taken(db, email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    await billing_service.ensure_seat_available(db, org.id, payload.role)
    user = User(
        organization_id=org.id, email=email, full_name=payload.full_name.strip(), role=payload.role,
        hashed_password=hash_password(secrets.token_urlsafe(32)), is_verified=True,
    )
    db.add(user)
    await db.flush()
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Created {payload.role} {email} in {org.name}"[:255], module="User Management", request=request,
        metadata={"target_user_id": str(user.id), "organization_id": str(org.id)},
    )
    await db.commit()
    await db.refresh(user)
    sent = await _send_invite(db, user, current_user.full_name)
    background_tasks.add_task(es_service.index_user, user)
    invalidate_users_cache(org.id)
    return APIResponse.success(
        message=f"Account created and invite sent to {email}." if sent else "Account created, but the invite email failed. Use Resend invite.",
        data={"id": str(user.id), "email": user.email, "invite_sent": sent},
    )


@router.patch("/users/{user_id}")
async def edit_user(user_id: uuid.UUID, payload: UserEdit, db: DB, current_user: SuperAdminUser, request: Request):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "role" in changes and user.role not in ("admin", "recruiter", "interviewer"):
        raise HTTPException(status_code=400, detail=f"A {user.role.replace('_', ' ')} account's role can't be changed here.")
    if "email" in changes:
        changes["email"] = str(changes["email"]).lower()
        if await _email_taken(db, changes["email"], exclude=user.id):
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
    if "role" in changes:
        await billing_service.ensure_seat_available(db, user.organization_id, changes["role"], previous_role=user.role)
    before = {k: getattr(user, k) for k in changes}
    for key, value in changes.items():
        setattr(user, key, value.strip() if key == "full_name" else value)
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Edited account {user.email}"[:255], module="User Management", request=request,
        metadata={"target_user_id": str(user.id), "before": before, "after": changes},
    )
    await db.commit()
    invalidate_users_cache(user.organization_id)
    return APIResponse.success(message="Account updated.", data={"id": str(user.id), "email": user.email, "role": user.role, "full_name": user.full_name})


@router.post("/users/{user_id}/resend-invite")
async def resend_invite(user_id: uuid.UUID, db: DB, current_user: SuperAdminUser, request: Request):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Reactivate this account before sending an invite.")
    if user.role not in ("admin", "recruiter", "interviewer"):
        raise HTTPException(status_code=400, detail="Invites are for team accounts.")
    if not await _send_invite(db, user, current_user.full_name):
        raise HTTPException(status_code=502, detail=f"The invite to {user.email} could not be sent. Check the email log.")
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Resent invite to {user.email}"[:255], module="User Management", request=request,
        metadata={"target_user_id": str(user.id)},
    )
    await db.commit()
    return APIResponse.success(message=f"Invite sent to {user.email}.")


# ── Plans ─────────────────────────────────────────────────────────────────────
class PlanEdit(BaseModel):
    price_monthly: float | None = Field(None, ge=0, le=100000)
    ai_credits_monthly: int | None = Field(None, ge=0, le=100_000_000)
    included_admins: int | None = Field(None, ge=0, le=1000)
    included_recruiters: int | None = Field(None, ge=0, le=1000)
    max_jobs: int | None = Field(None, ge=0, le=100000)
    copilot: bool | None = None


@router.put("/plans/{plan_id}")
async def edit_plan(plan_id: uuid.UUID, payload: PlanEdit, db: DB, current_user: SuperAdminUser, request: Request):
    """Change what a plan costs and includes. New payment links use the new
    price; clients already subscribed keep paying their old price in Stripe."""
    from app.models.super_admin import SubscriptionPlan

    plan = await db.get(SubscriptionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    before = {}
    if "copilot" in changes:
        before["copilot"] = bool((plan.features or {}).get("copilot"))
        plan.features = {**(plan.features or {}), "copilot": changes.pop("copilot")}
    for key, value in changes.items():
        before[key] = getattr(plan, key)
        setattr(plan, key, value)
    plan.updated_at = datetime.now(timezone.utc)
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Edited plan {plan.name}"[:255], module="Billing", request=request,
        metadata={"plan_id": str(plan.id), "before": before, "after": payload.model_dump(exclude_unset=True)},
    )
    await db.commit()
    return APIResponse.success(message=f"{plan.name} updated.", data=billing_service.plan_to_dict(plan))


# ── CSV exports ───────────────────────────────────────────────────────────────
def _csv(rows: list[list]) -> str:
    import csv
    import io
    buf = io.StringIO()
    writer = csv.writer(buf)
    for row in rows:
        # A leading = + - @ would run as a formula in a spreadsheet.
        writer.writerow([("'" + c) if isinstance(c, str) and c[:1] in ("=", "+", "-", "@") else c for c in row])
    return buf.getvalue()


@router.get("/exports/{kind}")
async def export_csv(kind: Literal["clients", "users", "payments"], db: DB, current_user: SuperAdminUser, request: Request):
    """Clients, users or payments as a CSV file. The export is audited."""
    from fastapi.responses import Response
    from app.models.payment import Payment

    if kind == "clients":
        orgs = (await db.execute(select(Organization).order_by(Organization.created_at))).scalars().all()
        rows = [["name", "slug", "active", "industry", "size", "created_at"]] + [
            [o.name, o.slug, o.is_active, o.industry or "", o.size or "", o.created_at.isoformat() if o.created_at else ""] for o in orgs
        ]
    elif kind == "users":
        users = (await db.execute(
            select(User, Organization.name).join(Organization, Organization.id == User.organization_id, isouter=True)
            .order_by(User.created_at)
        )).all()
        rows = [["name", "email", "role", "client", "active", "last_login", "created_at"]] + [
            [u.full_name, u.email, u.role, org or "", u.is_active,
             u.last_login.isoformat() if u.last_login else "", u.created_at.isoformat() if u.created_at else ""]
            for u, org in users
        ]
    else:
        payments = (await db.execute(
            select(Payment, Organization.name).join(Organization, Organization.id == Payment.organization_id, isouter=True)
            .order_by(Payment.created_at)
        )).all()
        rows = [["client", "kind", "description", "status", "amount_usd", "refunded_usd", "paid_at", "created_at"]] + [
            [org or "", p.kind, p.description, p.status, p.amount_usd, (p.details or {}).get("refunded_usd", 0),
             p.paid_at.isoformat() if p.paid_at else "", p.created_at.isoformat() if p.created_at else ""]
            for p, org in payments
        ]
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Exported {kind} ({len(rows) - 1} rows)", module="Exports", request=request, metadata={"kind": kind},
    )
    await db.commit()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content=_csv(rows), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="hybent-{kind}-{stamp}.csv"'},
    )


# ── Announcement banner and maintenance mode ─────────────────────────────────
from app.models.super_admin import PlatformSetting  # noqa: E402
from app.services import platform_notice  # noqa: E402

# Readable by anyone: the app shows it to signed-in users, and during
# maintenance it is how the app learns why requests are refused.
platform_router = APIRouter(prefix="/v1/platform", tags=["platform"])


@platform_router.get("/status")
async def platform_status(db: DB):
    return APIResponse.success(data=await platform_notice.load(db))


class AnnouncementIn(BaseModel):
    active: bool = False
    message: str = Field("", max_length=500)
    tone: Literal["info", "warning", "success"] = "info"


class MaintenanceIn(BaseModel):
    enabled: bool = False
    message: str = Field("", max_length=500)


class PlatformNoticeIn(BaseModel):
    announcement: AnnouncementIn | None = None
    maintenance: MaintenanceIn | None = None


@router.get("/platform-notice")
async def get_platform_notice(db: DB, current_user: SuperAdminUser):
    return APIResponse.success(data=await platform_notice.load(db, fresh=True))


@router.put("/platform-notice")
async def update_platform_notice(data: PlatformNoticeIn, db: DB, current_user: SuperAdminUser, request: Request):
    setting = await db.scalar(select(PlatformSetting).where(PlatformSetting.setting_key == platform_notice.NOTICE_KEY))
    value = dict(setting.setting_value) if setting else {}
    changes = data.model_dump(exclude_none=True)
    if data.announcement is not None and data.announcement.active and not data.announcement.message.strip():
        raise HTTPException(status_code=400, detail="Write the announcement before turning it on.")
    value.update(changes)
    value["updated_at"] = datetime.now(timezone.utc).isoformat()
    if setting:
        setting.setting_value = value
    else:
        db.add(PlatformSetting(setting_key=platform_notice.NOTICE_KEY, setting_value=value))

    parts = []
    if data.announcement is not None:
        parts.append("announcement " + ("on" if data.announcement.active else "off"))
    if data.maintenance is not None:
        parts.append("maintenance " + ("ON" if data.maintenance.enabled else "off"))
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Platform notice: {', '.join(parts) or 'saved'}", module="Global Settings", request=request, metadata=changes,
    )
    await db.commit()
    platform_notice.clear_cache()
    return APIResponse.success(message="Saved.", data=await platform_notice.load(db, fresh=True))


# ── Today's to-do: what needs a super admin, as counts ──────────────────────
from app.models.demo_booking import DemoBooking  # noqa: E402
from app.models.push import DemoRequestRecord  # noqa: E402
from app.models.super_admin import ImpersonationLog  # noqa: E402
from app.models.trial_request import TrialRequest  # noqa: E402


@router.get("/todo")
async def super_admin_todo(db: DB, current_user: SuperAdminUser):
    """Counts for the dashboard's "Today" card and the sidebar badges.
    Only things a person has to act on; zero means nothing to do."""
    now = datetime.now(timezone.utc)
    week = now - timedelta(days=7)

    async def count(model, *where) -> int:
        return await db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    data = {
        "trials_pending": await count(TrialRequest, TrialRequest.status == "pending"),
        "demo_requests_new": await count(DemoRequestRecord, DemoRequestRecord.status == "new"),
        "demos_upcoming": await count(DemoBooking, DemoBooking.status == "booked",
                                      DemoBooking.start_at >= now, DemoBooking.start_at < now + timedelta(days=1)),
        "contact_new": await count(ContactMessage, ContactMessage.status == "new"),
        "emails_failed": await count(EmailLog, EmailLog.status == "failed", EmailLog.created_at >= week),
        "errors_open": await count(PlatformError, PlatformError.status == "open"),
        "sessions_active": await count(ImpersonationLog, ImpersonationLog.ended_at.is_(None),
                                       ImpersonationLog.expires_at > now),
    }
    data["leads"] = data["trials_pending"] + data["demo_requests_new"] + data["contact_new"]
    data["system"] = data["emails_failed"] + data["errors_open"]
    return APIResponse.success(data=data)
