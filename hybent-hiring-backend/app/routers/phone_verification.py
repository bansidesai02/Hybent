"""A candidate verifies their mobile number with a one-time code sent on
WhatsApp (from Hybent's business number), and agrees to get updates there.

The code is kept in Redis for 10 minutes, hashed, with a cap on wrong tries
and on how often a code can be sent.
"""

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.dependencies import DB, CurrentUser
from app.models.candidate import Candidate
from app.schemas.response import APIResponse
from app.services import whatsapp_service
from app.services.sms_service import msisdn
from app.utils.permissions import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/portal/phone", tags=["portal"])

CODE_TTL = whatsapp_service.OTP_MINUTES * 60
MAX_TRIES = 5
RESEND_GAP = 45          # seconds between codes
MAX_SENDS_PER_HOUR = 5


def _redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _hash(code: str) -> str:
    return hmac.new(settings.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()


async def _my_profiles(db: DB, current_user: CurrentUser) -> list[Candidate]:
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    return list((await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalars())


def _status(profiles: list[Candidate]) -> dict:
    p = next((c for c in profiles if c.phone_verified_at), profiles[0] if profiles else None)
    return {
        "phone": p.phone if p else None,
        "verified": bool(p and p.phone_verified_at),
        "sms_opt_in": bool(p and p.sms_opt_in),
    }


async def _otp_ready() -> bool:
    """WhatsApp is set up and Meta has approved the OTP template (cached 10 min)."""
    if not whatsapp_service.configured():
        return False
    r = _redis()
    try:
        cached = await r.get("whatsapp_otp_ready")
        if cached is not None:
            return cached == "1"
        try:
            ready = (await run_in_threadpool(whatsapp_service.template_status)).get(whatsapp_service.OTP_TEMPLATE) == "APPROVED"
        except Exception as e:
            logger.warning(f"[phone] template status check failed: {e}")
            ready = False
        await r.set("whatsapp_otp_ready", "1" if ready else "0", ex=600)
        return ready
    finally:
        await r.aclose()


@router.get("")
async def phone_status(db: DB, current_user: CurrentUser):
    data = _status(await _my_profiles(db, current_user))
    data["available"] = await _otp_ready()
    return APIResponse.success(message="Phone status.", data=data)


class SendCode(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)


@router.post("/send-code")
async def send_code(body: SendCode, db: DB, current_user: CurrentUser):
    """Send a 6-digit code to this number on WhatsApp."""
    profiles = await _my_profiles(db, current_user)
    if not profiles:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    to = msisdn(body.phone)
    if not to:
        raise HTTPException(status_code=400, detail="Enter a valid Indian mobile number.")
    if not whatsapp_service.configured():
        raise HTTPException(status_code=503, detail="Mobile verification is not set up yet.")

    r = _redis()
    try:
        key, rate = f"phone_otp:{current_user.id}", f"phone_otp_sends:{current_user.id}"
        if await r.ttl(key) > CODE_TTL - RESEND_GAP:
            raise HTTPException(status_code=429, detail="Please wait a few seconds before asking for a new code.")
        sends = await r.incr(rate)
        if sends == 1:
            await r.expire(rate, 3600)
        if sends > MAX_SENDS_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many codes. Please try again in an hour.")
        code = f"{secrets.randbelow(10**6):06d}"
        try:
            whatsapp_service.send_otp(to, code)
        except Exception as e:
            logger.warning(f"[phone] WhatsApp OTP to {to} failed: {e}")
            raise HTTPException(status_code=502, detail="Could not send the code on WhatsApp. Check the number and try again.")
        await r.set(key, json.dumps({"to": to, "hash": _hash(code), "tries": 0}), ex=CODE_TTL)
    finally:
        await r.aclose()
    return APIResponse.success(message="Code sent on WhatsApp.", data={"to": f"+{to}"})


class VerifyCode(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")


@router.post("/verify")
async def verify_phone(body: VerifyCode, db: DB, current_user: CurrentUser):
    """Check the code; save the number and switch WhatsApp updates on."""
    profiles = await _my_profiles(db, current_user)
    if not profiles:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    r = _redis()
    try:
        key = f"phone_otp:{current_user.id}"
        raw = await r.get(key)
        if not raw:
            raise HTTPException(status_code=400, detail="The code expired. Send a new one.")
        data = json.loads(raw)
        if not hmac.compare_digest(data["hash"], _hash(body.code)):
            data["tries"] += 1
            if data["tries"] >= MAX_TRIES:
                await r.delete(key)
                raise HTTPException(status_code=400, detail="Too many wrong tries. Send a new code.")
            await r.set(key, json.dumps(data), keepttl=True)
            raise HTTPException(status_code=400, detail="Wrong code. Check WhatsApp and try again.")
        await r.delete(key)
    finally:
        await r.aclose()

    now = datetime.now(timezone.utc)
    for c in profiles:
        c.phone = f"+{data['to']}"
        c.phone_verified_at = now
        c.sms_opt_in = True
    await db.commit()
    return APIResponse.success(message="Mobile number verified.", data=_status(profiles))


class OptIn(BaseModel):
    sms_opt_in: bool


@router.put("/sms")
async def set_sms_opt_in(body: OptIn, db: DB, current_user: CurrentUser):
    """Stop (or restart) WhatsApp updates."""
    profiles = await _my_profiles(db, current_user)
    if body.sms_opt_in and not any(c.phone_verified_at for c in profiles):
        raise HTTPException(status_code=400, detail="Verify your mobile number first.")
    for c in profiles:
        c.sms_opt_in = body.sms_opt_in
    await db.commit()
    return APIResponse.success(message="Saved.", data=_status(profiles))
