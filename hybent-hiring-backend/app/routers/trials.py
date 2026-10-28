"""The 7-day free trial (services/trial_service.py).

- /api/public/trial-request: hybent.com/free-trial (send-code, verify-code, then the request).
- /api/public/trial-setup/{token}: the organization setup link sent on approval.
- /v1/super-admin/trials: review requests, reply (AI draft → edit → send; approving
  starts the trial), extend.
- /v1/trial: the signed-in organization's trial status and data export.
"""
import asyncio
import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, or_, select

from app.core.config import settings
from app.dependencies import DB, AdminUser, CurrentUser, SuperAdminUser
from app.models.organization import Organization
from app.models.trial_request import TRIAL_STATUSES, TrialMessage, TrialRequest
from app.models.user import User
from app.routers.super_admin import log_super_admin_action
from app.schemas.response import APIResponse
from app.schemas.trial import (
    COMPANY_SIZES, HIRES_PER_YEAR, INDUSTRIES, TrialExtend, TrialNotes, TrialReplyDraft, TrialReplySend,
    TrialRequestCreate, TrialSendCode, TrialSetupComplete, TrialVerifyCode,
)
from app.services import email_service, lead_checks, trial_export, trial_replies, trial_service
from app.services.activity_service import log_activity

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["Public"])
admin_router = APIRouter(prefix="/v1/super-admin/trials", tags=["super-admin"])
router = APIRouter(prefix="/v1/trial", tags=["trial"])

TRIAL_THANKS = (
    "Thank you for submitting your request. Our team will review it and, within one business day, "
    "send your organization setup link to your work email."
)


def _client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )


# ── Public ───────────────────────────────────────────────────────────────────

@public_router.get("/trial-request/options")
async def trial_options():
    return APIResponse.success(data={
        "company_sizes": COMPANY_SIZES, "industries": INDUSTRIES, "hires_per_year": HIRES_PER_YEAR,
        "trial_days": trial_service.TRIAL_DAYS,
    })


@public_router.post("/trial-request/send-code")
async def send_trial_code(body: TrialSendCode, request: Request, db: DB):
    """Email a verification code to the applicant's work address."""
    await trial_service.send_code(db, body.email, _client_ip(request))
    return APIResponse.success(message=f"We sent a 6-digit code to {body.email}.")


@public_router.post("/trial-request/verify-code")
async def verify_trial_code(body: TrialVerifyCode, db: DB):
    token = await trial_service.verify_code(db, body.email, body.code)
    return APIResponse.success(message="Email verified.", data={"verification_token": token})


@public_router.post("/trial-request")
async def request_trial(body: TrialRequestCreate, request: Request, db: DB):
    if body.homepage or (body.elapsed_ms is not None and body.elapsed_ms < lead_checks.MIN_FILL_MS):
        # Honeypot filled in, or sent faster than anyone can type: a bot.
        # Look successful so it doesn't retry.
        logger.info("Trial form bot check triggered; request dropped.")
        return APIResponse.success(message=TRIAL_THANKS)

    ip = _client_ip(request)
    if lead_checks.rate_limited(ip):
        raise HTTPException(
            status_code=429,
            detail="You've sent several requests already. Please wait a while, or email info@hybent.com.",
        )

    req = await trial_service.create_request(db, body, ip, request.headers.get("user-agent"))
    logger.info(f"Trial request {req.id} from {req.company_domain}.")

    review_url = f"{settings.frontend_url.rstrip('/')}/hiring/super-admin/trials?id={req.id}"
    try:
        await asyncio.to_thread(
            email_service.send_trial_request_alert_email, trial_service.request_rows(req), req.company_name, review_url,
        )
    except Exception:
        # The request is saved and shows in Super Admin either way.
        logger.exception(f"Alert email for trial request {req.id} failed.")
    return APIResponse.success(message=TRIAL_THANKS)


