from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Body, Depends
from sqlalchemy import func, select, update
from app.dependencies import DB, CurrentUser
from app.schemas.auth import RegisterRequest, LoginRequest, GoogleAuthRequest, RefreshRequest, UserOut, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.response import APIResponse
from app.services import auth_service, invitation_service
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.models.user import User, RefreshToken
from app.models.candidate import Candidate
from app.models.password_reset import PasswordResetToken
from app.models.organization import Organization
from app.core.config import settings as cfg

import re
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

_COOKIE_SECURE = cfg.is_production
_COOKIE_SAMESITE = "none" if _COOKIE_SECURE else "lax"

async def enforce_mfa(user: User):
    from app.utils.permissions import UserRole
    if user.role in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value] and getattr(user, "mfa_enabled", False) is False:
        if cfg.is_production:
            raise HTTPException(status_code=403, detail="MFA is required for administrative roles.")


@router.post("/register", status_code=201)
async def register(data: RegisterRequest, db: DB):
    result = await auth_service.register_user(data, db)
    return APIResponse.success(message="Account created successfully.", data=result)


def _sign_in_response(result: dict, response: Response, message: str):
    """A session (refresh cookie + tokens) or, with 2FA on, the challenge for step two."""
    if result.get("mfa_required"):
        return APIResponse.success(
            message="Enter the code we emailed you.",
            data={"mfa_required": True, "mfa_token": result["mfa_token"], "email": result["email"]},
        )
    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=30 * 24 * 3600,
        path="/v1/auth/refresh",
    )
    return APIResponse.success(
        message=message,
        data={
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "user": result.get("user"),
        },
    )


@router.post("/login")
async def login(data: LoginRequest, request: Request, response: Response, db: DB):
    result = await auth_service.login_user(data, db, request)
    return _sign_in_response(result, response, "Login successful.")


@router.post("/google")
async def google_login(data: GoogleAuthRequest, request: Request, response: Response, db: DB):
    token = data.id_token or data.token
    if not token:
        raise HTTPException(status_code=400, detail="Google authentication token is required.")
    result = await auth_service.google_authenticate(token, db, request)
    return _sign_in_response(result, response, "Google authentication successful.")


@router.get("/session-policy")
async def session_policy(db: DB):
    """Public: how long the app may sit idle before signing out (null = no limit)."""
    from app.services import platform_security
    sec = await platform_security.get_security_settings(db)
    return APIResponse.success(data={
        "idle_timeout_minutes": platform_security.SESSION_IDLE_MINUTES if sec["session_timeout"] else None,
    })


@router.post("/refresh")
async def refresh(
    db: DB,
    response: Response,
    # Accept from cookie OR body
    body: RefreshRequest | None = None,
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
):
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="No refresh token provided")
    result = await auth_service.refresh_access_token(token, db)
    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=30 * 24 * 3600,
        path="/v1/auth/refresh",
    )
    return APIResponse.success(
        message="Token refreshed successfully.",
        data={
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
        },
    )


@router.post("/logout")
async def logout(
    response: Response,
    db: DB,
    body: RefreshRequest | None = None,
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
):
    token = (body.refresh_token if body else None) or refresh_token_cookie
    if token:
        await auth_service.logout_user(token, db)
    response.delete_cookie("refresh_token")
    return APIResponse.success(message="Logged out successfully.")


@router.get("/features")
async def my_features(current_user: CurrentUser, db: DB):
    """Which switchable features the caller's organization has (super admin → Feature flags)."""
    from app.services import feature_flags
    from app.services.voice_calls import ai_calls_enabled
    flags = await feature_flags.effective_flags(db, current_user.organization_id)
    flags["ai_calls"] = await ai_calls_enabled(db, current_user.organization_id)
    return APIResponse.success(data=flags)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return APIResponse.success(message="User details retrieved.", data=UserOut.model_validate(current_user))


@router.put("/me/password")
async def change_password(data: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return APIResponse.success(message="Password updated successfully.")


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: DB):
    from app.models.password_reset import PasswordResetToken
    from app.services.email_service import send_password_reset_email
    import secrets
    from datetime import timedelta

    user = await auth_service.find_user_by_email(db, data.email)
    # Always return 200 to prevent email enumeration
    if not user or not user.is_active:
        return APIResponse.success(message="If that email exists, a reset link has been sent.")

    # Invalidate old tokens
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used == False)
        .values(is_used=True)
    )

    token = secrets.token_urlsafe(48)
    db.add(PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    ))

    org_res = await db.execute(select(Organization).where(Organization.id == user.organization_id))
    org = org_res.scalar_one_or_none()
    
    reset_url = f"{cfg.frontend_url}/reset-password?token={token}"
    send_password_reset_email(
        to_email=user.email,
        to_name=user.full_name,
        reset_url=reset_url,
        org_logo_url=org.logo_url if org else None,
        org_name=org.name if org else None
    )
    return APIResponse.success(message="If that email exists, a reset link has been sent.")


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: DB):
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == data.token,
            PasswordResetToken.is_used == False,
        )
    )
    token_obj = result.scalar_one_or_none()
    if not token_obj or token_obj.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired.")

    user_result = await db.execute(select(User).where(User.id == token_obj.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")

    user.hashed_password = hash_password(data.new_password)
    token_obj.is_used = True
    # Sign out every existing session: a reset is often because the old
    # password leaked. Access tokens already issued lapse within the hour.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)
        .values(is_revoked=True)
    )
    await db.commit()
    return APIResponse.success(message="Password reset successfully. You can now log in.")


@router.post("/candidate/magic-link")
async def candidate_magic_link(data: ForgotPasswordRequest, db: DB):
    """
    Send a magic link (invitation) to an existing candidate.

    Unknown addresses used to get a stub candidate in whichever organization
    came first in the database, plus an email, so anyone could add people to a
    client's candidate list. They now get the same reply and nothing else.
    """
    sent = "If that email belongs to a candidate, a sign-in link has been sent."

    # The same person can be a candidate at several organizations: prefer the
    # profile already linked to their portal account, then the newest.
    result = await db.execute(
        select(Candidate)
        .where(func.lower(Candidate.email) == data.email.lower())
        .order_by(Candidate.user_id.is_(None), Candidate.created_at.desc())
        .limit(1)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        return APIResponse.success(message=sent)

    # Trigger the invitation flow
    try:
        await invitation_service.create_invitation(
            db=db,
            candidate_id=candidate.id,
            organization_id=candidate.organization_id,
            email=candidate.email,
            full_name=candidate.full_name
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to send magic link: {str(e)}")

    return APIResponse.success(message=sent)


@router.post("/2fa/send")
async def resend_2fa_code(db: DB, body: dict = Body(...)):
    """Email a fresh sign-in code for a pending 2FA challenge (from /login)."""
    await auth_service.resend_mfa(body.get("mfa_token") or "", db)
    return APIResponse.success(message="A new code is on its way.")


@router.post("/2fa/verify")
async def verify_2fa_code(request: Request, response: Response, db: DB, body: dict = Body(...)):
    """Second sign-in step when 2FA is required: challenge token + emailed code.

    The challenge token proves the password (or Google) step passed; a code
    alone never signs anyone in.
    """
    result = await auth_service.verify_mfa(body.get("mfa_token") or "", str(body.get("otp") or ""), db, request)
    return _sign_in_response(result, response, "2FA authentication successful.")

