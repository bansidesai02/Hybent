"""
LinkedIn OAuth 2.0 router — handles connect, callback, status, and posting.
"""
import logging
import base64
import io
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Query, Request, Body
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy import select
import uuid

from app.config import settings
from app.dependencies import CurrentUser, RecruiterUser, DB
from app.models.user import User
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/linkedin", tags=["linkedin"])
logger = logging.getLogger(__name__)

LINKEDIN_SCOPES = "openid profile w_member_social"
LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_API_BASE = "https://api.linkedin.com/v2"
LINKEDIN_MEDIA_URL = "https://api.linkedin.com/v2/assets?action=registerUpload"


# ── Auth ───────────────────────────────────────────────────────────────────────

@router.get("/auth")
async def linkedin_auth(current_user: CurrentUser):
    """Return the LinkedIn OAuth URL for the frontend to open in a popup."""
    if not settings.linkedin_client_id or not settings.linkedin_client_secret:
        raise HTTPException(status_code=400, detail="LinkedIn OAuth is not configured on this server.")

    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "scope": LINKEDIN_SCOPES,
        "state": str(current_user.id),
    }
    auth_url = f"{LINKEDIN_AUTH_URL}?{urlencode(params)}"
    return APIResponse.success(message="LinkedIn auth URL generated.", data={"auth_url": auth_url})


# ── Callback ───────────────────────────────────────────────────────────────────

@router.get("/callback")
async def linkedin_callback(
    request: Request,
    db: DB,
    state: str = Query(...),
    code: str = Query(None),
    error: str = Query(None),
):
    """
    LinkedIn OAuth callback. Exchanges code → access token, stores it on the user,
    then closes the popup with a postMessage to the opener.
    """
    close_popup_html = """
    <html><body><script>
      window.opener && window.opener.postMessage('{status}', '*');
      window.close();
    </script><p>{message}</p></body></html>
    """

    if error:
        logger.error(f"LinkedIn OAuth error: {error}")
        return HTMLResponse(
            close_popup_html.replace("{status}", "linkedin_error")
                             .replace("{message}", f"LinkedIn auth failed: {error}")
        )

    if not code:
        return HTMLResponse(
            close_popup_html.replace("{status}", "linkedin_error")
                             .replace("{message}", "No authorization code received.")
        )

    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                LINKEDIN_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.linkedin_redirect_uri,
                    "client_id": settings.linkedin_client_id,
                    "client_secret": settings.linkedin_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if token_response.status_code != 200:
            logger.error(f"LinkedIn token exchange failed: {token_response.text}")
            return HTMLResponse(
                close_popup_html.replace("{status}", "linkedin_error")
                                 .replace("{message}", "Failed to exchange code for token.")
            )

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if access_token:
            user_id = uuid.UUID(state)
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.linkedin_access_token = access_token
                await db.commit()
                logger.info(f"LinkedIn connected for user {user.email}")

        return HTMLResponse(
            close_popup_html.replace("{status}", "linkedin_connected")
                             .replace("{message}", "LinkedIn connected! You can close this window.")
        )

    except Exception as e:
        logger.error(f"LinkedIn callback failed: {e}")
        return HTMLResponse(
            close_popup_html.replace("{status}", "linkedin_error")
                             .replace("{message}", "An unexpected error occurred.")
        )


# ── Status ─────────────────────────────────────────────────────────────────────

@router.get("/status")
async def linkedin_status(current_user: CurrentUser):
    """Return whether the current user has a LinkedIn access token stored."""
    return APIResponse.success(
        message="LinkedIn status fetched.",
        data={"connected": bool(current_user.linkedin_access_token)}
    )


@router.post("/disconnect")
async def linkedin_disconnect(current_user: CurrentUser, db: DB):
    """Remove the stored LinkedIn access token."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user:
        user.linkedin_access_token = None
        await db.commit()
    return APIResponse.success(message="LinkedIn disconnected.")


# ── Post ───────────────────────────────────────────────────────────────────────

async def _get_linkedin_person_urn(access_token: str) -> str:
    """Fetch the authenticated LinkedIn member's URN (sub from OpenID)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Failed to fetch LinkedIn profile: {resp.text}")
    data = resp.json()
    sub = data.get("sub")
    if not sub:
        raise HTTPException(status_code=502, detail="Could not retrieve LinkedIn user ID.")
    return f"urn:li:person:{sub}"


