"""
Candidate Screening Agent graph nodes.

    load ─┬─ missing / already screened / in pipeline ─────────────────────▶ END
          └─▶ dedupe ─┬─ duplicate ─────────────▶ record ─▶ approval ⏸ ─▶ apply ─▶ END
                      └─▶ match_jobs ─▶ decide ─▶ record ─▶ approval ⏸ ─▶ apply ─▶ END

- match_jobs scores the candidate against the org's open jobs with no AI
  call: the AI score already computed at intake for the job they applied
  to, and the deterministic scorer for every other open job.
- decide settles clear cases by rules (rules.py) and spends at most ONE AI
  call on the rest. If that call fails or returns junk, the rule draft stands.
- record saves the recommendation for the recruiter's review list.
- approval pauses the run (LangGraph interrupt) until a recruiter approves,
  overrides or dismisses it from the review list (routers/screening.py);
  apply then carries that out (actions.apply_decision).
"""
import json
import logging
import re
import uuid

from langgraph.runtime import Runtime
from langgraph.types import interrupt

from app.services.agents import llm
from app.services.agents.screening import actions, repo
from app.services.agents.screening.prompts import SYSTEM_PROMPT, user_message
from app.services.agents.screening.rules import RECOMMENDATIONS, rule_decision
from app.services.agents.screening.state import ScreeningContext, ScreeningState

logger = logging.getLogger(__name__)

TOP_MATCHES = 5
AI_MAX_TOKENS = 400
# Only candidates nobody has acted on yet are screened.
INTAKE_STAGES = (None, "", "applied", "needs_review")


# ── Nodes ────────────────────────────────────────────────────────────────────

