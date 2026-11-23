"""Meta's webhook for Hybent's WhatsApp number: incoming messages go to the
Hybent AI bot (whatsapp_bot). Public, but every POST must carry Meta's
signature (X-Hub-Signature-256, HMAC of the body with the app secret)."""

import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.dependencies import SuperAdminUser
from app.schemas.response import APIResponse
from app.services import whatsapp_service
from app.services.sms_service import msisdn

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


# ── Super admin: WhatsApp test console ────────────────────────────────────
# Sends a message and creates a template through Hybent's own app, so the
# Meta App Review videos can show both permissions in use.

class TestMessage(BaseModel):
    to: str = Field(..., min_length=10, max_length=20)
    text: str = Field(..., min_length=1, max_length=1000)


class TestTemplate(BaseModel):
    name: str = Field(..., pattern=r"^[a-z0-9_]{3,60}$")
    body: str = Field(..., min_length=5, max_length=900)


def _need_whatsapp():
    if not whatsapp_service.configured():
        raise HTTPException(status_code=503, detail="WhatsApp is not set up on this server.")


@router.post("/console/send")
async def console_send(body: TestMessage, current_user: SuperAdminUser):
    """Plain text: delivered if the number messaged Hybent in the last 24 hours."""
    _need_whatsapp()
    to = msisdn(body.to)
    if not to:
        raise HTTPException(status_code=400, detail="Enter a valid Indian mobile number.")
    try:
        msg_id = await run_in_threadpool(whatsapp_service.send_text, to, body.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return APIResponse.success(message="Message sent.", data={"to": f"+{to}", "message_id": msg_id})


@router.post("/console/template")
async def console_template(body: TestTemplate, current_user: SuperAdminUser):
    """Create a UTILITY message template on Hybent's WhatsApp account."""
    _need_whatsapp()
    try:
        data = await run_in_threadpool(whatsapp_service.create_template, body.name, body.body)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return APIResponse.success(message="Template submitted to Meta.", data=data)


@router.get("/console/templates")
async def console_templates(current_user: SuperAdminUser):
    _need_whatsapp()
    try:
        status = await run_in_threadpool(whatsapp_service.template_status, False)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return APIResponse.success(message="Templates.", data=[{"name": k, "status": v} for k, v in sorted(status.items())])
