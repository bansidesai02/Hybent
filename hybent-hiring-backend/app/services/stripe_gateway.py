"""Thin wrapper over the Stripe API.

Everything that talks to Stripe goes through here, so payment_service stays
testable (tests replace these functions) and gets plain dicts back rather
than StripeObjects. The Stripe SDK is synchronous; calls run in a thread.
"""
import asyncio
import json
import logging

import stripe

from app.core.config import settings

logger = logging.getLogger(__name__)

# Price IDs by lookup key, so each recurring price is looked up once per process.
_price_cache: dict[str, str] = {}


class StripeNotConfigured(RuntimeError):
    pass


def _key() -> str:
    if not settings.stripe_enabled:
        raise StripeNotConfigured("Stripe is not configured (STRIPE_SECRET_KEY).")
    return settings.stripe_secret_key.strip()


def _plain(obj) -> dict:
    return json.loads(json.dumps(obj))


async def create_checkout_session(params: dict) -> dict:
    session = await asyncio.to_thread(stripe.checkout.Session.create, api_key=_key(), **params)
    return _plain(session)


async def retrieve_checkout_session(session_id: str) -> dict:
    session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id, api_key=_key())
    return _plain(session)


async def expire_checkout_session(session_id: str) -> None:
    try:
        await asyncio.to_thread(stripe.checkout.Session.expire, session_id, api_key=_key())
    except stripe.StripeError as e:
        # Already complete or expired: nothing to do.
        logger.info(f"Couldn't expire Checkout session {session_id}: {e}")


async def retrieve_subscription(subscription_id: str) -> dict:
    sub = await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id, api_key=_key())
    return _plain(sub)


async def recurring_price(
    lookup_key: str, product_name: str, unit_amount_cents: int, currency: str,
    interval_count: int, item: str,
) -> str:
    """ID of the recurring price with `lookup_key`, created on first use.

    Lookup keys include the amount and term, so changing a price in code
    creates a new Stripe price instead of repricing existing subscribers.
    `item` (plan, admin_seat, recruiter_seat) is kept in the price's metadata
    to find a subscription's seat items later."""
    if lookup_key in _price_cache:
        return _price_cache[lookup_key]

    def _find_or_create() -> str:
        found = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1, api_key=_key())
        if found.data:
            return found.data[0].id
        return stripe.Price.create(
            api_key=_key(),
            currency=currency.lower(),
            unit_amount=unit_amount_cents,
            recurring={"interval": "month", "interval_count": interval_count},
            product_data={"name": product_name},
            lookup_key=lookup_key,
            metadata={"hybent_item": item},
        ).id

    price_id = await asyncio.to_thread(_find_or_create)
    _price_cache[lookup_key] = price_id
    return price_id


async def set_subscription_items(subscription_id: str, quantities: dict[str, tuple[str, int]]) -> None:
    """Set the quantity of each `item` (hybent_item metadata) on a Stripe
    subscription: {"admin_seat": (price_id, 2), ...}. Missing items are added
    and zero quantities removed. No proration: the change was already paid
    for in a separate Checkout payment, and it bills from the next renewal."""
    def _update() -> None:
        sub = stripe.Subscription.retrieve(subscription_id, api_key=_key())
        existing = {
            (item["price"].get("metadata") or {}).get("hybent_item"): item
            for item in sub["items"]["data"]
        }
        items = []
        for key, (price_id, qty) in quantities.items():
            current = existing.get(key)
            if current is not None:
                items.append({"id": current["id"], "deleted": True} if qty <= 0 else {"id": current["id"], "quantity": qty})
            elif qty > 0:
                items.append({"price": price_id, "quantity": qty})
        if items:
            stripe.Subscription.modify(subscription_id, api_key=_key(), items=items, proration_behavior="none")

    await asyncio.to_thread(_update)


def construct_event(payload: bytes, signature: str | None) -> dict:
    """Verify a webhook's signature and return the event. Raises ValueError
    or stripe.SignatureVerificationError if it isn't genuine."""
    secret = settings.stripe_webhook_secret.strip()
    if not secret:
        raise StripeNotConfigured("Stripe webhooks are not configured (STRIPE_WEBHOOK_SECRET).")
    stripe.Webhook.construct_event(payload, signature or "", secret)
    return json.loads(payload)
