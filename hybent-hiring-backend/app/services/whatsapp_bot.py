"""Hybent AI on WhatsApp.

Every incoming message:
1. finds or creates the WhatsAppContact for the sender (the number Meta proves),
2. works out who they are (whatsapp_identity): visitor, lead, candidate, client,
3. asks the model for a reply that may carry action tags:
     [LEAD:{...}]       lead details the person gave (company, team size, ...)
     [LINK_EMAIL:x@y]   they say they have a Hybent account with this email
     [HANDOFF]          they want a person, or the bot can't help
     [TRIAL]            they want to try Hybent (trial link is sent)
     [SUGGEST:a|b|c]    follow-up buttons
4. runs the actions, sends the reply and stores both sides of the chat.

While a person from the team has taken over (bot_paused) the bot stays quiet.
Replies inside the 24-hour window the person opens are free; no template.
"""

import hashlib
import hmac
import json
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.whatsapp import WaContactKind, WhatsAppContact, WhatsAppMessage
from app.services import whatsapp_apply, whatsapp_identity, whatsapp_service
from app.services.ai import site_assistant
from app.services.ai.copilot_service import _generate_text_with_fallback

logger = logging.getLogger(__name__)

HISTORY_MESSAGES = 20
MAX_IN = 1000
RATE_MAX_PER_HOUR = 30
LINK_CODE_TTL = 15 * 60
LINK_MAX_TRIES = 5
TRIAL_URL = "https://hybent.com/free-trial"

NOT_TEXT = "Sorry, I can only read text messages right now. Please type your question 🙂"
SLOW_DOWN = "You've sent a lot of messages. Please try again in a while, or email info@hybent.com."
FALLBACK = "Sorry, I couldn't answer that just now. Please try again, or email info@hybent.com."
HANDOFF_ACK = "Sure, I've asked someone from the Hybent team to reply here. They usually reply within working hours (Mon–Fri, 9–6 IST)."

LEAD_FIELDS = ("name", "company", "role", "team_size", "cvs_per_month", "email", "city", "current_tool", "interest")

_TAG_RE = re.compile(r"\[(LEAD|LINK_EMAIL|HANDOFF|TRIAL|SUGGEST|RESCHEDULE|STOP_UPDATES|START_UPDATES)(?::([^\]]*))?\]")


def _redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _now():
    return datetime.now(timezone.utc)


# ── Formatting ────────────────────────────────────────────────────────────

