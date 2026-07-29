from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlalchemy import select
from app.dependencies import DB, CurrentUser, AdminUser
from app.models.organization import Organization
from app.schemas.organization import OrganizationOut, OrganizationUpdate
from app.schemas.response import APIResponse
from app.services.storage_service import save_logo

router = APIRouter(prefix="/v1/organizations", tags=["organizations"])


@router.get("/me", response_model=OrganizationOut)
async def get_my_org(current_user: CurrentUser, db: DB):
    result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return APIResponse.success(message="Organization fetched successfully.", data=OrganizationOut.model_validate(org))


@router.put("/me", response_model=OrganizationOut)
async def update_my_org(data: OrganizationUpdate, current_user: AdminUser, db: DB):
    result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return APIResponse.success(message="Organization updated successfully.", data=OrganizationOut.model_validate(org))


@router.post("/me/logo", response_model=OrganizationOut)
async def upload_logo(current_user: AdminUser, db: DB, file: UploadFile = File(...)):
    """Upload a new logo for the current organization."""
    url = await save_logo(file, str(current_user.organization_id))
    
    result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = result.scalar_one()
    org.logo_url = url
    await db.commit()
    await db.refresh(org)
    
    return APIResponse.success(message="Logo uploaded successfully.", data=OrganizationOut.model_validate(org))
