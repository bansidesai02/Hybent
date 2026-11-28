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


# ── Global Search: own database + outside candidates ───────────────────────
import uuid  # noqa: E402
from typing import Literal, Optional  # noqa: E402

from pydantic import BaseModel, Field  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.models.job import Job  # noqa: E402
from app.services import global_search_service as gs  # noqa: E402
from app.services import github_search  # noqa: E402
from app.services import talent_network as tn  # noqa: E402


class GlobalSearchRequest(BaseModel):
    query: str = Field("", max_length=300)
    # Filters the recruiter edited as chips. When given, the AI parse is skipped.
    filters: Optional[dict] = None
    scope: Literal["own", "outside", "both"] = "both"
    # "both" and "outside" also ask GitHub when the search is for a developer.
    # Score results against this job's requirements. Optional.
    job_id: Optional[uuid.UUID] = None


class ImportOutsideRequest(BaseModel):
    person: dict
    job_id: Optional[uuid.UUID] = None


async def _org_job(db, organization_id, job_id):
    if not job_id:
        return None
    job = (await db.execute(select(Job).where(
        Job.id == job_id, Job.organization_id == organization_id, Job.is_deleted.is_(False)
    ))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/global")
async def global_candidate_search(body: GlobalSearchRequest, current_user: CurrentUser, db: DB):
    """Plain-English candidate search across the org's own database and outside sources."""
    if body.filters is not None:
        filters = gs.normalize_filters(body.filters)
    elif body.query.strip():
        filters = await gs.parse_query(body.query)
    else:
        raise HTTPException(status_code=400, detail="Type what you are looking for.")
    if not (filters["job_titles"] or filters["skills"]):
        raise HTTPException(status_code=400, detail="Add at least one role or skill.")

    job = await _org_job(db, current_user.organization_id, body.job_id)
    data: dict = {"filters": filters, "own": None, "outside": None, "outside_error": None,
                  "github": None, "github_error": None, "network": None}
    if body.scope in ("own", "both"):
        data["own"] = gs.rank(await gs.search_own(db, current_user.organization_id, filters), filters, job)
    if body.scope in ("outside", "both"):
        # Hybent Talent Network: free, consented, contact only on the member's yes.
        data["network"] = gs.rank(await tn.search_network(db, current_user.organization_id, filters), filters, job)
    if body.scope in ("outside", "both"):
        try:
            outside = await gs.search_outside(current_user.organization_id, filters)
            outside["results"] = gs.rank(outside["results"], filters, job)
            data["outside"] = outside
        except (gs.GlobalSearchLimit, gs.GlobalSearchUnavailable) as e:
            data["outside_error"] = str(e)
        if github_search.is_tech_search(filters):
            try:
                gh = await github_search.search_github(filters)
                # Every GitHub result codes in the searched language, so count it
                # as a skill when the search itself named none.
                lang = (github_search.language_for(filters) or "").lower()
                gh_filters = {**filters, "skills": filters["skills"] or ([lang] if lang else [])}
                gh["results"] = gs.rank(gh["results"], gh_filters, job)
                data["github"] = gh
            except github_search.GitHubUnavailable as e:
                data["github_error"] = str(e)

    return APIResponse.success(message="Search complete.", data=data)


@router.post("/global/import")
async def import_outside_candidate(body: ImportOutsideRequest, current_user: CurrentUser, db: DB):
    """Adds an outside profile to the org's candidates, and to a job's pipeline when job_id is given."""
    job = await _org_job(db, current_user.organization_id, body.job_id)
    try:
        cand, created = await gs.import_outside(
            db, current_user.organization_id, current_user.id, body.person, job
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    if created:
        msg = "Added to the job pipeline." if job else "Saved to your candidates."
    else:
        msg = "Already in your candidates" + (", now added to the job." if job else ".")
    return APIResponse.success(message=msg, data={"candidate_id": str(cand.id), "created": created})


class NetworkContactRequest(BaseModel):
    profile_id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    message: Optional[str] = Field(None, max_length=1000)


@router.post("/network/request")
async def request_network_contact(body: NetworkContactRequest, current_user: CurrentUser, db: DB):
    """Asks a Talent Network member for their contact details (they get an email to say yes or no)."""
    await _org_job(db, current_user.organization_id, body.job_id)
    try:
        await tn.request_contact(db, organization_id=current_user.organization_id, user=current_user,
                                 profile_id=body.profile_id, job_id=body.job_id, message=body.message)
    except tn.RequestError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return APIResponse.success(message="Request sent. We will email you when they answer.",
                               data={"status": "pending"})
