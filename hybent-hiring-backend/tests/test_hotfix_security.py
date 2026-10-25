"""
Security hotfix (October 2026): candidate accounts kept out of staff APIs,
cross-tenant leaks closed, no default passwords, safer password reset.
Each test names the problem it guards against.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import func, select

from app.dependencies import _candidate_may_access, get_current_user
from app.main import app
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview, InterviewPanelist
from app.models.job import Job
from app.models.password_reset import PasswordResetToken
from app.models.super_admin import SubscriptionPlan
from app.models.user import RefreshToken, User
from app.routers import interviews as interviews_router
from app.services import email_service, invitation_service
from app.utils.security import create_refresh_token, hash_password, verify_password
from tests.conftest import _make_user, auth_headers


def _uses_user_auth(dependant) -> bool:
    return any(d.call is get_current_user or _uses_user_auth(d) for d in dependant.dependencies)


def _fresh_ip() -> str:
    return f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"


async def _candidate(db, org, **over) -> Candidate:
    fields = dict(organization_id=org.id, email=f"c-{uuid.uuid4().hex[:8]}@example.com",
                  full_name="Jane Applicant", skills=[], tags=[])
    fields.update(over)
    cand = Candidate(**fields)
    db.add(cand)
    await db.commit()
    return cand


@pytest.fixture
def sent_resets(monkeypatch):
    """Captures password reset / setup emails instead of sending them."""
    sent = []
    monkeypatch.setattr(email_service, "send_password_reset_email", lambda **kw: sent.append(kw))
    return sent


# ── Candidate accounts stay inside the portal ───────────────────────────────

async def test_candidate_token_is_refused_by_every_staff_endpoint(client, db_session, organization):
    """Anyone can self-register a candidate account for any organization, so
    every user-authenticated route outside the portal must answer 403."""
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
            r = await client.request(method, path, headers={**headers, "X-Forwarded-For": _fresh_ip()})
            if r.status_code != 403:
                leaks.append(f"{method} {route.path} -> {r.status_code}")
    assert leaks == []


async def test_candidate_portal_still_works(client, db_session, organization):
    user = await _make_user(db_session, organization, "candidate")
    await _candidate(db_session, organization, user_id=user.id, email=user.email)
    headers = auth_headers(user)
    for path in (
        "/v1/auth/me", "/v1/users/me", "/v1/notifications", "/v1/notifications/unread-count",
        "/v1/portal/profile", "/v1/portal/jobs", "/v1/portal/my-applications",
        "/v1/portal/my-applications-summary", "/v1/portal/my-interviews", "/v1/portal/my-offers",
    ):
        r = await client.get(path, headers=headers)
        assert r.status_code == 200, (path, r.status_code, r.text[:200])


async def test_staff_still_reach_their_endpoints(client, admin_headers, recruiter_headers):
    for headers in (admin_headers, recruiter_headers):
        for path in ("/v1/interviews", "/v1/offers", "/v1/candidates", "/v1/jobs"):
            r = await client.get(path, headers=headers)
            assert r.status_code == 200, (path, r.status_code, r.text[:200])


# ── Resume URL no longer leaks candidates ───────────────────────────────────

async def test_missing_resume_does_not_leak_candidate_details(client, db_session, other_organization):
    await _candidate(db_session, other_organization, full_name="Secret Person",
                     resume_url="https://files.example/hybent_hiring_resumes/x/resume_abc12345.pdf")
    for name in ("resume_abc12345.pdf", "abc1", "%25", "_"):
        r = await client.get(f"/static/uploads/resumes/{name}")
        assert r.status_code == 404, (name, r.status_code)
        assert "Secret Person" not in r.text


async def test_gemini_test_endpoint_removed(client):
    assert (await client.get("/v1/ai/test-gemini")).status_code == 404


# ── Offers ──────────────────────────────────────────────────────────────────

async def test_offer_respond_is_for_the_hiring_team(client, db_session, organization, recruiter_headers):
    interviewer = await _make_user(db_session, organization, "interviewer")
    url = f"/v1/offers/{uuid.uuid4()}/respond"
    body = {"accept": False}
    assert (await client.post(url, json=body, headers=auth_headers(interviewer))).status_code == 403
    assert (await client.post(url, json=body, headers=recruiter_headers)).status_code == 404


# ── Interviews ──────────────────────────────────────────────────────────────

@pytest.fixture
def quiet_scheduling(monkeypatch):
    monkeypatch.setattr(interviews_router, "send_interview_invite", lambda **kw: None)
    monkeypatch.setattr(interviews_router, "send_interviewer_invite", lambda **kw: None)
    monkeypatch.setattr(interviews_router.notify_interview_team, "delay", lambda *a, **kw: None)
    monkeypatch.setattr(interviews_router.es_service, "index_interview", lambda *a, **kw: None)

    async def no_calendar(**kw):
        return {"meeting_link": None, "event_id": None}
    monkeypatch.setattr(interviews_router, "create_calendar_event", no_calendar)


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


async def test_cross_org_panelist_is_not_invited(client, db_session, organization, recruiter_headers,
                                                 other_org_admin, quiet_scheduling):
    candidate = await _candidate(db_session, organization)
    body = _interview_body(candidate, panelist_ids=[{"user_id": str(other_org_admin.id), "role": "lead"}])
    r = await client.post("/v1/interviews", json=body, headers=recruiter_headers)
    assert r.status_code in (200, 201), r.text
    assert other_org_admin.email not in r.text
    assert (await db_session.execute(select(InterviewPanelist))).first() is None


async def test_same_org_panelist_is_still_added(client, db_session, organization, recruiter_headers, quiet_scheduling):
    interviewer = await _make_user(db_session, organization, "interviewer")
    candidate = await _candidate(db_session, organization)
    body = _interview_body(candidate, panelist_ids=[{"user_id": str(interviewer.id), "role": "lead"}])
    r = await client.post("/v1/interviews", json=body, headers=recruiter_headers)
    assert r.status_code in (200, 201), r.text
    assert [p["user_id"] for p in r.json()["data"]["panelists"]] == [str(interviewer.id)]


async def test_cross_org_application_is_rejected(client, db_session, organization, other_organization,
                                                 recruiter_headers, quiet_scheduling):
    candidate = await _candidate(db_session, organization)
    foreign_job = Job(organization_id=other_organization.id, title="Python Developer",
                      description="Build APIs.", skills_required=["Python"], status="active")
    db_session.add(foreign_job)
    foreign_candidate = await _candidate(db_session, other_organization)
    foreign_app = Application(organization_id=other_organization.id, job_id=foreign_job.id,
                              candidate_id=foreign_candidate.id)
    db_session.add(foreign_app)
    await db_session.commit()
    body = _interview_body(candidate, application_id=str(foreign_app.id))
    r = await client.post("/v1/interviews", json=body, headers=recruiter_headers)
    assert r.status_code == 404, r.text


async def test_interview_list_refuses_candidates(db_session, organization):
    from fastapi import HTTPException
    from app.routers.interviews import list_interviews

    candidate_user = await _make_user(db_session, organization, "candidate")
    with pytest.raises(HTTPException) as exc:
        await list_interviews(current_user=candidate_user, db=db_session)
    assert exc.value.status_code == 403


async def test_interviewer_list_stays_inside_their_org(client, db_session, organization, other_organization,
                                                       other_org_admin):
    """A panelist row pointing at another organization's user (possible
    before the fix) must not show that organization's interview."""
    interviewer = await _make_user(db_session, organization, "interviewer")
    foreign_candidate = await _candidate(db_session, other_organization, full_name="Other Org Candidate")
    foreign = Interview(organization_id=other_organization.id, candidate_id=foreign_candidate.id,
                        scheduled_by_id=other_org_admin.id, title="Their round",
                        scheduled_at=datetime.now(timezone.utc) + timedelta(days=1))
    db_session.add(foreign)
    await db_session.flush()
    db_session.add(InterviewPanelist(interview_id=foreign.id, user_id=interviewer.id, role="lead"))
    await db_session.commit()
    r = await client.get("/v1/interviews", headers=auth_headers(interviewer))
    assert r.status_code == 200
    assert r.json()["data"] == []


