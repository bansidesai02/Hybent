"""
Deep end-to-end Copilot evaluation: real fixtures for the categories
discovered by the full-codebase capability audit that test_copilot_eval.py's
router suite can only check the ROUTING decision for — interview feedback/
scorecards, offers (including the "competing offers" trap), analytics/
reports (with real recruiter-vs-admin scoping), bulk import history,
pre-screening sessions, and audit activity.

These build proper test fixtures (never fabricated "production facts") on
the existing tenant-isolation fixture stack from conftest.py, then run the
ACTUAL tool functions (and for a representative subset, the full
classify_intent -> resolve_context -> execute_routed_intent pipeline)
against them — verifying the answer is grounded in the fixture data, correct
counts are returned, and role-based scoping matches what the real
Reports/Analytics/Activity pages enforce, not just that "some text comes
back".

Where the dev database has no equivalent real data (no scorecards, offers,
imports, or pre-screening sessions exist there — see repo docs), this file
is the source of truth for testing those categories; it does not invent
answers to make assertions pass, it builds real rows and asserts the tool
reads them back correctly.
"""
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.import_batch import ImportBatch
from app.models.interview import Interview
from app.models.job import Job
from app.models.offer import Offer
from app.models.pre_screening import PreScreeningSession
from app.models.scorecard import Scorecard
from app.services.activity_service import log_activity
from app.services.ai import copilot_service as cs
from app.services.ai.copilot_router import CopilotIntent, classify_intent, resolve_context


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def job(db_session, organization) -> Job:
    j = Job(
        organization_id=organization.id,
        title="Backend Engineer",
        description="Build and maintain backend APIs.",
        status="active",
        min_experience_years=3,
        skills_required=["Python", "FastAPI", "PostgreSQL"],
    )
    db_session.add(j)
    await db_session.commit()
    await db_session.refresh(j)
    return j


@pytest_asyncio.fixture
async def candidate_with_application(db_session, organization, recruiter_user, job):
    c = Candidate(
        organization_id=organization.id,
        created_by_id=recruiter_user.id,
        email="ankit.parmar@example.com",
        full_name="Ankit Parmar",
        skills=["Python", "FastAPI", "PostgreSQL"],
        years_experience=3.0,
        experience_years="3 Years",
        match_score=82.0,
        score_breakdown={
            "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
            "missing_skills": ["AWS"],
            "reasoning": "Strong technical fit for the role.",
        },
        pipeline_stage="technical_round",
        applied_job_title=job.title,
    )
    db_session.add(c)
    await db_session.flush()
    a = Application(
        organization_id=organization.id, job_id=job.id, candidate_id=c.id,
        stage="technical_round", match_score=82.0,
    )
    db_session.add(a)
    await db_session.commit()
    await db_session.refresh(c)
    await db_session.refresh(a)
    return c, a


@pytest_asyncio.fixture
async def interview_with_scorecard(db_session, organization, recruiter_user, candidate_with_application):
    c, a = candidate_with_application
    iv = Interview(
        organization_id=organization.id, candidate_id=c.id, application_id=a.id,
        scheduled_by_id=recruiter_user.id, title="Technical Round",
        interview_type="technical", status="completed",
        scheduled_at=datetime.now(timezone.utc),
    )
    db_session.add(iv)
    await db_session.flush()
    sc = Scorecard(
        organization_id=organization.id, interview_id=iv.id, application_id=a.id,
        submitted_by_id=recruiter_user.id, overall_rating=4, recommendation="yes",
        strengths="Strong Python and FastAPI fundamentals, clean code in the live exercise.",
        weaknesses="Limited exposure to AWS/cloud infrastructure.",
        summary="Solid technical candidate, recommend advancing.",
    )
    db_session.add(sc)
    await db_session.commit()
    return iv, sc


@pytest_asyncio.fixture
async def offer(db_session, organization, recruiter_user, candidate_with_application):
    c, a = candidate_with_application
    o = Offer(
        organization_id=organization.id, application_id=a.id, created_by_id=recruiter_user.id,
        status="sent", base_salary=1200000.0, salary_currency="INR",
        position_title="Backend Engineer",
    )
    db_session.add(o)
    await db_session.commit()
    await db_session.refresh(o)
    return o


@pytest_asyncio.fixture
async def import_batch(db_session, organization, recruiter_user):
    b = ImportBatch(
        organization_id=organization.id, imported_by_id=recruiter_user.id,
        file_name="backend_candidates_sept.xlsx", total_rows=20,
        success_count=15, failed_count=2, duplicate_count=3, status="completed",
    )
    db_session.add(b)
    await db_session.commit()
    await db_session.refresh(b)
    return b


