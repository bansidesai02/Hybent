"""
FastAPI dependencies: DB session, current user, role guards.
"""
import uuid
import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.utils.permissions import UserRole, RECRUITER_ROLES, INTERVIEWER_ROLES, ADMIN_ONLY
from app.utils.security import decode_access_token

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


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
            # Cache values on request.state for downstream routers or middleware
            request.state.user_id = user_id
            request.state.org_id = payload.get("org")
            request.state.impersonator_id = impersonator_id
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
        user.is_impersonating = bool(impersonator_id)
        user.impersonator_id = impersonator_id
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
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user


# Type aliases
CurrentUser = Annotated[User, Depends(get_current_user)]
RecruiterUser = Annotated[User, Depends(require_recruiter)]
InterviewerUser = Annotated[User, Depends(require_interviewer_or_above)]
AdminUser = Annotated[User, Depends(require_admin)]
SuperAdminUser = Annotated[User, Depends(require_super_admin)]
DB = Annotated[AsyncSession, Depends(get_db)]
