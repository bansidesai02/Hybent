from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Response, Cookie
from sqlalchemy import select, update
from app.dependencies import DB, CurrentUser
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, UserOut, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.response import APIResponse
from app.services import auth_service, invitation_service
from app.utils.security import hash_password, verify_password
from app.models.user import User
from app.models.candidate import Candidate
from app.models.password_reset import PasswordResetToken
from app.models.organization import Organization
from app.core.config import settings as cfg

router = APIRouter(prefix="/v1/auth", tags=["auth"])

# NOTE: Flip to True in production (HTTPS). Currently False for local HTTP dev.
_COOKIE_SECURE = cfg.is_production


@router.post("/register", status_code=201)
async def register(data: RegisterRequest, db: DB):
    result = await auth_service.register_user(data, db)
    return APIResponse.success(message="Account created successfully.", data=result)


@router.post("/login")
async def login(data: LoginRequest, response: Response, db: DB):
    result = await auth_service.login_user(data, db)
    # Set refresh token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=30 * 24 * 3600,
        path="/v1/auth/refresh",
    )
    return APIResponse.success(
        message="Login successful.",
        data={
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "bearer",
            "user": result.get("user"),
        },
    )


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
        samesite="lax",
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


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return APIResponse.success(message="User details retrieved.", data=UserOut.model_validate(current_user))


@router.put("/me/password")
async def change_password(data: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    return APIResponse.success(message="Password updated successfully.")


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: DB):
    from app.models.password_reset import PasswordResetToken
    from app.services.email_service import send_password_reset_email
    import secrets
    from datetime import timedelta

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
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
    return APIResponse.success(message="Password reset successfully. You can now log in.")


@router.post("/candidate/magic-link")
async def candidate_magic_link(data: ForgotPasswordRequest, db: DB):
    """
    Send a magic link (invitation) to a candidate. 
    If registration is open for new candidates, create a stub profile.
    """
    
    # 1. Check if candidate exists
    result = await db.execute(select(Candidate).where(Candidate.email == data.email))
    candidate = result.scalar_one_or_none()
    
    if not candidate:
        # Create a stub candidate for truly new users
        # For multi-tenant, we pick the first org as default 'host' for public signups
        org_result = await db.execute(select(Organization).limit(1))
        org = org_result.scalar_one_or_none()
        
        if not org:
            raise HTTPException(status_code=500, detail="System configuration error: No organization found.")
            
        candidate = Candidate(
            organization_id=org.id,
            email=data.email,
            full_name=data.email.split('@')[0].capitalize(), # Simple default name
            source="Magic Link Signup",
            skills=[],
            tags=[],
        )
        db.add(candidate)
        await db.flush()

    # 2. Trigger the invitation flow
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

    return APIResponse.success(message="Magic link sent successfully. Please check your inbox.")
