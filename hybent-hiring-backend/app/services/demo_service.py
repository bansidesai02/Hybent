"""Product demos booked from hybent.com/book-demo.

Hours: Monday–Friday, 10:00–19:00 India time. Each demo is 30 minutes, with
15 minutes free after it, so two bookings must start at least 45 minutes
apart. A slot needs 3 hours' notice and can be up to 21 days ahead.

When `demo_google_refresh_token` is set, the host's own calendar busy times
are hidden from visitors, and each booking becomes an event on that calendar
with a Google Meet link and invites to both sides.
"""
import asyncio
import logging
import secrets
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.demo_booking import DemoBooking
from app.services import calendar_service, email_service

logger = logging.getLogger(__name__)

HOST_TZ = ZoneInfo("Asia/Kolkata")
WORK_DAYS = {0, 1, 2, 3, 4}          # Monday–Friday
DAY_START = time(10, 0)
DAY_END = time(19, 0)                # the last demo ends by 19:00
DURATION = 30                        # minutes
BUFFER = 15                          # free minutes after each demo
STEP = 30                            # a slot starts every half hour
MIN_NOTICE = timedelta(hours=3)
MAX_AHEAD_DAYS = 21


async def host_account(db: AsyncSession) -> tuple[str | None, str | None]:
    """(refresh token, email) of the calendar that hosts demos.

    The env token wins; otherwise a super admin who connected Google Calendar
    in the app, preferring the one whose email is demo_host_email.
    """
    if settings.demo_google_refresh_token:
        return settings.demo_google_refresh_token, settings.demo_host_email
    from app.models.user import User
    rows = (await db.execute(select(User.google_refresh_token, User.email).where(
        User.role == "super_admin", User.google_refresh_token.is_not(None), User.google_refresh_token != "",
    ))).all()
    if not rows:
        return None, None
    rows.sort(key=lambda r: (r.email or "").lower() != settings.demo_host_email.lower())
    return rows[0].google_refresh_token, rows[0].email


class SlotTaken(Exception):
    """The chosen time is no longer free."""


