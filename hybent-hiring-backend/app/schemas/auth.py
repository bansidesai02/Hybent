from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.utils.permissions import UserRole
from app.schemas.base import OrmSchema


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    organization_name: str
    organization_slug: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("organization_slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(OrmSchema):
    id: str
    email: str
    full_name: str
    role: UserRole
    organization_id: str
    organization_name: str | None = None
    avatar_url: str | None = None
    phone: str | None = None
    recovery_email: str | None = None
    is_active: bool
    is_calendar_connected: bool = False
    candidate_id: str | None = None
    created_at: datetime | None = None
    last_login: datetime | None = None


class ProfileUpdateRequest(BaseModel):
    """Payload for PUT /v1/users/me.
    All roles: full_name, avatar_url, phone.
    Admin only: email, role, organization_name.
    """
    full_name: str | None = None
    avatar_url: str | None = None
    phone: str | None = None
    recovery_email: str | None = None
    # Admin-only fields (enforced in router)
    email: str | None = None
    role: str | None = None
    organization_name: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
