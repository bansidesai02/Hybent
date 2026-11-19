import logging
import uuid
import httpx
from urllib.parse import quote, urlencode
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies import get_db, CurrentUser
from app.models.user import User
from app.schemas.response import APIResponse
from app.utils.security import create_oauth_state, decode_oauth_state

router = APIRouter(prefix="/v1/calendar", tags=["calendar"])
logger = logging.getLogger(__name__)

# Essential scopes for calendar and meet link generation
SCOPES = " ".join(["https://www.googleapis.com/auth/calendar.events"])


# The schedule page for each role, where the callback returns.
INTERVIEWS_PATH = {
    "admin": "/hiring/admin/interviews",
    "recruiter": "/hiring/recruiter/interviews",
    "super_admin": "/hiring/super-admin/demos",
}


def _back(user: User | None, query: str) -> RedirectResponse:
    role = str(getattr(user.role, "value", user.role)) if user else "admin"
    path = INTERVIEWS_PATH.get(role, INTERVIEWS_PATH["admin"])
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}{path}?{query}")


@router.get("/auth")
async def google_calendar_auth(current_user: CurrentUser):
    """Initiates the manual Google OAuth2 flow for Calendar access."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=400, detail="Google Calendar is not configured")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        # Signed and short-lived (as for Gmail): a bare user id let anyone
        # attach their Google calendar to someone else's account.
        "state": create_oauth_state(str(current_user.id), str(current_user.organization_id)),
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    logger.info(f"Generated manual auth URL for user {current_user.email}")
    
    return APIResponse.success(message="Calendar auth URL generated.", data={"auth_url": auth_url})


@router.get("/callback")
async def google_calendar_callback(
    request: Request,
    state: str = Query(...),
    code: str = Query(None),
    error: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Callback for Google OAuth2. Saves the refresh token to the user."""
    user = None
    try:
        claims = decode_oauth_state(state)
        user = await db.get(User, uuid.UUID(claims["sub"]))
        if user is None or str(user.organization_id) != claims.get("org"):
            user = None
    except Exception:
        logger.warning("Rejected Google Calendar callback with an invalid or expired state")

    if error or not code or user is None:
        logger.error(f"Google Calendar OAuth failed: error={error!r} user={'ok' if user else 'invalid state'}")
        reason = "access_denied" if error == "access_denied" else (error or "invalid_state")
        return _back(user, f"error=calendar_auth_failed&reason={quote(reason)}")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.google_redirect_uri,
                },
            )
        if token_response.status_code != 200:
            logger.error(f"Google Calendar token exchange failed: {token_response.text}")
            return _back(user, "error=calendar_auth_failed&reason=token_exchange")

        refresh_token = token_response.json().get("refresh_token")
        if not refresh_token:
            # Used to report success here while saving nothing.
            logger.warning(f"No refresh token returned for {user.email}")
            return _back(user, "error=calendar_auth_failed&reason=no_refresh_token")

        user.google_refresh_token = refresh_token
        await db.commit()
        logger.info(f"Connected Google Calendar for {user.email}")
        return _back(user, "success=calendar_connected")
    except Exception as e:
        logger.error(f"Google Calendar callback failed: {e}")
        return _back(user, "error=calendar_auth_failed&reason=server")


@router.get("/status")
async def calendar_status(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Is the calendar really connected? If the user removed Hybent's access
    in their Google account, the saved token is cleared so the app asks them
    to connect again instead of showing "synced"."""
    import asyncio
    from app.services.calendar_service import token_is_valid

    token = current_user.google_refresh_token
    if token:
        valid = await asyncio.to_thread(token_is_valid, token)
        if valid is False:
            current_user.google_refresh_token = None
            await db.commit()
            logger.info(f"Google Calendar access was removed for {current_user.email}; cleared the token")
    return APIResponse.success(data={"connected": bool(current_user.google_refresh_token)})


@router.delete("")
async def disconnect_calendar(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Disconnect Google Calendar: revoke Hybent's access at Google and forget the token."""
    import asyncio
    from app.services.calendar_service import revoke_token

    token = current_user.google_refresh_token
    current_user.google_refresh_token = None
    await db.commit()
    await asyncio.to_thread(revoke_token, token)
    return APIResponse.success(message="Google Calendar disconnected.", data={"connected": False})
