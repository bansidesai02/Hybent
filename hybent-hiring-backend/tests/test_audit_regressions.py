"""
Regression tests for HYBENT_BUG_AUDIT_REPORT.md (October 2026).
Each test names the bug it guards.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import select

from app.dependencies import _candidate_may_access, get_current_user
from app.main import app
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import InterviewPanelist
from app.models.job import Job
from app.services import email_service, interview_scheduling
from app.utils.permissions import ApplicationStage
from tests.conftest import _make_user, auth_headers

PDF = ("cv.pdf", b"%PDF-1.4 test resume", "application/pdf")


def _uses_user_auth(dependant) -> bool:
    return any(d.call is get_current_user or _uses_user_auth(d) for d in dependant.dependencies)


async def _job(db, org, **over) -> Job:
    job = Job(organization_id=org.id, title="Python Developer", description="Build APIs.",
              skills_required=["Python"], status="active", **over)
    db.add(job)
    await db.commit()
    return job


async def _candidate(db, org, **over) -> Candidate:
    fields = dict(organization_id=org.id, email=f"c-{uuid.uuid4().hex[:8]}@example.com",
                  full_name="Jane Applicant", skills=[], tags=[])
    fields.update(over)
    cand = Candidate(**fields)
    db.add(cand)
    await db.commit()
    return cand


# ── BUG-001 / BUG-015: candidate accounts stay inside the portal ────────────

async def test_candidate_token_is_refused_by_every_staff_endpoint(client, db_session, organization):
    """Walks every route that authenticates a user. Anything outside the
    candidate allowlist must answer 403 before its handler runs."""
    candidate = await _make_user(db_session, organization, "candidate")
    headers = auth_headers(candidate)
    leaks = []
    for route in app.routes:
        if not isinstance(route, APIRoute) or not _uses_user_auth(route.dependant):
            continue
        if _candidate_may_access(route.path):
            continue
        path = re.sub(r"\{[^}]+\}", str(uuid.uuid4()), route.path)
        for method in route.methods - {"HEAD", "OPTIONS"}:
            # A fresh client IP per request keeps the walk under the rate limit.
            ip = f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"
            r = await client.request(method, path, headers={**headers, "X-Forwarded-For": ip})
            if r.status_code != 403:
                leaks.append(f"{method} {route.path} -> {r.status_code}")
    assert leaks == []


async def test_candidate_portal_endpoints_still_work(client, db_session, organization):
    candidate = await _make_user(db_session, organization, "candidate")
    headers = auth_headers(candidate)
    for path in ("/v1/users/me", "/v1/auth/me", "/v1/notifications", "/v1/portal/my-interviews"):
        r = await client.get(path, headers=headers)
        assert r.status_code == 200, (path, r.status_code, r.text)


async def test_interview_list_refuses_unknown_roles(db_session, organization):
    from fastapi import HTTPException
    from app.routers.interviews import list_interviews

    user = await _make_user(db_session, organization, "candidate")
    with pytest.raises(HTTPException) as exc:
        await list_interviews(current_user=user, db=db_session)
    assert exc.value.status_code == 403


# ── BUG-002: missing resume files are a plain 404 ───────────────────────────

async def test_missing_resume_does_not_leak_candidate_details(client, db_session, other_organization):
    await _candidate(db_session, other_organization, full_name="Secret Person",
                     resume_url="https://files.example/hybent_hiring_resumes/x/resume_abc12345.pdf")
    for name in ("resume_abc12345.pdf", "abc1", "%25", "_"):
        r = await client.get(f"/static/uploads/resumes/{name}")
        assert r.status_code == 404, (name, r.status_code)
        assert "Secret Person" not in r.text


# ── BUG-003: the public Gemini test endpoint is gone ────────────────────────

async def test_gemini_test_endpoint_removed(client):
    assert (await client.get("/v1/ai/test-gemini")).status_code == 404


# ── BUG-004: only the hiring team records an offer response here ───────────

async def test_offer_respond_requires_recruiter(client, db_session, organization, recruiter_headers):
    interviewer = await _make_user(db_session, organization, "interviewer")
    url = f"/v1/offers/{uuid.uuid4()}/respond"
    body = {"accept": False}
    assert (await client.post(url, json=body, headers=auth_headers(interviewer))).status_code == 403
    assert (await client.post(url, json=body, headers=recruiter_headers)).status_code == 404


# ── BUG-005: panelists and application must belong to the organization ─────

@pytest.fixture
def quiet_scheduling(monkeypatch):
    for mod in (interview_scheduling, email_service):
        monkeypatch.setattr(mod, "send_interview_invite", lambda **kw: None)
    monkeypatch.setattr(interview_scheduling, "send_interviewer_invite", lambda **kw: None)
    monkeypatch.setattr(interview_scheduling.notify_interview_team, "delay", lambda *a, **kw: None)

    async def no_calendar(**kw):
        return {"meeting_link": None, "event_id": None}
    monkeypatch.setattr(interview_scheduling, "create_calendar_event", no_calendar)


def _interview_body(candidate, **over):
    body = {
        "candidate_id": str(candidate.id),
        "title": "Technical round",
        "interview_type": "video",
        "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "duration_minutes": 45,
        "panelist_ids": [],
    }
    body.update(over)
    return body


async def test_cross_org_panelist_is_rejected(client, db_session, organization, recruiter_headers,
                                              other_org_admin, quiet_scheduling):
    candidate = await _candidate(db_session, organization)
    body = _interview_body(candidate, panelist_ids=[{"user_id": str(other_org_admin.id)}])
    r = await client.post("/v1/interviews", json=body, headers=recruiter_headers)
    assert r.status_code == 400, r.text
    assert other_org_admin.email not in r.text


async def test_same_org_panelist_is_added(client, db_session, organization, recruiter_headers,
                                          admin_user, quiet_scheduling):
    candidate = await _candidate(db_session, organization)
    body = _interview_body(candidate, panelist_ids=[{"user_id": str(admin_user.id)}])
    r = await client.post("/v1/interviews", json=body, headers=recruiter_headers)
    assert r.status_code == 200, r.text
    panel = (await db_session.execute(select(InterviewPanelist.user_id))).scalars().all()
    assert panel == [admin_user.id]


async def test_cross_org_application_is_rejected(client, db_session, organization, other_organization,
                                                 recruiter_headers, quiet_scheduling):
    candidate = await _candidate(db_session, organization)
    foreign_job = await _job(db_session, other_organization)
    foreign_candidate = await _candidate(db_session, other_organization)
    foreign_app = Application(organization_id=other_organization.id, job_id=foreign_job.id,
                              candidate_id=foreign_candidate.id)
    db_session.add(foreign_app)
    await db_session.commit()
    body = _interview_body(candidate, application_id=str(foreign_app.id))
    r = await client.post("/v1/interviews", json=body, headers=recruiter_headers)
    assert r.status_code == 404, r.text


# ── BUG-007: average hire time comes from real hires ────────────────────────

async def test_avg_hire_time_is_null_without_hires(client, admin_headers):
    r = await client.get("/v1/talent-pool/stats", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["data"]["avg_hire_time"] is None


async def test_avg_hire_time_is_measured(client, db_session, organization, admin_headers):
    job = await _job(db_session, organization)
    candidate = await _candidate(db_session, organization)
    applied = datetime.now(timezone.utc) - timedelta(days=10)
    db_session.add(Application(organization_id=organization.id, job_id=job.id, candidate_id=candidate.id,
                               stage=ApplicationStage.HIRED.value, applied_at=applied,
                               stage_changed_at=applied + timedelta(days=4)))
    await db_session.commit()
    from app.routers import talent_pool
    talent_pool._stats_cache.clear()
    r = await client.get("/v1/talent-pool/stats", headers=admin_headers)
    assert r.json()["data"]["avg_hire_time"] == "4.0d"


# ── BUG-008: /api compatibility routes authenticate properly ────────────────

async def test_compat_routes_authenticate(client, recruiter_headers):
    assert (await client.get("/api/designations")).status_code == 401
    assert (await client.get("/api/designations", headers=recruiter_headers)).status_code == 200


# ── BUG-009: pipeline still groups every applicant ──────────────────────────

async def test_pipeline_lists_applicants(client, db_session, organization, admin_headers):
    job = await _job(db_session, organization)
    for _ in range(3):
        candidate = await _candidate(db_session, organization)
        db_session.add(Application(organization_id=organization.id, job_id=job.id, candidate_id=candidate.id))
    await db_session.commit()
    r = await client.get(f"/v1/pipeline/{job.id}", headers=admin_headers)
    assert r.status_code == 200
    applied = r.json()["data"]["stages"]["applied"]
    assert len(applied) == 3 and all(a["candidate_name"] == "Jane Applicant" for a in applied)


# ── BUG-011: public apply validates name and email ──────────────────────────

@pytest.mark.parametrize("field, value", [("email", "not-an-email"), ("full_name", "x" * 300), ("full_name", "  ")])
async def test_public_apply_rejects_bad_identity(client, db_session, organization, field, value):
    job = await _job(db_session, organization)
    form = {"full_name": "Priya Nair", "email": "priya@example.com", "phone": "+91 98765 43210",
            "current_ctc": "8 LPA", "expected_ctc": "12 LPA", "notice_period": "30 days", field: value}
    r = await client.post(f"/api/public/jobs/{organization.slug}/{job.id}/apply", data=form, files={"resume": PDF})
    assert r.status_code == 400, r.text


# ── BUG-012: an empty signing key is refused everywhere ─────────────────────

def test_empty_secret_key_is_refused():
    from app.core.config import Settings

    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(secret_key="", app_env="development")
