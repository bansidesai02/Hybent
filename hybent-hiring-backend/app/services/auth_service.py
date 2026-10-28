"""
Authentication service: register, login, token refresh, logout.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.models.organization import Organization
from app.models.user import User, RefreshToken
from app.schemas.auth import RegisterRequest, LoginRequest, UserOut
from app.utils.permissions import UserRole
from app.utils.security import verify_password, create_access_token, create_refresh_token
from app.services import platform_security, trial_service


async def register_user(data: RegisterRequest, db: AsyncSession) -> dict:
    """
    Public self-serve registration is disabled — the platform is invite-only.
    New organizations are provisioned by a super admin
    (POST /v1/super-admin/clients, see app/routers/super_admin.py), and new
    teammates inside an existing org are added via POST /v1/users/invite.
    Neither path goes through here, so this endpoint only ever rejects.
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Public registration is disabled. Contact your Hybent admin to get an invite.",
    )


async def find_user_by_email(db: AsyncSession, email: str, *options) -> User | None:
    """The account for `email`: an exact match first, otherwise a match that
    ignores letter case, but only when exactly one account fits. Emails keep
    the case they were saved with (EmailStr only lowercases the domain), so
    "Rahul@x.com" and "rahul@x.com" used to be different people to the login
    and forgot-password forms."""
    user = (await db.execute(select(User).options(*options).where(User.email == email))).scalar_one_or_none()
    if user:
        return user
    matches = (await db.execute(
        select(User).options(*options).where(func.lower(User.email) == email.lower()).limit(2)
    )).scalars().all()
    return matches[0] if len(matches) == 1 else None


def ensure_org_active(user: User) -> None:
    """Reject sign-in for members of a suspended organization (super admins exempt)."""
    if user.role == "super_admin":
        return
    org = user.__dict__.get("organization")
    if org is not None and not org.is_active:
        raise HTTPException(status_code=403, detail="Your organization's account is suspended. Please contact support.")


async def _reject(
    db: AsyncSession, *, status_code: int, detail: str, email: str, method: str,
    request: Request | None, user: User | None = None, reason: str,
):
    """Record the failed attempt (committed, so the raise doesn't roll it back) and refuse."""
    await platform_security.record_login_event(
        db, email=email, method=method, success=False, request=request,
        user=user, reason=reason, commit=True,
    )
    raise HTTPException(status_code=status_code, detail=detail)


async def _complete_sign_in(user: User, db: AsyncSession, method: str, request: Request | None) -> dict:
    """Checks every sign-in path shares once the first factor passed: account
    and organization status, the super admin IP allow-list, then either a
    2FA challenge or a session."""
    if not user.is_active:
        await _reject(db, status_code=403, detail="Account is deactivated. Please contact support.",
                      email=user.email, method=method, request=request, user=user, reason="user_suspended")
    try:
        ensure_org_active(user)
    except HTTPException as e:
        await _reject(db, status_code=e.status_code, detail=e.detail,
                      email=user.email, method=method, request=request, user=user, reason="org_suspended")
    # After a free trial ends only its admins sign in, to upgrade or export.
    if (
        user.role not in (UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value)
        and await trial_service.trial_access(db, user.organization_id) == "expired"
    ):
        await _reject(db, status_code=403, detail=trial_service.EXPIRED_MEMBER_DETAIL["message"],
                      email=user.email, method=method, request=request, user=user, reason="trial_expired")
    if user.role == UserRole.SUPER_ADMIN.value and await platform_security.super_admin_ip_blocked(db, request):
        await _reject(db, status_code=403, detail="Super admin sign-in is not allowed from this network.",
                      email=user.email, method=method, request=request, user=user, reason="ip_not_allowed")

    if method != "otp" and user.role in platform_security.MFA_ROLES:
        sec = await platform_security.get_security_settings(db)
        if sec["require_2fa"]:
            await platform_security.issue_mfa_code(db, user)
            await platform_security.record_login_event(
                db, email=user.email, method=method, success=False, request=request,
                user=user, reason="mfa_required",
            )
            return {
                "mfa_required": True,
                "mfa_token": platform_security.create_mfa_token(user.id, method),
                "email": user.email,
            }

    return await _issue_session(user, db, method, request)


async def _issue_session(user: User, db: AsyncSession, method: str, request: Request | None) -> dict:
    user.last_login = datetime.now(timezone.utc)
    access_token = create_access_token({"sub": str(user.id), "org": str(user.organization_id), "role": user.role})
    refresh_tok = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_tok,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))
    await platform_security.record_login_event(
        db, email=user.email, method=method, success=True, request=request, user=user,
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_tok,
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    }


async def login_user(data: LoginRequest, db: AsyncSession, request: Request | None = None) -> dict:
    """Authenticate user and issue tokens (or a 2FA challenge)."""
    user = await find_user_by_email(db, data.email, joinedload(User.organization))

    if not user or not verify_password(data.password, user.hashed_password):
        await _reject(db, status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password",
                      email=data.email, method="password", request=request, user=user,
                      reason="bad_credentials")
    return await _complete_sign_in(user, db, "password", request)


_EXPIRED = "Your sign-in attempt expired. Please sign in again."


