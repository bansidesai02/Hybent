"""
/v1/integrations — the surface machine clients (n8n) use.

  - /keys     tenant admins create, list and revoke their org's integration
              keys (normal user login);
  - /whoami   an integration key checks itself (n8n's credential test).

Every other integration endpoint authenticates with an integration key
(X-Hybent-Key) through get_integration_principal / require_scopes, which takes
the organization from the key and never from the request.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from app.core.config import settings
from app.dependencies import DB, AdminUser, Integration
from app.models.integration_key import IntegrationKey
from app.schemas.integration import IntegrationKeyCreate, IntegrationKeyCreated, IntegrationKeyOut
from app.schemas.response import APIResponse
from app.services.activity_service import log_activity
from app.utils.integration_keys import generate_key

router = APIRouter(prefix="/v1/integrations", tags=["integrations"])

MAX_ACTIVE_KEYS_PER_ORG = 10


@router.post("/keys", status_code=201)
async def create_integration_key(data: IntegrationKeyCreate, current_user: AdminUser, db: DB):
    active = await db.scalar(
        select(func.count()).select_from(IntegrationKey).where(
            IntegrationKey.organization_id == current_user.organization_id,
            IntegrationKey.revoked_at.is_(None),
        )
    )
    if active >= MAX_ACTIVE_KEYS_PER_ORG:
        raise HTTPException(
            status_code=400,
            detail=f"Your organization already has {MAX_ACTIVE_KEYS_PER_ORG} active keys. Revoke one first.",
        )

    generated = generate_key(settings.is_production)
    key = IntegrationKey(
        organization_id=current_user.organization_id,
        name=data.name,
        key_id=generated.key_id,
        secret_hash=generated.secret_hash,
        scopes=data.scopes,
        created_by_id=current_user.id,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
                    if data.expires_in_days else None),
    )
    db.add(key)
    await db.flush()
    await log_activity(
        db, organization_id=current_user.organization_id, user_id=current_user.id,
        action="CREATE", resource_type="integration_key", resource_id=str(key.id),
        details={"name": key.name, "key_id": key.key_id, "scopes": key.scopes},
    )
    await db.commit()
    await db.refresh(key)

    out = IntegrationKeyCreated(**IntegrationKeyOut.model_validate(key).model_dump(), key=generated.full_key)
    return APIResponse.success(
        message="Integration key created. Copy it now: it won't be shown again.",
        data=out, status_code=201,
    )


@router.get("/keys")
async def list_integration_keys(current_user: AdminUser, db: DB):
    keys = (await db.execute(
        select(IntegrationKey)
        .where(IntegrationKey.organization_id == current_user.organization_id)
        .order_by(IntegrationKey.created_at.desc())
    )).scalars().all()
    return APIResponse.success(
        message="Integration keys retrieved.",
        data=[IntegrationKeyOut.model_validate(k) for k in keys],
    )


@router.delete("/keys/{key_pk}")
async def revoke_integration_key(key_pk: uuid.UUID, current_user: AdminUser, db: DB):
    key = (await db.execute(
        select(IntegrationKey).where(
            IntegrationKey.id == key_pk,
            IntegrationKey.organization_id == current_user.organization_id,
        )
    )).scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=404, detail="Integration key not found.")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(timezone.utc)
        await log_activity(
            db, organization_id=current_user.organization_id, user_id=current_user.id,
            action="REVOKE", resource_type="integration_key", resource_id=str(key.id),
            details={"name": key.name, "key_id": key.key_id},
        )
        await db.commit()
    return APIResponse.success(message="Integration key revoked.")


@router.get("/whoami")
async def whoami(principal: Integration):
    return APIResponse.success(
        message="Integration key is valid.",
        data={
            "organization_id": str(principal.organization_id),
            "key_id": principal.key_id,
            "name": principal.name,
            "scopes": sorted(principal.scopes),
        },
    )
