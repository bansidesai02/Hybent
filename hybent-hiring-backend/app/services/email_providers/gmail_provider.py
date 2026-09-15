"""
Gmail provider: OAuth connect (mirrors app.routers.calendar's manual-httpx flow,
reusing the same Google OAuth client, scoped to gmail.send) + send via Gmail API.
"""
import base64
import logging
import re
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
    "https://www.googleapis.com/auth/gmail.readonly",
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


def _get_access_token(account: EmailAccount) -> str:
    if not account.refresh_token_encrypted:
        raise ValueError("Gmail account has no refresh token — reconnect required")
    return _refresh_access_token_sync(crypto.decrypt(account.refresh_token_encrypted))


def _header(headers: list[dict], name: str) -> str | None:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value")
    return None


def _parse_from_header(value: str | None) -> tuple[str | None, str | None]:
    """'Jane Doe <jane@acme.com>' -> ('Jane Doe', 'jane@acme.com'); a bare
    address returns (None, address)."""
    if not value:
        return None, None
    match = re.match(r'^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$', value)
    if match:
        name = match.group(1).strip() or None
        return name, match.group(2).strip()
    return None, value.strip()


def list_recent_messages(account: EmailAccount, max_results: int = 30) -> list[dict]:
    """Inbox message metadata (id, threadId, from, subject, snippet, received_at) —
    no bodies, kept cheap for periodic syncing."""
    access_token = _get_access_token(account)
    headers = {"Authorization": f"Bearer {access_token}"}

    list_response = httpx.get(
        f"https://gmail.googleapis.com/gmail/v1/users/{account.email_address}/messages",
        headers=headers,
        params={"maxResults": max_results, "labelIds": "INBOX"},
        timeout=10,
    )
    if list_response.status_code >= 400:
        raise ValueError(f"Gmail API list failed: {list_response.text}")

    message_ids = [m["id"] for m in list_response.json().get("messages", [])]
    results = []
    for message_id in message_ids:
        detail_response = httpx.get(
            f"https://gmail.googleapis.com/gmail/v1/users/{account.email_address}/messages/{message_id}",
            headers=headers,
            params={"format": "metadata", "metadataHeaders": ["From", "Subject", "To"]},
            timeout=10,
        )
        if detail_response.status_code >= 400:
            continue  # skip a single bad message rather than failing the whole sync
        detail = detail_response.json()
        msg_headers = detail.get("payload", {}).get("headers", [])
        from_name, from_address = _parse_from_header(_header(msg_headers, "From"))
        internal_date_ms = int(detail.get("internalDate", "0"))
        results.append({
            "provider_message_id": detail["id"],
            "thread_id": detail.get("threadId"),
            "from_name": from_name,
            "from_address": from_address,
            "to_address": _header(msg_headers, "To"),
            "subject": _header(msg_headers, "Subject"),
            "snippet": detail.get("snippet"),
            "received_at_ms": internal_date_ms,
        })
    return results


def _extract_body(payload: dict) -> tuple[str | None, str | None]:
    """Walk a (possibly nested multipart) Gmail message payload for the first
    text/plain and text/html parts, base64url-decoded."""
    text_body, html_body = None, None

    def walk(part: dict):
        nonlocal text_body, html_body
        mime_type = part.get("mimeType", "")
        body_data = part.get("body", {}).get("data")
        if body_data:
            decoded = base64.urlsafe_b64decode(body_data + "=" * (-len(body_data) % 4)).decode("utf-8", errors="replace")
            if mime_type == "text/plain" and text_body is None:
                text_body = decoded
            elif mime_type == "text/html" and html_body is None:
                html_body = decoded
        for sub_part in part.get("parts", []):
            walk(sub_part)

    walk(payload)
    return text_body, html_body


def _extract_attachment_parts(payload: dict) -> list[dict]:
    """Walk a (possibly nested multipart) Gmail message payload for parts that
    carry a filename (i.e. attachments, as opposed to the text/html body
    parts handled by _extract_body). A part's bytes are either inline
    (body.data, small attachments) or must be fetched separately via
    body.attachmentId (large attachments)."""
    attachments: list[dict] = []

    def walk(part: dict):
        filename = part.get("filename")
        if filename:
            body = part.get("body", {})
            attachments.append({
                "filename": filename,
                "mime_type": part.get("mimeType", "application/octet-stream"),
                "size": body.get("size", 0),
                "attachment_id": body.get("attachmentId"),
                "inline_data": body.get("data"),
            })
        for sub_part in part.get("parts", []):
            walk(sub_part)

    walk(payload)
    return attachments


def get_attachment_content(account: EmailAccount, provider_message_id: str, attachment: dict) -> bytes:
    """Resolve an attachment dict from _extract_attachment_parts to its raw
    bytes — inline data is decoded directly, otherwise it's fetched via the
    attachments endpoint (large attachments Gmail didn't inline)."""
    inline_data = attachment.get("inline_data")
    if inline_data:
        return base64.urlsafe_b64decode(inline_data + "=" * (-len(inline_data) % 4))
    attachment_id = attachment.get("attachment_id")
    if not attachment_id:
        raise ValueError("Attachment has neither inline data nor an attachment_id")
    return get_attachment_bytes(account, provider_message_id, attachment_id)


def get_attachment_bytes(account: EmailAccount, provider_message_id: str, attachment_id: str) -> bytes:
    """Fetch one attachment's raw bytes for a message whose data wasn't
    inlined in the full-message payload (large attachments)."""
    access_token = _get_access_token(account)
    response = httpx.get(
        f"https://gmail.googleapis.com/gmail/v1/users/{account.email_address}"
        f"/messages/{provider_message_id}/attachments/{attachment_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    if response.status_code >= 400:
        raise ValueError(f"Gmail API get attachment failed: {response.text}")
    data = response.json().get("data", "")
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def get_message_full(account: EmailAccount, provider_message_id: str) -> dict:
    """Fetch a single message's full body + attachment metadata live — bodies
    are never stored at rest."""
    access_token = _get_access_token(account)
    response = httpx.get(
        f"https://gmail.googleapis.com/gmail/v1/users/{account.email_address}/messages/{provider_message_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"format": "full"},
        timeout=10,
    )
    if response.status_code >= 400:
        raise ValueError(f"Gmail API get message failed: {response.text}")
    detail = response.json()
    payload = detail.get("payload", {})
    text_body, html_body = _extract_body(payload)
    msg_headers = payload.get("headers", [])
    from_name, from_address = _parse_from_header(_header(msg_headers, "From"))
    return {
        "body_text": text_body,
        "body_html": html_body,
        "attachments": _extract_attachment_parts(payload),
        "from_name": from_name,
        "from_address": from_address,
        "subject": _header(msg_headers, "Subject"),
    }
