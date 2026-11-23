"""WhatsApp Cloud API (Meta): updates to candidates and interviewers, and the
mobile-number OTP, sent from Hybent's WhatsApp business number.

A business may only start a WhatsApp conversation with a template Meta has
approved. Each SMS event (sms_service.EVENTS) has a matching template here,
named `hybent_<event>`; `sync_templates()` submits any that are missing, and
Meta reviews them (usually minutes). Until a template is approved, sending
it fails and the log row says so.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

LANG = "en"
OTP_TEMPLATE = "hybent_otp"
OTP_MINUTES = 10

# event key -> (body with {{n}} placeholders, sample values for Meta's review).
# Meta rejects a body that starts or ends with a placeholder.
TEMPLATES: dict[str, tuple[str, tuple[str, ...]]] = {
    "application_received": (
        "Hi {{1}}, we received your application for {{2}} at {{3}}. We will update you soon.",
        ("Raj", "Sales Executive", "Acme Pvt Ltd")),
    "shortlisted": (
        "Hi {{1}}, good news! You are shortlisted for {{2}}. Pick your interview time here: {{3}} . All the best.",
        ("Raj", "Sales Executive", "https://hybent.com/portal")),
    "interview_scheduled": (
        "Hi {{1}}, your interview for {{2}} is booked for {{3}}. Join here: {{4}} . All the best.",
        ("Raj", "Sales Executive", "21 Nov, 11:00 AM", "https://meet.google.com/abc-defg-hij")),
    "interview_reminder": (
        "Reminder: your interview for {{1}} starts at {{2}}. Join here: {{3}} . All the best.",
        ("Sales Executive", "21 Nov, 11:00 AM", "https://meet.google.com/abc-defg-hij")),
    "rejected": (
        "Hi {{1}}, thank you for applying to {{2}}. We have decided to move ahead with other candidates this time. We wish you all the best.",
        ("Raj", "Acme Pvt Ltd")),
    "offer_sent": (
        "Hi {{1}}, congratulations! Your offer for {{2}} has been sent to your email. Please check it and reply there.",
        ("Raj", "Sales Executive")),
    "interviewer_new_interview": (
        "New interview booked: {{1}} for {{2}} on {{3}}. Join here: {{4}} . Thank you.",
        ("Raj Patel", "Sales Executive", "21 Nov, 11:00 AM", "https://meet.google.com/abc-defg-hij")),
    "interviewer_reminder": (
        "Reminder: your interview with {{1}} is at {{2}}. Join here: {{3}} . Thank you.",
        ("Raj Patel", "21 Nov, 11:00 AM", "https://meet.google.com/abc-defg-hij")),
    "interviewer_feedback": (
        "Please share your feedback for {{1}} ({{2}}) here: {{3}} . Thank you.",
        ("Raj Patel", "Sales Executive", "https://hybent.com/hiring")),
}


def configured() -> bool:
    return bool(settings.whatsapp_token and settings.whatsapp_phone_number_id)


def _url(path: str) -> str:
    return f"https://graph.facebook.com/{settings.whatsapp_api_version}/{path}"


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.whatsapp_token}"}


def _error(r: httpx.Response) -> str:
    try:
        err = r.json().get("error") or {}
        msg = err.get("error_user_msg") or (err.get("error_data") or {}).get("details") or err.get("message")
        return f"WhatsApp {r.status_code}: {msg}"[:500]
    except Exception:
        return f"WhatsApp HTTP {r.status_code}"


def _clean(value: str | None) -> str:
    # Meta rejects parameters with newlines, tabs or 4+ spaces in a row.
    return " ".join((value or "-").split())[:200] or "-"


def _post_message(payload: dict) -> str:
    r = httpx.post(_url(f"{settings.whatsapp_phone_number_id}/messages"), headers=_headers(),
                   json={"messaging_product": "whatsapp", **payload}, timeout=20)
    if r.status_code >= 400:
        raise RuntimeError(_error(r))
    return str((r.json().get("messages") or [{}])[0].get("id") or "")[:100]


def send_message(payload: dict) -> str:
    """Any message body (text, interactive); free inside the 24h reply window."""
    return _post_message(payload)


def send_text(to: str, body: str) -> str:
    return _post_message({"to": to, "type": "text", "text": {"body": body[:4096], "preview_url": False}})


def mark_read(message_id: str) -> None:
    """Blue ticks on the person's message."""
    httpx.post(_url(f"{settings.whatsapp_phone_number_id}/messages"), headers=_headers(), timeout=10,
               json={"messaging_product": "whatsapp", "status": "read", "message_id": message_id})


def send_event(key: str, to: str, variables: tuple[str, ...], values: dict[str, str]) -> str:
    """Send one update as its approved template. `to` is digits with country
    code (91XXXXXXXXXX). Returns Meta's message id; raises on failure."""
    params = [{"type": "text", "text": _clean(values.get(name))} for name in variables]
    return _post_message({
        "to": to, "type": "template",
        "template": {"name": f"hybent_{key}", "language": {"code": LANG},
                     "components": [{"type": "body", "parameters": params}]},
    })


def send_otp(to: str, code: str) -> str:
    """The one-time code, as the authentication template (copy-code button)."""
    return _post_message({
        "to": to, "type": "template",
        "template": {"name": OTP_TEMPLATE, "language": {"code": LANG}, "components": [
            {"type": "body", "parameters": [{"type": "text", "text": code}]},
            {"type": "button", "sub_type": "url", "index": "0", "parameters": [{"type": "text", "text": code}]},
        ]},
    })


def _template_payloads() -> list[dict]:
    out = [{
        "name": OTP_TEMPLATE, "language": LANG, "category": "AUTHENTICATION",
        "components": [
            {"type": "BODY", "add_security_recommendation": True},
            {"type": "FOOTER", "code_expiration_minutes": OTP_MINUTES},
            {"type": "BUTTONS", "buttons": [{"type": "OTP", "otp_type": "COPY_CODE", "text": "Copy code"}]},
        ],
    }]
    for key, (body, sample) in TEMPLATES.items():
        out.append({
            "name": f"hybent_{key}", "language": LANG, "category": "UTILITY",
            "components": [
                {"type": "BODY", "text": body, "example": {"body_text": [list(sample)]}},
                {"type": "FOOTER", "text": "Hybent Hiring"},
            ],
        })
    return out


def template_status() -> dict[str, str]:
    """name -> APPROVED / PENDING / REJECTED for our templates on Meta."""
    if not settings.whatsapp_business_account_id:
        return {}
    r = httpx.get(_url(f"{settings.whatsapp_business_account_id}/message_templates"), headers=_headers(),
                  params={"fields": "name,status,language", "limit": 200}, timeout=20)
    if r.status_code >= 400:
        raise RuntimeError(_error(r))
    return {t["name"]: t["status"] for t in r.json().get("data", []) if t["name"].startswith("hybent_")}


def sync_templates() -> dict[str, str]:
    """Submit every Hybent template Meta doesn't have yet. Returns name -> status."""
    have = template_status()
    for payload in _template_payloads():
        if payload["name"] in have:
            continue
        r = httpx.post(_url(f"{settings.whatsapp_business_account_id}/message_templates"),
                       headers=_headers(), json=payload, timeout=20)
        if r.status_code >= 400:
            have[payload["name"]] = _error(r)
            logger.warning(f"[whatsapp] template {payload['name']} not created: {have[payload['name']]}")
        else:
            have[payload["name"]] = r.json().get("status", "PENDING")
    return have