def safe_tz(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _candidate_slots(start_day: date, days: int) -> list[datetime]:
    """Every half-hour start inside working hours, as UTC times."""
    out: list[datetime] = []
    for d in range(days):
        day = start_day + timedelta(days=d)
        if day.weekday() not in WORK_DAYS:
            continue
        t = datetime.combine(day, DAY_START, HOST_TZ)
        last = datetime.combine(day, DAY_END, HOST_TZ) - timedelta(minutes=DURATION)
        while t <= last:
            out.append(t.astimezone(timezone.utc))
            t += timedelta(minutes=STEP)
    return out


def _google_busy(start: datetime, end: datetime, token: str | None = None) -> list[tuple[datetime, datetime]]:
    """Busy times on the host's Google Calendar (empty without a token)."""
    service = calendar_service.get_calendar_service(token)
    if not service:
        return []
    try:
        res = service.freebusy().query(body={
            "timeMin": start.isoformat(), "timeMax": end.isoformat(), "items": [{"id": "primary"}],
        }).execute()
        busy = res.get("calendars", {}).get("primary", {}).get("busy", [])
        return [(datetime.fromisoformat(b["start"].replace("Z", "+00:00")),
                 datetime.fromisoformat(b["end"].replace("Z", "+00:00"))) for b in busy]
    except Exception as e:  # a calendar hiccup must not take the page down
        logger.warning(f"Demo free/busy lookup failed: {e}")
        return []


async def available_slots(db: AsyncSession, now: datetime | None = None,
                          exclude_id=None) -> list[datetime]:
    """Open slots from now to MAX_AHEAD_DAYS ahead, earliest first."""
    now = now or datetime.now(timezone.utc)
    first_day = now.astimezone(HOST_TZ).date()
    candidates = [s for s in _candidate_slots(first_day, MAX_AHEAD_DAYS + 1) if s >= now + MIN_NOTICE]
    if not candidates:
        return []
    window_end = candidates[-1] + timedelta(minutes=DURATION)

    q = select(DemoBooking.start_at, DemoBooking.duration_minutes).where(
        DemoBooking.status == "booked", DemoBooking.start_at < window_end,
        DemoBooking.start_at > now - timedelta(hours=2),
    )
    if exclude_id is not None:
        q = q.where(DemoBooking.id != exclude_id)
    taken = [(s, s + timedelta(minutes=d)) for s, d in (await db.execute(q)).all()]
    token, _ = await host_account(db)
    busy = await asyncio.to_thread(_google_busy, candidates[0], window_end, token)

    gap = timedelta(minutes=BUFFER)
    open_: list[datetime] = []
    for s in candidates:
        e = s + timedelta(minutes=DURATION)
        # Keep the buffer on both sides of every existing demo and busy block.
        if any(s < b_end + gap and e + gap > b_start for b_start, b_end in taken + busy):
            continue
        open_.append(s)
    return open_


def _normalise(start_at: datetime) -> datetime:
    if start_at.tzinfo is None:
        start_at = start_at.replace(tzinfo=timezone.utc)
    return start_at.astimezone(timezone.utc).replace(second=0, microsecond=0)


async def _ensure_open(db: AsyncSession, start_at: datetime, exclude_id=None) -> None:
    if start_at not in await available_slots(db, exclude_id=exclude_id):
        raise SlotTaken()


async def _make_event(db: AsyncSession, b: DemoBooking) -> None:
    """Calendar event with a Meet link and invites (best effort)."""
    token, host_email = await host_account(db)
    result = await calendar_service.create_calendar_event(
        title=f"Hybent Hiring demo · {b.company}",
        description=(f"Product demo of Hybent Hiring for {b.name} ({b.company}).\n"
                     f"Team size: {b.team_size or '-'}\nWhat they want to see: {b.notes or '-'}"),
        start_time=b.start_at,
        duration_minutes=b.duration_minutes,
        attendee_emails=[b.email, host_email or settings.demo_host_email],
        organizer_refresh_token=token,
    )
    b.calendar_event_id = result.get("event_id")
    # Only a link from a real calendar event opens a meeting. Without one
    # (no host token, or Google failed) send none rather than a made-up
    # meet.google.com code: the emails then say the link will follow.
    b.meet_link = result.get("meeting_link") if b.calendar_event_id else None


async def book(db: AsyncSession, *, name: str, email: str, company: str, team_size: str | None,
               phone: str | None, notes: str | None, start_at: datetime, tz: str, ip: str | None) -> DemoBooking:
    start_at = _normalise(start_at)
    await _ensure_open(db, start_at)
    b = DemoBooking(
        name=name, email=email.lower(), company=company, team_size=team_size, phone=phone, notes=notes,
        start_at=start_at, duration_minutes=DURATION, timezone=safe_tz(tz).key, ip=ip,
        manage_token=secrets.token_urlsafe(32),
    )
    db.add(b)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise SlotTaken()
    await _make_event(db, b)
    await db.commit()
    await db.refresh(b)
    await asyncio.to_thread(email_service.send_demo_booked, b)
    await asyncio.to_thread(email_service.send_demo_host_alert, b, "booked")
    return b


async def reschedule(db: AsyncSession, b: DemoBooking, start_at: datetime) -> DemoBooking:
    start_at = _normalise(start_at)
    await _ensure_open(db, start_at, exclude_id=b.id)
    old_event = b.calendar_event_id
    b.start_at = start_at
    b.reminder_24h_sent_at = None
    b.reminder_1h_sent_at = None
    b.updated_at = datetime.now(timezone.utc)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise SlotTaken()
    if old_event:
        await calendar_service.cancel_calendar_event(old_event, (await host_account(db))[0])
    await _make_event(db, b)
    await db.commit()
    await db.refresh(b)
    await asyncio.to_thread(email_service.send_demo_booked, b, True)
    await asyncio.to_thread(email_service.send_demo_host_alert, b, "rescheduled")
    return b


async def cancel(db: AsyncSession, b: DemoBooking, by_visitor: bool = True) -> DemoBooking:
    if b.calendar_event_id:
        await calendar_service.cancel_calendar_event(b.calendar_event_id, (await host_account(db))[0])
    b.status = "cancelled"
    b.cancelled_at = b.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(b)
    await asyncio.to_thread(email_service.send_demo_cancelled, b)
    if by_visitor:
        await asyncio.to_thread(email_service.send_demo_host_alert, b, "cancelled")
    return b


async def send_reminders(db: AsyncSession, now: datetime | None = None) -> dict:
    """24-hour and 1-hour reminders, each sent once."""
    now = now or datetime.now(timezone.utc)
    done = {"24h": 0, "1h": 0}
    rows = (await db.execute(select(DemoBooking).where(
        DemoBooking.status == "booked", DemoBooking.start_at > now,
        DemoBooking.start_at <= now + timedelta(hours=24),
    ))).scalars().all()
    for b in rows:
        left = b.start_at - now
        if left <= timedelta(minutes=70) and b.reminder_1h_sent_at is None:
            b.reminder_1h_sent_at = now
            b.reminder_24h_sent_at = b.reminder_24h_sent_at or now
            await db.commit()
            await asyncio.to_thread(email_service.send_demo_reminder, b, "1h")
            done["1h"] += 1
        elif left > timedelta(minutes=70) and b.reminder_24h_sent_at is None:
            # A booking made less than a day ahead already has its confirmation.
            if b.created_at and now - b.created_at < timedelta(hours=3):
                continue
            b.reminder_24h_sent_at = now
            await db.commit()
            await asyncio.to_thread(email_service.send_demo_reminder, b, "24h")
            done["24h"] += 1
    return done


def public_view(b: DemoBooking) -> dict:
    return {
        "name": b.name, "email": b.email, "company": b.company,
        "start_at": b.start_at.isoformat(), "duration_minutes": b.duration_minutes,
        "timezone": b.timezone, "status": b.status, "meet_link": b.meet_link,
    }
