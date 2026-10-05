"""
Candidate Screening Agent entry point. Runs in the Celery worker
(app/tasks/screening.py), one run per new candidate.
"""
import logging
import uuid

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.agents.screening.graph import get_graph
from app.services.agents.screening.state import ScreeningContext
from app.services.ai_metering import ai_feature, ai_scope

logger = logging.getLogger(__name__)


@ai_feature("candidate_screening")
async def screen_candidate(candidate_id: str, organization_id: str) -> dict:
    """Screens one candidate and saves the recommendation. Returns the final
    graph state (for logs and tests)."""
    org_id = uuid.UUID(organization_id)
    if not settings.screening_agent_enabled_for(org_id):
        return {"stop_reason": "disabled"}
    async with AsyncSessionLocal() as db, ai_scope(org_id):
        ctx = ScreeningContext(organization_id=org_id, db=db)
        result = await get_graph().ainvoke(
            {"candidate_id": candidate_id},
            {"configurable": {"thread_id": f"screening:{candidate_id}"}},
            context=ctx,
            durability="exit",
        )
    decision = (result or {}).get("decision") or {}
    logger.info(
        "Screening agent: candidate %s → %s (%s)%s",
        candidate_id, decision.get("recommendation"), decision.get("engine"),
        f" [{result.get('stop_reason')}]" if result.get("stop_reason") else "",
    )
    return result


async def decide_recommendations(
    db, organization_id: uuid.UUID, user_id: uuid.UUID, recommendation_ids: list[str],
    decision: dict, background_tasks=None,
) -> list[dict]:
    """Applies one recruiter decision ({"action": approve|override|dismiss,
    "override_to"?, "job_id"?}) to each recommendation. Resumes the paused
    graph run when there is one; otherwise applies it directly, so a card
    always works even if its checkpoint is gone."""
    from langgraph.types import Command
    from sqlalchemy import select

    from app.models.screening_recommendation import ScreeningRecommendation
    from app.services.agents.screening.actions import apply_decision

    graph = get_graph()
    decision = {**decision, "user_id": str(user_id)}
    results = []
    for rec_id in recommendation_ids:
        rec = (await db.execute(select(ScreeningRecommendation).where(
            ScreeningRecommendation.id == uuid.UUID(rec_id),
            ScreeningRecommendation.organization_id == organization_id,
        ))).scalar_one_or_none()
        if rec is None:
            results.append({"id": rec_id, "status": "missing", "action": None, "error": "Not found."})
            continue
        config = {"configurable": {"thread_id": f"screening:{rec.candidate_id}"}}
        ctx = ScreeningContext(organization_id=organization_id, db=db, background_tasks=background_tasks)
        try:
            snapshot = await graph.aget_state(config)
            paused_here = bool(snapshot.interrupts) and (snapshot.values or {}).get("recommendation_id") == rec_id
        except Exception as exc:
            logger.warning("Screening: checkpoint lookup failed for %s: %s", rec_id, exc)
            paused_here = False
        if paused_here and rec.status == "pending":
            final = await graph.ainvoke(Command(resume=decision), config, context=ctx, durability="exit")
            results.append((final or {}).get("outcome") or {"id": rec_id, "status": "failed", "error": "No outcome."})
        else:
            results.append(await apply_decision(db, organization_id, rec_id, decision, background_tasks))
    return results