@pytest_asyncio.fixture
async def pre_screening_session(db_session, organization, recruiter_user, candidate_with_application):
    c, a = candidate_with_application
    s = PreScreeningSession(
        organization_id=organization.id, candidate_id=c.id, created_by_id=recruiter_user.id,
        questions=[{"id": 1, "text": "Tell me about yourself", "category": "role_awareness"}],
        status="completed", invite_token="test-token-123",
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        overall_ai_summary="Candidate demonstrated strong Python fundamentals and clear communication.",
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    return s


@pytest_asyncio.fixture
async def audit_entries(db_session, organization, recruiter_user, admin_user, candidate_with_application):
    c, a = candidate_with_application
    await log_activity(db_session, organization.id, recruiter_user.id, "CREATE", "candidate", str(c.id), {"name": c.full_name})
    await log_activity(db_session, organization.id, admin_user.id, "UPDATE_STAGE", "candidate", str(c.id), {"from": "applied", "to": "technical_round"})
    await db_session.commit()


# ── Interview feedback / scorecards ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_interview_feedback_reflects_real_scorecard(db_session, organization, candidate_with_application, interview_with_scorecard):
    c, _ = candidate_with_application
    result = await cs.tool_get_interview_feedback(str(c.id), str(organization.id), db_session)
    assert "4/5" in result
    assert "Hire" in result
    assert "AWS" in result  # weakness text
    assert "Strong Python" in result  # strength text


@pytest.mark.asyncio
async def test_interview_feedback_honest_when_none_submitted(db_session, organization, candidate_with_application):
    c, _ = candidate_with_application
    result = await cs.tool_get_interview_feedback(str(c.id), str(organization.id), db_session)
    assert "no interview feedback" in result.lower()


@pytest.mark.asyncio
async def test_interview_feedback_blocked_across_tenants(db_session, other_organization, candidate_with_application, interview_with_scorecard):
    c, _ = candidate_with_application
    result = await cs.tool_get_interview_feedback(str(c.id), str(other_organization.id), db_session)
    assert "couldn't find" in result.lower()


# ── Offers ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_offer_query_reflects_real_offer(db_session, organization, candidate_with_application, offer):
    c, _ = candidate_with_application
    result = await cs.tool_get_offers(str(c.id), None, str(organization.id), db_session)
    assert "Sent" in result
    assert "1,200,000" in result or "1200000" in result


@pytest.mark.asyncio
async def test_offer_query_honest_when_none_exists(db_session, organization, candidate_with_application):
    c, _ = candidate_with_application
    result = await cs.tool_get_offers(str(c.id), None, str(organization.id), db_session)
    assert "no offer" in result.lower()


@pytest.mark.asyncio
async def test_competing_offers_not_conflated_with_real_offer(db_session, organization, candidate_with_application, offer):
    """'Competing offers' is a different model (OtherOffer, candidate-portal-only,
    never exposed to recruiters) — asking about it must NOT return Hybent's own
    offer data, which would misrepresent what's actually known."""
    c, _ = candidate_with_application
    result = await cs.tool_get_offers(
        str(c.id), None, str(organization.id), db_session,
        user_message="Does this candidate have any competing offers?",
    )
    assert "sent" not in result.lower() and "1,200,000" not in result
    assert "don't have visibility" in result.lower()


# ── Analytics / reports — including recruiter-vs-admin scoping ─────────────

@pytest.mark.asyncio
async def test_analytics_report_counts_match_fixtures_for_admin(db_session, organization, admin_user, candidate_with_application):
    result = await cs.tool_get_analytics_report(None, None, str(admin_user.id), "admin", str(organization.id), db_session)
    assert "Applied: **1**" in result


@pytest.mark.asyncio
async def test_analytics_report_scopes_to_own_candidates_for_recruiter(db_session, organization, candidate_with_application):
    """A recruiter who did NOT create the candidate must see 0 — this is the
    same restriction report_service.py enforces for the real Reports page;
    the Copilot must not show them another recruiter's numbers."""
    from app.models.user import User
    from app.utils.permissions import UserRole
    from app.utils.security import hash_password
    import uuid as _uuid

    other_recruiter = User(
        organization_id=organization.id,
        email=f"other-recruiter-{_uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("password123"),
        full_name="Other Recruiter",
        role=UserRole.RECRUITER.value,
        is_active=True, is_verified=True,
    )
    db_session.add(other_recruiter)
    await db_session.commit()
    await db_session.refresh(other_recruiter)

    result = await cs.tool_get_analytics_report(None, None, str(other_recruiter.id), "recruiter", str(organization.id), db_session)
    assert "Applied: **0**" in result


@pytest.mark.asyncio
async def test_analytics_score_distribution_reflects_application_score(db_session, organization, admin_user, candidate_with_application):
    result = await cs.tool_get_analytics_report("score_distribution", None, str(admin_user.id), "admin", str(organization.id), db_session)
    assert "81-100%: 1" in result


@pytest.mark.asyncio
async def test_analytics_time_to_hire_honest_when_unavailable(db_session, organization, admin_user, candidate_with_application):
    result = await cs.tool_get_analytics_report("time to hire", None, str(admin_user.id), "admin", str(organization.id), db_session)
    assert "isn't available" in result.lower() or "not available" in result.lower()
    # Must NEVER show the known-fake talent-pool placeholder value.
    assert "2.1d" not in result


# ── Bulk import ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_import_history_reflects_real_batch(db_session, organization, import_batch):
    result = await cs.tool_get_import_history(str(organization.id), db_session)
    assert "backend_candidates_sept.xlsx" in result
    assert "15 created" in result
    assert "3 duplicates skipped" in result


@pytest.mark.asyncio
async def test_import_history_honest_when_none_run(db_session, organization):
    result = await cs.tool_get_import_history(str(organization.id), db_session)
    assert "no bulk imports" in result.lower()


# ── Pre-screening ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pre_screening_reflects_real_session(db_session, organization, candidate_with_application, pre_screening_session):
    c, _ = candidate_with_application
    result = await cs.tool_get_pre_screening_status(str(c.id), str(organization.id), db_session)
    assert "Completed" in result
    assert "strong Python fundamentals" in result


@pytest.mark.asyncio
async def test_pre_screening_honest_when_not_sent(db_session, organization, candidate_with_application):
    c, _ = candidate_with_application
    result = await cs.tool_get_pre_screening_status(str(c.id), str(organization.id), db_session)
    assert "not been sent" in result.lower()


# ── Activity / audit trail ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_activity_admin_sees_all_org_actions(db_session, organization, admin_user, audit_entries):
    result = await cs.tool_get_activity(str(admin_user.id), "admin", str(organization.id), db_session)
    assert "Create" in result and "Update Stage" in result


@pytest.mark.asyncio
async def test_activity_recruiter_sees_only_own_actions(db_session, organization, recruiter_user, admin_user, audit_entries):
    """recruiter_user only performed the CREATE action in the fixture; the
    UPDATE_STAGE was done by admin_user — a recruiter-role caller must not
    see that second entry, matching activities.py's own restriction."""
    result = await cs.tool_get_activity(str(recruiter_user.id), "recruiter", str(organization.id), db_session)
    assert "Create" in result
    assert "Update Stage" not in result


# ── Full pipeline: router -> resolve -> tool, against real fixtures ─────────

@pytest.mark.asyncio
async def test_full_pipeline_interview_feedback_question(db_session, organization, candidate_with_application, interview_with_scorecard):
    c, _ = candidate_with_application
    q = "How did Ankit's technical interview go?"
    routed = await classify_intent(q, None)
    assert routed.intent == CopilotIntent.INTERVIEW_FEEDBACK_QUERY

    resolved = await resolve_context(routed, None, db_session, organization.id)
    reply = await cs.execute_routed_intent(routed, resolved, str(organization.id), db_session, q)
    assert "4/5" in reply


@pytest.mark.asyncio
async def test_full_pipeline_offer_question(db_session, organization, candidate_with_application, offer):
    q = "Has the offer been sent to Ankit yet?"
    routed = await classify_intent(q, None)
    assert routed.intent == CopilotIntent.OFFER_QUERY

    resolved = await resolve_context(routed, None, db_session, organization.id)
    reply = await cs.execute_routed_intent(routed, resolved, str(organization.id), db_session, q)
    assert "sent" in reply.lower()


@pytest.mark.asyncio
async def test_full_pipeline_analytics_question(db_session, organization, admin_user, candidate_with_application):
    q = "Give me a recruitment report."
    routed = await classify_intent(q, None)
    assert routed.intent == CopilotIntent.ANALYTICS_QUERY

    resolved = await resolve_context(routed, None, db_session, organization.id)
    reply = await cs.execute_routed_intent(
        routed, resolved, str(organization.id), db_session, q,
        user_id=str(admin_user.id), user_role="admin",
    )
    assert "Applied: **1**" in reply