# ── No default passwords ────────────────────────────────────────────────────

async def test_new_client_admin_gets_a_setup_link_not_password123(client, db_session, super_admin_headers, sent_resets):
    db_session.add(SubscriptionPlan(name="Standard", term_months=1, price_monthly=69.0,
                                    price_yearly=828.0, sort_order=1))
    await db_session.commit()
    r = await client.post("/v1/super-admin/clients", headers=super_admin_headers, json={
        "name": "Globex", "slug": f"globex-{uuid.uuid4().hex[:6]}",
        "admin_email": "owner@globex-example.com", "admin_name": "Hank Scorpio", "plan_name": "Standard",
    })
    assert r.status_code in (200, 201), r.text
    admin = (await db_session.execute(select(User).where(User.email == "owner@globex-example.com"))).scalar_one()
    assert admin.is_active
    assert not verify_password("password123", admin.hashed_password)
    token = (await db_session.execute(select(PasswordResetToken).where(PasswordResetToken.user_id == admin.id))).scalar_one()
    assert token.expires_at > datetime.now(timezone.utc) + timedelta(days=2)
    assert [e["to_email"] for e in sent_resets] == ["owner@globex-example.com"]
    assert token.token in sent_resets[0]["reset_url"]

    # The emailed link sets the password and lets the admin in.
    new_password = "Globex-Admin-2026!"
    assert (await client.post("/v1/auth/reset-password",
                              json={"token": token.token, "new_password": new_password})).status_code == 200
    login = await client.post("/v1/auth/login", json={"email": "owner@globex-example.com", "password": new_password})
    assert login.status_code == 200, login.text


