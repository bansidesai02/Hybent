import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload
from app.dependencies import DB, CurrentUser, AdminUser, RecruiterUser
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserOut, ProfileUpdateRequest
from app.services.storage_service import save_avatar
from app.utils.permissions import UserRole
from app.utils.security import hash_password
from pydantic import BaseModel
from app.schemas.response import APIResponse
from app.services import elasticsearch_service as es_service

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


import time
_users_cache = {}
_users_cache_ttl = 300 # 5 minutes

def invalidate_users_cache(org_id):
    org_id_str = str(org_id)
    if org_id_str in _users_cache:
        del _users_cache[org_id_str]

@router.get("", response_model=list[UserOut])
async def list_users(current_user: RecruiterUser, db: DB):
    now = time.monotonic()
    org_id_str = str(current_user.organization_id)
    if org_id_str in _users_cache:
        data, timestamp = _users_cache[org_id_str]
        if now - timestamp < _users_cache_ttl:
            return APIResponse.success(message="Users retrieved successfully.", data=data)

    result = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where(User.organization_id == current_user.organization_id)
    )
    users = result.scalars().all()
    # Debug log to investigate why team members might not show up
    import logging
    print(f"DEBUG: Listing users for org {current_user.organization_id}: found {len(users)}")
    
    out_data = [UserOut.model_validate(u) for u in users]
    _users_cache[org_id_str] = (out_data, now)
    return APIResponse.success(message="Users retrieved successfully.", data=out_data)


from app.services.email_service import send_email