async def load(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    ctx = runtime.context
    candidate_id = state["candidate_id"]
    if await repo.already_screened(ctx.db, ctx.organization_id, candidate_id):
        return {"stop_reason": "already_screened"}
    candidate = await repo.load_candidate(ctx.db, ctx.organization_id, candidate_id)
    if candidate is None:
        return {"stop_reason": "missing"}
    if candidate.get("pipeline_stage") not in INTAKE_STAGES:
        # A recruiter already moved them on (or they came in mid-pipeline,
        # e.g. a bulk import) — nothing left to screen.
        return {"stop_reason": "in_pipeline"}
    return {"candidate": candidate}


def route_after_load(state: ScreeningState) -> str:
    return "end" if state.get("stop_reason") else "dedupe"


async def dedupe(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    ctx = runtime.context
    duplicate = await repo.find_duplicate(ctx.db, ctx.organization_id, state["candidate"])
    if not duplicate:
        return {"duplicate": None}
    return {
        "duplicate": duplicate,
        "decision": {
            "recommendation": "duplicate", "job_id": None, "confidence": "high", "engine": "rules",
            "reasons": [f"Same email or phone as {duplicate['full_name']}, already in your candidates."],
            "risks": [],
        },
    }


def route_after_dedupe(state: ScreeningState) -> str:
    return "record" if state.get("duplicate") else "match_jobs"


def _match_entry(job, score, breakdown: dict, source: str) -> dict:
    return {
        "job_id": str(job.id),
        "title": job.title,
        "score": round(float(score or 0), 1),
        "source": source,
        "min_experience_years": job.min_experience_years,
        "location": job.location,
        "skills_required": list(job.skills_required or [])[:12],
        "matched_skills": list((breakdown or {}).get("matched_skills") or [])[:10],
        "missing_skills": list((breakdown or {}).get("missing_skills") or [])[:10],
    }


async def match_jobs(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    from app.services.ai.match_scorer import compute_heuristic_match_score

    ctx = runtime.context
    cand = state["candidate"]
    parsed = cand.get("parsed") or {}
    applied = set(await repo.applied_job_ids(ctx.db, ctx.organization_id, cand["id"]))
    jobs = await repo.active_jobs(ctx.db, ctx.organization_id)

    matches = []
    for job in jobs:
        _, breakdown = compute_heuristic_match_score(
            candidate_skills=cand.get("skills") or [],
            candidate_title=parsed.get("current_title"),
            years_experience=cand.get("years_experience"),
            candidate_education=parsed.get("education") or [],
            job=job,
            candidate_experience=parsed.get("experience") or [],
            candidate_projects=parsed.get("projects") or [],
            candidate_certifications=parsed.get("certifications") or [],
        )
        score, source = (breakdown or {}).get("final_score"), "rules"
        # The job they applied to was already scored by AI at intake — reuse it.
        if str(job.id) in applied and cand.get("match_score") is not None:
            score, source = cand["match_score"], "ai"
        matches.append(_match_entry(job, score, breakdown, source))

    matches.sort(key=lambda m: m["score"], reverse=True)
    return {"matches": matches[:TOP_MATCHES]}


def _parse_ai_decision(text: str, matches: list[dict]) -> dict | None:
    """The model's JSON, validated. None if it's unusable."""
    m = re.search(r"\{.*\}", text or "", re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    rec = data.get("recommendation")
    if rec not in RECOMMENDATIONS:
        return None
    job_ids = {x["job_id"] for x in matches}
    job_id = data.get("job_id") if data.get("job_id") in job_ids else None
    if rec in ("pre_screen", "shortlist") and job_id is None:
        job_id = matches[0]["job_id"] if matches else None
        if job_id is None:
            return None
    clean = lambda xs, n: [str(x).strip()[:200] for x in (xs or []) if str(x).strip()][:n]  # noqa: E731
    reasons = clean(data.get("reasons"), 4)
    if not reasons:
        return None
    confidence = data.get("confidence") if data.get("confidence") in ("low", "medium", "high") else "medium"
    return {
        "recommendation": rec,
        "job_id": job_id if rec in ("pre_screen", "shortlist") else None,
        "reasons": reasons,
        "risks": clean(data.get("risks"), 3),
        "confidence": confidence,
        "engine": "ai",
    }


async def decide(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    from app.services.ai_credit_service import AICreditsService

    ctx = runtime.context
    matches = state.get("matches") or []
    draft = rule_decision(matches)
    needs_ai = draft.pop("needs_ai")
    draft["engine"] = "rules"
    if not needs_ai:
        return {"decision": draft}

    try:
        await AICreditsService.check_credits_available(None, ctx.organization_id, "candidate_screening")
        turn = await llm.stream_chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message(state["candidate"], matches)},
            ],
            max_tokens=AI_MAX_TOKENS,
            temperature=0,
        )
        decision = _parse_ai_decision(turn.content, matches)
    except Exception as exc:  # out of credits, provider down, ...
        logger.warning("Screening agent: AI decision skipped for %s: %s", state["candidate_id"], exc)
        decision = None
    if decision is None:
        return {"decision": draft}
    return {"decision": decision}


async def record(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    ctx = runtime.context
    decision = state["decision"]
    matches = state.get("matches") or []
    best = next((m for m in matches if m["job_id"] == decision.get("job_id")), None)
    rec_id = await repo.save_recommendation(
        ctx.db, ctx.organization_id, state["candidate_id"],
        job_id=_uuid(decision.get("job_id")),
        recommendation=decision["recommendation"],
        reasons=decision.get("reasons") or [],
        risks=decision.get("risks") or [],
        confidence=decision.get("confidence"),
        score=best["score"] if best else (matches[0]["score"] if matches else None),
        matches=matches,
        duplicate_of_id=_uuid((state.get("duplicate") or {}).get("id")),
        decided_by_engine=decision.get("engine", "rules"),
        status="pending",
    )
    return {"recommendation_id": rec_id}


def _uuid(value):
    return uuid.UUID(value) if value else None


async def approval(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    """Wait for the recruiter. Everything before interrupt() re-runs on
    resume, so this node does nothing else."""
    decision = interrupt({"recommendation_id": state["recommendation_id"]})
    return {"decision": {**state["decision"], "recruiter": decision}}


async def apply(state: ScreeningState, runtime: Runtime[ScreeningContext]) -> dict:
    ctx = runtime.context
    outcome = await actions.apply_decision(
        ctx.db, ctx.organization_id, state["recommendation_id"],
        state["decision"]["recruiter"], ctx.background_tasks,
    )
    return {"outcome": outcome}