async def test_super_admin_reset_emails_a_link_instead_of_password123(client, db_session, organization,
                                                                       super_admin_headers, sent_resets):
    user = await _make_user(db_session, organization, "recruiter")
    old_hash = user.hashed_password
    r = await client.post(f"/v1/super-admin/users/{user.id}/reset-password", headers=super_admin_headers)
    assert r.status_code == 200, r.text
    assert "password123" not in r.text
    await db_session.refresh(user)
    assert user.hashed_password == old_hash  # unchanged until the link is used
    assert [e["to_email"] for e in sent_resets] == [user.email]


# ── Password reset and login ────────────────────────────────────────────────

async def _user_with_email(db, org, email, password="Original-Pass-2026!") -> User:
    user = User(organization_id=org.id, email=email, hashed_password=hash_password(password),
                full_name="Rahul Shah", role="recruiter", is_active=True, is_verified=True)
    db.add(user)
    await db.commit()
    return user


async def test_login_ignores_email_letter_case(client, db_session, organization):
    await _user_with_email(db_session, organization, "Rahul.Shah@example.com")
    for typed in ("Rahul.Shah@example.com", "rahul.shah@example.com", "RAHUL.SHAH@EXAMPLE.COM"):
        r = await client.post("/v1/auth/login", json={"email": typed, "password": "Original-Pass-2026!"},
                              headers={"X-Forwarded-For": _fresh_ip()})
        assert r.status_code == 200, (typed, r.text)
    wrong = await client.post("/v1/auth/login", json={"email": "rahul.shah@example.com", "password": "nope-nope-1A!"},
                              headers={"X-Forwarded-For": _fresh_ip()})
    assert wrong.status_code == 401


async def test_ambiguous_letter_case_is_not_guessed(client, db_session, organization):
    await _user_with_email(db_session, organization, "Twin@example.com")
    await _user_with_email(db_session, organization, "twin@example.com")
    r = await client.post("/v1/auth/login", json={"email": "tWiN@example.com", "password": "Original-Pass-2026!"})
    assert r.status_code == 401


async def test_forgot_password_ignores_email_letter_case(client, db_session, organization, sent_resets):
    await _user_with_email(db_session, organization, "Rahul.Shah@example.com")
    r = await client.post("/v1/auth/forgot-password", json={"email": "rahul.shah@example.com"})
    assert r.status_code == 200
    assert [e["to_email"] for e in sent_resets] == ["Rahul.Shah@example.com"]


async def test_password_reset_signs_out_other_sessions(client, db_session, organization, sent_resets):
    user = await _user_with_email(db_session, organization, f"reset-{uuid.uuid4().hex[:6]}@example.com")
    old_refresh = create_refresh_token()
    db_session.add(RefreshToken(user_id=user.id, token=old_refresh,
                                expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
    await db_session.commit()

    await client.post("/v1/auth/forgot-password", json={"email": user.email})
    token = sent_resets[0]["reset_url"].rsplit("token=", 1)[1]
    r = await client.post("/v1/auth/reset-password", json={"token": token, "new_password": "Brand-New-Pass-2026!"})
    assert r.status_code == 200, r.text

    refreshed = await client.post("/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 401
    login = await client.post("/v1/auth/login", json={"email": user.email, "password": "Brand-New-Pass-2026!"})
    assert login.status_code == 200


# ── Candidate magic link ────────────────────────────────────────────────────

@pytest.fixture
def invitations(monkeypatch):
    sent = []

    async def fake_create_invitation(**kw):
        sent.append(kw)
    monkeypatch.setattr(invitation_service, "create_invitation", fake_create_invitation)
    return sent


async def test_magic_link_never_creates_candidates(client, db_session, organization, invitations):
    r = await client.post("/v1/auth/candidate/magic-link", json={"email": "stranger@example.com"})
    assert r.status_code == 200
    assert invitations == []
    count = (await db_session.execute(select(func.count(Candidate.id)))).scalar()
    assert count == 0


async def test_magic_link_for_candidate_at_two_organizations(client, db_session, organization,
                                                            other_organization, invitations):
    portal_user = await _make_user(db_session, other_organization, "candidate")
    linked = await _candidate(db_session, other_organization, email="Priya@example.com", user_id=portal_user.id)
    await _candidate(db_session, organization, email="priya@example.com")
    r = await client.post("/v1/auth/candidate/magic-link", json={"email": "priya@example.com"})
    assert r.status_code == 200, r.text
    assert [i["candidate_id"] for i in invitations] == [linked.id]
