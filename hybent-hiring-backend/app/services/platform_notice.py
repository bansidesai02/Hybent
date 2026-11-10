"""Platform-wide announcement banner and maintenance mode, set from the super
admin portal.

Stored in platform_settings under NOTICE_KEY:
    {"announcement": {"active", "message", "tone"},
     "maintenance": {"enabled", "message"}}

Maintenance blocks signed-in users of every organization (503) except super
admins, support sessions, and the few routes the app needs to show the notice
and let people sign out. Public pages and sign-in are untouched.

The value is cached in-process for CACHE_SECONDS so the check costs no query on
almost every request; saving clears this process's cache, and others pick it
up within CACHE_SECONDS.
"""
import time

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.super_admin import PlatformSetting

NOTICE_KEY = "platform_notice"
CACHE_SECONDS = 15
TONES = ("info", "warning", "success")
DEFAULT_MAINTENANCE_MESSAGE = "Hybent is down for a short maintenance. Please check back in a few minutes."

# Allowed during maintenance: the notice itself, auth (sign out, refresh),
# your own profile and notifications.
MAINTENANCE_ALLOWED_PREFIXES = ("/v1/platform/", "/v1/auth/", "/v1/users/me", "/v1/notifications")

_cache: tuple[float, dict] | None = None


def normalize(value: dict | None) -> dict:
    value = value or {}
    a = value.get("announcement") or {}
    m = value.get("maintenance") or {}
    tone = a.get("tone") if a.get("tone") in TONES else "info"
    return {
        "announcement": {
            "active": bool(a.get("active")) and bool((a.get("message") or "").strip()),
            "message": (a.get("message") or "").strip()[:500],
            "tone": tone,
        },
        "maintenance": {
            "enabled": bool(m.get("enabled")),
            "message": (m.get("message") or "").strip()[:500] or DEFAULT_MAINTENANCE_MESSAGE,
        },
        "updated_at": value.get("updated_at"),
    }


async def load(db: AsyncSession, fresh: bool = False) -> dict:
    global _cache
    now = time.monotonic()
    if not fresh and _cache and now - _cache[0] < CACHE_SECONDS:
        return _cache[1]
    stored = await db.scalar(select(PlatformSetting.setting_value).where(PlatformSetting.setting_key == NOTICE_KEY))
    value = normalize(stored)
    _cache = (now, value)
    return value


def clear_cache() -> None:
    global _cache
    _cache = None


async def enforce_maintenance(db: AsyncSession, role: str, path: str, impersonating: bool) -> None:
    if role == "super_admin" or impersonating or path.startswith(MAINTENANCE_ALLOWED_PREFIXES):
        return
    notice = await load(db)
    if notice["maintenance"]["enabled"]:
        raise HTTPException(status_code=503, detail=notice["maintenance"]["message"])
