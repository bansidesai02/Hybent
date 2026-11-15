"""Hard job criteria checked by rules (not AI), with a plain reason.

Today: the job's experience range (min_experience_years .. max_experience_years).
A candidate outside it is rejected at screening, and the reason is put at the
top of the match summary. The match score is left exactly as scored: it says
how well the profile fits, the rejection says why it can't go ahead.
"""
from app.utils.permissions import REJECTION_STAGES

REJECTED_STAGE = "screening_rejected"
# Only move candidates who haven't been worked on yet; never undo a recruiter's move.
EARLY_STAGES = {None, "", "applied", "screening", "new", "sourced", "needs_review"}


def _years(v) -> str:
    v = float(v)
    return f"{v:g} year" + ("" if v == 1 else "s")


def experience_failure(years_experience, job) -> str | None:
    """Why the candidate's experience is outside the job's range, or None."""
    if years_experience is None or job is None:
        return None
    lo = float(getattr(job, "min_experience_years", 0) or 0)
    hi = getattr(job, "max_experience_years", None)
    hi = float(hi) if hi not in (None, 0) else None
    if hi is not None and hi < lo:  # a mistyped range: keep the minimum only
        hi = None
    yrs = float(years_experience)
    if lo > 0 and yrs < lo:
        need = f"{lo:g}-{hi:g} years" if hi else f"at least {_years(lo)}"
        return f"Experience is {_years(yrs)}; this job needs {need} ({_years(round(lo - yrs, 1))} short)."
    if hi is not None and yrs > hi:
        need = f"{lo:g}-{hi:g} years" if lo else f"at most {_years(hi)}"
        return f"Experience is {_years(yrs)}; this job needs {need} ({_years(round(yrs - hi, 1))} over)."
    return None


def annotate(breakdown: dict | None, years_experience, job) -> dict | None:
    """Add the criteria result to a match breakdown, reason first in the summary."""
    if breakdown is None:
        return None
    reason = experience_failure(years_experience, job)
    breakdown["criteria_failed"] = [reason] if reason else []
    if reason:
        text = breakdown.get("reasoning") or ""
        if not text.startswith("REJECTED:"):
            breakdown["reasoning"] = f"REJECTED: {reason}\n\n{text}".strip()
        breakdown["shortlisted"] = False
    return breakdown


def apply_outcome(breakdown: dict | None, application=None, candidate=None) -> str | None:
    """Reject a not-yet-reviewed application/candidate whose breakdown failed a
    criterion. Returns the reason when it rejected. No email is sent."""
    failed = (breakdown or {}).get("criteria_failed") or []
    if not failed:
        return None
    reason = failed[0]
    moved = False
    if application is not None and getattr(application, "stage", None) in EARLY_STAGES:
        application.stage = REJECTED_STAGE
        application.rejection_reason = reason
        moved = True
    if candidate is not None and getattr(candidate, "pipeline_stage", None) in EARLY_STAGES \
            and candidate.pipeline_stage not in REJECTION_STAGES:
        candidate.pipeline_stage = REJECTED_STAGE
        moved = True
    return reason if moved else None
