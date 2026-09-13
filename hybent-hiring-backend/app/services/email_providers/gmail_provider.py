"""
Gmail provider: OAuth connect (mirrors app.routers.calendar's manual-httpx flow,
reusing the same Google OAuth client, scoped to gmail.send) + send via Gmail API.
"""
import base64
import logging
from email.mime.text import MIMEText
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.models.email_account import EmailAccount
from app.services.email_providers.base import EmailProvider
from app.utils import crypto

logger = logging.getLogger(__name__)

SCOPES = " ".join([
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
])


def build_authorize_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.gmail_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange an OAuth code for tokens + the connected Gmail address."""
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.gmail_redirect_uri,
            },
        )
        if token_response.status_code != 200:
            raise ValueError(f"Failed to exchange code for token: {token_response.text}")
        tokens = token_response.json()

        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_response.status_code != 200:
            raise ValueError(f"Failed to fetch Gmail account info: {userinfo_response.text}")
        userinfo = userinfo_response.json()

        return {
            "email_address": userinfo.get("email"),
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_in": tokens.get("expires_in"),
        }


def _refresh_access_token_sync(refresh_token: str) -> str:
    response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=10,
    )
    if response.status_code != 200:
        raise ValueError(f"Failed to refresh Gmail access token: {response.text}")
    return response.json()["access_token"]


class GmailProvider(EmailProvider):
    def send(self, account: EmailAccount, to: str, subject: str, html_body: str) -> None:
        if not account.refresh_token_encrypted:
            raise ValueError("Gmail account has no refresh token — reconnect required")
        refresh_token = crypto.decrypt(account.refresh_token_encrypted)
        access_token = _refresh_access_token_sync(refresh_token)

        mime_message = MIMEText(html_body, "html", "utf-8")
        mime_message["to"] = to
        mime_message["from"] = account.email_address
        mime_message["subject"] = subject
        raw = base64.urlsafe_b64encode(mime_message.as_bytes()).decode("utf-8")

        response = httpx.post(
            f"https://gmail.googleapis.com/gmail/v1/users/{account.email_address}/messages/send",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"raw": raw},
            timeout=10,
        )
        if response.status_code >= 400:
            raise ValueError(f"Gmail API send failed: {response.text}")

    def verify(self, account: EmailAccount) -> None:
        """Refresh the access token only — proves the refresh token (i.e. the
        whole connection) is still valid without sending any message."""
        if not account.refresh_token_encrypted:
            raise ValueError("Gmail account has no refresh token — reconnect required")
        refresh_token = crypto.decrypt(account.refresh_token_encrypted)
        _refresh_access_token_sync(refresh_token)
