"""Screening review list API against a real (test) Postgres: listing, approve,
override, dismiss, failures and org isolation. Side effects that leave the
process (AI scoring, Celery, Elasticsearch, invite emails) are faked."""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.screening_recommendation import ScreeningRecommendation
from tests.conftest import auth_headers


@pytest.fixture(autouse=True)
def no_side_effects(monkeypatch):
    from app.routers import candidates as cand_router
    from app.routers import pre_screening
    from app.services.ai import match_scorer

    sent = []

    async def fake_score(**kwargs):
        return 77.0, {"final_score": 77.0}

    async def fake_create_session(body, current_user, db, background_tasks):
        sent.append({"candidate_id": str(body.candidate_id), "job_id": str(body.job_id)})
        return {"candidate_email": "x@example.com", "questions_count": 10}

    async def noop(*a, **k):
        return None

    monkeypatch.setattr(match_scorer, "evaluate_candidate_match", fake_score)
    monkeypatch.setattr(cand_router.notify_organization_roles, "delay", lambda *a, **k: None)
    monkeypatch.setattr(cand_router.notify_candidate_stage_change, "delay", lambda *a, **k: None)
    monkeypatch.setattr(cand_router.es_service, "index_candidate", noop)
    monkeypatch.setattr(pre_screening, "create_session", fake_create_session)
    return sent


@pytest_asyncio.fixture
async def job(db_session, organization):
    j = Job(organization_id=organization.id, title="Python Developer", description="Django APIs",
            skills_required=["Python", "Django"], status="active")
    db_session.add(j)
    await db_session.commit()
    return j


async def _candidate(db_session, org, name="Ankit Shah"):
    c = Candidate(organization_id=org.id, full_name=name, email=f"{uuid.uuid4().hex[:8]}@example.com",
                  pipeline_stage="needs_review", skills=["Python"])
    db_session.add(c)
    await db_session.commit()
    return c


async def _rec(db_session, org, cand, recommendation="shortlist", job=None, **over):
    r = ScreeningRecommendation(
        organization_id=org.id, candidate_id=cand.id, job_id=job.id if job else None,
        recommendation=recommendation, reasons=["Good Django experience"], risks=[], confidence="medium",
        score=82.0, matches=[{"job_id": str(job.id), "title": job.title, "score": 82.0}] if job else [],
        decided_by_engine="ai", status="pending", **over,
    )
    db_session.add(r)
    await db_session.commit()
    return r


async def _decide(client, user, ids, action, **extra):
    return await client.post("/v1/screening/decide", headers=auth_headers(user),
                             json={"ids": [str(i) for i in ids], "action": action, **extra})


async def test_queue_lists_pending_for_own_org_only(client, db_session, organization, other_organization,
                                                    recruiter_user, other_org_admin, job):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, job=job)

    res = await client.get("/v1/screening/queue", headers=auth_headers(recruiter_user))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["pending_total"] == 1
    item = data["items"][0]
    assert item["id"] == str(rec.id)
    assert item["candidate"]["full_name"] == "Ankit Shah"
    assert item["job"]["title"] == "Python Developer"
    assert item["reasons"] == ["Good Django experience"]

    other = await client.get("/v1/screening/queue", headers=auth_headers(other_org_admin))
    assert other.json()["data"]["items"] == []


async def test_approve_shortlist_adds_to_pipeline_for_the_job(client, db_session, organization, recruiter_user, job):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "shortlist", job)

    res = await _decide(client, recruiter_user, [rec.id], "approve")

    assert res.status_code == 200
    assert res.json()["data"]["results"][0]["status"] == "approved"
    await db_session.refresh(cand)
    await db_session.refresh(rec)
    assert cand.pipeline_stage == "applied"
    apps = (await db_session.execute(select(Application).where(Application.candidate_id == cand.id))).scalars().all()
    assert [a.job_id for a in apps] == [job.id]
    assert rec.status == "approved" and rec.action_taken == "shortlist" and rec.decided_by_id == recruiter_user.id


async def test_approve_pre_screen_adds_to_pipeline_and_sends_invite(client, db_session, organization,
                                                                    recruiter_user, job, no_side_effects):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "pre_screen", job)

    res = await _decide(client, recruiter_user, [rec.id], "approve")

    assert res.json()["data"]["results"][0]["status"] == "approved"
    assert no_side_effects == [{"candidate_id": str(cand.id), "job_id": str(job.id)}]
    await db_session.refresh(cand)
    assert cand.pipeline_stage == "applied"


async def test_approve_talent_pool_tags_candidate(client, db_session, organization, recruiter_user):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "talent_pool")

    await _decide(client, recruiter_user, [rec.id], "approve")

    await db_session.refresh(cand)
    assert "Talent pool" in cand.tags
    assert cand.pipeline_stage == "needs_review"


async def test_override_to_reject(client, db_session, organization, recruiter_user, job):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "shortlist", job)

    res = await _decide(client, recruiter_user, [rec.id], "override", override_to="reject")

    assert res.json()["data"]["results"][0]["status"] == "overridden"
    await db_session.refresh(cand)
    await db_session.refresh(rec)
    assert cand.pipeline_stage == "rejected"
    assert rec.action_taken == "reject"


async def test_dismiss_changes_nothing(client, db_session, organization, recruiter_user, job):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "shortlist", job)

    await _decide(client, recruiter_user, [rec.id], "dismiss")

    await db_session.refresh(cand)
    await db_session.refresh(rec)
    assert cand.pipeline_stage == "needs_review"
    assert rec.status == "dismissed" and rec.action_taken == "none"
    queue = await client.get("/v1/screening/queue", headers=auth_headers(recruiter_user))
    assert queue.json()["data"]["items"] == []


async def test_failed_action_stays_pending_with_error(client, db_session, organization, recruiter_user):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "talent_pool")

    # Shortlist needs a job, and neither the card nor the request has one.
    res = await _decide(client, recruiter_user, [rec.id], "override", override_to="shortlist")

    result = res.json()["data"]["results"][0]
    assert result["status"] == "failed" and result["error"] == "Pick a job first."
    await db_session.refresh(rec)
    assert rec.status == "pending" and rec.error == "Pick a job first."


async def test_cannot_decide_twice(client, db_session, organization, recruiter_user, job):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "shortlist", job)

    await _decide(client, recruiter_user, [rec.id], "dismiss")
    again = await _decide(client, recruiter_user, [rec.id], "approve")

    assert again.json()["data"]["results"][0]["error"] == "Already decided."
    await db_session.refresh(cand)
    assert cand.pipeline_stage == "needs_review"


async def test_other_org_cannot_decide(client, db_session, organization, recruiter_user, other_org_admin, job):
    cand = await _candidate(db_session, organization)
    rec = await _rec(db_session, organization, cand, "shortlist", job)

    res = await _decide(client, other_org_admin, [rec.id], "approve")

    assert res.json()["data"]["results"][0]["status"] == "missing"
    await db_session.refresh(rec)
    assert rec.status == "pending"
