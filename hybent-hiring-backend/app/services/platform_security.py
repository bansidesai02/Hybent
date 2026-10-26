"""
Platform security settings from the super admin Settings page, and the
helpers that enforce them:

- require_2fa     tenant admins confirm a 6-digit code emailed at sign-in
- session_timeout sessions end after SESSION_IDLE_MINUTES without activity
- ip_whitelist    super admin sign-in and API calls only from ip_allowlist

Also records sign-in attempts (LoginEvent) for the super admin portal.
"""
import hashlib
import hmac
import ipaddress
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from jose import JWTError, jwt
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.login_event import LoginEvent
from app.models.password_reset import PasswordResetToken
from app.models.super_admin import PlatformSetting

SETTINGS_KEY = "platform_branding_smtp"
SAVED_MARKER = "security_saved_at"
SECURITY_KEYS = ("require_2fa", "session_timeout", "ip_whitelist", "ip_allowlist")
SESSION_IDLE_MINUTES = 30
MFA_CODE_TTL_MINUTES = 10
MFA_MAX_ATTEMPTS = 5
MFA_ROLES = {"admin"}  # "Require 2FA for tenant admins"

_MFA_TOKEN_TYPE = "mfa_challenge"
_OTP_PREFIX = "2fa_"


async def get_security_settings(db: AsyncSession) -> dict:
    """The three security switches plus the allow-list, as enforced.

    The Settings page used to write require_2fa/session_timeout = true as
    defaults on first view while nothing enforced them. So a switch only
    counts once a super admin has saved the security section (SAVED_MARKER);
    until then all three are off, which is what was actually in effect.
    """
    value = await db.scalar(
        select(PlatformSetting.setting_value).where(PlatformSetting.setting_key == SETTINGS_KEY)
    ) or {}
    if not value.get(SAVED_MARKER):
        return {"require_2fa": False, "session_timeout": False, "ip_whitelist": False,
                "ip_allowlist": list(value.get("ip_allowlist") or [])}
    return {
        "require_2fa": bool(value.get("require_2fa", False)),
        "session_timeout": bool(value.get("session_timeout", False)),
        "ip_whitelist": bool(value.get("ip_whitelist", False)),
        "ip_allowlist": list(value.get("ip_allowlist") or []),
    }


# ── Client IP and the super admin allow-list ─────────────────────────────────

def client_ip(request: Request | None) -> str | None:
    """The caller's address. In production Caddy sets X-Forwarded-For itself
    (it ignores the client's value), so the right-most entry is the hop our
    proxy saw; a client can only prepend entries, never replace that one."""
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last = forwarded.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else None


def normalize_allowlist(entries: list[str]) -> list[str]:
    """Validate IPs/CIDRs; raises ValueError naming the first bad entry."""
    out = []
    for raw in entries:
        entry = raw.strip()
        if not entry:
            continue
        try:
            out.append(str(ipaddress.ip_network(entry, strict=False)))
        except ValueError:
            raise ValueError(f"'{entry}' is not a valid IP address or CIDR range.")
    return out


def ip_allowed(ip: str | None, allowlist: list[str]) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for entry in allowlist:
        try:
            if addr in ipaddress.ip_network(entry, strict=False):
                return True
        except ValueError:
            continue
    return False


async def super_admin_ip_blocked(db: AsyncSession, request: Request | None) -> bool:
    sec = await get_security_settings(db)
    if not sec["ip_whitelist"] or not sec["ip_allowlist"]:
        return False
    return not ip_allowed(client_ip(request), sec["ip_allowlist"])


# ── Session timeout ──────────────────────────────────────────────────────────

def refresh_is_stale(token_created_at: datetime) -> bool:
    """A refresh token is rotated on every use, so its age is the time since
    the client last refreshed. An active client refreshes as its access token
    expires; one that hasn't for access-lifetime + the idle window was idle."""
    limit = timedelta(minutes=settings.access_token_expire_minutes + SESSION_IDLE_MINUTES)
    created = token_created_at if token_created_at.tzinfo else token_created_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - created > limit


# ── Sign-in events ───────────────────────────────────────────────────────────

async def record_login_event(
    db: AsyncSession,
    *,
    email: str,
    method: str,
    success: bool,
    request: Request | None = None,
    user=None,
    reason: str | None = None,
    commit: bool = False,
) -> None:
    """Add a LoginEvent. `commit=True` on failure paths, which raise right
    after and would otherwise roll the event back with the request."""
    ip = client_ip(request)
    db.add(LoginEvent(
        user_id=getattr(user, "id", None),
        organization_id=getattr(user, "organization_id", None),
        email=(email or "")[:255].lower(),
        method=method,
        success=success,
        reason=reason,
        ip_address=ip[:50] if ip else None,
        user_agent=(request.headers.get("user-agent") or "")[:500] if request else None,
    ))
    if commit:
        await db.commit()
    else:
        await db.flush()


# ── Two-factor challenge ─────────────────────────────────────────────────────

def _otp_digest(user_id: uuid.UUID, code: str) -> str:
    mac = hmac.new(settings.secret_key.encode(), f"{user_id}:{code}".encode(), hashlib.sha256)
    return _OTP_PREFIX + mac.hexdigest()


def create_mfa_token(user_id: uuid.UUID, method: str) -> str:
    """Proof that the first factor passed. Not an access token (own `type`)."""
    payload = {
        "sub": str(user_id),
        "type": _MFA_TOKEN_TYPE,
        "method": method,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=MFA_CODE_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_mfa_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    return payload if payload.get("type") == _MFA_TOKEN_TYPE else None


async def _expire_codes(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.is_used == False,  # noqa: E712
            PasswordResetToken.token.like(f"{_OTP_PREFIX}%"),
        )
        .values(is_used=True)
    )


async def issue_mfa_code(db: AsyncSession, user) -> None:
    """Replace any outstanding code with a new one and email it."""
    from app.services.email_service import send_email

    await _expire_codes(db, user.id)
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(PasswordResetToken(
        user_id=user.id,
        token=_otp_digest(user.id, code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=MFA_CODE_TTL_MINUTES),
    ))
    await db.flush()
    send_email(
        to=user.email,
        subject="Your Hybent sign-in code",
        html_body=(
            f"<p>Your sign-in code is <strong style=\"font-size:20px\">{code}</strong>.</p>"
            f"<p>It expires in {MFA_CODE_TTL_MINUTES} minutes. If you didn't try to sign in, "
            "change your password.</p>"
        ),
    )


async def mfa_attempts_exhausted(db: AsyncSession, user_id: uuid.UUID) -> bool:
    since = datetime.now(timezone.utc) - timedelta(minutes=MFA_CODE_TTL_MINUTES)
    failures = await db.scalar(
        select(func.count(LoginEvent.id)).where(
            LoginEvent.user_id == user_id,
            LoginEvent.method == "otp",
            LoginEvent.success == False,  # noqa: E712
            LoginEvent.created_at >= since,
        )
    ) or 0
    return failures >= MFA_MAX_ATTEMPTS


async def consume_mfa_code(db: AsyncSession, user_id: uuid.UUID, code: str) -> bool:
    row = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.token == _otp_digest(user_id, code.strip()),
            PasswordResetToken.is_used == False,  # noqa: E712
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    if not row:
        return False
    row.is_used = True
    return True
