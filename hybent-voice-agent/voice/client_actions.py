"""
Questions the agent asks the client during a call, answered at once:

    hold_slot        lock an interview slot the candidate just agreed to
                     -> {"ok": true} or {"ok": false, "alternatives": [iso, ...]}
    resend_details   re-send the interview link / address to the candidate
                     -> {"ok": true}

Signed exactly like callbacks (voice.security), so the client verifies both
the same way. Short timeout: the candidate is waiting on the line.
"""
import json
import logging

import httpx

from voice.models import Client
from voice.security import sign
from voice.services import utcnow

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 8


class ActionError(Exception):
    """The client couldn't answer; the agent should not promise anything."""


async def call_action(client: Client, action: str, client_ref: str, **params) -> dict:
    if not client.actions_url:
        raise ActionError(f"{client.name} has no actions endpoint")
    body = json.dumps({"action": action, "client_ref": client_ref, **params}, separators=(",", ":")).encode()
    ts = str(int(utcnow().timestamp()))
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as http:
            resp = await http.post(
                client.actions_url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Voice-Timestamp": ts,
                    "X-Voice-Signature": sign(client.callback_secret, ts, body),
                },
            )
    except httpx.HTTPError as exc:
        raise ActionError(f"{action}: {type(exc).__name__}") from exc
    if resp.status_code >= 400:
        raise ActionError(f"{action}: HTTP {resp.status_code}")
    try:
        return resp.json()
    except ValueError as exc:
        raise ActionError(f"{action}: invalid JSON") from exc