@public_router.get("/trial-setup/{token}")
async def get_trial_setup(token: str, db: DB):
    """What the setup page fills in from the request."""
    req = await trial_service.setup_request(db, token)
    org = await db.get(Organization, req.organization_id)
    return APIResponse.success(data={
        "plan": trial_service.PLAN_LABELS.get(req.plan_interest, "Pro"),
        "email": req.contact_email,
        "full_name": req.contact_name,
        "company_name": org.name if org else req.company_name,
        "website": req.company_website,
        "industry": req.industry,
        "size": req.company_size,
        "logo_url": org.logo_url if org else None,
        "trial_end": req.trial_end,
        "industries": INDUSTRIES,
        "company_sizes": COMPANY_SIZES,
    })


@public_router.post("/trial-setup/{token}/logo")
async def upload_trial_setup_logo(token: str, db: DB, file: UploadFile = File(...)):
    """The organization's logo, stored with the other trial files."""
    from app.services import supabase_storage_service
    from app.services.storage_service import ALLOWED_IMAGE_TYPES, save_logo

    req = await trial_service.setup_request(db, token)
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG or WEBP image.")
    if settings.supabase_url and settings.supabase_service_role_key:
        content = await file.read()
        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="The logo must be under 2 MB.")
        try:
            url = await supabase_storage_service.upload_trial_logo(
                content, file.content_type, str(req.organization_id), ALLOWED_IMAGE_TYPES[file.content_type],
            )
        except Exception:
            logger.exception("Trial logo upload to Supabase failed.")
            raise HTTPException(status_code=502, detail="We couldn't upload the logo. Please try again.")
    else:
        url = await save_logo(file, str(req.organization_id))
    return APIResponse.success(data={"logo_url": url})


@public_router.post("/trial-setup/{token}")
async def complete_trial_setup(token: str, body: TrialSetupComplete, request: Request, db: DB):
    """Finish the organization setup and sign the admin in."""
    from app.services.auth_service import _issue_session

    req = await trial_service.setup_request(db, token, lock=True)
    admin = await trial_service.complete_setup(db, req, body)
    await db.flush()
    session = await _issue_session(admin, db, "password", request)
    await db.commit()
    logger.info(f"Trial organization {req.organization_id} set up by {admin.email}.")
    return APIResponse.success(message="Your organization is ready.", data=session)


# ── Super admin ──────────────────────────────────────────────────────────────

def _request_out(req: TrialRequest, org_active: bool | None = None) -> dict:
    return {
        "id": str(req.id),
        "company_name": req.company_name,
        "company_website": req.company_website,
        "company_domain": req.company_domain,
        "company_linkedin_url": req.company_linkedin_url,
        "company_size": req.company_size,
        "industry": req.industry,
        "country": req.country,
        "hires_per_year": req.hires_per_year,
        "contact_name": req.contact_name,
        "contact_title": req.contact_title,
        "contact_email": req.contact_email,
        "contact_phone": req.contact_phone,
        "contact_linkedin_url": req.contact_linkedin_url,
        "hiring_needs": req.hiring_needs,
        "plan_interest": req.plan_interest,
        "email_verified_at": req.email_verified_at,
        "setup_completed_at": req.setup_completed_at,
        "ip_address": req.ip_address,
        "risk_flags": req.risk_flags or [],
        "status": req.status,
        "reviewed_at": req.reviewed_at,
        "rejection_reason": req.rejection_reason,
        "admin_notes": req.admin_notes,
        "organization_id": str(req.organization_id) if req.organization_id else None,
        "trial_start": req.trial_start,
        "trial_end": req.trial_end,
        "data_purge_at": req.data_purge_at,
        "reminder_1d_sent_at": req.reminder_1d_sent_at,
        "reminder_1h_sent_at": req.reminder_1h_sent_at,
        "converted_at": req.converted_at,
        "purged_at": req.purged_at,
        "created_at": req.created_at,
    }


