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
    # Free-trial preview: search every free source and show what the AI
    # understood, but don't use the trial's Global (PDL) search yet.
    skip_outside: bool = False


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

    # Free trial: a set number of Global (PDL) searches in total.
    quota = await _trial_quota(db, current_user.organization_id)
    previous = await _same_search(db, current_user, body.query)
    charge = False
    run_outside = body.scope in ("outside", "both")
    if quota is not None and run_outside:
        free_rerun = is_sample(body.query) or (previous is not None and previous.charged)
        if body.skip_outside and not free_rerun:
            run_outside = False
            data["outside_preview"] = True
        elif not free_rerun:
            if quota["remaining"] > 0:
                charge = True  # confirmed below, only if it finds someone
            else:
                run_outside = False
                data["outside_locked"] = True
                data["outside_error"] = TRIAL_LIMIT_DETAIL
    if body.scope in ("own", "both"):
        data["own"] = gs.rank(await gs.search_own(db, current_user.organization_id, filters), filters, job)
    if body.scope in ("outside", "both"):
        # Hybent Talent Network: free, consented, contact only on the member's yes.
        data["network"] = gs.rank(await tn.search_network(db, current_user.organization_id, filters), filters, job)
    if run_outside:
        try:
            outside = await gs.search_outside(current_user.organization_id, filters)
            outside["results"] = gs.rank(outside["results"], filters, job)
            data["outside"] = outside
        except (gs.GlobalSearchLimit, gs.GlobalSearchUnavailable) as e:
            data["outside_error"] = str(e)
    if body.scope in ("outside", "both"):
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

    # A search that found nobody or failed doesn't use the trial's search.
    charged = charge and bool((data.get("outside") or {}).get("results"))
    if body.scope == "both":
        data["search_id"] = str(await _save_run(db, current_user, body, filters, data, previous, charged))
    if quota is not None:
        data["trial_quota"] = await _trial_quota(db, current_user.organization_id)
    return APIResponse.success(message="Search complete.", data=data)


# ── Search history and saved candidates ────────────────────────────────────
from datetime import datetime, timedelta, timezone  # noqa: E402

from sqlalchemy import desc, func  # noqa: E402

from app.models.application import Application  # noqa: E402
from app.models.candidate import Candidate  # noqa: E402
from app.models.global_search import GlobalSearchRun  # noqa: E402
from app.models.user import User  # noqa: E402

# Editing a chip or switching the job re-runs the same search: within this
# window it updates the user's last run instead of adding another row.
SAME_SEARCH_WINDOW = timedelta(minutes=30)
HISTORY_KEEP = 200  # newest runs kept per organization
SAVED_SOURCES = ("global_search", "talent_network")

TRIAL_LIMIT_DETAIL = "You've used your free Global search. Upgrade to search millions of profiles."

# The page's example searches: free for trials (they answer from cache), so a
# trial can see Global results before spending its own search. Keep in step
# with EXAMPLES in GlobalSearchPage.tsx.
SAMPLE_QUERIES = {
    "react developer in ahmedabad, 3–5 years",
    "python django developer bangalore with aws",
    "hr executive in pune",
}


def is_sample(query: str | None) -> bool:
    return " ".join((query or "").lower().split()) in SAMPLE_QUERIES


async def _trial_quota(db, organization_id) -> dict | None:
    """None for paid companies; else the trial's Global search allowance."""
    from app.core.config import settings
    from app.services.trial_service import trial_access
    if await trial_access(db, organization_id) is None:
        return None
    used = (await db.execute(select(func.count(GlobalSearchRun.id)).where(
        GlobalSearchRun.organization_id == organization_id, GlobalSearchRun.charged.is_(True),
    ))).scalar() or 0
    limit = max(0, settings.trial_global_searches)
    return {"limit": limit, "used": used, "remaining": max(0, limit - used)}


async def _same_search(db, user, query: str | None):
    """The user's last run if this request is the same search again (a chip
    edit, a job switch, or confirming a trial preview)."""
    query = (query or "").strip()[:300]
    if not query:
        return None
    last = (await db.execute(
        select(GlobalSearchRun)
        .where(GlobalSearchRun.organization_id == user.organization_id, GlobalSearchRun.user_id == user.id)
        .order_by(desc(GlobalSearchRun.created_at)).limit(1)
    )).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if last and last.query == query and last.created_at and now - last.created_at < SAME_SEARCH_WINDOW:
        return last
    return None


def _counts(data: dict) -> dict:
    return {
        "outside": (data.get("outside") or {}).get("total") or 0,
        "github": (data.get("github") or {}).get("total") or 0,
        "network": len(data.get("network") or []),
        "own": len(data.get("own") or []),
    }


async def _save_run(db, user, body: GlobalSearchRequest, filters: dict, data: dict,
                    previous: "GlobalSearchRun | None", charged: bool) -> uuid.UUID:
    query = (body.query or "").strip()[:300] or None
    results = {k: data.get(k) for k in ("outside", "outside_error", "github", "github_error", "network", "own")}
    now = datetime.now(timezone.utc)
    run = previous
    if run is None:
        run = GlobalSearchRun(organization_id=user.organization_id, user_id=user.id, query=query)
        db.add(run)
    run.filters, run.job_id, run.counts, run.results, run.created_at = filters, body.job_id, _counts(data), results, now
    run.charged = bool(run.charged) or charged
    await db.flush()

    # Keep the newest HISTORY_KEEP runs per org. Runs that used a trial's
    # search are kept: deleting them would hand the trial its search back.
    old_ids = (await db.execute(
        select(GlobalSearchRun.id).where(GlobalSearchRun.organization_id == user.organization_id,
                                         GlobalSearchRun.charged.is_(False))
        .order_by(desc(GlobalSearchRun.created_at)).offset(HISTORY_KEEP)
    )).scalars().all()
    if old_ids:
        from sqlalchemy import delete
        await db.execute(delete(GlobalSearchRun).where(GlobalSearchRun.id.in_(old_ids)))
    await db.commit()
    return run.id


