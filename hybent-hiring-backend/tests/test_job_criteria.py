"""Experience outside the job's range: rejected with a reason, score untouched."""
from types import SimpleNamespace

from app.services import job_criteria


def job(lo=0, hi=None):
    return SimpleNamespace(min_experience_years=lo, max_experience_years=hi)


def test_below_minimum():
    r = job_criteria.experience_failure(2, job(4, 6))
    assert r == "Experience is 2 years; this job needs 4-6 years (2 years short)."


def test_above_maximum():
    assert "(6 years over)" in job_criteria.experience_failure(12, job(4, 6))


def test_inside_range_or_unknown_passes():
    assert job_criteria.experience_failure(5, job(4, 6)) is None
    assert job_criteria.experience_failure(None, job(4, 6)) is None
    assert job_criteria.experience_failure(30, job(4, None)) is None
    assert job_criteria.experience_failure(30, job(4, 2)) is None  # bad range: minimum only


def test_annotate_keeps_score_and_rejects_early_stage_only():
    b = job_criteria.annotate({"final_score": 90, "reasoning": "Strong fit.", "shortlisted": True}, 1, job(3))
    assert b["final_score"] == 90 and b["shortlisted"] is False
    assert b["reasoning"].startswith("REJECTED: Experience is 1 year; this job needs at least 3 years")

    app = SimpleNamespace(stage="applied", rejection_reason=None)
    cand = SimpleNamespace(pipeline_stage=None)
    assert job_criteria.apply_outcome(b, app, cand)
    assert app.stage == cand.pipeline_stage == "screening_rejected"
    assert app.rejection_reason.startswith("Experience is 1 year")

    later = SimpleNamespace(stage="technical_round", rejection_reason=None)
    assert job_criteria.apply_outcome(b, later) is None and later.stage == "technical_round"

    ok = job_criteria.annotate({"final_score": 70, "reasoning": "Fine."}, 5, job(3))
    assert ok["criteria_failed"] == [] and ok["reasoning"] == "Fine."
    assert job_criteria.apply_outcome(ok, SimpleNamespace(stage="applied")) is None
