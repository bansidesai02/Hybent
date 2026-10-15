"""
Talent-pool matching: which candidates already in the org fit an open job.

Used by the jobs list's "Re-engage" count, the Talent DB's "Recent matches"
and its "Re-matched to new roles" figure. These used to count only
candidates whose applied_job_title was exactly the job's title and who had a
score from some earlier job — so "Python Developer (AI/ML Focus)" never
matched a "Python Developer" opening, a 13-year consultant never matched a
13-year role, and every count sat at 0.

Each candidate is scored against the job itself with the deterministic
heuristic scorer (skills, title, experience, education) — no AI call, so the
lists stay free and fast to compute on every page load.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.services.ai.match_scorer import compute_heuristic_match_score
from app.services.resume_intake import job_has_requirements
from app.utils.permissions import JobStatus

# Same bar the rest of the app uses for "a match worth acting on" is 70 for
# shortlisting; re-engaging only needs a credible fit, which on the heuristic
# scale is around half the requirements met.
REENGAGE_THRESHOLD = 55.0
# Most recent profiles considered per request — bounds the in-process scoring.
MAX_POOL = 1000
# Stages after which a candidate isn't someone to re-engage.
CLOSED_STAGES = ("offered", "hired", "hired_joined")


async def _pool(db: AsyncSession, organization_id: uuid.UUID) -> list[Candidate]:
    return list((await db.execute(
        select(Candidate)
        .where(
            Candidate.organization_id == organization_id,
            Candidate.is_deleted.is_(False),
            (Candidate.pipeline_stage.is_(None)) | (Candidate.pipeline_stage.notin_(CLOSED_STAGES)),
        )
        .order_by(Candidate.created_at.desc())
        .limit(MAX_POOL)
    )).scalars().all())


async def _applied_pairs(db: AsyncSession, organization_id: uuid.UUID, job_ids: list) -> set[tuple]:
    if not job_ids:
        return set()
    rows = (await db.execute(
        select(Application.candidate_id, Application.job_id).where(
            Application.organization_id == organization_id,
            Application.job_id.in_(job_ids),
        )
    )).all()
    return {(r.candidate_id, r.job_id) for r in rows}


def score_for_job(candidate: Candidate, job: Job) -> tuple[float, dict]:
    parsed = candidate.parsed_data or {}
    return compute_heuristic_match_score(
        candidate_skills=list(candidate.skills or parsed.get("skills") or []),
        candidate_title=candidate.current_title or parsed.get("current_title"),
        years_experience=candidate.years_experience,
        candidate_education=parsed.get("education") if isinstance(parsed.get("education"), list) else [],
        job=job,
        match_threshold=REENGAGE_THRESHOLD,
        candidate_experience=parsed.get("experience") if isinstance(parsed.get("experience"), list) else [],
        candidate_projects=parsed.get("projects") if isinstance(parsed.get("projects"), list) else [],
        candidate_certifications=parsed.get("certifications") if isinstance(parsed.get("certifications"), list) else [],
    )


async def pool_matches(
    db: AsyncSession, organization_id: uuid.UUID, jobs: list[Job]
) -> dict[uuid.UUID, list[dict]]:
    """For each open (active) job: the pool candidates who clear the bar and
    haven't applied to it yet, best first."""
    # A job with no skills or requirements (e.g. "General Application") has
    # nothing to match against — every profile would score the same.
    open_jobs = [
        j for j in jobs
        if j.status == JobStatus.ACTIVE and not j.is_deleted and job_has_requirements(j)
    ]
    result: dict[uuid.UUID, list[dict]] = {j.id: [] for j in jobs}
    if not open_jobs:
        return result

    pool = [c for c in await _pool(db, organization_id) if c.skills or c.parsed_data]
    applied = await _applied_pairs(db, organization_id, [j.id for j in open_jobs])
    for job in open_jobs:
        matches = []
        for cand in pool:
            if (cand.id, job.id) in applied:
                continue
            score, breakdown = score_for_job(cand, job)
            if score >= REENGAGE_THRESHOLD:
                matches.append({"candidate": cand, "score": score, "breakdown": breakdown})
        matches.sort(key=lambda m: m["score"], reverse=True)
        result[job.id] = matches
    return result


async def active_jobs(db: AsyncSession, organization_id: uuid.UUID) -> list[Job]:
    return list((await db.execute(
        select(Job).where(
            Job.organization_id == organization_id,
            Job.status == JobStatus.ACTIVE,
            Job.is_deleted.is_(False),
        ).order_by(Job.created_at.desc())
    )).scalars().all())
