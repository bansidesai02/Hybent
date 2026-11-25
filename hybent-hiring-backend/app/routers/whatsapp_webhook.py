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
from app.dependencies import DB, SuperAdminUser
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
            names = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts", [])}
            for message in value.get("messages", []):
                whatsapp_answer.delay(message, names.get(message.get("from")))
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


# ── Super admin: WhatsApp inbox (people who messaged Hybent) ─────────────

from uuid import UUID  # noqa: E402

from sqlalchemy import desc, select  # noqa: E402

from app.models.whatsapp import WhatsAppContact, WhatsAppMessage  # noqa: E402
from app.services import whatsapp_bot  # noqa: E402


def _contact_out(c: WhatsAppContact) -> dict:
    return {
        "id": str(c.id), "phone": c.phone, "name": (c.lead or {}).get("name") or c.profile_name,
        "kind": c.kind, "status": c.status, "lead": c.lead or {}, "bot_paused": c.bot_paused,
        "handoff_requested_at": c.handoff_requested_at, "last_message_at": c.last_message_at,
        "can_reply": whatsapp_bot.within_reply_window(c),
    }


@router.get("/console/contacts")
async def console_contacts(db: DB, current_user: SuperAdminUser, kind: str | None = None):
    q = select(WhatsAppContact).order_by(desc(WhatsAppContact.last_message_at)).limit(200)
    if kind:
        q = q.where(WhatsAppContact.kind == kind)
    rows = (await db.execute(q)).scalars().all()
    return APIResponse.success(message="Contacts.", data=[_contact_out(c) for c in rows])


@router.get("/console/contacts/{contact_id}/messages")
async def console_messages(contact_id: UUID, db: DB, current_user: SuperAdminUser):
    c = await db.get(WhatsAppContact, contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    msgs = (await db.execute(select(WhatsAppMessage).where(WhatsAppMessage.contact_id == contact_id)
                             .order_by(WhatsAppMessage.created_at).limit(500))).scalars().all()
    return APIResponse.success(message="Messages.", data={
        "contact": _contact_out(c),
        "messages": [{"id": str(m.id), "direction": m.direction, "author": m.author, "text": m.text,
                      "created_at": m.created_at} for m in msgs],
    })


class TeamReply(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


@router.post("/console/contacts/{contact_id}/reply")
async def console_reply(contact_id: UUID, body: TeamReply, db: DB, current_user: SuperAdminUser):
    """A person from the team replies; the bot stays paused for this chat."""
    _need_whatsapp()
    c = await db.get(WhatsAppContact, contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    if not whatsapp_bot.within_reply_window(c):
        raise HTTPException(status_code=400, detail="More than 24 hours since their last message: WhatsApp only allows a template now.")
    try:
        wamid = await run_in_threadpool(whatsapp_service.send_text, c.wa_id, body.text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    db.add(WhatsAppMessage(contact_id=c.id, direction="out", author="team", text=body.text, wamid=wamid))
    c.bot_paused = True
    c.last_message_at = whatsapp_bot._now()
    await db.commit()
    return APIResponse.success(message="Sent.", data=_contact_out(c))


class BotState(BaseModel):
    paused: bool


@router.put("/console/contacts/{contact_id}/bot")
async def console_bot(contact_id: UUID, body: BotState, db: DB, current_user: SuperAdminUser):
    """Take a chat over from the bot, or hand it back."""
    c = await db.get(WhatsAppContact, contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    c.bot_paused = body.paused
    if not body.paused:
        c.handoff_requested_at = None
    await db.commit()
    return APIResponse.success(message="Saved.", data=_contact_out(c))
