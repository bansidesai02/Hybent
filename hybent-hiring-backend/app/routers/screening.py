"""
Candidate Screening Agent: the recruiter's review list.

The agent (app/services/agents/screening) recommends a next step for each new
candidate; nothing happens until a recruiter approves, overrides or dismisses
it here.
"""
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.dependencies import DB, RecruiterUser
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.screening_recommendation import ScreeningRecommendation
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/screening", tags=["screening"])

MAX_BATCH = 50


class DecideRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=MAX_BATCH)
    action: Literal["approve", "override", "dismiss"]
    # For override: what to do instead, and (for pre_screen/shortlist) which job.
    override_to: Optional[Literal["pre_screen", "shortlist", "talent_pool", "reject"]] = None
    job_id: Optional[str] = None


@router.get("/queue")
async def get_queue(
    current_user: RecruiterUser,
    db: DB,
    status: Literal["pending", "decided"] = "pending",
    limit: int = Query(100, ge=1, le=200),
):
    """Recommendations waiting for a recruiter (or recently decided ones)."""
    org_id = current_user.organization_id
    dup = aliased(Candidate)
    query = (
        select(ScreeningRecommendation, Candidate, Job.title, dup.full_name)
        .join(Candidate, Candidate.id == ScreeningRecommendation.candidate_id)
        .outerjoin(Job, Job.id == ScreeningRecommendation.job_id)
        .outerjoin(dup, dup.id == ScreeningRecommendation.duplicate_of_id)
        .where(ScreeningRecommendation.organization_id == org_id, Candidate.is_deleted.is_(False))
    )
    if status == "pending":
        query = query.where(ScreeningRecommendation.status == "pending").order_by(ScreeningRecommendation.created_at.desc())
    else:
        query = query.where(ScreeningRecommendation.status != "pending").order_by(ScreeningRecommendation.decided_at.desc())
    rows = (await db.execute(query.limit(limit))).all()

    counts = dict((await db.execute(
        select(ScreeningRecommendation.recommendation, func.count())
        .join(Candidate, Candidate.id == ScreeningRecommendation.candidate_id)
        .where(
            ScreeningRecommendation.organization_id == org_id,
            ScreeningRecommendation.status == "pending",
            Candidate.is_deleted.is_(False),
        )
        .group_by(ScreeningRecommendation.recommendation)
    )).all())

    items = [
        {
            "id": str(rec.id),
            "recommendation": rec.recommendation,
            "reasons": rec.reasons or [],
            "risks": rec.risks or [],
            "confidence": rec.confidence,
            "score": rec.score,
            "engine": rec.decided_by_engine,
            "status": rec.status,
            "action_taken": rec.action_taken,
            "error": rec.error,
            "created_at": rec.created_at,
            "decided_at": rec.decided_at,
            "job": {"id": str(rec.job_id), "title": job_title} if rec.job_id else None,
            # Other open jobs it was scored against, for the "Change" picker.
            "matches": [
                {"job_id": m.get("job_id"), "title": m.get("title"), "score": m.get("score")}
                for m in (rec.matches or [])
            ],
            "duplicate_of": {"id": str(rec.duplicate_of_id), "full_name": dup_name} if rec.duplicate_of_id else None,
            "candidate": {
                "id": str(cand.id),
                "full_name": cand.full_name,
                "email": cand.email,
                "current_title": cand.current_title,
                "current_company": cand.current_company,
                "years_experience": cand.years_experience,
                "location": cand.location,
                "source": cand.source,
                "skills": list(cand.skills or [])[:8],
            },
        }
        for rec, cand, job_title, dup_name in rows
    ]
    return APIResponse.success(
        message="Screening queue retrieved.",
        data={
            "enabled": settings.screening_agent_enabled_for(org_id),
            "pending_total": sum(counts.values()),
            "counts": counts,
            "items": items,
        },
    )


@router.post("/decide")
async def decide(body: DecideRequest, current_user: RecruiterUser, db: DB, background_tasks: BackgroundTasks):
    """Approve, override or dismiss one or more recommendations."""
    from app.services.agents.screening.service import decide_recommendations

    if body.action == "override" and not body.override_to:
        raise HTTPException(status_code=400, detail="Choose what to do instead.")
    if body.override_to in ("pre_screen", "shortlist") and body.job_id:
        try:
            uuid.UUID(body.job_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid job.")
    for rec_id in body.ids:
        try:
            uuid.UUID(rec_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid recommendation id.")

    decision = {"action": body.action, "override_to": body.override_to, "job_id": body.job_id}
    results = await decide_recommendations(
        db, current_user.organization_id, current_user.id, body.ids, decision, background_tasks,
    )
    done = sum(1 for r in results if r.get("status") in ("approved", "overridden", "dismissed"))
    return APIResponse.success(
        message=f"{done} of {len(results)} done.",
        data={"results": results},
    )
