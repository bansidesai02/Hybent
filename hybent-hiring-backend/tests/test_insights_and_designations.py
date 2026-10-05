"""
AI Insights numbers come from live pipeline data, and Talent DB designations
can be deleted by recruiters without touching open positions.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.services.insights_service import get_insights, stage_step

from tests.conftest import auth_headers


def test_stage_step_counts_suffixed_stages_toward_their_round():
    assert stage_step("applied") == 0
    assert stage_step("screening_rejected") == 0
    assert stage_step("screening_selected") == 1
    assert stage_step("pre_screening_selected") == 1
    assert stage_step("technical_round_rejected") == 2
    assert stage_step("techno_functional_selected") == 2
    assert stage_step("hr_round_selected") == 3
    assert stage_step("offered_back_out") == 4
    assert stage_step("hired_joined") == 5
    assert stage_step(None) == 0


async def _job(db, org, user, title, status="active"):
    job = Job(organization_id=org.id, created_by_id=user.id, title=title, description=title, status=status)
    db.add(job)
    await db.flush()
    return job


async def _candidate(db, org, name, **kw):
    c = Candidate(organization_id=org.id, full_name=name, email=f"{uuid.uuid4().hex[:8]}@x.com", **kw)
    db.add(c)
    await db.flush()
    return c


@pytest.mark.asyncio
async def test_insights_from_real_pipeline(db_session, organization, admin_user):
    db = db_session
    job = await _job(db, organization, admin_user, "React Developer")
    pool = await _job(db, organization, admin_user, "BDE", status="pool")
    now = datetime.now(timezone.utc)

    stages = ["applied", "technical_round_rejected", "hr_round_selected", "hired"]
    for i, stage in enumerate(stages):
        c = await _candidate(db, organization, f"C{i}", skills=["React", "react ", "Node"], source="linkedin")
        db.add(Application(
            organization_id=organization.id, job_id=job.id, candidate_id=c.id, stage=stage, match_score=80,
            applied_at=now - timedelta(days=10), stage_changed_at=now,
        ))
        # Pool placeholder applications must not count as hiring activity.
        db.add(Application(organization_id=organization.id, job_id=pool.id, candidate_id=c.id, stage="applied"))

    # Fits the open role, not in its pipeline: a Talent DB match.
    await _candidate(db, organization, "Pool fit", applied_job_title="react developer", match_score=75)
    await _candidate(db, organization, "Weak fit", applied_job_title="React Developer", match_score=30)
    await db.commit()

    d = await get_insights(organization.id, db)

    assert d["total_applications"] == 4
    reached = {f["step"]: f["count"] for f in d["funnel"]}
    assert reached == {"Applied": 4, "Shortlisted": 3, "Technical rounds": 3, "Final interviews": 2, "Offer": 1, "Hired": 1}
    assert d["hires"] == 1
    assert d["time_to_hire_days"] == pytest.approx(10, abs=0.1)
    assert d["avg_match_score"] == 80
    assert d["talent_matches"] == 1
    top = {s["skill"].lower(): s["count"] for s in d["top_skills"]}
    assert top["react"] == 8 and top["node"] == 4  # "React" and "react " are one skill
    assert d["sources"][0] == {"source": "linkedin", "applications": 4, "reached_interview": 2, "rate": 50.0}
    assert any("25.0%" in h for h in d["highlights"])


@pytest.mark.asyncio
async def test_insights_empty_org(db_session, organization):
    d = await get_insights(organization.id, db_session)
    assert d["total_applications"] == 0
    assert d["time_to_hire_days"] is None
    assert d["highlights"][0].startswith("No applications")


@pytest.mark.asyncio
async def test_insights_endpoint(client, admin_user):
    resp = await client.get("/v1/analytics/insights", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    assert "funnel" in resp.json()["data"]


@pytest.mark.asyncio
async def test_recruiter_deletes_designation_but_not_open_position(client, db_session, organization, recruiter_user):
    db = db_session
    pool = await _job(db, organization, recruiter_user, "BDE", status="pool")
    open_job = await _job(db, organization, recruiter_user, "React Developer")
    cand = await _candidate(db, organization, "Asha", designation_id=pool.id, applied_job_title="BDE")
    db.add(Application(organization_id=organization.id, job_id=pool.id, candidate_id=cand.id, stage="applied"))
    await db.commit()
    pool_id, open_id, cand_id = pool.id, open_job.id, cand.id

    resp = await client.delete(f"/v1/designations/{open_id}", headers=auth_headers(recruiter_user))
    assert resp.status_code == 404  # open positions are never deleted here

    resp = await client.delete(f"/v1/designations/{pool_id}", headers=auth_headers(recruiter_user))
    assert resp.status_code == 200

    db.expire_all()
    assert (await db.execute(select(Job).where(Job.id == pool_id))).scalar_one_or_none() is None
    assert (await db.execute(select(Job).where(Job.id == open_id))).scalar_one_or_none() is not None
    kept = (await db.execute(select(Candidate).where(Candidate.id == cand_id))).scalar_one()
    assert kept.designation_id is None
