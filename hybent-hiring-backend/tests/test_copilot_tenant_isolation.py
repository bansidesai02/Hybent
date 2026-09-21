"""
Tenant isolation tests for the new Copilot tools and RAG layer. Every one of
these must fail closed (empty result / "not found") when queried with the
wrong organization_id — the same guarantee the existing raw-SQL tools in
copilot_service.py already provide via `WHERE organization_id = :oid`.
"""
import pytest
import pytest_asyncio

from app.models.candidate import Candidate
from app.services.ai import copilot_service as cs
from app.services.ai import resume_rag as rag

PARSED_DATA = {
    "current_title": "Backend Engineer",
    "summary": "Backend engineer with FastAPI experience.",
    "skills": ["Python", "FastAPI", "PostgreSQL"],
    "experience": [
        {"title": "Backend Engineer", "company": "Acme", "duration": "Jan 2022 - Present", "description": "Built APIs with FastAPI."}
    ],
    "education": [{"degree": "B.Tech", "institution": "GTU", "year": 2020}],
}


@pytest_asyncio.fixture
async def scored_candidate(db_session, organization) -> Candidate:
    c = Candidate(
        organization_id=organization.id,
        email="ankit@example.com",
        full_name="Ankit Parmar",
        skills=["Python", "FastAPI", "PostgreSQL"],
        years_experience=3.0,
        experience_years="3 Years",
        parsed_data=PARSED_DATA,
        match_score=82.0,
        score_breakdown={
            "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
            "missing_skills": ["AWS"],
            "reasoning": "Strong technical fit.",
        },
        applied_job_title="Python Developer",
    )
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    # Index RAG chunks without requiring a live embedding call — chunking
    # itself is what tenant isolation depends on, not embedding quality.
    await rag.index_candidate_resume(db_session, c)
    return c


@pytest.mark.asyncio
async def test_get_candidate_details_blocked_across_tenants(db_session, other_organization, scored_candidate):
    result = await cs.tool_get_candidate_details(str(scored_candidate.id), str(other_organization.id), db_session)
    assert "couldn't find" in result.lower()


@pytest.mark.asyncio
async def test_get_candidate_details_works_within_own_tenant(db_session, organization, scored_candidate):
    result = await cs.tool_get_candidate_details(str(scored_candidate.id), str(organization.id), db_session)
    assert scored_candidate.full_name in result


@pytest.mark.asyncio
async def test_explain_match_score_blocked_across_tenants(db_session, other_organization, scored_candidate):
    result = await cs.tool_explain_match_score(str(scored_candidate.id), None, str(other_organization.id), db_session)
    assert "couldn't find" in result.lower()


@pytest.mark.asyncio
async def test_explain_match_score_reads_stored_breakdown_not_recomputed(db_session, organization, scored_candidate):
    result = await cs.tool_explain_match_score(str(scored_candidate.id), None, str(organization.id), db_session)
    assert "82.0%" in result
    assert "AWS" in result  # missing_skills from the stored breakdown
    assert "Strong technical fit." in result  # stored reasoning, not regenerated


@pytest.mark.asyncio
async def test_compare_candidates_blocked_across_tenants(db_session, other_organization, scored_candidate):
    # Only one real candidate resolves in the other org -> below the
    # 2-candidate minimum -> must not leak the first org's candidate data.
    result = await cs.tool_compare_candidates([str(scored_candidate.id)], str(other_organization.id), db_session)
    assert scored_candidate.full_name not in result


@pytest.mark.asyncio
async def test_find_similar_candidates_blocked_across_tenants(db_session, other_organization, scored_candidate):
    result = await cs.tool_find_similar_candidates(str(scored_candidate.id), str(other_organization.id), db_session)
    assert "couldn't find" in result.lower()


@pytest.mark.asyncio
async def test_semantic_search_candidate_scoped_to_organization(db_session, organization, other_organization, scored_candidate):
    own = await rag.semantic_search_candidate(db_session, organization.id, scored_candidate.id, "FastAPI experience")
    cross_tenant = await rag.semantic_search_candidate(db_session, other_organization.id, scored_candidate.id, "FastAPI experience")

    assert len(own) > 0
    assert cross_tenant == []


@pytest.mark.asyncio
async def test_resume_qa_blocked_across_tenants(db_session, other_organization, scored_candidate):
    result = await cs.tool_resume_qa(str(scored_candidate.id), "What skills does this candidate have?", str(other_organization.id), db_session)
    assert "couldn't find" in result.lower()


@pytest.mark.asyncio
async def test_index_candidate_resume_scopes_chunks_to_candidates_own_org(db_session, organization, scored_candidate):
    from sqlalchemy import select
    from app.models.candidate_resume_chunk import CandidateResumeChunk

    res = await db_session.execute(
        select(CandidateResumeChunk).where(CandidateResumeChunk.candidate_id == scored_candidate.id)
    )
    chunks = res.scalars().all()
    assert len(chunks) > 0
    assert all(c.organization_id == organization.id for c in chunks)
