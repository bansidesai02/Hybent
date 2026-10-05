"""
AI Insights: what the pipeline data says, computed from real applications.

Fixes over the older funnel/fairness numbers the page used to read:
  - Stages like `technical_round_selected` / `hr_round_rejected` count toward
    the round they reached (they used to be dropped, so most people looked
    stuck at "Applied").
  - The funnel is cumulative: a hired candidate also passed every earlier step.
  - Talent DB designations (`pool` jobs) hold placeholder applications; they
    are not hiring activity and are left out.
"""
import uuid
from typing import Optional

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.services.analytics_service import interviewer_calibration
from app.utils.permissions import JobStatus

FUNNEL_STEPS = ["Applied", "Shortlisted", "Technical rounds", "Final interviews", "Offer", "Hired"]
INTERVIEW_STEP = 3  # "Final interviews": where source quality is judged
HIRED_STAGES = ("hired", "hired_joined")
MATCH_THRESHOLD = 60

_STEP_BY_BASE = {
    "applied": 0,
    "screening": 0,
    "rejected": 0,
    "pre_screening": 1,
    "technical_round": 2,
    "practical_round": 2,
    "techno_functional_round": 2,
    "techno_functional": 2,
    "management_round": 3,
    "hr_round": 3,
    "interview": 3,
    "interviewed": 3,
    "offer": 4,
    "offered": 4,
    "offer_withdrawn": 4,
    "hired": 5,
    "hired_joined": 5,
}


def stage_step(stage: Optional[str]) -> int:
    """Furthest funnel step an application stage proves the candidate reached."""
    s = (stage or "applied").strip().lower()
    if s in _STEP_BY_BASE:
        return _STEP_BY_BASE[s]
    for suffix in ("_selected", "_rejected", "_back_out"):
        if s.endswith(suffix):
            base = s[: -len(suffix)]
            step = _STEP_BY_BASE.get(base, 0)
            # Passing screening is what "shortlisted" means.
            return max(step, 1) if suffix == "_selected" and base == "screening" else step
    return 0


def _app_scope(org_id: uuid.UUID, user_id: Optional[uuid.UUID], job_id: Optional[uuid.UUID]) -> list:
    hiring_jobs = select(Job.id).where(Job.organization_id == org_id, Job.status != JobStatus.POOL)
    if user_id:
        hiring_jobs = hiring_jobs.where(Job.created_by_id == user_id)
    conds = [Application.organization_id == org_id, Application.job_id.in_(hiring_jobs)]
    if job_id:
        conds.append(Application.job_id == job_id)
    return conds


def _rate(part: int, whole: int) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


