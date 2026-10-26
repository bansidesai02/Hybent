"""
Delivers queued callbacks (the deliveries outbox) to each client, signed.
A delivery is retried with exponential backoff until a 2xx, so call data is
never lost when the client is down (Spec §11).
"""
import json
import logging
from datetime import datetime, timedelta

import httpx

from voice.models import Client, Delivery
from voice.security import sign

logger = logging.getLogger(__name__)

BACKOFF_CAP_MINUTES = 60


def backoff(attempts: int) -> timedelta:
    return timedelta(minutes=min(2 ** attempts, BACKOFF_CAP_MINUTES))


async def deliver(http: httpx.AsyncClient, client: Client, delivery: Delivery, now: datetime, max_attempts: int) -> None:
    body = json.dumps(delivery.payload, separators=(",", ":"), ensure_ascii=False).encode()
    ts = str(int(now.timestamp()))
    delivery.attempts += 1
    try:
        resp = await http.post(
            client.callback_url,
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Voice-Timestamp": ts,
                "X-Voice-Signature": sign(client.callback_secret, ts, body),
                "X-Voice-Delivery": str(delivery.id),
            },
            timeout=15,
        )
        if 200 <= resp.status_code < 300:
            delivery.delivered_at = now
            delivery.last_error = None
            return
        delivery.last_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
    except httpx.HTTPError as exc:
        delivery.last_error = f"{type(exc).__name__}: {exc}"[:500]

    if delivery.attempts >= max_attempts:
        delivery.gave_up_at = now
        logger.error("voice: gave up delivering %s to %s: %s", delivery.id, client.name, delivery.last_error)
    else:
        delivery.next_attempt_at = now + backoff(delivery.attempts)
