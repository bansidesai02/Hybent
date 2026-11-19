"""
Google Calendar service for interview scheduling.
Outside production, falls back to a generated fake Meet link if credentials are
not configured. In production there is no fallback: a made-up meet.google.com
URL does not open a real meeting, so candidates would be sent a dead link.
"""
import random
import string
import logging
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_fake_meet_link() -> str:
    """Generate a fake Google Meet link for dev/demo."""
    def rand(n): return "".join(random.choices(string.ascii_lowercase, k=n))
    return f"https://meet.google.com/{rand(3)}-{rand(4)}-{rand(3)}"


def fallback_meet_link() -> str | None:
    """The link to use when Google Calendar did not give us one."""
    return None if settings.is_production else generate_fake_meet_link()


def get_calendar_service(refresh_token: str | None = None):
    """Build the Google Calendar API service."""
    if not refresh_token or not settings.google_client_id or not settings.google_client_secret:
        return None
    
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )
    return build("calendar", "v3", credentials=creds)


def token_is_valid(refresh_token: str | None) -> bool | None:
    """True if Google still accepts this refresh token, False if the user
    removed Hybent's access (or it expired), None if we couldn't tell
    (network error, Google not configured)."""
    if not refresh_token or not settings.google_client_id or not settings.google_client_secret:
        return None
    import httpx
    try:
        r = httpx.post("https://oauth2.googleapis.com/token", data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }, timeout=10)
    except Exception as e:
        logger.warning(f"Couldn't check the Google Calendar token: {e}")
        return None
    if r.status_code == 200:
        return True
    if r.status_code in (400, 401) and "invalid_grant" in r.text:
        return False
    logger.warning(f"Unexpected answer checking the Google Calendar token: {r.status_code} {r.text[:200]}")
    return None


def revoke_token(refresh_token: str | None) -> None:
    """Tell Google to drop Hybent's access (best effort)."""
    if not refresh_token:
        return
    import httpx
    try:
        httpx.post("https://oauth2.googleapis.com/revoke", params={"token": refresh_token}, timeout=10)
    except Exception as e:
        logger.warning(f"Couldn't revoke the Google Calendar token: {e}")


async def create_calendar_event(
    title: str,
    description: str,
    start_time: datetime,
    duration_minutes: int,
    attendee_emails: list[str],
    organizer_refresh_token: str | None = None,
) -> dict:
    """
    Create a Google Calendar event with a Meet link.
    Returns dict with {event_id, meeting_link}.

    If Google Calendar credentials are not configured or missing for the user,
    meeting_link comes from fallback_meet_link() (None in production).
    """
    service = get_calendar_service(organizer_refresh_token)
    
    if not service:
        logger.info("Google Calendar not configured or no refresh token — using fallback Meet link")
        return {
            "event_id": None,
            "meeting_link": fallback_meet_link(),
        }

    try:
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        event = {
            "summary": title,
            "description": description,
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "UTC",
            },
            "attendees": [{"email": email} for email in attendee_emails if email],
            "conferenceData": {
                "createRequest": {
                    "requestId": f"{random.randint(1000, 9999)}-hybent-hiring-{start_time.timestamp()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }

        created_event = service.events().insert(
            calendarId="primary",
            body=event,
            conferenceDataVersion=1,
            sendUpdates="all"
        ).execute()

        meet_link = created_event.get("hangoutLink") or fallback_meet_link()
        
        return {
            "event_id": created_event.get("id"),
            "meeting_link": meet_link,
        }

    except Exception as e:
        logger.error(f"Google Calendar event creation failed: {e}")
        return {
            "event_id": None,
            "meeting_link": fallback_meet_link(),
        }


async def cancel_calendar_event(event_id: str, organizer_refresh_token: str | None = None) -> bool:
    """Cancel a Google Calendar event. Returns True on success."""
    if not event_id:
        return True
        
    service = get_calendar_service(organizer_refresh_token)
    if not service:
        return True
        
    try:
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to cancel calendar event {event_id}: {e}")
        return False
