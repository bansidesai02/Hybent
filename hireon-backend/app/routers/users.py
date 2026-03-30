import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.dependencies import DB, CurrentUser, AdminUser, RecruiterUser
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserOut, ProfileUpdateRequest
from app.services.storage_service import save_avatar
from app.utils.permissions import UserRole
from app.utils.security import hash_password
from pydantic import BaseModel
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/users", tags=["users"])


class UserInvite(BaseModel):
    email: str
    full_name: str
    role: UserRole
    password: str = "TempPass@123"


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


@router.get("", response_model=list[UserOut])
async def list_users(current_user: RecruiterUser, db: DB):
    result = await db.execute(
        select(User).where(User.organization_id == current_user.organization_id)
    )
    users = result.scalars().all()
    # Debug log to investigate why team members might not show up
    import logging
    print(f"DEBUG: Listing users for org {current_user.organization_id}: found {len(users)}")
    return APIResponse.success(message="Users retrieved successfully.", data=[UserOut.model_validate(u) for u in users])


from app.services.email_service import send_email

@router.post("/invite", response_model=UserOut, status_code=201)
async def invite_user(data: UserInvite, current_user: AdminUser, db: DB):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Ensure role is saved as a clean string value
    role_str = data.role.value if hasattr(data.role, 'value') else str(data.role)
    
    user = User(
        organization_id=current_user.organization_id,
        email=data.email,
        full_name=data.full_name,
        role=role_str,
        hashed_password=hash_password(data.password),
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    
    # Send invite email
    from app.services.email_service import send_team_invite
    import os
    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    send_team_invite(
        to_email=user.email,
        to_name=user.full_name,
        invited_by=current_user.full_name,
        company_name="HireOn",
        role=role_str,
        password=data.password,
        login_url=f"{frontend_base}/login"
    )
    
    return APIResponse.success(message="User invited successfully.", data=UserOut.model_validate(user))


# ── My Profile endpoints — MUST be defined BEFORE /{user_id} wildcard ─────────
# FastAPI matches routes top-to-bottom. If /{user_id} is first, calling
# PUT /me would match it with user_id="me" (not a UUID) → 422 error.

def _user_out_with_org(user: User) -> UserOut:
    """Build UserOut including organization_name from the loaded relationship."""
    data = UserOut.model_validate(user)
    if hasattr(user, 'organization') and user.organization:
        data.organization_name = user.organization.name
    return data


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: CurrentUser, db: DB):
    """Get the authenticated user's own profile, including organization name."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.organization))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()
    return APIResponse.success(
        message="Profile retrieved successfully.",
        data=_user_out_with_org(user)
    )


@router.put("/me", response_model=UserOut)
async def update_my_profile(data: ProfileUpdateRequest, current_user: CurrentUser, db: DB):
    """
    Update profile. All roles: full_name, avatar_url, phone.
    Admin only: email, role, organization_name.
    Always commits so changes persist after page refresh.
    """
    # Fields editable by all roles
    if data.full_name is not None:
        current_user.full_name = data.full_name.strip()
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    if data.phone is not None:
        current_user.phone = data.phone.strip()

    # Fields editable by admin only
    # Robust check for admin role (handles string, enum, and UserRole objects)
    role_val = str(current_user.role).lower().strip()
    is_admin = role_val == "admin" or role_val == "userrole.admin"

    if is_admin:
        if data.email is not None:
            # Check no other user uses this email
            existing = await db.execute(
                select(User).where(User.email == data.email.strip(), User.id != current_user.id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Email already in use by another account.")
            current_user.email = data.email.strip()
        
        if data.role is not None:
            current_user.role = data.role.strip()
            
        if data.organization_name is not None:
            # Load organization relationship if not already present
            from sqlalchemy import update
            await db.execute(
                update(Organization)
                .where(Organization.id == current_user.organization_id)
                .values(name=data.organization_name.strip())
            )
            # Help SQLAlchemy session stay in sync
            await db.flush()

    await db.commit()

    # Re-fetch with org for the response
    result = await db.execute(
        select(User)
        .options(selectinload(User.organization))
        .where(User.id == current_user.id)
    )
    updated_user = result.scalar_one()
    return APIResponse.success(
        message="Profile updated successfully.",
        data=_user_out_with_org(updated_user)
    )


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(current_user: CurrentUser, db: DB, file: UploadFile = File(...)):
    """Upload a new avatar image for the current user."""
    url = await save_avatar(file, str(current_user.id))
    current_user.avatar_url = url
    await db.commit()
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == current_user.id)
    )
    updated_user = result.scalar_one()
    return APIResponse.success(message="Avatar uploaded successfully.", data=_user_out_with_org(updated_user))


# ── Admin: update any user by ID — wildcard MUST stay after /me above ─────────

@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: uuid.UUID, data: UserUpdate, current_user: AdminUser, db: DB):
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == current_user.organization_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return APIResponse.success(message="User updated successfully.", data=UserOut.model_validate(user))