@router.get("/global/history")
async def global_search_history(current_user: CurrentUser, db: DB, limit: int = Query(20, ge=1, le=100)):
    """The team's recent Global Searches, newest first."""
    rows = (await db.execute(
        select(GlobalSearchRun, User.full_name, Job.title)
        .outerjoin(User, User.id == GlobalSearchRun.user_id)
        .outerjoin(Job, Job.id == GlobalSearchRun.job_id)
        .where(GlobalSearchRun.organization_id == current_user.organization_id, GlobalSearchRun.hidden.is_(False))
        .order_by(desc(GlobalSearchRun.created_at)).limit(limit)
    )).all()
    return APIResponse.success(message="Search history.", data=[{
        "id": str(r.id), "query": r.query, "filters": r.filters, "counts": r.counts,
        "job_id": str(r.job_id) if r.job_id else None, "job_title": job_title,
        "searched_by": name, "is_mine": r.user_id == current_user.id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r, name, job_title in rows])


@router.get("/global/history/{run_id}")
async def global_search_history_item(run_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """A saved search with the results it found, so reopening it costs nothing.
    Network request statuses are refreshed, since they change after the search."""
    run = (await db.execute(select(GlobalSearchRun).where(
        GlobalSearchRun.id == run_id, GlobalSearchRun.organization_id == current_user.organization_id,
        GlobalSearchRun.hidden.is_(False),
    ))).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Search not found")
    data = {"filters": run.filters, **(run.results or {}), "search_id": str(run.id),
            "job_id": str(run.job_id) if run.job_id else None, "query": run.query,
            "saved_at": run.created_at.isoformat() if run.created_at else None}
    network = data.get("network") or []
    if network:
        from app.models.talent_network import TalentContactRequest
        ids = [uuid.UUID(n["profile_id"]) for n in network if n.get("profile_id")]
        status = {str(r.profile_id): r for r in (await db.execute(select(TalentContactRequest).where(
            TalentContactRequest.organization_id == current_user.organization_id,
            TalentContactRequest.profile_id.in_(ids),
        ))).scalars().all()}
        for n in network:
            r = status.get(n.get("profile_id"))
            n["request_status"] = r.status if r else None
    return APIResponse.success(message="Saved search.", data=data)


@router.delete("/global/history/{run_id}")
async def delete_global_search_history_item(run_id: uuid.UUID, current_user: CurrentUser, db: DB):
    run = (await db.execute(select(GlobalSearchRun).where(
        GlobalSearchRun.id == run_id, GlobalSearchRun.organization_id == current_user.organization_id,
    ))).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Search not found")
    if run.charged:
        # Keep the row: it counts against a trial's searches. Just hide it.
        run.hidden = True
        run.results, run.counts = {}, {}
    else:
        await db.delete(run)
    await db.commit()
    return APIResponse.success(message="Removed from history.", data=None)


@router.get("/global/saved")
async def global_search_saved(current_user: CurrentUser, db: DB,
                              page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100)):
    """Candidates the team brought in from outside: saved or added from Global
    Search (PDL, GitHub) or accepted from the Talent Network."""
    base = [Candidate.organization_id == current_user.organization_id, Candidate.is_deleted.is_(False),
            Candidate.source.in_(SAVED_SOURCES)]
    total = (await db.execute(select(func.count(Candidate.id)).where(*base))).scalar() or 0
    rows = (await db.execute(
        select(Candidate, User.full_name).outerjoin(User, User.id == Candidate.created_by_id)
        .where(*base).order_by(desc(Candidate.created_at)).offset((page - 1) * limit).limit(limit)
    )).all()
    jobs: dict = {}
    if rows:
        for cid, title in (await db.execute(
            select(Application.candidate_id, Job.title).join(Job, Job.id == Application.job_id)
            .where(Application.candidate_id.in_([c.id for c, _ in rows]))
        )).all():
            jobs.setdefault(cid, []).append(title)
    items = []
    for c, saved_by in rows:
        pd = c.parsed_data or {}
        origin = "network" if c.source == "talent_network" else (pd.get("external_source") or "pdl")
        items.append({
            "id": str(c.id), "full_name": c.full_name, "job_title": c.current_title,
            "company": c.current_company, "location": c.location, "skills": list(c.skills or [])[:8],
            "origin": origin, "github_url": c.github_url, "linkedin_url": c.linkedin_url,
            "has_email": not (c.email or "").endswith(".invalid"),
            "pipeline_stage": c.pipeline_stage, "jobs": jobs.get(c.id, []),
            "saved_by": saved_by, "saved_at": c.created_at.isoformat() if c.created_at else None,
        })
    return APIResponse.success(message="Saved candidates.", data={"items": items, "total": total, "page": page})


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


@router.get("/global/quota")
async def global_search_quota(current_user: CurrentUser, db: DB):
    """Free-trial allowance of Global (PDL) searches; null for paid companies."""
    return APIResponse.success(message="Quota.", data=await _trial_quota(db, current_user.organization_id))