@router.post("/invite", response_model=UserOut, status_code=201)
async def invite_user(data: UserInvite, current_user: AdminUser, db: DB, background_tasks: BackgroundTasks):
    existing = await db.execute(
        select(User).where(
            User.email == data.email,
            User.organization_id == current_user.organization_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email is already registered in your organization.")
    
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

    # ── Commit user FIRST so they are saved even if email fails ──────────────
    await db.commit()
    await db.refresh(user)

    # Send invite email (non-fatal — user is already saved above)
    from app.services.email_service import send_team_invite
    import os
    import logging
    logger = logging.getLogger(__name__)

    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:3000")

    org_res = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = org_res.scalar_one_or_none()
    company_name = org.name if org else "HireOn"

    try:
        send_team_invite(
            to_email=user.email,
            to_name=user.full_name,
            invited_by=current_user.full_name,
            company_name=company_name,
            role=role_str,
            password=data.password,
            login_url=f"{frontend_base}/login",
            org_logo_url=org.logo_url if org else None,
        )
    except Exception as e:
        logger.warning(f"Invite email failed for {user.email} (user still created): {e}")
    
    background_tasks.add_task(es_service.index_user, user)
    invalidate_users_cache(current_user.organization_id)
    return APIResponse.success(message="User invited successfully.", data=UserOut.model_validate(user))


# ── My Profile endpoints — MUST be defined BEFORE /{user_id} wildcard ─────────
# FastAPI matches routes top-to-bottom. If /{user_id} is first, calling
# PUT /me would match it with user_id="me" (not a UUID) → 422 error.

async def _user_out_with_org(user: User, db: AsyncSession) -> UserOut:
    """Build UserOut including organization_name and candidate_id for portal users."""
    data = UserOut.model_validate(user)
    
    # Add organization name
    if hasattr(user, 'organization') and user.organization:
        data = data.model_copy(update={'organization_name': user.organization.name})
    
    # Add candidate ID if it's a candidate role
    role_val = str(user.role).lower()
    if 'candidate' in role_val:
        from app.models.candidate import Candidate
        res = await db.execute(select(Candidate.id).where(Candidate.user_id == user.id))
        c_id = res.scalar_one_or_none()
        if c_id:
            data = data.model_copy(update={'candidate_id': str(c_id)})
            
    return data


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: CurrentUser, db: DB):
    """Get the authenticated user's own profile, including organization name."""
    result = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()
    return APIResponse.success(
        message="Profile retrieved successfully.",
        data=await _user_out_with_org(user, db)
    )


@router.put("/me", response_model=UserOut)
async def update_my_profile(data: ProfileUpdateRequest, current_user: CurrentUser, db: DB, background_tasks: BackgroundTasks):
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
    if data.recovery_email is not None:
        current_user.recovery_email = data.recovery_email.strip()

    # Fields editable by Admin & Recruiter
    role_val = str(current_user.role).lower().strip()
    is_admin = role_val == "admin" or "admin" in role_val
    is_recruiter = role_val == "recruiter" or "recruiter" in role_val
    is_privileged = is_admin or is_recruiter

    if is_privileged and data.organization_name is not None:
        # Re-fetch organization to ensure it's in the session and editable
        result = await db.execute(
            select(Organization).where(Organization.id == current_user.organization_id)
        )
        org = result.scalar_one_or_none()
        if org and data.organization_name.strip():  # Only update if non-empty
            org.name = data.organization_name.strip()
            db.add(org)
            await db.flush() # Ensure org update is sent to DB before user commit

    # Fields editable by admin only
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

    # Save user_id BEFORE commit — after commit(), SQLAlchemy auto-expires all
    # session objects, so accessing current_user.id afterward triggers a sync
    # lazy-load which raises MissingGreenlet in an async context.
    user_id = current_user.id

    await db.commit()

    # Re-fetch with fresh org data for the response
    result = await db.execute(
        select(User)
        .options(joinedload(User.organization))
        .where(User.id == user_id)
    )
    updated_user = result.scalar_one()
    background_tasks.add_task(es_service.index_user, updated_user)
    invalidate_users_cache(current_user.organization_id)
    return APIResponse.success(
        message="Profile updated successfully.",
        data=await _user_out_with_org(updated_user, db)
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
    return APIResponse.success(message="Avatar uploaded successfully.", data=await _user_out_with_org(updated_user, db))


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(current_user: CurrentUser, db: DB):
    """Remove the current user's avatar."""
    current_user.avatar_url = None
    await db.commit()
    result = await db.execute(
        select(User).options(selectinload(User.organization)).where(User.id == current_user.id)
    )
    updated_user = result.scalar_one()
    return APIResponse.success(message="Avatar removed successfully.", data=await _user_out_with_org(updated_user, db))





# ── Admin: update any user by ID — wildcard MUST stay after /me above ─────────

@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: uuid.UUID, data: UserUpdate, current_user: AdminUser, db: DB, background_tasks: BackgroundTasks):
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
    background_tasks.add_task(es_service.index_user, user)
    invalidate_users_cache(current_user.organization_id)
    return APIResponse.success(message="User updated successfully.", data=UserOut.model_validate(user))


@router.delete("/{user_id}", response_model=UserOut)
async def delete_user(user_id: uuid.UUID, current_user: AdminUser, db: DB, background_tasks: BackgroundTasks):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == current_user.organization_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Optional: Delete from ES
    background_tasks.add_task(es_service.delete_from_index, "users", str(user.id))
    
    await db.delete(user)
    await db.commit()
    invalidate_users_cache(current_user.organization_id)
    return APIResponse.success(message="User deleted successfully.", data=UserOut.model_validate(user))


from datetime import datetime, timezone

class DesignationOrderUpdate(BaseModel):
    order: list[str]


@router.put("/{user_id}/designation-order")
async def update_designation_order(
    user_id: uuid.UUID,
    data: DesignationOrderUpdate,
    current_user: CurrentUser,
    db: DB,
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update preferences for this user")
    
    from app.models.user_preference import UserPreference
    res = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    preference = res.scalar_one_or_none()
    
    if not preference:
        preference = UserPreference(
            id=uuid.uuid4(),
            user_id=user_id,
            designation_order=data.order,
            updated_at=datetime.now(timezone.utc)
        )
        db.add(preference)
    else:
        preference.designation_order = data.order
        preference.updated_at = datetime.now(timezone.utc)
        
    await db.commit()
    return APIResponse.success(message="Designation order saved.", data={"order": preference.designation_order})


@router.get("/{user_id}/designation-order")
async def get_designation_order(
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access preferences for this user")
        
    from app.models.user_preference import UserPreference
    res = await db.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    preference = res.scalar_one_or_none()
    
    order = preference.designation_order if preference else []
    return APIResponse.success(message="Designation order retrieved.", data={"order": order})