def to_whatsapp(text: str) -> str:
    """Markdown from the model -> WhatsApp formatting."""
    text = re.sub(r"\[([^\]]+)\]\((/[^)]*)\)", r"\1: https://hybent.com\2", text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1: \2", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.M)
    return text.strip()[:4000]


def _buttons(to: str, body: str, options: list[str]) -> dict:
    opts = [o for o in options if 0 < len(o) <= 20][:3]
    if not opts:
        return {"to": to, "type": "text", "text": {"body": body, "preview_url": False}}
    return {"to": to, "type": "interactive", "interactive": {
        "type": "button", "body": {"text": body[:1024]},
        "action": {"buttons": [{"type": "reply", "reply": {"id": f"q{i}", "title": o}} for i, o in enumerate(opts)]},
    }}


def incoming_text(message: dict) -> str | None:
    kind = message.get("type")
    if kind == "text":
        return (message.get("text") or {}).get("body")
    if kind == "interactive":
        inter = message.get("interactive") or {}
        return (inter.get("button_reply") or inter.get("list_reply") or {}).get("title")
    if kind == "button":
        return (message.get("button") or {}).get("text")
    return None


def parse_tags(text: str) -> tuple[str, dict]:
    """Strip action tags from the model's reply; return (clean text, actions)."""
    actions: dict = {"lead": {}, "link_email": None, "handoff": False, "trial": False, "suggest": [],
                     "reschedule": None, "updates": None}
    for tag, arg in _TAG_RE.findall(text):
        arg = (arg or "").strip()
        if tag == "LEAD" and arg:
            try:
                data = json.loads(arg if arg.startswith("{") else "{" + arg + "}")
                actions["lead"].update({k: str(v)[:200] for k, v in data.items() if k in LEAD_FIELDS and v})
            except ValueError:
                pass
        elif tag == "LINK_EMAIL" and "@" in arg:
            actions["link_email"] = arg.lower()[:320]
        elif tag == "HANDOFF":
            actions["handoff"] = True
        elif tag == "TRIAL":
            actions["trial"] = True
        elif tag == "RESCHEDULE" and arg:
            try:
                data = json.loads(arg if arg.startswith("{") else "{" + arg + "}")
                actions["reschedule"] = {k: str(data.get(k, ""))[:300] for k in ("interview", "reason", "preferred")}
            except ValueError:
                pass
        elif tag == "STOP_UPDATES":
            actions["updates"] = False
        elif tag == "START_UPDATES":
            actions["updates"] = True
        elif tag == "SUGGEST":
            actions["suggest"] = [s.strip() for s in arg.split("|") if s.strip()][:3]
    clean = _TAG_RE.sub("", text)
    clean = re.sub(r"^\s*(Hybent AI|Assistant)\s*:\s*", "", clean).strip()
    return clean, actions


# ── Prompt ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""You are **Hybent AI**, answering on Hybent's WhatsApp number (+91 87990 29798).

## Who you talk to
The PERSON section below says who this is: a new visitor, a lead, a verified candidate, or a verified Hybent customer (client). Talk to them accordingly.
- Visitor / lead: help them understand Hybent Hiring and get them to try it. Naturally (one question at a time, never a form) learn their name, company, their role, team size, how many CVs they get a month, city and the tool they use today.
- Candidate: they applied for a job at a company that uses Hybent (the company hires; Hybent is the software). Be warm and encouraging. Their own applications and upcoming interviews are in the PERSON section: answer status, interview time and joining link ONLY from there. If something isn't listed (an offer letter, documents, a result), say the company will update them and they can also check the candidate portal at https://hybent.com/login. Never reveal or guess scores, rankings, reasons for a decision, other candidates or salary budgets; never promise a result. You cannot change an interview yourself: for a reschedule or cancel, get their reason and 1–2 preferred times, then send the request to the company (tag below) and tell them the interview stays as it is until the company confirms.
- Client: a Hybent customer (admin, recruiter or interviewer). Help with how-to questions about Hybent Hiring. A read-only snapshot of their own company (interviews today and tomorrow, applicants in the last 24 hours, open jobs with applicant counts) is in the PERSON section: answer "aaj ke interviews?", "naye applicants?" and similar ONLY from it, and never invent numbers. You cannot change anything from WhatsApp: to move a candidate, schedule, reject or send an offer, point them to the app (https://hybent.com/login) and its Recruiter Copilot. For details not in the snapshot, say so and point them to the app.

## Rules
- Answer ONLY from the KNOWLEDGE. If it isn't there, say you don't have that detail and offer to connect them with the team. Never invent prices, features, clients, discounts or dates.
- Reply in the SAME language style as their latest message: if they write Hinglish (Hindi in Latin letters, e.g. "mera interview kab hai"), reply in Hinglish; English gets English; Gujarati in Latin letters gets the same. Never use Devanagari script.
- WhatsApp style: short (2–6 lines), *single asterisks* for bold, no headings, no tables, no Markdown links: write full URLs like https://hybent.com/pricing.
- Only Hybent and hiring topics. Politely decline anything else.
- Never ask for passwords, OTPs or card details. Never claim to be a human.
- You are Hybent's own assistant; never name the underlying AI model or provider.

## Actions: add these tags at the very end of your reply when they apply
- [LEAD:{{"name":"...","company":"...","team_size":"..."}}] whenever a visitor or lead tells you any of: name, company, role, team_size, cvs_per_month, email, city, current_tool, interest. Always include their name when they say it ("main Priya hoon" -> "name":"Priya"). Only facts they actually said.
- Candidate only: [RESCHEDULE:{{"interview":"I1","reason":"...","preferred":"..."}}] once they asked to reschedule or cancel and gave a reason (and preferred times if any). Use the interview ref from PERSON. When you add this tag, tell them the request has been sent to the company; do not ask them to confirm again.
- Candidate only: [STOP_UPDATES] if they don't want WhatsApp updates any more; [START_UPDATES] if they want them back.
- [TRIAL] when they want to try or sign up. Also tell them the link {TRIAL_URL} (7 days, business email, approved within one business day).
- [HANDOFF] when they ask for a person/call/sales/support you can't solve, are upset, or want a custom deal. Tell them someone from the team will reply here.
- [LINK_EMAIL:their@email.com] when someone says they already use Hybent (as a candidate or a customer) and gives the email of that account, so we can confirm it's them. If they say they use Hybent but haven't given the email, ask for it.
- Always end with [SUGGEST:option|option|option]: 2–3 short follow-ups (max 20 characters each) in their language.

## KNOWLEDGE
{site_assistant.SITE_KNOWLEDGE}
"""


def _person_block(contact: WhatsAppContact, who: whatsapp_identity.Identity, ctx: dict | None = None) -> str:
    lines = [f"Kind: {who.kind}"]
    if who.name:
        lines.append(f"Name: {who.name}")
    if who.kind == WaContactKind.CLIENT:
        lines.append(f"Customer company: {who.organization_name} (role: {who.role})")
    if who.kind == WaContactKind.CANDIDATE and who.companies:
        lines.append("Applied with: " + ", ".join(who.companies))
    if ctx is not None and who.kind == WaContactKind.CLIENT:
        lines.append("Their company snapshot (read-only): " + json.dumps(ctx, ensure_ascii=False))
    elif ctx is not None:
        apps = [{k: a[k] for k in ("job", "company", "status", "applied_on")} for a in ctx["applications"]]
        ivs = [{k: i[k] for k in ("ref", "title", "company", "when", "duration_minutes", "join")}
               for i in ctx["interviews"]]
        lines.append("Their applications: " + (json.dumps(apps, ensure_ascii=False) if apps else "none found"))
        lines.append("Their upcoming interviews: " + (json.dumps(ivs, ensure_ascii=False) if ivs else "none scheduled"))
    known = {k: v for k, v in (contact.lead or {}).items() if v}
    if known:
        lines.append("Already known (don't ask again): " + json.dumps(known, ensure_ascii=False))
    if contact.profile_name and not who.name:
        lines.append(f"WhatsApp profile name: {contact.profile_name}")
    return "\n".join(lines)


async def _ask_model(contact: WhatsAppContact, who, history: list[WhatsAppMessage], text: str,
                     ctx: dict | None = None) -> str | None:
    transcript = "\n".join(
        f"{'Person' if m.direction == 'in' else ('Hybent team' if m.author == 'team' else 'Hybent AI')}: {m.text}"
        for m in history
    )
    user_content = (
        f"## PERSON\n{_person_block(contact, who, ctx)}\n\n"
        + (f"## Conversation so far\n{transcript}\n\n" if transcript else "")
        + f"## New message\n{text}\n\nReply as Hybent AI."
    )
    return await _generate_text_with_fallback(SYSTEM_PROMPT, user_content, temperature=0.3)


# ── Account linking (email code) ──────────────────────────────────────────

def _hash(code: str) -> str:
    return hmac.new(settings.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()


async def _start_link(db, r, contact: WhatsAppContact, email: str) -> str:
    """Email a 6-digit code to the Hybent account with this email."""
    match = await whatsapp_identity.find_account_by_email(db, email)
    if not match:
        return ("I couldn't find a Hybent account with that email. Please check the spelling, "
                "or email info@hybent.com.")
    code = f"{secrets.randbelow(10**6):06d}"
    await r.set(f"wa_link:{contact.id}", json.dumps({**match, "email": email, "hash": _hash(code), "tries": 0}),
                ex=LINK_CODE_TTL)
    try:
        from app.services.email_service import send_email
        send_email(email, "Your Hybent WhatsApp code",
                   f"<p>Your code to connect WhatsApp with your Hybent account is:</p>"
                   f"<p style='font-size:24px;font-weight:700;letter-spacing:4px'>{code}</p>"
                   f"<p>It expires in 15 minutes. If you didn't ask for this, ignore this email.</p>")
    except Exception as e:
        logger.warning(f"[whatsapp] link code email failed: {e}")
    return "I've emailed you a 6-digit code. Please send it here to confirm it's you (valid 15 minutes)."


async def _try_link_code(db, r, contact: WhatsAppContact, text: str) -> str | None:
    """If a link code is pending and the message is a 6-digit code, check it."""
    code = text.strip().replace(" ", "")
    if not re.fullmatch(r"\d{6}", code):
        return None
    raw = await r.get(f"wa_link:{contact.id}")
    if not raw:
        return None
    data = json.loads(raw)
    if not hmac.compare_digest(data["hash"], _hash(code)):
        data["tries"] += 1
        if data["tries"] >= LINK_MAX_TRIES:
            await r.delete(f"wa_link:{contact.id}")
            return "That code didn't match too many times. Send your account email again to get a new one."
        await r.set(f"wa_link:{contact.id}", json.dumps(data), keepttl=True)
        return "That code doesn't match. Please check the email and try again."
    await r.delete(f"wa_link:{contact.id}")
    if data["kind"] == WaContactKind.CLIENT:
        contact.user_id = data["user_id"]
        contact.kind = WaContactKind.CLIENT
    else:
        contact.candidate_email = data["email"]
        contact.kind = WaContactKind.CANDIDATE
    await db.flush()
    who = await whatsapp_identity.identify(db, contact)
    hello = f"Thanks{', ' + who.name.split(' ')[0] if who.name else ''}! ✅ Your WhatsApp is now connected to your Hybent account."
    return hello


# ── Candidate actions ─────────────────────────────────────────────────────

async def _request_reschedule(r, contact: WhatsAppContact, who, ctx: dict, req: dict) -> str | None:
    """Tell the company's admins and recruiters; the interview itself is not changed.
    Returns a message to send instead of the model's reply when something's off."""
    iv = next((i for i in ctx["interviews"] if i["ref"] == (req.get("interview") or "").upper()), None)
    if iv is None and len(ctx["interviews"]) == 1:
        iv = ctx["interviews"][0]
    if iv is None:
        return "I couldn't find that interview. Which one do you mean?"
    if not await r.set(f"wa_resched:{iv['id']}", "1", nx=True, ex=12 * 3600):
        return "Your request for this interview has already been sent to the company. They'll reply soon."
    msg = (f"{who.name or 'The candidate'} asked on WhatsApp to reschedule '{iv['title']}' ({iv['when']}). "
           f"Reason: {req.get('reason') or 'not given'}. Preferred: {req.get('preferred') or 'not given'}.")
    try:
        from app.tasks.notifications import notify_organization_roles
        notify_organization_roles.delay(iv["organization_id"], ["admin", "recruiter"], "interview_updated",
                                        "Reschedule request from candidate", msg,
                                        {"interview_id": iv["id"], "source": "whatsapp", "contact_id": str(contact.id)})
    except Exception as e:
        logger.warning(f"[whatsapp] reschedule notify failed: {e}")
    return None


async def _set_updates(db, who, on: bool) -> None:
    import uuid as _uuid

    from app.models.candidate import Candidate
    for cid in who.candidate_ids:
        c = await db.get(Candidate, _uuid.UUID(cid))
        if c and (not on or c.phone_verified_at):
            c.sms_opt_in = on


# ── Main handler ──────────────────────────────────────────────────────────

async def _get_contact(db, sender: str, profile_name: str | None) -> WhatsAppContact:
    contact = (await db.execute(select(WhatsAppContact).where(WhatsAppContact.wa_id == sender))).scalar_one_or_none()
    if contact is None:
        contact = WhatsAppContact(wa_id=sender, phone=f"+{sender}" if sender.isdigit() else None,
                                  profile_name=(profile_name or None), lead={})
        db.add(contact)
        await db.flush()
    elif profile_name and not contact.profile_name:
        contact.profile_name = profile_name
    return contact


async def _send(db, contact: WhatsAppContact, payload: dict, text: str, author: str = "bot") -> None:
    try:
        wamid = whatsapp_service.send_message(payload)
    except Exception as e:
        logger.warning(f"[whatsapp] reply to {contact.wa_id} failed: {e}")
        wamid = None
    db.add(WhatsAppMessage(contact_id=contact.id, direction="out", author=author, text=text, wamid=wamid))
    contact.last_message_at = _now()


async def _notify_team(contact: WhatsAppContact, reason: str, last_text: str) -> None:
    who = contact.profile_name or contact.phone or contact.wa_id
    try:
        from app.tasks.notifications import alert_super_admins
        # Bell + phone push (for super admins who turned push on); tap opens the chats.
        alert_super_admins(f"WhatsApp: {who} needs a reply", f"{reason}: “{last_text[:140]}”",
                           "/hiring/super-admin/whatsapp", type="whatsapp_handoff",
                           event="whatsapp_handoff", throttle=str(contact.id))
    except Exception as e:
        logger.warning(f"[whatsapp] notify team failed: {e}")


async def handle(message: dict, profile_name: str | None = None) -> None:
    sender = message.get("from")
    msg_id = message.get("id")
    if not sender or not msg_id:
        return
    r = _redis()
    try:
        if not await r.set(f"wa_seen:{msg_id}", "1", nx=True, ex=3 * 24 * 3600):
            return
        try:
            whatsapp_service.mark_read(msg_id)
        except Exception:
            pass

        async with AsyncSessionLocal() as db:
            contact = await _get_contact(db, sender, profile_name)
            text = incoming_text(message)
            db.add(WhatsAppMessage(contact_id=contact.id, direction="in", author="person",
                                   text=(text or f"[{message.get('type', 'message')}]")[:MAX_IN], wamid=msg_id))
            contact.last_message_at = contact.last_inbound_at = _now()

            if contact.bot_paused:
                # A person from the team is handling this chat.
                await db.commit()
                await _notify_team(contact, "New message in a chat you took over", text or "")
                return

            applying = await whatsapp_apply.pending(r, contact)
            apply_reply = (await whatsapp_apply.step(db, r, contact, applying, text, message) if applying
                           else await whatsapp_apply.start(db, r, contact, text or ""))
            if apply_reply:
                await _send(db, contact, {"to": sender, "type": "text", "text": {"body": apply_reply}}, apply_reply)
                await db.commit()
                return

            if not text:
                body = NOT_TEXT if message.get("type") != "document" else (
                    "Thanks for the file! To apply for a job, open the job's apply page and tap "
                    "*Apply on WhatsApp*, then send your resume when I ask for it.")
                await _send(db, contact, {"to": sender, "type": "text", "text": {"body": body}}, body)
                await db.commit()
                return

            n = await r.incr(f"wa_rate:{sender}")
            if n == 1:
                await r.expire(f"wa_rate:{sender}", 3600)
            if n > RATE_MAX_PER_HOUR:
                if n == RATE_MAX_PER_HOUR + 1:
                    await _send(db, contact, {"to": sender, "type": "text", "text": {"body": SLOW_DOWN}}, SLOW_DOWN)
                await db.commit()
                return

            linked = await _try_link_code(db, r, contact, text)
            if linked:
                await _send(db, contact, {"to": sender, "type": "text", "text": {"body": linked}}, linked)
                await db.commit()
                return

            who = await whatsapp_identity.identify(db, contact)
            history = list((await db.execute(
                select(WhatsAppMessage).where(WhatsAppMessage.contact_id == contact.id)
                .order_by(WhatsAppMessage.created_at.desc()).limit(HISTORY_MESSAGES + 1)
            )).scalars())[1:][::-1]   # without the message just stored

            if who.kind == WaContactKind.CANDIDATE:
                ctx = await whatsapp_identity.candidate_context(db, who.candidate_ids)
            elif who.kind == WaContactKind.CLIENT and who.user_id:
                ctx = await whatsapp_identity.client_context(db, who.user_id)
            else:
                ctx = None
            raw = await _ask_model(contact, who, history, text[:MAX_IN], ctx)
            reply, actions = parse_tags(raw) if raw else parse_tags(FALLBACK)

            is_candidate = who.kind == WaContactKind.CANDIDATE
            if is_candidate and actions["reschedule"]:
                problem = await _request_reschedule(r, contact, who, ctx, actions["reschedule"])
                if problem:
                    reply = problem
            if is_candidate and actions["updates"] is not None:
                await _set_updates(db, who, actions["updates"])
            if actions["lead"] and who.kind in (WaContactKind.VISITOR, WaContactKind.LEAD):
                contact.lead = {**(contact.lead or {}), **actions["lead"]}
                if contact.kind == WaContactKind.VISITOR:
                    contact.kind = WaContactKind.LEAD
                if contact.status == "new" and contact.lead.get("company") and (
                        contact.lead.get("team_size") or contact.lead.get("cvs_per_month")):
                    contact.status = "qualified"
            if actions["trial"]:
                if TRIAL_URL not in reply:
                    reply += f"\n\nStart your free trial: {TRIAL_URL}"
                if contact.status in ("new", "qualified"):
                    contact.status = "trial_link_sent"
            if actions["link_email"] and contact.kind not in (WaContactKind.CLIENT, WaContactKind.CANDIDATE):
                reply = await _start_link(db, r, contact, actions["link_email"])
                actions["suggest"] = []
            if actions["handoff"]:
                contact.bot_paused = True
                contact.handoff_requested_at = _now()
                if "team" not in reply.lower():
                    reply = (reply + "\n\n" + HANDOFF_ACK).strip()
                actions["suggest"] = []

            body = to_whatsapp(reply)
            await _send(db, contact, _buttons(sender, body, actions["suggest"]), body)
            await db.commit()
            if actions["handoff"]:
                await _notify_team(contact, "Asked for a person", text)
    finally:
        await r.aclose()


def within_reply_window(contact: WhatsAppContact) -> bool:
    return bool(contact.last_inbound_at and _now() - contact.last_inbound_at < timedelta(hours=24))
