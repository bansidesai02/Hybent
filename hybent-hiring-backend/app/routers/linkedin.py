"""
LinkedIn OAuth 2.0 connect router.

Publishing itself does not go through LinkedIn's API (that requires the
`w_member_social` scope, which is gated behind LinkedIn product review and
was the source of repeated production issues here). Instead, the frontend
copies the AI-drafted post to the clipboard and opens LinkedIn's own post
composer for the recruiter to paste into and publish themselves — the
standard workaround most ATS integrations use. This router only exists to
gate that "Post" action behind a "Connect LinkedIn" step, as requested.

Endpoints:
  GET  /v1/linkedin/connect-url   → returns the OAuth authorization URL
  GET  /v1/linkedin/callback      → exchanges code for token, stores it, returns HTML postMessage page
  GET  /v1/linkedin/status        → { connected: bool }
  DELETE /v1/linkedin/disconnect  → clears stored token
"""

import time
import urllib.parse
import logging
from typing import Annotated

import httpx
from jose import jwt, JWTError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.dependencies import DB, require_recruiter
from app.models.user import User
from app.schemas.response import APIResponse
from sqlalchemy import update

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/linkedin", tags=["linkedin"])

# ── LinkedIn API constants ─────────────────────────────────────────────────────
_AUTH_URL   = "https://www.linkedin.com/oauth/v2/authorization"
_TOKEN_URL  = "https://www.linkedin.com/oauth/v2/accessToken"
_API_BASE   = "https://api.linkedin.com/v2"
# openid + profile → userinfo, just enough to confirm a connected identity.
_SCOPES     = "openid profile"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_state(user_id: str) -> str:
    """
    Encode user_id into a signed JWT to carry through the OAuth redirect.
    LinkedIn state param is opaque — we use it to identify which user to
    associate the returned token with.
    """
    payload = {"user_id": user_id, "exp": int(time.time()) + 600}  # 10 min
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _decode_state(state: str) -> str:
    """Decode state → user_id, raises ValueError on failure."""
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
        return payload["user_id"]
    except JWTError:
        # python-jose raises JWTError for both expiry and invalid tokens
        raise ValueError("state_expired_or_invalid")
    except Exception:
        raise ValueError("state_invalid")


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/connect-url")
async def get_connect_url(
    current_user: Annotated[User, Depends(require_recruiter)],
):
    """Return the LinkedIn OAuth authorization URL.  Frontend opens this in a popup."""
    if not settings.linkedin_client_id:
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth is not configured on this server. "
                   "Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in your environment.",
        )

    state  = _make_state(str(current_user.id))
    params = urllib.parse.urlencode(
        {
            "response_type": "code",
            "client_id":     settings.linkedin_client_id,
            "redirect_uri":  settings.linkedin_redirect_uri,
            "scope":         _SCOPES,
            "state":         state,
        }
    )
    auth_url = f"{_AUTH_URL}?{params}"
    return APIResponse.success(message="LinkedIn authorization URL retrieved.", data={"url": auth_url})


@router.get("/callback")
async def linkedin_callback(
    code: str,
    state: str,
    db: DB,
    error: str | None = None,
    error_description: str | None = None,
):
    """
    OAuth callback — exchanges code for access token, stores it in the DB,
    then returns an HTML page that sends postMessage to the opener window
    so the modal can react without a page reload.
    """
    frontend_url = settings.frontend_url or "http://localhost:5173"

    def _html_result(success: bool, msg: str = "") -> HTMLResponse:
        event_type = "LINKEDIN_CONNECTED" if success else "LINKEDIN_ERROR"
        return HTMLResponse(
            f"""<!DOCTYPE html>
<html>
<head><title>LinkedIn Auth</title></head>
<body>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#555">
  {"Connected! You may close this window." if success else "Connection failed. " + msg}
</p>
<script>
  try {{
    const target = window.opener || window.parent;
    if (target) {{
      target.postMessage({{ type: "{event_type}", message: {repr(msg)} }}, "*");
    }}
  }} catch(e) {{}}
  setTimeout(() => window.close(), 1500);
</script>
</body>
</html>""",
            status_code=200,
        )

    # LinkedIn sent an error
    if error:
        logger.warning(f"LinkedIn OAuth error: {error} — {error_description}")
        return _html_result(False, error_description or error)

    # Decode state → user_id
    try:
        user_id = _decode_state(state)
    except ValueError as exc:
        return _html_result(False, str(exc))

    # Exchange authorization code for access token
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.post(
                _TOKEN_URL,
                data={
                    "grant_type":    "authorization_code",
                    "code":          code,
                    "redirect_uri":  settings.linkedin_redirect_uri,
                    "client_id":     settings.linkedin_client_id,
                    "client_secret": settings.linkedin_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_resp.raise_for_status()
            token_data   = token_resp.json()
            access_token = token_data.get("access_token")

        if not access_token:
            return _html_result(False, "No access token returned.")
    except Exception as exc:
        logger.error(f"LinkedIn token exchange failed: {exc}")
        return _html_result(False, "Token exchange failed.")

    # Persist token in DB
    try:
        import uuid
        uid = uuid.UUID(user_id)
        await db.execute(
            update(User)
            .where(User.id == uid)
            .values(linkedin_access_token=access_token)
        )
        await db.commit()
    except Exception as exc:
        logger.error(f"Failed to store LinkedIn token: {exc}")
        return _html_result(False, "Could not save token.")

    return _html_result(True)


@router.get("/status")
async def linkedin_status(
    current_user: Annotated[User, Depends(require_recruiter)],
):
    """Return whether the current user has a LinkedIn access token stored."""
    return APIResponse.success(
        message="LinkedIn connection status retrieved.",
        data={"connected": bool(current_user.linkedin_access_token)}
    )


@router.delete("/disconnect")
async def linkedin_disconnect(
    current_user: Annotated[User, Depends(require_recruiter)],
    db: DB,
):
    """Clear the stored LinkedIn access token for the current user."""
    current_user.linkedin_access_token = None
    await db.commit()
    return APIResponse.success(message="LinkedIn account disconnected.")
