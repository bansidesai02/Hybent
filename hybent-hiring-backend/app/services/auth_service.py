"""
Authentication service: register, login, token refresh, logout.
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.models.organization import Organization
from app.models.user import User, RefreshToken
from app.schemas.auth import RegisterRequest, LoginRequest, UserOut
from app.utils.permissions import UserRole
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token


async def register_user(data: RegisterRequest, db: AsyncSession) -> dict:
    """Create a new organization and admin user."""
    # Check email uniqueness
    existing = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where(User.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check slug uniqueness
    slug_check = await db.execute(
        select(Organization).where(Organization.slug == data.organization_slug)
    )
    if slug_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Organization slug already taken")

    # Create organization
    org = Organization(
        name=data.organization_name,
        slug=data.organization_slug,
    )
    db.add(org)
    await db.flush()  # get org.id

    # Create admin user
    user = User(
        organization_id=org.id,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.ADMIN,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    # Issue tokens
    access_token = create_access_token({"sub": str(user.id), "org": str(org.id), "role": user.role})
    refresh_tok = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_tok,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))

    return {
        "access_token": access_token,
        "refresh_token": refresh_tok,
        "token_type": "bearer",
    }


async def login_user(data: LoginRequest, db: AsyncSession) -> dict:
    """Authenticate user and issue tokens."""
    result = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where(User.email == data.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # Update last login
    user.last_login = datetime.now(timezone.utc)

    access_token = create_access_token({"sub": str(user.id), "org": str(user.organization_id), "role": user.role})
    refresh_tok = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_tok,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))

    return {
        "access_token": access_token,
        "refresh_token": refresh_tok,
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    }


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


async def google_authenticate(token: str, db: AsyncSession) -> dict:
    """
    Authenticate user via Google OAuth 2.0.
    Links existing user or registers a new account automatically with provider="google".
    """
    import re
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
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Please contact support.",
            )

        # Update google_id if missing
        if not user.google_id and google_id:
            user.google_id = google_id

        # Update profile picture if user doesn't have an avatar
        if not user.avatar_url and picture:
            user.avatar_url = picture

        user.is_verified = True
    else:
        # User does not exist, create new organization & user
        domain = email.split("@")[-1].split(".")[0].replace("-", " ")
        org_name = f"{domain.capitalize()} Workspace" if domain and domain not in ["gmail", "yahoo", "hotmail", "outlook"] else f"{full_name.split()[0]}'s Workspace"

        raw_slug = re.sub(r"[^a-z0-9-]", "", org_name.lower().replace(" ", "-"))
        slug = raw_slug or "organization"

        # Check slug collision
        slug_check = await db.execute(select(Organization).where(Organization.slug == slug))
        if slug_check.scalar_one_or_none():
            import uuid
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"

        org = Organization(
            name=org_name,
            slug=slug,
        )
        db.add(org)
        await db.flush()

        user = User(
            organization_id=org.id,
            organization=org,
            email=email,
            full_name=full_name,
            hashed_password=None,
            google_id=google_id,
            provider="google",
            avatar_url=picture,
            role=UserRole.ADMIN,
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        await db.flush()

    # Update last login
    user.last_login = datetime.now(timezone.utc)

    # Re-query user with organization loaded if needed
    if user.organization_id and "organization" not in user.__dict__:
        org_res = await db.execute(select(Organization).where(Organization.id == user.organization_id))
        user.organization = org_res.scalar_one_or_none()

    access_token = create_access_token({"sub": str(user.id), "org": str(user.organization_id), "role": user.role})
    refresh_tok = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_tok,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))

    return {
        "access_token": access_token,
        "refresh_token": refresh_tok,
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    }

