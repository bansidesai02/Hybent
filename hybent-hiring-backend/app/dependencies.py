"""
FastAPI dependencies: DB session, current user, role guards.
"""
import uuid
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.integration_key import IntegrationKey
from app.models.organization import Organization
from app.models.user import User
from app.services import impersonation
from app.services.ai_metering import bind_request_scope
from app.utils.integration_keys import parse_key, secret_matches
from app.utils.permissions import UserRole, RECRUITER_ROLES, INTERVIEWER_ROLES, ADMIN_ONLY
from app.utils.security import decode_access_token

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

# Candidate portal accounts belong to the hiring organization, so an
# organization_id filter alone doesn't keep them out of staff data. Anyone can
# self-register one (POST /v1/portal/register), so they are denied by default
# and may only reach their own portal, account and notification endpoints.
CANDIDATE_ALLOWED_PREFIXES = ("/v1/portal/", "/v1/auth/", "/v1/users/me", "/v1/notifications")


def _candidate_may_access(path: str) -> bool:
    return path.startswith(CANDIDATE_ALLOWED_PREFIXES)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate access token and return the authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Check if TenantMiddleware already decoded the JWT token
    user_id = getattr(request.state, "user_id", None)
    impersonator_id = getattr(request.state, "impersonator_id", None)
    impersonation_sid = getattr(request.state, "impersonation_sid", None)

    if user_id is None:
        if not credentials:
            logger.debug("No credentials found in Authorization header")
            raise credentials_exception

        try:
            payload = decode_access_token(credentials.credentials)
            user_id = payload.get("sub")
            if user_id is None:
                logger.debug("sub is missing in payload")
                raise credentials_exception
            impersonator_id = payload.get("impersonator_id")
            impersonation_sid = payload.get("imp_sid")
            # Cache values on request.state for downstream routers or middleware
            request.state.user_id = user_id
            request.state.org_id = payload.get("org")
            request.state.impersonator_id = impersonator_id
            request.state.impersonation_sid = impersonation_sid
        except JWTError as e:
            logger.debug(f"JWT decode failed: {str(e)}")
            raise credentials_exception

    try:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if user is None:
            logger.debug(f"User with ID {user_id} not found in DB")
            raise credentials_exception
        if not user.is_active:
            logger.debug(f"User {user_id} is inactive")
            raise credentials_exception
        if user.role != UserRole.SUPER_ADMIN.value and user.organization_id:
            org_active = await db.scalar(
                select(Organization.is_active).where(Organization.id == user.organization_id)
            )
            if org_active is False:
                raise HTTPException(status_code=403, detail="Your organization's account is suspended.")
        if user.role == UserRole.CANDIDATE.value and not _candidate_may_access(request.url.path):
            raise HTTPException(status_code=403, detail="This area is for the hiring team.")
        if impersonator_id:
            # Live session, not view-only-blocked; binds it for audit recording.
            await impersonation.resolve(db, request, user, impersonator_id, impersonation_sid)
        user.is_impersonating = bool(impersonator_id)
        user.impersonator_id = impersonator_id
        # AI calls made while serving this request are charged to this
        # user's organization and credit limit (app/services/ai_metering.py).
        bind_request_scope(user.organization_id, user.id, user.role)
    except HTTPException:
        raise  # re-raise 401/403 as-is, don't swallow them
    except Exception as db_err:
        logger.error(f"DB lookup failed: {str(db_err)}", exc_info=True)  # use ERROR not DEBUG
        raise HTTPException(status_code=500, detail="Internal server error")

    return user


# ── Role dependencies ──────────────────────────────────────────────────────────

def require_roles(*roles: UserRole):
    """Factory: returns a dependency that checks the user has one of the given roles."""
    async def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in {r.value for r in roles}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {[r.value for r in roles]}",
            )
        return current_user
    return _check


async def require_recruiter(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role not in {r.value for r in RECRUITER_ROLES}:
        raise HTTPException(status_code=403, detail="Recruiter or Admin access required")
    return current_user


async def require_interviewer_or_above(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role not in {r.value for r in INTERVIEWER_ROLES}:
        raise HTTPException(status_code=403, detail="Interviewer or above access required")
    return current_user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role not in {r.value for r in ADMIN_ONLY}:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_super_admin(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    from app.services.platform_security import super_admin_ip_blocked

    if current_user.role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    if await super_admin_ip_blocked(db, request):
        raise HTTPException(status_code=403, detail="Super admin access is not allowed from this network.")
    return current_user


# ── Integration keys (machine clients such as n8n) ─────────────────────────────

INTEGRATION_KEY_HEADER = "X-Hybent-Key"
# Writing last_used_at on every call would turn each read into a write.
_LAST_USED_RESOLUTION = timedelta(minutes=5)


@dataclass(frozen=True)
class IntegrationPrincipal:
    key_pk: uuid.UUID
    key_id: str
    name: str
    organization_id: uuid.UUID
    scopes: frozenset[str]


def _integration_error(status_code: int, message: str, error_code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"message": message, "error_code": error_code})


async def get_integration_principal(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IntegrationPrincipal:
    """Authenticate an integration key. The organization comes from the key
    alone, so a caller can never act for another org by naming it."""
    if not settings.integrations_enabled:
        raise _integration_error(503, "Integrations are disabled.", "INTEGRATIONS_DISABLED")

    parsed = parse_key(request.headers.get(INTEGRATION_KEY_HEADER))
    invalid = _integration_error(401, "Invalid or missing integration key.", "INVALID_KEY")
    if parsed is None:
        raise invalid

    row = (await db.execute(
        select(IntegrationKey, Organization.is_active)
        .join(Organization, Organization.id == IntegrationKey.organization_id)
        .where(IntegrationKey.key_id == parsed.key_id)
    )).one_or_none()
    if row is None:
        raise invalid
    key, org_active = row
    now = datetime.now(timezone.utc)
    if not secret_matches(parsed.secret, key.secret_hash) or not key.is_usable(now) or not org_active:
        raise invalid

    if key.last_used_at is None or now - key.last_used_at > _LAST_USED_RESOLUTION:
        key.last_used_at = now
        await db.commit()

    request.state.org_id = str(key.organization_id)
    request.state.integration_key_id = key.key_id
    # AI used by an integration call is charged to the key's organization.
    bind_request_scope(key.organization_id, None, "integration")
    return IntegrationPrincipal(key.id, key.key_id, key.name, key.organization_id, frozenset(key.scopes or ()))


def require_scopes(*scopes: str):
    """Factory: an integration principal that holds every one of `scopes`."""
    async def _check(
        principal: Annotated[IntegrationPrincipal, Depends(get_integration_principal)],
    ) -> IntegrationPrincipal:
        missing = [s for s in scopes if s not in principal.scopes]
        if missing:
            raise _integration_error(403, f"This key lacks the scope(s): {', '.join(missing)}.", "SCOPE_MISSING")
        return principal
    return _check


# Type aliases
Integration = Annotated[IntegrationPrincipal, Depends(get_integration_principal)]
CurrentUser = Annotated[User, Depends(get_current_user)]
RecruiterUser = Annotated[User, Depends(require_recruiter)]
InterviewerUser = Annotated[User, Depends(require_interviewer_or_above)]
AdminUser = Annotated[User, Depends(require_admin)]
SuperAdminUser = Annotated[User, Depends(require_super_admin)]
DB = Annotated[AsyncSession, Depends(get_db)]
