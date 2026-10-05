"""
What happens when a recruiter decides on a screening recommendation.

Every action runs the same code as the button a recruiter would press, so
the result is identical to doing it by hand (activity log, notifications,
pipeline, emails):
  pre_screen  → "Add to Pipeline" for the job, then the Pre-screening page's
                "Send invite" (routers/pre_screening.create_session)
  shortlist   → "Add to Pipeline" for the job (routers/candidates.update_candidate_stage)
  talent_pool → the "Talent pool" tag (routers/talent_pool.add_tag)
  reject      → moved to Rejected, no rejection email
  none        → nothing (a dismissed card, or an acknowledged duplicate)

Used by the graph's `apply` node when a paused run is resumed, and directly
by the API when there's no paused run to resume (e.g. checkpoints were lost
in a restart without Postgres).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.screening_recommendation import ScreeningRecommendation
from app.models.user import User

logger = logging.getLogger(__name__)

ACTIONS = ("pre_screen", "shortlist", "talent_pool", "reject", "none")
TALENT_POOL_TAG = "Talent pool"


def final_action(recommendation: str, decision: dict) -> str:
    """approve → the recommendation itself; override → the recruiter's
    choice; dismiss → nothing."""
    kind = decision.get("action")
    if kind == "dismiss":
        return "none"
    if kind == "override":
        return decision.get("override_to") or "none"
    return "none" if recommendation == "duplicate" else recommendation


async def _run(db: AsyncSession, user: User, candidate_id: uuid.UUID, action: str,
               job_id: Optional[uuid.UUID], background_tasks: BackgroundTasks) -> None:
    from app.routers.candidates import update_candidate_stage
    from app.routers.pre_screening import create_session
    from app.routers.talent_pool import add_tag
    from app.schemas.candidate import CandidateStageUpdate
    from app.schemas.pre_screening import CreateSessionRequest

    if action in ("pre_screen", "shortlist"):
        if not job_id:
            raise HTTPException(status_code=400, detail="Pick a job first.")
        await update_candidate_stage(
            candidate_id, CandidateStageUpdate(pipeline_stage="applied", job_id=str(job_id)),
            user, db, background_tasks,
        )
        await db.commit()
        if action == "pre_screen":
            await create_session(
                body=CreateSessionRequest(candidate_id=candidate_id, job_id=job_id),
                current_user=user, db=db, background_tasks=background_tasks,
            )
            await db.commit()
    elif action == "talent_pool":
        await add_tag(candidate_id, TALENT_POOL_TAG, user, db)
        await db.commit()
    elif action == "reject":
        await update_candidate_stage(
            candidate_id, CandidateStageUpdate(pipeline_stage="rejected"), user, db, background_tasks,
        )
        await db.commit()


async def apply_decision(db: AsyncSession, organization_id: uuid.UUID, recommendation_id: str,
                         decision: dict, background_tasks: Optional[BackgroundTasks] = None) -> dict:
    """Carries out a recruiter's decision on a pending recommendation and
    records the outcome on its row. Returns {"id", "status", "action", "error"?};
    status "failed" means nothing changed and the card is still pending."""
    rec = (await db.execute(select(ScreeningRecommendation).where(
        ScreeningRecommendation.id == uuid.UUID(recommendation_id),
        ScreeningRecommendation.organization_id == organization_id,
    ))).scalar_one_or_none()
    if rec is None:
        return {"id": recommendation_id, "status": "missing", "action": None, "error": "Not found."}
    if rec.status != "pending":
        return {"id": recommendation_id, "status": rec.status, "action": rec.action_taken,
                "error": "Already decided."}

    user = (await db.execute(select(User).where(
        User.id == uuid.UUID(str(decision["user_id"])),
        User.organization_id == organization_id,
    ))).scalar_one_or_none()
    if user is None:
        return {"id": recommendation_id, "status": "pending", "action": None, "error": "Unknown user."}

    action = final_action(rec.recommendation, decision)
    if action not in ACTIONS:
        return {"id": recommendation_id, "status": "pending", "action": None, "error": "Unknown action."}
    job_id = decision.get("job_id") or rec.job_id
    job_id = uuid.UUID(str(job_id)) if job_id else None

    error = None
    try:
        await _run(db, user, rec.candidate_id, action, job_id, background_tasks or BackgroundTasks())
        status = {"dismiss": "dismissed", "override": "overridden"}.get(decision.get("action"), "approved")
    except HTTPException as exc:
        await db.rollback()
        error = str(exc.detail)
        if error.startswith("completed_session:"):
            error = "This candidate already completed a pre-screening for this job."
        status = "failed"
    except Exception as exc:
        await db.rollback()
        logger.error("Screening action %s failed for %s: %s", action, recommendation_id, exc, exc_info=True)
        error = "Something went wrong. Please try again."
        status = "failed"

    # Re-read: the action's own commits/rollbacks may have expired the row.
    rec = (await db.execute(select(ScreeningRecommendation).where(
        ScreeningRecommendation.id == uuid.UUID(recommendation_id),
    ))).scalar_one()
    rec.error = error
    if status != "failed":
        rec.status = status
        rec.action_taken = action
        rec.decided_by_id = user.id
        rec.decided_at = datetime.now(timezone.utc)
        if job_id and action in ("pre_screen", "shortlist"):
            rec.job_id = job_id
    # A failed action leaves the card pending, with the error shown on it, so
    # the recruiter can retry or choose something else.
    await db.commit()
    out = {"id": recommendation_id, "status": status, "action": action}
    if error:
        out["error"] = error
    return out
