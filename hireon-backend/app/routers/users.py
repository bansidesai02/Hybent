import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlalchemy import select
from app.dependencies import DB, CurrentUser, AdminUser, RecruiterUser
from app.models.user import User
from app.schemas.auth import UserOut
from app.services.storage_service import save_avatar
from app.utils.permissions import UserRole
from app.utils.security import hash_password
from pydantic import BaseModel

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


@router.get("/", response_model=list[UserOut])
async def list_users(current_user: RecruiterUser, db: DB):
    result = await db.execute(
        select(User).where(User.organization_id == current_user.organization_id)
    )
    return [UserOut.model_validate(u) for u in result.scalars().all()]


from app.services.email_service import send_email

@router.post("/invite", response_model=UserOut, status_code=201)
async def invite_user(data: UserInvite, current_user: AdminUser, db: DB):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        organization_id=current_user.organization_id,
        email=data.email,
        full_name=data.full_name,
        role=data.role,
        hashed_password=hash_password(data.password),
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    
    # Send invite email
    login_url = "http://localhost:5173/login"
    html_body = f"""
    <p>Hi {user.full_name},</p>
    <p>You have been invited by {current_user.full_name} to join HireOn as a {user.role.value}.</p>
    <p>Your temporary password is: <strong>{data.password}</strong></p>
    <p><a href="{login_url}">Click here to log in</a></p>
    """
    send_email(user.email, "You've been invited to HireOn!", html_body)
    
    return UserOut.model_validate(user)


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
    return UserOut.model_validate(user)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(current_user: CurrentUser, db: DB, file: UploadFile = File(...)):
    url = await save_avatar(file, str(current_user.id))
    current_user.avatar_url = url
    return UserOut.model_validate(current_user)
