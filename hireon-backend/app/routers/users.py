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
    users = result.scalars().all()
    # Debug log to investigate why team members might not show up
    import logging
    print(f"DEBUG: Listing users for org {current_user.organization_id}: found {len(users)}")
    return [UserOut.model_validate(u) for u in users]


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
    import os
    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:3000")
    login_url = f"{frontend_base}/login"
    
    # Capitalize role for display
    display_role = role_str.replace('_', ' ').title()
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Inter', -apple-system, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }}
            .wrapper {{ padding: 60px 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.04); border: 1px solid #edf2f7; }}
            .header {{ background: linear-gradient(135deg, #6c47ff, #8b5cf6); padding: 50px 40px; text-align: center; color: white; }}
            .content {{ padding: 50px 48px; color: #334155; line-height: 1.7; }}
            .btn {{ display: inline-block; padding: 18px 36px; background: #6c47ff; color: #ffffff !important; text-decoration: none !important; border-radius: 14px; font-weight: 700; margin-top: 32px; box-shadow: 0 8px 25px rgba(108, 71, 255, 0.3); font-size: 16px; text-align: center; }}
            .creds-box {{ background: #f8fafc; padding: 28px; border-radius: 18px; margin: 32px 0; border: 1px solid #f1f5f9; }}
            .role-pill {{ display: inline-block; padding: 6px 16px; background: rgba(108, 71, 255, 0.08); color: #6c47ff; border-radius: 99px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; border: 1px solid rgba(108, 71, 255, 0.1); }}
            .footer {{ padding: 32px; text-align: center; font-size: 12px; color: #94a3b8; background: #fafafa; border-top: 1px solid #f1f5f9; }}
        </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -1.5px; color: white;">HireOn</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px; color: white;">The Future of Intelligent Hiring</p>
            </div>
            <div class="content">
                <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 26px; font-weight: 800;">Join the internal team</h2>
                <p>Hi <strong>{user.full_name}</strong>,</p>
                <p>You've been invited by <strong>{current_user.full_name}</strong> to join <strong>HireOn</strong>. You'll be joining us as an:</p>
                
                <div style="margin: 20px 0;">
                    <span class="role-pill">{display_role}</span>
                </div>
                
                <div class="creds-box">
                    <p style="margin: 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Your Access Credentials</p>
                    <p style="margin: 0; font-size: 15px; color: #1e293b;">Email: <strong style="color: #6c47ff;">{user.email}</strong></p>
                    <p style="margin: 6px 0 0 0; font-size: 22px; font-weight: 800; color: #0f172a;">Password: {data.password}</p>
                </div>

                <div style="text-align: center;">
                    <a href="{login_url}" class="btn">Complete Your Setup</a>
                </div>

                <p style="margin-top: 40px; font-size: 13px; color: #94a3b8; font-style: italic;">
                    Please change your temporary password once you log in for the first time.
                </p>
            </div>
            <div class="footer">
                &copy; 2026 HireOn AI Platform. Helping great teams hire great people.
            </div>
        </div>
      </div>
    </body>
    </html>
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