async def get_insights(
    org_id: uuid.UUID, db: AsyncSession, user_id: Optional[uuid.UUID] = None, job_id: Optional[uuid.UUID] = None,
) -> dict:
    scope = _app_scope(org_id, user_id, job_id)

    # ── Funnel and step-to-step pass rates ──────────────────────────────────
    stage_rows = (await db.execute(
        select(Application.stage, func.count(Application.id)).where(*scope).group_by(Application.stage)
    )).all()
    reached = [0] * len(FUNNEL_STEPS)
    for stage, count in stage_rows:
        for step in range(stage_step(stage) + 1):
            reached[step] += count
    total_apps = reached[0]

    funnel = [
        {"step": name, "count": reached[i], "percentage": _rate(reached[i], total_apps)}
        for i, name in enumerate(FUNNEL_STEPS)
    ]
    pass_rates = [
        {"from_step": FUNNEL_STEPS[i - 1], "to_step": FUNNEL_STEPS[i], "pass_rate": _rate(reached[i], reached[i - 1]),
         "entered": reached[i - 1]}
        for i in range(1, len(FUNNEL_STEPS))
        if reached[i - 1] > 0
    ]

    # ── Sources: how often each one gets people to the final interviews ─────
    source = func.coalesce(func.nullif(Candidate.source, ""), func.nullif(Application.source, ""), "unknown")
    source_rows = (await db.execute(
        select(source.label("source"), Application.stage, func.count(Application.id))
        .join(Candidate, Candidate.id == Application.candidate_id)
        .where(*scope)
        .group_by(source, Application.stage)
    )).all()
    by_source: dict[str, list[int]] = {}
    for src, stage, count in source_rows:
        totals = by_source.setdefault(src.lower(), [0, 0])
        totals[0] += count
        if stage_step(stage) >= INTERVIEW_STEP:
            totals[1] += count
    sources = sorted(
        ({"source": s, "applications": t, "reached_interview": r, "rate": _rate(r, t)} for s, (t, r) in by_source.items()),
        key=lambda x: (-x["rate"], -x["applications"]),
    )

    # ── Score and speed ─────────────────────────────────────────────────────
    avg_score = (await db.execute(
        select(func.avg(Application.match_score)).where(*scope, Application.match_score.isnot(None))
    )).scalar()
    hire_seconds = (await db.execute(
        select(func.avg(func.extract("epoch", Application.stage_changed_at - Application.applied_at)))
        .where(*scope, Application.stage.in_(HIRED_STAGES), Application.stage_changed_at.isnot(None))
    )).scalar()
    hires = reached[FUNNEL_STEPS.index("Hired")]

    # ── Top skills across the candidates in scope ───────────────────────────
    cand_conds = [Candidate.organization_id == org_id]
    if user_id or job_id:
        cand_conds.append(Candidate.id.in_(select(Application.candidate_id).where(*scope)))
    skill = func.unnest(Candidate.skills).label("skill")
    skills_sq = select(skill).where(*cand_conds).subquery()
    key = func.lower(func.trim(skills_sq.c.skill))
    skill_rows = (await db.execute(
        select(func.min(func.trim(skills_sq.c.skill)), func.count())
        .where(func.length(func.trim(skills_sq.c.skill)) > 0)
        .group_by(key)
        .order_by(func.count().desc())
        .limit(12)
    )).all()
    candidates_in_scope = (await db.execute(select(func.count(Candidate.id)).where(*cand_conds))).scalar() or 0

    # ── Talent DB: people who fit an open role but aren't in its pipeline ───
    active_job = and_(
        Job.organization_id == org_id,
        Job.status == JobStatus.ACTIVE,
        func.lower(func.trim(Job.title)) == func.lower(func.trim(Candidate.applied_job_title)),
    )
    talent_matches = (await db.execute(
        select(func.count(func.distinct(Candidate.id)))
        .select_from(Candidate)
        .join(Job, active_job)
        .where(
            Candidate.organization_id == org_id,
            Candidate.match_score >= MATCH_THRESHOLD,
            ~exists().where(Application.candidate_id == Candidate.id, Application.job_id == Job.id),
            or_(Candidate.pipeline_stage.is_(None), ~Candidate.pipeline_stage.in_(HIRED_STAGES)),
        )
    )).scalar() or 0

    calibration = [c.model_dump() for c in await interviewer_calibration(org_id, db)]

    result = {
        "job_id": str(job_id) if job_id else None,
        "total_applications": total_apps,
        "hires": hires,
        "avg_match_score": round(float(avg_score), 1) if avg_score is not None else None,
        "time_to_hire_days": round(float(hire_seconds) / 86400, 1) if hire_seconds else None,
        "funnel": funnel,
        "pass_rates": pass_rates,
        "sources": sources,
        "top_skills": [{"skill": s, "count": c} for s, c in skill_rows],
        "candidates_in_scope": candidates_in_scope,
        "talent_matches": talent_matches,
        "interviewer_calibration": calibration,
    }
    result["highlights"] = build_highlights(result)
    return result


def build_highlights(d: dict) -> list[str]:
    """Plain-language takeaways from the numbers above. Only states what the data shows."""
    out: list[str] = []
    if not d["total_applications"]:
        return ["No applications on your open positions yet. Insights appear as candidates move through the pipeline."]

    hired = d["hires"]
    out.append(
        f"{d['total_applications']} applications so far; {hired} hired "
        f"({_rate(hired, d['total_applications'])}%)." if hired else
        f"{d['total_applications']} applications so far; no hires yet."
    )
    meaningful = [p for p in d["pass_rates"] if p["entered"] >= 5]
    if meaningful:
        worst = min(meaningful, key=lambda p: p["pass_rate"])
        out.append(
            f"Biggest drop-off: only {worst['pass_rate']}% move from {worst['from_step']} to {worst['to_step']}."
        )
    ranked = [s for s in d["sources"] if s["applications"] >= 5 and s["source"] != "unknown"]
    if len(ranked) >= 2 and ranked[0]["rate"] > 0:
        best = ranked[0]
        out.append(f"{best['source'].replace('_', ' ').title()} is your strongest source: "
                   f"{best['rate']}% of its candidates reach final interviews.")
    if d["time_to_hire_days"] is not None:
        out.append(f"Average time to hire is {d['time_to_hire_days']:g} days from application.")
    if d["talent_matches"]:
        out.append(f"{d['talent_matches']} candidates already in your Talent DB fit an open role "
                   f"and aren't in its pipeline yet.")
    return out
