"""Candidate-facing application paths against a real (test) Postgres: the
public apply link and the candidate portal (open jobs, apply, profile), the
portal "joined" notification, and the upload page's reject action.

AI parsing/scoring, file storage, RAG indexing and Celery are faked — the
tests check what the app does with their results."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.invitation import CandidateInvitation
from app.models.job import Job
from app.models.user import User
from app.services.ai.resume_parser import NotAResumeError
from app.utils.category import extract_all_categories, extract_core_category, is_role_mismatch
from app.utils.permissions import UserRole
from app.utils.security import hash_password
from tests.conftest import auth_headers

PARSED = {
    "full_name": "Priya Nair",
    "email": "priya@example.com",
    "phone": "+91 9876543210",
    "location": "Pune",
    "current_title": "Python Developer",
    "current_company": "Acme Labs",
    "years_experience": 3.5,
    "experience_years": "3.5 Years",
    "summary": "Backend engineer focused on Django APIs.",
    "skills": ["Python", "Django", "PostgreSQL"],
    "education": [{"degree": "B.E.", "institution": "COEP", "year": 2020}],
    "experience": [
        {"title": "Python Developer", "company": "Acme Labs", "duration": "Jan 2022 - Present",
         "description": "Built Django REST APIs."},
        {"title": "Intern", "company": "Beta", "duration": "Jun 2021 - Dec 2021", "description": "Scripts."},
    ],
    "projects": [],
    "certifications": [],
}
PDF = ("resume.pdf", b"%PDF-1.4 fake resume bytes", "application/pdf")


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    """Records what would have left the process."""
    from app.services import resume_intake
    from app.services.ai import match_scorer, resume_parser
    from app.routers import candidates as cand_router
    from app.tasks import notifications, screening

    calls = {"parse": 0, "score": [], "notify": [], "parse_error": None}

    async def fake_parse(content, content_type, filename, **kwargs):
        calls["parse"] += 1
        if calls["parse_error"]:
            raise calls["parse_error"]
        return {**PARSED, "experience": [dict(e) for e in PARSED["experience"]]}

    async def fake_score(**kwargs):
        calls["score"].append(kwargs["job"].title)
        return 82.5, {"final_score": 82.5, "skills_score": 90, "reasoning": "Strong Django match."}

    async def fake_save_resume(file, organization_id):
        return f"/static/resumes/{uuid.uuid4().hex}.pdf", file.filename

    async def noop(*a, **k):
        return None

    monkeypatch.setattr(resume_parser, "parse_resume", fake_parse)
    monkeypatch.setattr(match_scorer, "evaluate_candidate_match", fake_score)
    monkeypatch.setattr(resume_intake, "save_resume", fake_save_resume)
    monkeypatch.setattr(resume_intake, "stage_candidate_resume_chunks", noop)
    monkeypatch.setattr(notifications.notify_organization_roles, "delay",
                        lambda *a, **k: calls["notify"].append(a))
    monkeypatch.setattr(cand_router.notify_candidate_stage_change, "delay", lambda *a, **k: None)
    monkeypatch.setattr(cand_router.es_service, "index_candidate", noop)
    monkeypatch.setattr(screening, "enqueue_screening", lambda *a, **k: None)
    return calls


def _types(calls):
    return [a[2] for a in calls["notify"]]


async def _job(db, org, title="Python Developer", status="active", **over) -> Job:
    fields = dict(organization_id=org.id, title=title, description="Build Django APIs.",
                  skills_required=["Python", "Django"], status=status)
    fields.update(over)
    job = Job(**fields)
    db.add(job)
    await db.commit()
    return job


@pytest_asyncio.fixture
async def job(db_session, organization):
    return await _job(db_session, organization)


async def _candidate_user(db, org, *, email=None, with_resume=False, parsed=False):
    email = email or f"cand-{uuid.uuid4().hex[:8]}@example.com"
    user = User(organization_id=org.id, email=email, hashed_password=hash_password("password123"),
                full_name="Priya Nair", role=UserRole.CANDIDATE, is_active=True, is_verified=True)
    db.add(user)
    await db.flush()
    cand = Candidate(organization_id=org.id, user_id=user.id, email=email, full_name="Priya Nair",
                     skills=["Python"] if parsed else [], tags=[])
    if with_resume:
        cand.resume_url, cand.resume_filename = "/static/resumes/old.pdf", "old.pdf"
    if parsed:
        cand.parsed_data, cand.years_experience = dict(PARSED), 3.5
    db.add(cand)
    await db.commit()
    return user, cand


def _apply_form(**over):
    form = {"full_name": "Priya Nair", "email": "Priya@Example.com", "phone": "+91 98765 43210",
            "current_ctc": "8 LPA", "expected_ctc": "12 LPA", "notice_period": "30 days"}
    form.update(over)
    return form


# ── 1 & 2: link applications are parsed and scored ──────────────────────────

async def test_link_application_gets_parsed_experience_and_match_score(client, db_session, organization, job, fakes):
    r = await client.post(f"/api/public/jobs/{organization.slug}/{job.id}/apply",
                          data=_apply_form(), files={"resume": PDF})
    assert r.status_code == 200, r.text

    cand = (await db_session.execute(select(Candidate).where(Candidate.email == "priya@example.com"))).scalar_one()
    app = (await db_session.execute(select(Application).where(Application.candidate_id == cand.id))).scalar_one()
    assert fakes["score"] == ["Python Developer"]
    assert app.match_score == 82.5 and cand.match_score == 82.5
    assert cand.score_breakdown["reasoning"] == "Strong Django match."
    assert [e["company"] for e in cand.parsed_data["experience"]] == ["Acme Labs", "Beta"]
    assert cand.years_experience == 3.5 and cand.experience_years == "3.5 Years"
    assert cand.skills == ["Python", "Django", "PostgreSQL"]
    assert (cand.current_title, cand.current_company) == ("Python Developer", "Acme Labs")
    # What the applicant typed wins over the parse; the stage is untouched.
    assert cand.full_name == "Priya Nair" and cand.phone == "+91 9876543210"
    assert cand.pipeline_stage is None and app.stage == "applied"
    assert _types(fakes) == ["application_received"]

    # The recruiter's profile endpoint returns it all.
    from tests.conftest import _make_user
    recruiter = await _make_user(db_session, organization, UserRole.RECRUITER.value)
    detail = (await client.get(f"/v1/candidates/{cand.id}", headers=auth_headers(recruiter))).json()["data"]
    assert detail["match_score"] == 82.5 and len(detail["parsed_data"]["experience"]) == 2


async def test_job_without_requirements_is_parsed_but_not_scored(client, db_session, organization, fakes):
    general = await _job(db_session, organization, title="General Application", skills_required=[])
    r = await client.post(f"/api/public/jobs/{organization.slug}/{general.id}/apply",
                          data=_apply_form(), files={"resume": PDF})
    assert r.status_code == 200
    cand = (await db_session.execute(select(Candidate))).scalar_one()
    assert fakes["score"] == [] and cand.match_score is None
    assert len(cand.parsed_data["experience"]) == 2


async def test_unparseable_resume_still_applies_unscored(client, db_session, organization, job, fakes):
    fakes["parse_error"] = NotAResumeError()
    r = await client.post(f"/api/public/jobs/{organization.slug}/{job.id}/apply",
                          data=_apply_form(), files={"resume": PDF})
    assert r.status_code == 200
    cand = (await db_session.execute(select(Candidate))).scalar_one()
    app = (await db_session.execute(select(Application))).scalar_one()
    assert cand.resume_url and cand.parsed_data is None
    assert app.match_score is None and fakes["score"] == []


async def test_link_application_rejects_non_resume_file_types(client, db_session, organization, job):
    r = await client.post(f"/api/public/jobs/{organization.slug}/{job.id}/apply",
                          data=_apply_form(), files={"resume": ("photo.png", b"\x89PNG....", "image/png")})
    assert r.status_code == 400
    assert (await db_session.execute(select(Candidate))).first() is None


# ── 3: reject + role-mismatch gate ──────────────────────────────────────────

async def test_reject_endpoint_rejects_instead_of_crashing(client, db_session, organization, recruiter_user):
    cand = Candidate(organization_id=organization.id, email="r@example.com", full_name="R",
                     pipeline_stage="needs_review", skills=[], tags=[])
    db_session.add(cand)
    await db_session.commit()
    r = await client.post(f"/v1/candidates/{cand.id}/reject", headers=auth_headers(recruiter_user))
    assert r.status_code == 200, r.text
    assert r.json()["data"]["pipeline_stage"] == "rejected"


@pytest.mark.parametrize("cand_cat, target, skills, expected", [
    ("React", "Full-Stack", ["React", "Node.js"], False),       # free-text target: scorer decides
    ("Data Science", "Data Scientist", ["Python", "PyTorch"], False),
    ("Python", "Qa", ["Python", "Selenium"], False),
    ("Python", "Web", ["Python"], False),
    ("Python", ".Net", ["Python", "Django"], True),               # a real conflict still rejects
    ("Python", ".Net", ["Python", "C#"], False),
    ("React", "Angular", ["React"], True),
    ("Node.js", "MERN Stack", ["Node.js", "React"], False),
])
def test_role_mismatch_only_for_conflicting_known_technologies(cand_cat, target, skills, expected):
    assert is_role_mismatch(cand_cat, target, skills) is expected


def test_javascript_titles_are_not_java():
    assert extract_all_categories("JavaScript Developer") == ["Javascript"]
    assert extract_core_category("Senior JavaScript Engineer") == "Javascript"
    assert extract_all_categories("Java Developer") == ["Java"]


# ── 4: candidate joined notification ───────────────────────────────────────

async def test_portal_registration_notifies_the_org_once(client, db_session, organization, fakes):
    existing = Candidate(organization_id=organization.id, email="jane@example.com", full_name="Jane", skills=[], tags=[])
    db_session.add(existing)
    await db_session.commit()

    r = await client.post("/v1/portal/register", json={
        "email": "Jane@Example.com", "full_name": "Jane Doe", "password": "Passw0rd!x",
        "organization_slug": organization.slug})
    assert r.status_code == 200, r.text
    await db_session.refresh(existing)
    assert existing.user_id is not None  # linked to the existing profile, not a duplicate
    assert (await db_session.execute(select(Candidate))).scalars().all() == [existing]
    joined = [a for a in fakes["notify"] if a[2] == "candidate_joined"]
    assert len(joined) == 1
    assert joined[0][0] == str(organization.id) and set(joined[0][1]) == {"admin", "recruiter"}
    assert joined[0][5] == {"candidate_id": str(existing.id)}


async def test_invitation_join_notifies_once_and_not_on_reinvite(client, db_session, organization, fakes):
    cand = Candidate(organization_id=organization.id, email="inv@example.com", full_name="Inv", skills=[], tags=[])
    db_session.add(cand)
    await db_session.flush()
    expires = datetime.now(timezone.utc) + timedelta(hours=48)
    db_session.add_all([
        CandidateInvitation(organization_id=organization.id, candidate_id=cand.id, email=cand.email, token="tok-1", expires_at=expires),
        CandidateInvitation(organization_id=organization.id, candidate_id=cand.id, email=cand.email, token="tok-2", expires_at=expires),
    ])
    await db_session.commit()

    assert (await client.post("/v1/invitations/use/tok-1", json={"password": "Passw0rd!x"})).status_code == 200
    assert (await client.post("/v1/invitations/use/tok-1", json={"password": "Passw0rd!x"})).status_code == 400
    # A second invitation to an account that already joined: no new alert.
    assert (await client.post("/v1/invitations/use/tok-2", json={"password": "Passw0rd!y"})).status_code == 200
    assert _types(fakes).count("candidate_joined") == 1


# ── 5: open positions ───────────────────────────────────────────────────────

async def test_portal_lists_only_open_published_jobs_of_own_org(client, db_session, organization, other_organization):
    user, _ = await _candidate_user(db_session, organization)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    open_job = await _job(db_session, organization, title="Open")
    await _job(db_session, organization, title="Due today", application_deadline=datetime.now(timezone.utc).replace(hour=0, minute=0))
    for title, status, extra in [("Pool", "pool", {}), ("Draft", "draft", {}), ("Closed", "closed", {}),
                                 ("Paused", "paused", {}), ("Deleted", "active", {"is_deleted": True}),
                                 ("Expired", "active", {"application_deadline": yesterday})]:
        await _job(db_session, organization, title=title, status=status, **extra)
    await _job(db_session, other_organization, title="Other org")

    r = await client.get("/v1/portal/jobs", headers=auth_headers(user))
    assert r.status_code == 200
    assert {j["title"] for j in r.json()["data"]} == {"Open", "Due today"}
    assert any(j["id"] == str(open_job.id) for j in r.json()["data"])
    assert {j["org_slug"] for j in r.json()["data"]} == {organization.slug}  # for share links


async def test_portal_jobs_are_candidates_only(client, recruiter_user):
    assert (await client.get("/v1/portal/jobs", headers=auth_headers(recruiter_user))).status_code == 403


# ── 6: apply from the portal ───────────────────────────────────────────────

async def test_portal_apply_with_new_resume_parses_scores_and_notifies(client, db_session, organization, job, fakes):
    user, cand = await _candidate_user(db_session, organization)
    r = await client.post(f"/v1/portal/jobs/{job.id}/apply", headers=auth_headers(user), files={"resume": PDF})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert body["job_id"] == str(job.id) and body["match_score"] == 82.5 and body["stage"] == "applied"

    await db_session.refresh(cand)
    app = (await db_session.execute(select(Application).where(Application.candidate_id == cand.id))).scalar_one()
    assert app.source == "portal" and app.organization_id == organization.id
    assert cand.resume_filename == "resume.pdf" and len(cand.parsed_data["experience"]) == 2
    assert cand.match_score == 82.5 and cand.applied_job_title == "Python Developer"
    assert _types(fakes) == ["application_received"]

    dup = await client.post(f"/v1/portal/jobs/{job.id}/apply", headers=auth_headers(user))
    assert dup.status_code == 409
    assert len((await db_session.execute(select(Application))).scalars().all()) == 1


async def test_portal_apply_reuses_the_resume_on_file(client, db_session, organization, job, fakes):
    user, cand = await _candidate_user(db_session, organization, with_resume=True, parsed=True)
    r = await client.post(f"/v1/portal/jobs/{job.id}/apply", headers=auth_headers(user))
    assert r.status_code == 201, r.text
    assert fakes["parse"] == 0 and fakes["score"] == ["Python Developer"]
    assert r.json()["data"]["match_score"] == 82.5


async def test_portal_apply_requires_a_resume(client, db_session, organization, job):
    user, _ = await _candidate_user(db_session, organization)
    r = await client.post(f"/v1/portal/jobs/{job.id}/apply", headers=auth_headers(user))
    assert r.status_code == 400
    assert (await db_session.execute(select(Application))).first() is None


async def test_portal_apply_refuses_closed_foreign_and_bad_files(client, db_session, organization, other_organization):
    user, _ = await _candidate_user(db_session, organization, with_resume=True)
    closed = await _job(db_session, organization, status="closed")
    foreign = await _job(db_session, other_organization)
    pool = await _job(db_session, organization, status="pool")
    for j in (closed, foreign, pool):
        assert (await client.post(f"/v1/portal/jobs/{j.id}/apply", headers=auth_headers(user))).status_code == 404
    open_job = await _job(db_session, organization)
    bad = await client.post(f"/v1/portal/jobs/{open_job.id}/apply", headers=auth_headers(user),
                            files={"resume": ("notes.txt", b"hello", "text/plain")})
    assert bad.status_code == 400
    assert (await db_session.execute(select(Application))).first() is None


async def test_portal_apply_is_candidates_only(client, job, recruiter_user):
    r = await client.post(f"/v1/portal/jobs/{job.id}/apply", headers=auth_headers(recruiter_user))
    assert r.status_code == 403


# ── 2: portal profile edits ────────────────────────────────────────────────

async def test_portal_profile_update_saves_skills_and_experience_but_not_recruiter_fields(client, db_session, organization):
    user, cand = await _candidate_user(db_session, organization)
    cand.tags = ["recruiter-tag"]
    await db_session.commit()
    r = await client.put("/v1/portal/profile", headers=auth_headers(user), json={
        "email": cand.email, "experience_years": "18 Months", "skills": ["Go", " ", "Rust"],
        "pipeline_stage": "offered", "hr_notes": "hire!", "tags": ["x"]})
    assert r.status_code == 200, r.text
    await db_session.refresh(cand)
    assert cand.skills == ["Go", "Rust"]
    assert cand.experience_years == "18 Months" and cand.years_experience == 1.5
    assert cand.pipeline_stage is None and cand.hr_notes is None and cand.tags == ["recruiter-tag"]


async def test_referral_link_application_is_recorded_as_referral(client, db_session, organization, job, fakes):
    r = await client.post(f"/api/public/jobs/{organization.slug}/{job.id}/apply",
                          data=_apply_form(source="referral"), files={"resume": PDF})
    assert r.status_code == 200, r.text
    app = (await db_session.execute(select(Application))).scalar_one()
    assert app.source == "referral"
    assert "referral link" in fakes["notify"][0][4]
