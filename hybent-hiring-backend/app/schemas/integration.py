import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.utils.integration_keys import SCOPES


class IntegrationKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    scopes: list[str] = Field(min_length=1)
    # None = never expires. Rotation is still expected (revoke + create).
    expires_in_days: int | None = Field(default=None, ge=1, le=730)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("scopes")
    @classmethod
    def _known_scopes(cls, v: list[str]) -> list[str]:
        unknown = sorted(set(v) - SCOPES)
        if unknown:
            raise ValueError(f"Unknown scope(s): {', '.join(unknown)}. Allowed: {', '.join(sorted(SCOPES))}.")
        return sorted(set(v))


class IntegrationKeyOut(BaseModel):
    id: uuid.UUID
    name: str
    key_id: str
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime | None
    revoked_at: datetime | None

    model_config = {"from_attributes": True}


class IntegrationKeyCreated(IntegrationKeyOut):
    # The full key. Returned once, at creation; only its hash is stored.
    key: str
