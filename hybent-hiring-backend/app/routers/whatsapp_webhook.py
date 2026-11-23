"""Meta's webhook for Hybent's WhatsApp number: incoming messages go to the
Hybent AI bot (whatsapp_bot). Public, but every POST must carry Meta's
signature (X-Hub-Signature-256, HMAC of the body with the app secret)."""

import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/whatsapp", tags=["whatsapp"])


@router.get("/webhook")
async def verify(request: Request):
    """Meta's one-time check when the webhook URL is saved in the dashboard."""
    q = request.query_params
    token = settings.whatsapp_verify_token
    if q.get("hub.mode") == "subscribe" and token and hmac.compare_digest(q.get("hub.verify_token", ""), token):
        return PlainTextResponse(q.get("hub.challenge", ""))
    raise HTTPException(status_code=403, detail="Verification failed")


def _signed(body: bytes, header: str | None) -> bool:
    secret = settings.whatsapp_app_secret
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(header[7:], expected)


@router.post("/webhook")
async def receive(request: Request):
    body = await request.body()
    if not _signed(body, request.headers.get("x-hub-signature-256")):
        raise HTTPException(status_code=403, detail="Bad signature")
    if not settings.whatsapp_bot_enabled:
        return {"ok": True}
    from app.tasks.whatsapp import whatsapp_answer

    try:
        data = json.loads(body)
    except ValueError:
        return {"ok": True}
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value") or {}
            # Only our own number; delivery/read statuses are ignored for now.
            if (value.get("metadata") or {}).get("phone_number_id") != settings.whatsapp_phone_number_id:
                continue
            for message in value.get("messages", []):
                whatsapp_answer.delay(message)
    return {"ok": True}
