"""
Tests for the Copilot intent router: fast-path greeting detection (pure),
and follow-up context resolution (Postgres-backed, using the tenant
isolation fixtures already built for the email-accounts feature).
"""
import pytest
import pytest_asyncio

from app.models.candidate import Candidate
from app.services.ai.copilot_router import (
    CopilotIntent,
    RoutedIntent,
    is_greeting,
    resolve_context,
    build_last_context,
)


# ── is_greeting: pure function, no DB ───────────────────────────────────────────

@pytest.mark.parametrize("text", ["Hi", "hello", "Hey!", "Good morning", "hi there".replace(" there", ""), "namaste"])
def test_is_greeting_matches_plain_greetings(text):
    assert is_greeting(text) is True


@pytest.mark.parametrize("text", [
    "What can you help me with?",
    "how can you help",
])
def test_is_greeting_matches_help_prompts(text):
    assert is_greeting(text) is True


@pytest.mark.parametrize("text", [
    "Ankit ka experience kitna hai?",
    "Help me find a candidate.",  # vague but a genuine search request, not a greeting
    "Hi, does Ankit know Python?",  # greeting + real question — must not short-circuit
    "Python developers dikhao",
])
def test_is_greeting_does_not_match_real_questions(text):
    assert is_greeting(text) is False


# ── resolve_context: Postgres-backed, tenant-scoped ─────────────────────────────

@pytest_asyncio.fixture
async def candidate(db_session, organization) -> Candidate:
    c = Candidate(
        organization_id=organization.id,
        email="ankit@example.com",
        full_name="Ankit Parmar",
        skills=["Python", "FastAPI"],
    )
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest_asyncio.fixture
async def other_org_candidate(db_session, other_organization) -> Candidate:
    c = Candidate(
        organization_id=other_organization.id,
        email="rival@example.com",
        full_name="Ankit Parmar",  # same name, different org
        skills=["Java"],
    )
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest.mark.asyncio
async def test_resolve_context_finds_named_candidate_in_own_org(db_session, organization, candidate):
    routed = RoutedIntent(intent=CopilotIntent.EXPERIENCE_QUERY, candidate_names=["Ankit"])
    resolved = await resolve_context(routed, None, db_session, organization.id)

    assert resolved["not_found"] == []
    assert resolved["ambiguous"] == {}
    assert len(resolved["candidates"]) == 1
    assert resolved["candidates"][0]["id"] == str(candidate.id)


@pytest.mark.asyncio
async def test_resolve_context_never_crosses_tenant_boundary(db_session, other_organization, candidate, other_org_candidate):
    """A same-named candidate exists in `organization`, but we're resolving
    as `other_organization` — must resolve to the other org's own candidate,
    never the first org's."""
    routed = RoutedIntent(intent=CopilotIntent.EXPERIENCE_QUERY, candidate_names=["Ankit"])
    resolved = await resolve_context(routed, None, db_session, other_organization.id)

    assert len(resolved["candidates"]) == 1
    assert resolved["candidates"][0]["id"] == str(other_org_candidate.id)
    assert resolved["candidates"][0]["id"] != str(candidate.id)


@pytest.mark.asyncio
async def test_resolve_context_reports_not_found(db_session, organization):
    routed = RoutedIntent(intent=CopilotIntent.EXPERIENCE_QUERY, candidate_names=["Nonexistent Person"])
    resolved = await resolve_context(routed, None, db_session, organization.id)

    assert resolved["not_found"] == ["Nonexistent Person"]
    assert resolved["candidates"] == []


@pytest.mark.asyncio
async def test_resolve_context_falls_back_to_last_context_for_bare_followup(db_session, organization, candidate):
    """'aur FastAPI?' names no candidate — must resolve against last_context."""
    routed = RoutedIntent(intent=CopilotIntent.SKILL_QUERY, candidate_names=[], skills=["FastAPI"])
    last_context = {"candidate_id": str(candidate.id), "candidate_name": candidate.full_name}

    resolved = await resolve_context(routed, last_context, db_session, organization.id)

    assert resolved["used_followup"] is True
    assert resolved["candidates"] == [{"id": str(candidate.id), "name": candidate.full_name}]


def test_build_last_context_preserves_previous_when_nothing_new_resolved():
    previous = {"candidate_id": "abc", "candidate_name": "Ankit Parmar"}
    resolved = {"candidates": [], "job_id": None, "job_title": None}

    ctx = build_last_context(resolved, previous)

    assert ctx == previous


def test_build_last_context_updates_candidate_when_newly_resolved():
    previous = {"candidate_id": "old-id", "candidate_name": "Old Name"}
    resolved = {"candidates": [{"id": "new-id", "name": "New Name"}], "job_id": None, "job_title": None}

    ctx = build_last_context(resolved, previous)

    assert ctx["candidate_id"] == "new-id"
    assert ctx["candidate_name"] == "New Name"
