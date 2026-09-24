"""
Response-UX tests for the Recruiter Copilot: answer-first structure,
question-specific formatting, progressive disclosure for large result sets,
and honest zero-result/missing-data wording (see the "answer first" spec
added to COPILOT_SYSTEM_PROMPT §7 and the search_candidates/compare/
match-explanation rewrites in copilot_service.py).

These assert on the actual text `execute_read_tool`/`tool_*` functions
return — the same strings that get streamed to the frontend verbatim — not
on LLM prose (which isn't deterministic enough to assert on), matching the
existing test_copilot_deep_eval.py pattern of real DB fixtures over mocks.
"""
import re
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.services.ai import copilot_service as cs


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
async def ankit(db_session, organization, recruiter_user, job) -> Candidate:
    """The exact recruiter-spec example scenario: 82% match, Python/FastAPI/
    PostgreSQL matched, AWS missing."""
    c = Candidate(
        organization_id=organization.id,
        created_by_id=recruiter_user.id,
        email="ankit.parmar@example.com",
        full_name="Ankit Parmar",
        skills=["Python", "FastAPI", "PostgreSQL"],
        years_experience=3.5,
        experience_years="3.5 Years",
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
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest_asyncio.fixture
async def rahul(db_session, organization, recruiter_user, job) -> Candidate:
    c = Candidate(
        organization_id=organization.id,
        created_by_id=recruiter_user.id,
        email="rahul.shah@example.com",
        full_name="Rahul Shah",
        skills=["Python", "Django"],
        years_experience=2.0,
        experience_years="2 Years",
        match_score=64.0,
        pipeline_stage="pre_screening",
        applied_job_title=job.title,
    )
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


def _frontend_split(content: str) -> list[str]:
    """Mirrors CopilotWidget.tsx's renderBotMessageContent split regex —
    the header must land in its own part or the card parser (which only
    reads emoji-tagged lines) silently drops it, leaving the recruiter
    with no "Found N candidates" line above the cards."""
    return re.split(r"\n\n---\n\n|\n---\n", content)


async def _make_candidates(db_session, organization, recruiter_user, n: int, skill="Python"):
    rows = []
    for i in range(n):
        c = Candidate(
            organization_id=organization.id,
            created_by_id=recruiter_user.id,
            email=f"bulk{i}@example.com",
            full_name=f"Bulk Candidate {i}",
            skills=[skill],
            years_experience=float(i % 6),
            match_score=float(60 + i % 40),
        )
        db_session.add(c)
        rows.append(c)
    await db_session.commit()
    return rows


# ── search_candidates: zero results ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_candidates_zero_results_is_answer_first(db_session, organization):
    result = await cs.execute_read_tool(
        "search_candidates",
        {"query": "Rust Blockchain Engineer"},
        str(organization.id),
        db_session,
    )
    assert result.startswith("**No matching candidates found**")
    assert "retrieved" not in result.lower()
    assert "based on" not in result.lower()


# ── search_candidates: small result set shown in full ───────────────────────

@pytest.mark.asyncio
async def test_search_candidates_small_set_shown_directly(db_session, organization, recruiter_user, ankit, rahul):
    result = await cs.execute_read_tool(
        "search_candidates", {"query": "Python"}, str(organization.id), db_session,
    )
    assert result.startswith("**Found 2 candidates.**")
    assert "Ankit Parmar" in result
    assert "Rahul Shah" in result
    assert "[SUGGEST:" not in result  # a 2-result set needs no narrowing prompt

    # The header must be its own split part — not merged into the first
    # candidate block — or the frontend's emoji-only card parser drops it
    # silently and the recruiter never sees "Found 2 candidates." at all.
    parts = _frontend_split(result)
    assert parts[0].strip() == "**Found 2 candidates.**"
    assert "👤" not in parts[0]


# ── search_candidates: a "how many" question gets ONLY the count ───────────

@pytest.mark.asyncio
async def test_count_question_gets_count_only_no_cards(db_session, organization, recruiter_user, ankit, rahul):
    result = await cs.execute_read_tool(
        "search_candidates", {"query": "Python"}, str(organization.id), db_session,
        user_message="python mai kitne candidates hai",
    )
    assert result == "**Found 2 candidates.**\n\n[SUGGEST:Show candidates]"
    assert "👤" not in result
    assert "Ankit" not in result


@pytest.mark.asyncio
async def test_list_request_with_kitna_still_shows_list(db_session, organization, recruiter_user, ankit, rahul):
    """'dikhao' in the same message overrides the count-only heuristic —
    the recruiter explicitly asked to see them."""
    result = await cs.execute_read_tool(
        "search_candidates", {"query": "Python"}, str(organization.id), db_session,
        user_message="python wale kitne candidates hain, dikhao unko",
    )
    assert "👤 **Ankit Parmar**" in result
    assert "[SUGGEST:Show candidates]" not in result


# ── search_candidates: mid-size set shows a subset, not everything ─────────

@pytest.mark.asyncio
async def test_search_candidates_mid_set_shows_subset_with_suggestion(db_session, organization, recruiter_user):
    await _make_candidates(db_session, organization, recruiter_user, 10)
    result = await cs.execute_read_tool(
        "search_candidates", {"query": "Python"}, str(organization.id), db_session,
    )
    assert result.startswith("**Found 10 candidates.**")
    assert "Showing top" in result
    assert result.count("👤 **Bulk Candidate") == 8  # _SEARCH_SUBSET_SIZE
    assert "[SUGGEST:Show all|Narrow the search]" in result

    parts = _frontend_split(result)
    assert "👤" not in parts[0]
    assert "Showing top" in parts[0]


# ── search_candidates: large set never dumps candidates ────────────────────

@pytest.mark.asyncio
async def test_search_candidates_large_set_is_summarized_not_dumped(db_session, organization, recruiter_user):
    await _make_candidates(db_session, organization, recruiter_user, 30)
    result = await cs.execute_read_tool(
        "search_candidates", {"query": "Python"}, str(organization.id), db_session,
    )
    assert result.startswith("**Found 30 candidates.**")
    assert "👤" not in result  # no individual cards for a 30-result set
    assert "Quick breakdown:" in result
    assert "[SUGGEST:" in result


# ── match score explanation: answer-first, matched/missing sections ────────

@pytest.mark.asyncio
async def test_explain_match_score_is_answer_first(db_session, organization, ankit):
    result = await cs.tool_explain_match_score(str(ankit.id), None, str(organization.id), db_session)
    assert result.startswith("**82.0% match**")
    assert "Matched:" in result
    assert "- Python" in result
    assert "Missing:" in result
    assert "- AWS" in result
    # Never hands the recruiter a final hiring verdict.
    assert "should hire" not in result.lower()
    assert "should not hire" not in result.lower()


@pytest.mark.asyncio
async def test_explain_match_score_missing_data_is_plain(db_session, organization, recruiter_user, job):
    unscored = Candidate(
        organization_id=organization.id,
        created_by_id=recruiter_user.id,
        email="unscored@example.com",
        full_name="Unscored Candidate",
    )
    db_session.add(unscored)
    await db_session.commit()
    await db_session.refresh(unscored)

    result = await cs.tool_explain_match_score(str(unscored.id), None, str(organization.id), db_session)
    assert "I don't have a match score on file" in result
    assert "retrieved" not in result.lower()


# ── candidate comparison: a real Markdown table ─────────────────────────────

@pytest.mark.asyncio
async def test_compare_candidates_renders_as_table(db_session, organization, ankit, rahul):
    result = await cs.tool_compare_candidates([str(ankit.id), str(rahul.id)], str(organization.id), db_session)
    assert result.startswith("**Comparing Ankit Parmar, Rahul Shah**")
    lines = [l for l in result.split("\n") if l.strip()]
    header_line = next(l for l in lines if l.startswith("|") and "Ankit Parmar" in l)
    divider_line = lines[lines.index(header_line) + 1]
    assert set(divider_line.replace("|", "").strip()) <= {"-"}
    assert any(l.startswith("| Match score |") for l in lines)
    assert any(l.startswith("| Experience |") for l in lines)


# ── skill query: direct yes/no ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_users_header_is_its_own_part(db_session, organization, recruiter_user):
    result = await cs.execute_read_tool("search_users", {"name": ""}, str(organization.id), db_session)
    assert result.startswith("**Found")
    parts = _frontend_split(result)
    assert "👤" not in parts[0]


# ── search_users: role filter (for finding real interviewers to schedule with) ──

@pytest.mark.asyncio
async def test_search_users_role_filter_finds_only_interviewers(db_session, organization, recruiter_user):
    interviewer = User(
        organization_id=organization.id,
        email=f"interviewer-{organization.id}@example.com",
        hashed_password="x",
        full_name="Priya Interviewer",
        role="interviewer",
        is_active=True,
        is_verified=True,
    )
    db_session.add(interviewer)
    await db_session.commit()

    result = await cs.execute_read_tool(
        "search_users", {"role": "interviewer"}, str(organization.id), db_session,
    )
    assert "Priya Interviewer" in result
    assert "Test Recruiter" not in result  # recruiter_user must be excluded by the role filter


# ── extract_hallucinated_tool_call: only fires near the start of a reply ────

def test_hallucinated_tool_call_ignores_coherent_answer():
    """A real, complete clarification that happens to mention a tool-shaped
    word deep in the text must not get a canned override appended after it
    — this was the exact bug behind the garbled 'Scheduling Krish Desai's
    Technical Round interview... Please tell me the exact name of the
    candidate' reply."""
    coherent_reply = (
        "**Scheduling Krish Desai's Technical Round interview.** I need:\n"
        "- Date and time\n- Interviewer\n\n"
        "Once scheduled I can also update_candidate_stage later if the stage changes."
    )
    assert cs.extract_hallucinated_tool_call(coherent_reply) is None


def test_hallucinated_tool_call_still_caught_near_start():
    genuinely_hallucinated = 'update_candidate_stage({"candidate_name": "", "new_stage": "hired"})'
    result = cs.extract_hallucinated_tool_call(genuinely_hallucinated)
    assert result is not None
    assert result[0] == "update_candidate_stage"


@pytest.mark.asyncio
async def test_skill_query_yes_no_is_direct(db_session, organization, ankit):
    from app.services.ai.copilot_router import CopilotIntent

    result = await cs.tool_get_resume_fact(
        CopilotIntent.SKILL_QUERY, str(ankit.id), ["Python"], str(organization.id), db_session,
    )
    assert result.startswith("✅ Yes")

    result_no = await cs.tool_get_resume_fact(
        CopilotIntent.SKILL_QUERY, str(ankit.id), ["Kubernetes"], str(organization.id), db_session,
    )
    assert "Not listed" in result_no