@admin_router.get("")
async def list_trial_requests(
    db: DB,
    current_user: SuperAdminUser,
    status: str | None = Query(None),
    search: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = select(TrialRequest)
    if status:
        if status not in TRIAL_STATUSES:
            raise HTTPException(status_code=400, detail="Unknown status.")
        query = query.where(TrialRequest.status == status)
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(or_(
            func.lower(TrialRequest.company_name).like(term),
            TrialRequest.company_domain.like(term),
            TrialRequest.contact_email.like(term),
            func.lower(TrialRequest.contact_name).like(term),
        ))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = (await db.execute(
        query.order_by(TrialRequest.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()
    counts = dict((await db.execute(
        select(TrialRequest.status, func.count()).group_by(TrialRequest.status)
    )).all())
    return APIResponse.success(data={
        "items": [_request_out(r) for r in rows],
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "counts": {s: counts.get(s, 0) for s in TRIAL_STATUSES},
    })


@admin_router.get("/{request_id}")
async def get_trial_request(request_id: uuid.UUID, db: DB, current_user: SuperAdminUser):
    req = await db.get(TrialRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Trial request not found.")
    data = _request_out(req)
    data["messages"] = [_message_out(m) for m in (await db.execute(
        select(TrialMessage).where(TrialMessage.request_id == req.id).order_by(TrialMessage.created_at.desc())
    )).scalars().all()]
    data["usage"] = None
    if req.organization_id:
        from app.models.candidate import Candidate
        from app.models.job import Job
        org_id = req.organization_id
        data["usage"] = {
            "users": await db.scalar(select(func.count(User.id)).where(User.organization_id == org_id)),
            "jobs": await db.scalar(select(func.count(Job.id)).where(Job.organization_id == org_id)),
            "candidates": await db.scalar(select(func.count(Candidate.id)).where(Candidate.organization_id == org_id)),
        }
    return APIResponse.success(data=data)


def _message_out(m: TrialMessage) -> dict:
    return {
        "id": str(m.id), "kind": m.kind, "to_email": m.to_email, "subject": m.subject, "body": m.body,
        "ai_generated": m.ai_generated, "delivered": m.delivered, "sent_by_email": m.sent_by_email,
        "created_at": m.created_at,
    }


@admin_router.post("/{request_id}/draft")
async def draft_trial_reply(request_id: uuid.UUID, body: TrialReplyDraft, db: DB, current_user: SuperAdminUser):
    """An email for the team to review and edit; regenerate by calling again."""
    req = await db.get(TrialRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Trial request not found.")
    result = await trial_replies.draft(req, body.kind, body.instructions)
    return APIResponse.success(data=result)


@admin_router.post("/{request_id}/send")
async def send_trial_reply(
    request_id: uuid.UUID, body: TrialReplySend, db: DB, current_user: SuperAdminUser, request: Request,
):
    """Send the team's email from info@hybent.com. "approve" starts the trial
    and adds the organization setup button; "reject" closes the request."""
    req = await trial_service.lock_request(db, request_id)
    cta_url = None
    if body.kind == "approve":
        token = await trial_service.approve(db, req, current_user)
        cta_url = f"{settings.frontend_url.rstrip('/')}/setup?token={token}"
        action = f"Approved free trial for {req.company_name}"
    elif body.kind == "reject":
        trial_service.reject(req, current_user, (body.reason or "").strip() or "Rejected by email")
        action = f"Rejected free trial for {req.company_name}"
    else:
        if req.status != "pending":
            raise HTTPException(status_code=409, detail=f"This request is already {req.status}.")
        action = f"Asked {req.company_name} for more information"

    text = body.body.strip()
    if body.kind == "approve":
        text += f"\n\nYour trial ends on {req.trial_end:%d %B %Y at %H:%M} UTC."
    message = TrialMessage(
        request_id=req.id, kind=body.kind, to_email=req.contact_email, subject=body.subject.strip(), body=text,
        ai_generated=body.ai_generated, sent_by_id=current_user.id, sent_by_email=current_user.email,
    )
    db.add(message)
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email, action=action, module="Trials", request=request,
        metadata={"trial_request_id": str(req.id), "kind": body.kind, "subject": message.subject,
                  "organization_id": str(req.organization_id) if req.organization_id else None},
    )
    await db.commit()

    html_body = email_service.render_trial_reply(text, cta_url, trial_replies.CTA_LABEL if cta_url else None)
    sent = False
    try:
        sent = await asyncio.to_thread(email_service.send_email, req.contact_email, message.subject, html_body)
    except Exception:
        logger.exception(f"Reply to trial request {req.id} failed.")
    message.delivered = bool(sent)
    await db.commit()
    note = {"approve": "Trial approved", "reject": "Request rejected", "info": "Email sent"}[body.kind]
    return APIResponse.success(
        message=f"{note}. " + ("The email was sent." if sent else "But the email couldn't be sent; try sending it again."),
        data={**_request_out(req), "email_sent": bool(sent), "message": _message_out(message)},
    )


@admin_router.post("/{request_id}/extend")
async def extend_trial(
    request_id: uuid.UUID, body: TrialExtend, db: DB, current_user: SuperAdminUser, request: Request,
):
    req = await trial_service.lock_request(db, request_id)
    await trial_service.extend(db, req, body.days)
    await log_super_admin_action(
        db=db, user_id=current_user.id, user_email=current_user.email,
        action=f"Extended free trial for {req.company_name} by {body.days} day(s)", module="Trials", request=request,
        metadata={"trial_request_id": str(req.id), "status": req.status,
                  "trial_end": req.trial_end.isoformat() if req.trial_end else None,
                  "data_purge_at": req.data_purge_at.isoformat() if req.data_purge_at else None},
    )
    await db.commit()
    label = "Trial" if req.status == "active" else "Data retention"
    return APIResponse.success(message=f"{label} extended by {body.days} day(s).", data=_request_out(req))


@admin_router.put("/{request_id}/notes")
async def update_trial_notes(request_id: uuid.UUID, body: TrialNotes, db: DB, current_user: SuperAdminUser):
    req = await trial_service.lock_request(db, request_id)
    req.admin_notes = body.admin_notes.strip() or None
    await db.commit()
    return APIResponse.success(message="Notes saved.", data=_request_out(req))


# ── The organization's own trial ─────────────────────────────────────────────

@router.get("/status")
async def trial_status(db: DB, current_user: CurrentUser):
    return APIResponse.success(data=await trial_service.status_for_org(db, current_user.organization_id))


# Exports per organization per hour. In-process, like lead_checks.rate_limited.
_EXPORT_WINDOW = 3600
_EXPORT_MAX = 10
_exports: dict[str, deque] = defaultdict(deque)


def _export_limited(org_id: str) -> bool:
    now = time.time()
    q = _exports[org_id]
    while q and now - q[0] > _EXPORT_WINDOW:
        q.popleft()
    if len(q) >= _EXPORT_MAX:
        return True
    q.append(now)
    return False


@router.get("/export")
async def export_data(
    db: DB, current_user: AdminUser, request: Request,
    format: str = Query("xlsx", pattern="^(xlsx|csv|pdf)$"),
):
    """The admin's own organization's jobs, candidates, pipeline, interviews,
    scorecards and offers. Admins only; works after the trial has ended."""
    org_id = current_user.organization_id
    if _export_limited(str(org_id)):
        raise HTTPException(status_code=429, detail="Too many exports in the last hour. Please try again later.")
    body, media_type, filename = await trial_export.build(db, org_id, format)
    await log_activity(
        db, org_id, current_user.id, "data.exported", "organization", str(org_id),
        {"format": format, "bytes": len(body)},
        request.client.host if request.client else None, request.headers.get("user-agent"),
    )
    await db.commit()
    return Response(
        content=body, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
