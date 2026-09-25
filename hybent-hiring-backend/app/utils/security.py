"""
JWT creation/verification and password hashing utilities.
No database imports — pure crypto helpers.
"""
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ── Password hashing ───────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    # Use direct bcrypt for hashing for maximum speed and security (bypassing passlib fallback slowness)
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        # Standard bcrypt checkpw (extremely fast C implementation)
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        # Fallback to passlib if format is different (e.g. non-bcrypt formats, legacy hash formats)
        try:
            return pwd_context.verify(plain, hashed)
        except Exception:
            return False


# ── JWT ────────────────────────────────────────────────────────────────────────
def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload["type"] = "access"
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token() -> str:
    """Generate a cryptographically secure random refresh token."""
    return secrets.token_urlsafe(64)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate an access token.
    Raises JWTError on invalid/expired tokens.
    """
    payload = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.algorithm],
    )
    if payload.get("type") != "access":
        raise JWTError("Not an access token")
    return payload


OAUTH_STATE_TYPE = "gmail_oauth"
OAUTH_STATE_TTL_MINUTES = 10


def create_oauth_state(user_id: str, organization_id: str) -> str:
    """Signed, short-lived `state` for the mailbox OAuth round-trip.

    Carries only who started the flow. Its own `type` means it can never be
    accepted as an access token (decode_access_token rejects it), and the
    callback reads the user's role from the database, never from here.
    """
    payload = {
        "sub": user_id,
        "org": organization_id,
        "type": OAUTH_STATE_TYPE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=OAUTH_STATE_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_oauth_state(state: str) -> dict[str, Any]:
    """Raises JWTError when the state is forged, expired or not an OAuth state."""
    payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != OAUTH_STATE_TYPE:
        raise JWTError("Not an OAuth state")
    return payload
