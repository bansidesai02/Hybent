"""Product demo booking (services/demo_service.py).

- /api/public/demo/slots: open 30-minute slots for the next three weeks.
- /api/public/demo/book: book one (work or personal email; no throwaway inboxes).
- /api/public/demo/manage/{token}: the visitor's link to view, move or cancel it.
- /v1/super-admin/demos: the Hybent team's list, with status and notes.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, or_, select

from app.dependencies import DB, SuperAdminUser
from app.models.demo_booking import DEMO_STATUSES, DemoBooking
from app.schemas.response import APIResponse
from app.services import demo_service, lead_checks

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public/demo", tags=["Public"])
admin_router = APIRouter(prefix="/v1/super-admin/demos", tags=["super-admin"])

TAKEN = "Someone just booked that time. Please pick another slot."
MIN_FILL_MS = 2500


def _client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )


class DemoBook(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    company: str = Field(..., min_length=2, max_length=200)
    team_size: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=40)
    notes: str | None = Field(None, max_length=1000)
    start_at: datetime
    timezone: str = Field("UTC", max_length=64)
    website: str | None = None        # honeypot: people never fill it
    elapsed_ms: int = 0

    @field_validator("name", "company", "notes", "team_size", "phone")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class DemoMove(BaseModel):
    start_at: datetime


class DemoSendLink(BaseModel):
    meet_link: str = Field(..., max_length=500)

    @field_validator("meet_link")
    @classmethod
    def _https(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("https://"):
            raise ValueError("Paste the full meeting link, starting with https://")
        return v


class DemoAdminUpdate(BaseModel):
    status: str | None = None
    admin_notes: str | None = Field(None, max_length=2000)


async def _by_token(db, token: str) -> DemoBooking:
    b = (await db.execute(select(DemoBooking).where(DemoBooking.manage_token == token))).scalar_one_or_none()
    if not b:
        raise HTTPException(404, "This link is not valid. Check the latest email from us.")
    return b


# ── Public ───────────────────────────────────────────────────────────────────

@public_router.get("/slots")
async def demo_slots(db: DB, exclude: str | None = Query(None, description="manage token of a booking being moved")):
    exclude_id = None
    if exclude:
        exclude_id = (await _by_token(db, exclude)).id
    slots = await demo_service.available_slots(db, exclude_id=exclude_id)
    return APIResponse.success(data={
        "slots": [s.isoformat() for s in slots],
        "duration_minutes": demo_service.DURATION,
        "host_timezone": demo_service.HOST_TZ.key,
    })


@public_router.post("/book")
async def demo_book(body: DemoBook, request: Request, db: DB):
    ip = _client_ip(request)
    if body.website or body.elapsed_ms < MIN_FILL_MS:
        # A bot: answer like a success, book nothing.
        return APIResponse.success(message="Booked.")
    if lead_checks.rate_limited(ip):
        raise HTTPException(429, "Too many attempts. Please try again in a few minutes.")
    domain = lead_checks.email_domain(str(body.email))
    if domain in lead_checks.DISPOSABLE_DOMAINS:
        raise HTTPException(422, "Please use a real email address, not a temporary inbox.")
    if not await lead_checks.domain_accepts_mail(domain):
        raise HTTPException(422, "That email domain can't receive mail. Check the address.")
    try:
        b = await demo_service.book(
            db, name=body.name, email=str(body.email), company=body.company, team_size=body.team_size,
            phone=body.phone, notes=body.notes, start_at=body.start_at, tz=body.timezone, ip=ip,
        )
    except demo_service.SlotTaken:
        raise HTTPException(409, TAKEN)
    return APIResponse.success(data={**demo_service.public_view(b), "manage_token": b.manage_token},
                               message="Your demo is booked.")


@public_router.get("/manage/{token}")
async def demo_manage(token: str, db: DB):
    return APIResponse.success(data=demo_service.public_view(await _by_token(db, token)))


@public_router.post("/manage/{token}/reschedule")
async def demo_reschedule(token: str, body: DemoMove, db: DB):
    b = await _by_token(db, token)
    if b.status != "booked":
        raise HTTPException(409, "This demo is no longer booked. Book a new time instead.")
    try:
        b = await demo_service.reschedule(db, b, body.start_at)
    except demo_service.SlotTaken:
        raise HTTPException(409, TAKEN)
    return APIResponse.success(data=demo_service.public_view(b), message="Your demo has moved.")


@public_router.post("/manage/{token}/cancel")
async def demo_cancel(token: str, db: DB):
    b = await _by_token(db, token)
    if b.status == "booked":
        b = await demo_service.cancel(db, b)
    return APIResponse.success(data=demo_service.public_view(b), message="Your demo is cancelled.")


# ── Super admin ──────────────────────────────────────────────────────────────

def _admin_view(b: DemoBooking) -> dict:
    return {**demo_service.public_view(b), "id": str(b.id), "team_size": b.team_size, "phone": b.phone,
            "notes": b.notes, "admin_notes": b.admin_notes, "created_at": b.created_at.isoformat()}


@admin_router.get("")
async def list_demos(db: DB, _: SuperAdminUser, status: str | None = None, search: str | None = None,
                     when: str = Query("upcoming", pattern="^(upcoming|past|all)$")):
    q = select(DemoBooking)
    now = func.now()
    if when == "upcoming":
        q = q.where(DemoBooking.start_at >= now).order_by(DemoBooking.start_at.asc())
    elif when == "past":
        q = q.where(DemoBooking.start_at < now).order_by(DemoBooking.start_at.desc())
    else:
        q = q.order_by(DemoBooking.start_at.desc())
    if status:
        q = q.where(DemoBooking.status == status)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(or_(DemoBooking.name.ilike(like), DemoBooking.email.ilike(like), DemoBooking.company.ilike(like)))
    rows = (await db.execute(q.limit(500))).scalars().all()
    counts = dict((await db.execute(select(DemoBooking.status, func.count()).group_by(DemoBooking.status))).all())
    return APIResponse.success(data={"items": [_admin_view(b) for b in rows], "counts": counts})


@admin_router.get("/calendar")
async def demo_calendar_status(db: DB, _: SuperAdminUser):
    """Which Google Calendar hosts demos, if any."""
    token, email = await demo_service.host_account(db)
    return APIResponse.success(data={"connected": bool(token), "account": email})


@admin_router.post("/{demo_id}/send-link")
async def send_demo_link(demo_id: str, body: DemoSendLink, db: DB, _: SuperAdminUser):
    """Save a meeting link (Meet, Zoom, Teams…) on the booking and email it to the visitor."""
    b = await db.get(DemoBooking, demo_id)
    if not b:
        raise HTTPException(404, "Demo not found.")
    if b.status != "booked":
        raise HTTPException(409, "This demo is not booked any more.")
    b.meet_link = body.meet_link
    await db.commit()
    await db.refresh(b)
    import asyncio
    from app.services import email_service
    sent = await asyncio.to_thread(email_service.send_demo_link, b)
    if not sent:
        raise HTTPException(502, "The link is saved but the email could not be sent. Try again.")
    return APIResponse.success(data=_admin_view(b), message=f"Link sent to {b.email}.")


@admin_router.patch("/{demo_id}")
async def update_demo(demo_id: str, body: DemoAdminUpdate, db: DB, _: SuperAdminUser):
    b = await db.get(DemoBooking, demo_id)
    if not b:
        raise HTTPException(404, "Demo not found.")
    if body.status:
        if body.status not in DEMO_STATUSES:
            raise HTTPException(422, "Unknown status.")
        if body.status == "cancelled" and b.status == "booked":
            b = await demo_service.cancel(db, b, by_visitor=False)
        else:
            b.status = body.status
    if body.admin_notes is not None:
        b.admin_notes = body.admin_notes
    await db.commit()
    await db.refresh(b)
    return APIResponse.success(data=_admin_view(b))
