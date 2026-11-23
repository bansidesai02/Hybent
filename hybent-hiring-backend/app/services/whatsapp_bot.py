"""Hybent AI on WhatsApp: anyone who messages Hybent's WhatsApp number gets
an automatic answer about Hybent, from the same assistant as the website chat
(site_assistant). The conversation is kept in Redis for a day so follow-up
questions make sense. Replies inside the 24-hour window Meta opens when the
person writes to us are free and need no template.
"""

import json
import logging
import re

import redis.asyncio as aioredis

from app.core.config import settings
from app.services import whatsapp_service
from app.services.ai import site_assistant

logger = logging.getLogger(__name__)

HISTORY_TTL = 24 * 3600
HISTORY_TURNS = 10
MAX_IN = 1000              # characters of one incoming message we read
RATE_MAX_PER_HOUR = 30

GREETING = (
    "Hi! 👋 I'm *Hybent AI*. Ask me anything about Hybent Hiring: features, pricing, "
    "the free trial or how it works. For the team, email info@hybent.com."
)
NOT_TEXT = "Sorry, I can only read text messages right now. Please type your question 🙂"
SLOW_DOWN = "You've sent a lot of messages. Please try again in a while, or email info@hybent.com."


def _redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def to_whatsapp(text: str) -> str:
    """Markdown from the assistant -> WhatsApp formatting."""
    text = re.sub(r"\[([^\]]+)\]\((/[^)]*)\)", r"\1: https://hybent.com\2", text)   # site links
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1: \2", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)                                  # bold
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)                               # headings
    text = re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.M)                            # bullets
    return text.strip()[:4000]


def _buttons(to: str, body: str, options: list[str]) -> dict:
    # Reply buttons: max 3, title max 20 characters.
    opts = [o for o in options if 0 < len(o) <= 20][:3]
    if not opts:
        return {"to": to, "type": "text", "text": {"body": body, "preview_url": False}}
    return {"to": to, "type": "interactive", "interactive": {
        "type": "button", "body": {"text": body[:1024]},
        "action": {"buttons": [{"type": "reply", "reply": {"id": f"q{i}", "title": o}} for i, o in enumerate(opts)]},
    }}


def incoming_text(message: dict) -> str | None:
    """The text of an incoming message (typed, or a tapped reply button), else None."""
    kind = message.get("type")
    if kind == "text":
        return (message.get("text") or {}).get("body")
    if kind == "interactive":
        inter = message.get("interactive") or {}
        return ((inter.get("button_reply") or inter.get("list_reply") or {}).get("title"))
    if kind == "button":
        return (message.get("button") or {}).get("text")
    return None


async def handle(message: dict) -> None:
    """Answer one incoming WhatsApp message."""
    sender = message.get("from")
    msg_id = message.get("id")
    if not sender or not msg_id:
        return
    r = _redis()
    try:
        # Meta retries deliveries: answer each message once.
        if not await r.set(f"wa_seen:{msg_id}", "1", nx=True, ex=3 * 24 * 3600):
            return
        try:
            whatsapp_service.mark_read(msg_id)
        except Exception:
            pass

        text = incoming_text(message)
        if not text:
            whatsapp_service.send_text(sender, NOT_TEXT)
            return

        rate = f"wa_rate:{sender}"
        n = await r.incr(rate)
        if n == 1:
            await r.expire(rate, 3600)
        if n > RATE_MAX_PER_HOUR:
            if n == RATE_MAX_PER_HOUR + 1:
                whatsapp_service.send_text(sender, SLOW_DOWN)
            return

        key = f"wa_chat:{sender}"
        history = [json.loads(h) for h in await r.lrange(key, 0, -1)]
        if not history and text.strip().lower() in {"hi", "hii", "hello", "hey", "hy", "namaste"}:
            whatsapp_service.send_message(_buttons(sender, GREETING, ["Show pricing", "Free trial", "How it works"]))
            await r.rpush(key, json.dumps({"role": "user", "content": text}),
                          json.dumps({"role": "assistant", "content": GREETING}))
            await r.expire(key, HISTORY_TTL)
            return

        history.append({"role": "user", "content": text[:MAX_IN]})
        reply, followups = await site_assistant.answer(history[-HISTORY_TURNS * 2:], channel="whatsapp")
        body = to_whatsapp(reply)
        whatsapp_service.send_message(_buttons(sender, body, followups))

        await r.rpush(key, json.dumps(history[-1]), json.dumps({"role": "assistant", "content": reply}))
        await r.ltrim(key, -HISTORY_TURNS * 2, -1)
        await r.expire(key, HISTORY_TTL)
    finally:
        await r.aclose()
