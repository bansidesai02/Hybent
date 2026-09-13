from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.base import OrmSchema


class EmailAccountRead(OrmSchema):
    """Never includes tokens/passwords — those never leave the service layer."""
    id: str
    organization_id: str
    provider: str
    email_address: str
    display_name: str | None = None
    status: str
    is_default: bool
    scope: str
    last_synced_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    # Non-secret SMTP fields — lets the UI pre-fill a reconnect form.
    # Never smtp_password_encrypted / refresh_token_encrypted / access_token_encrypted.
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None


class EmailAccountCreateSMTP(BaseModel):
    email_address: EmailStr
    display_name: str | None = None
    smtp_host: str = Field(min_length=1, max_length=255)
    smtp_port: int = Field(gt=0, le=65535)
    smtp_username: str = Field(min_length=1, max_length=255)
    smtp_password: str = Field(min_length=1)
    use_tls: bool = True


class EmailAccountUpdate(BaseModel):
    display_name: str | None = None
    is_default: bool | None = None


class EmailAccountTestSendResult(BaseModel):
    success: bool
    detail: str | None = None
