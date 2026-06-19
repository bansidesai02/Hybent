import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, BackgroundTasks
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.schemas.response import APIResponse
from app.schemas.candidate import CandidateDesignationUpdate
from app.routers.designations import list_designations
from app.routers.candidates import update_candidate_designation
from app.routers.users import update_designation_order, get_designation_order, DesignationOrderUpdate

router = APIRouter(prefix="/api", tags=["API Compatibility"])

@router.get("/designations")
async def compat_list_designations(
    current_user: Annotated[CurrentUser, Depends()],
    db: DB,
):
    return await list_designations(current_user=current_user, db=db)

@router.patch("/candidates/{candidate_id}/designation")
async def compat_update_candidate_designation(
    candidate_id: uuid.UUID,
    data: CandidateDesignationUpdate,
    current_user: Annotated[RecruiterUser, Depends()],
    db: DB,
    background_tasks: BackgroundTasks,
):
    return await update_candidate_designation(
        candidate_id=candidate_id,
        data=data,
        current_user=current_user,
        db=db,
        background_tasks=background_tasks,
    )

@router.put("/users/{user_id}/designation-order")
async def compat_update_designation_order(
    user_id: uuid.UUID,
    data: DesignationOrderUpdate,
    current_user: Annotated[CurrentUser, Depends()],
    db: DB,
):
    return await update_designation_order(
        user_id=user_id,
        data=data,
        current_user=current_user,
        db=db,
    )

@router.get("/users/{user_id}/designation-order")
async def compat_get_designation_order(
    user_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends()],
    db: DB,
):
    return await get_designation_order(
        user_id=user_id,
        current_user=current_user,
        db=db,
    )