async def _upload_image_to_linkedin(access_token: str, person_urn: str, image_base64: str) -> str:
    """
    Upload a base64 image to LinkedIn and return the asset URN.
    Steps: 1) Register upload  2) PUT binary  3) Return asset URN
    """
    # Strip data URL prefix if present
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_base64)

    register_payload = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": person_urn,
            "serviceRelationships": [
                {
                    "relationshipType": "OWNER",
                    "identifier": "urn:li:userGeneratedContent"
                }
            ]
        }
    }

    async with httpx.AsyncClient() as client:
        reg_resp = await client.post(
            LINKEDIN_MEDIA_URL,
            json=register_payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )

    if reg_resp.status_code != 200:
        logger.error(f"LinkedIn register upload failed: {reg_resp.text}")
        raise HTTPException(status_code=502, detail=f"LinkedIn image registration failed: {reg_resp.text}")

    reg_data = reg_resp.json()
    upload_url = reg_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
    asset_urn = reg_data["value"]["asset"]

    # Upload the image binary
    async with httpx.AsyncClient() as client:
        upload_resp = await client.put(
            upload_url,
            content=image_bytes,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "image/png",
            },
        )

    if upload_resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"LinkedIn image upload failed: {upload_resp.text}")

    return asset_urn


@router.post("/post")
async def create_linkedin_post(
    current_user: RecruiterUser,
    db: DB,
    post_text: str = Body(...),
    image_base64: str = Body(None),
):
    """
    Create a LinkedIn post for the authenticated user.
    Optionally uploads an image and attaches it to the post.
    """
    # Re-fetch user to get fresh linkedin_access_token
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()

    if not user or not user.linkedin_access_token:
        raise HTTPException(
            status_code=401,
            detail="LinkedIn account not connected. Please authorize via /v1/linkedin/auth."
        )

    access_token = user.linkedin_access_token

    try:
        # Get the person URN
        person_urn = await _get_linkedin_person_urn(access_token)

        # Build the share payload
        share_content: dict = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": post_text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        # If image provided, upload it and attach
        if image_base64:
            try:
                asset_urn = await _upload_image_to_linkedin(access_token, person_urn, image_base64)
                share_content["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
                share_content["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                    {
                        "status": "READY",
                        "description": {"text": "Job Opening"},
                        "media": asset_urn,
                        "title": {"text": "We're Hiring!"},
                    }
                ]
            except Exception as img_err:
                logger.warning(f"Image upload failed, posting without image: {img_err}")
                # Fall back to text-only post

        async with httpx.AsyncClient() as client:
            post_resp = await client.post(
                f"{LINKEDIN_API_BASE}/ugcPosts",
                json=share_content,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
            )

        if post_resp.status_code not in (200, 201):
            logger.error(f"LinkedIn post failed: {post_resp.text}")
            # If LinkedIn returns 401, the LinkedIn OAuth token has expired — NOT the user's session.
            # Use 403 here so the frontend axios interceptor does NOT treat this as a session expiry
            # and accidentally log the user out.
            if post_resp.status_code == 401:
                user.linkedin_access_token = None
                await db.commit()
                raise HTTPException(status_code=403, detail="LinkedIn token expired. Please reconnect your LinkedIn account.")
            raise HTTPException(status_code=502, detail=f"LinkedIn post failed: {post_resp.text}")

        post_id = post_resp.headers.get("x-restli-id", "")
        post_url = f"https://www.linkedin.com/feed/update/{post_id}" if post_id else "https://www.linkedin.com/feed/"

        return APIResponse.success(
            message="Posted to LinkedIn successfully!",
            data={"post_url": post_url, "post_id": post_id}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LinkedIn post error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to post to LinkedIn: {str(e)}")
