"""
Global search router — GET /v1/search?q=<query>&limit=<n>
Scoped to the authenticated user's organization.
"""
from fastapi import APIRouter, Query, HTTPException

from app.dependencies import CurrentUser, DB
from app.schemas.response import APIResponse
from app.services.search_service import global_search

router = APIRouter(prefix="/v1/search", tags=["search"])


@router.get("")
async def search(
    current_user: CurrentUser,
    db: DB,
    q: str = Query(..., min_length=1, max_length=200, description="Search query string"),
    limit: int = Query(5, ge=1, le=20, description="Max results per entity type"),
):
    """
    Global search across candidates, jobs, interviews, and team members.
    Results are grouped by entity type and scoped to the user's organization.
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    results = await global_search(
        db=db,
        organization_id=current_user.organization_id,
        query=q,
        limit=limit,
    )

    return APIResponse.success(
        message="Search results retrieved successfully.",
        data=results,
    )
