"""
LinkedIn OAuth 2.0 + UGC Post API router.

Endpoints:
  GET  /v1/linkedin/connect-url   → returns the OAuth authorization URL
  GET  /v1/linkedin/callback      → exchanges code for token, stores it, returns HTML postMessage page
  GET  /v1/linkedin/status        → { connected: bool }
  POST /v1/linkedin/post          → creates a UGC post (text + optional image)
  DELETE /v1/linkedin/disconnect  → clears stored token
"""

import base64
import time
import urllib.parse
import logging
from typing import Annotated

import httpx
from jose import jwt, JWTError
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import HTMLResponse

from app.config import settings
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
# Scopes required:
#   openid + profile  → userinfo (needed to get person URN)
#   w_member_social   → create UGC posts
_SCOPES     = "openid profile w_member_social"


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


async def _get_linkedin_profile(token: str) -> dict:
    """Fetch LinkedIn profile via OpenID userinfo endpoint."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{_API_BASE}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        return r.json()


async def _upload_image(token: str, person_urn: str, image_base64: str) -> str | None:
    """
    Upload an image to LinkedIn's media API.
    Returns the asset URN (e.g. urn:li:digitalmediaAsset:...) or None on failure.
    """
    async with httpx.AsyncClient(timeout=60) as client:
        # 1. Register upload
        reg_resp = await client.post(
            f"{_API_BASE}/assets?action=registerUpload",
            json={
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": person_urn,
                    "serviceRelationships": [
                        {
                            "relationshipType": "OWNER",
                            "identifier": "urn:li:userGeneratedContent",
                        }
                    ],
                }
            },
            headers={
                "Authorization": f"Bearer {token}",
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json",
            },
        )

        if reg_resp.status_code not in (200, 201):
            logger.warning(f"LinkedIn registerUpload failed: {reg_resp.status_code} {reg_resp.text}")
            return None

        reg_data   = reg_resp.json()
        upload_url = (
            reg_data.get("value", {})
            .get("uploadMechanism", {})
            .get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
            .get("uploadUrl")
        )
        asset_urn  = reg_data.get("value", {}).get("asset")

        if not upload_url or not asset_urn:
            logger.warning("LinkedIn registerUpload response missing uploadUrl or asset.")
            return None

        # 2. Strip data-URL prefix and decode
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_base64)

        # 3. PUT binary image
        put_resp = await client.put(
            upload_url,
            content=image_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
            },
        )

        if put_resp.status_code not in (200, 201):
            logger.warning(f"LinkedIn image upload PUT failed: {put_resp.status_code} {put_resp.text}")
            return None

        return asset_urn


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


@router.post("/post")
async def post_to_linkedin(
    current_user: Annotated[User, Depends(require_recruiter)],
    db: DB,
    body: dict = Body(...),
):
    """
    Publish a post to the recruiter's LinkedIn feed.

    Body fields:
      text         (str, required)  — full post text including hashtags
      image_base64 (str, optional)  — base64 PNG/JPG data URL or raw base64
    """
    token = current_user.linkedin_access_token
    if not token:
        raise HTTPException(
            status_code=401,
            detail="LinkedIn not connected. Please connect your LinkedIn account first.",
        )

    text         = (body.get("text") or "").strip()
    image_base64 = body.get("image_base64")

    if not text:
        raise HTTPException(status_code=400, detail="Post text cannot be empty.")

    async with httpx.AsyncClient(timeout=30) as client:
        # ── 1. Get LinkedIn person URN ────────────────────────────────────────
        profile_resp = await client.get(
            f"{_API_BASE}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
        )

        if profile_resp.status_code == 401:
            # Token expired — clear it and ask user to reconnect
            current_user.linkedin_access_token = None
            await db.commit()
            raise HTTPException(
                status_code=401,
                detail="LinkedIn session expired. Please reconnect your LinkedIn account.",
            )

        if not profile_resp.is_success:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch LinkedIn profile: {profile_resp.status_code}",
            )

        profile    = profile_resp.json()
        sub        = profile.get("sub")  # LinkedIn member ID (OpenID)
        if not sub:
            raise HTTPException(status_code=502, detail="LinkedIn profile missing 'sub' field.")

        person_urn = f"urn:li:person:{sub}"

        # ── 2. Upload image (optional) ────────────────────────────────────────
        asset_urn: str | None = None
        if image_base64:
            asset_urn = await _upload_image(token, person_urn, image_base64)
            if not asset_urn:
                logger.warning("Image upload failed; posting text-only as fallback.")

        # ── 3. Build UGC post body ────────────────────────────────────────────
        share_content: dict
        if asset_urn:
            share_content = {
                "shareCommentary":    {"text": text},
                "shareMediaCategory": "IMAGE",
                "media": [
                    {
                        "status":      "READY",
                        "description": {"text": "Job opportunity banner"},
                        "media":       asset_urn,
                        "title":       {"text": "Job Opening"},
                    }
                ],
            }
        else:
            share_content = {
                "shareCommentary":    {"text": text},
                "shareMediaCategory": "NONE",
            }

        post_body = {
            "author":         person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": share_content,
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
            },
        }

        # ── 4. Create the post ────────────────────────────────────────────────
        post_resp = await client.post(
            f"{_API_BASE}/ugcPosts",
            json=post_body,
            headers={
                "Authorization":              f"Bearer {token}",
                "X-Restli-Protocol-Version":  "2.0.0",
                "Content-Type":               "application/json",
            },
        )

    if post_resp.status_code not in (200, 201):
        logger.error(f"LinkedIn UGC post failed: {post_resp.status_code} {post_resp.text}")
        raise HTTPException(
            status_code=502,
            detail=f"LinkedIn API error: {post_resp.status_code}. "
                   "Your post may not have the required permissions (w_member_social scope).",
        )

    # Extract post ID from header or response body
    post_id  = post_resp.headers.get("x-restli-id") or post_resp.json().get("id", "")
    post_url = f"https://www.linkedin.com/feed/update/{post_id}/" if post_id else "https://www.linkedin.com/feed/"

    logger.info(f"LinkedIn post created: {post_id} by user {current_user.id}")

    return APIResponse.success(
        message="Posted to LinkedIn successfully!",
        data={"post_id": post_id, "post_url": post_url},
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