async def verify_mfa(mfa_token: str, code: str, db: AsyncSession, request: Request | None = None) -> dict:
    """Second step of a 2FA sign-in: the challenge token from step one plus the emailed code."""
    claims = platform_security.decode_mfa_token(mfa_token or "")
    if not claims:
        raise HTTPException(status_code=401, detail=_EXPIRED)
    user = (await db.execute(
        select(User).options(joinedload(User.organization)).where(User.id == uuid.UUID(claims["sub"]))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail=_EXPIRED)
    if await platform_security.mfa_attempts_exhausted(db, user.id):
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Please sign in again in a few minutes.")
    if not code or not await platform_security.consume_mfa_code(db, user.id, code):
        await _reject(db, status_code=400, detail="Invalid or expired code.",
                      email=user.email, method="otp", request=request, user=user, reason="bad_otp")
    return await _complete_sign_in(user, db, "otp", request)


async def resend_mfa(mfa_token: str, db: AsyncSession) -> None:
    claims = platform_security.decode_mfa_token(mfa_token or "")
    if not claims:
        raise HTTPException(status_code=401, detail=_EXPIRED)
    user = await db.get(User, uuid.UUID(claims["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail=_EXPIRED)
    await platform_security.issue_mfa_code(db, user)


async def refresh_access_token(refresh_tok: str, db: AsyncSession) -> dict:
    """Rotate refresh token and issue new access token."""
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == refresh_tok,
            RefreshToken.is_revoked == False,
        )
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj or token_obj.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Revoke old token (rotation)
    token_obj.is_revoked = True

    sec = await platform_security.get_security_settings(db)
    if sec["session_timeout"] and platform_security.refresh_is_stale(token_obj.created_at):
        await db.commit()
        raise HTTPException(status_code=401, detail="Your session timed out. Please sign in again.")

    # Get user
    user_result = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where(User.id == token_obj.user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=403, detail="Account has been deleted")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account has been deactivated")
    ensure_org_active(user)

    # Issue new tokens
    new_access = create_access_token({"sub": str(user.id), "org": str(user.organization_id), "role": user.role})
    new_refresh = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=new_refresh,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


async def logout_user(refresh_tok: str, db: AsyncSession) -> None:
    """Revoke the given refresh token."""
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == refresh_tok))
    token_obj = result.scalar_one_or_none()
    if token_obj:
        token_obj.is_revoked = True


async def verify_google_token(raw_token: str) -> dict:
    """
    Verify Google OAuth token (ID token or Access token).
    Returns dict with keys: google_id, email, full_name, picture.
    """
    import httpx
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    if not raw_token or not raw_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token is required.",
        )

    clean_token = raw_token.strip()

    # 1. Attempt Google ID Token verification using official google-auth library
    if settings.google_client_id:
        try:
            id_info = google_id_token.verify_oauth2_token(
                clean_token,
                google_requests.Request(),
                settings.google_client_id,
            )
            issuer = id_info.get("iss", "")
            if issuer in ["accounts.google.com", "https://accounts.google.com"]:
                email = id_info.get("email")
                if email and id_info.get("email_verified", True):
                    return {
                        "google_id": id_info.get("sub"),
                        "email": email.lower(),
                        "full_name": id_info.get("name") or id_info.get("given_name") or email.split("@")[0],
                        "picture": id_info.get("picture"),
                    }
        except Exception:
            pass  # Fallback to userinfo API for access tokens

    # 2. Fallback to Google UserInfo API (for Access Tokens)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {clean_token}"},
                timeout=10.0,
            )
            if resp.status_code == 200:
                info = resp.json()
                email = info.get("email")
                if email:
                    return {
                        "google_id": info.get("sub"),
                        "email": email.lower(),
                        "full_name": info.get("name") or info.get("given_name") or email.split("@")[0],
                        "picture": info.get("picture"),
                    }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to communicate with Google authentication services: {str(e)}",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired Google authentication token.",
    )


async def google_authenticate(token: str, db: AsyncSession, request: Request | None = None) -> dict:
    """
    Authenticate user via Google OAuth 2.0.
    Links existing user or registers a new account automatically with provider="google".
    """
    profile = await verify_google_token(token)

    google_id = profile["google_id"]
    email = profile["email"]
    full_name = profile["full_name"]
    picture = profile["picture"]

    # Check if user exists by email or google_id
    result = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where((User.email == email) | (User.google_id == google_id))
    )
    user = result.scalar_one_or_none()

    if user:
        # Update google_id if missing
        if not user.google_id and google_id:
            user.google_id = google_id

        # Update profile picture if user doesn't have an avatar
        if not user.avatar_url and picture:
            user.avatar_url = picture

        user.is_verified = True
    else:
        # The platform is invite-only: an unrecognized Google account does not
        # get to provision itself a new organization + admin. New orgs come
        # from a super admin (POST /v1/super-admin/clients); new teammates
        # inside an existing org come from POST /v1/users/invite.
        await _reject(
            db, status_code=status.HTTP_403_FORBIDDEN,
            detail="No account found for this email. Ask your organization admin to invite you, or contact Hybent to set up your organization.",
            email=email, method="google", request=request, reason="no_account",
        )

    # Re-query user with organization loaded if needed
    if user.organization_id and "organization" not in user.__dict__:
        org_res = await db.execute(select(Organization).where(Organization.id == user.organization_id))
        user.organization = org_res.scalar_one_or_none()
    return await _complete_sign_in(user, db, "google", request)

