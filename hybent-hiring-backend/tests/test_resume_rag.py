"""
Pure-function tests for the resume RAG layer — chunking and similarity
scoring. No DB/network calls, matching the style of tests/test_match_scorer.py.
"""
from app.services.ai.resume_rag import (
    chunk_parsed_resume,
    cosine_similarity,
    keyword_score,
    best_score,
    SECTION_OVERVIEW,
    SECTION_SKILLS,
    SECTION_EXPERIENCE,
    SECTION_PROJECT,
    SECTION_EDUCATION,
    SECTION_CERTIFICATIONS,
)


SAMPLE_PARSED_DATA = {
    "current_title": "Backend Engineer",
    "current_company": "Acme Corp",
    "location": "Ahmedabad",
    "years_experience": 3.5,
    "experience_years": "3.5 Years",
    "summary": "Backend engineer with FastAPI and PostgreSQL experience.",
    "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
    "experience": [
        {
            "title": "Backend Engineer",
            "company": "Acme Corp",
            "duration": "Jan 2022 - Present",
            "description": "Built REST APIs with FastAPI and PostgreSQL.",
        },
        {"title": "", "company": "", "duration": "", "description": ""},
    ],
    "projects": [
        {"name": "Order Service", "description": "Microservice for orders", "technologies": ["FastAPI", "Docker"]},
        {"name": "", "description": "", "technologies": []},
    ],
    "education": [{"degree": "B.Tech", "institution": "GTU", "year": 2020}],
    "certifications": ["AWS Certified Developer"],
}


def test_chunk_parsed_resume_produces_expected_sections():
    chunks = chunk_parsed_resume("Ankit Parmar", SAMPLE_PARSED_DATA)
    sections = [c["section"] for c in chunks]

    assert SECTION_OVERVIEW in sections
    assert SECTION_SKILLS in sections
    assert SECTION_EXPERIENCE in sections
    assert SECTION_PROJECT in sections
    assert SECTION_EDUCATION in sections
    assert SECTION_CERTIFICATIONS in sections

    # Empty experience/project entries must not produce empty chunks
    assert sections.count(SECTION_EXPERIENCE) == 1
    assert sections.count(SECTION_PROJECT) == 1

    overview = next(c["content"] for c in chunks if c["section"] == SECTION_OVERVIEW)
    assert "Ankit Parmar" in overview
    assert "Backend Engineer" in overview

    skills_chunk = next(c["content"] for c in chunks if c["section"] == SECTION_SKILLS)
    assert "FastAPI" in skills_chunk and "PostgreSQL" in skills_chunk


def test_chunk_parsed_resume_handles_missing_data():
    chunks = chunk_parsed_resume("New Candidate", {})
    # With nothing but a name, only the overview line is even a candidate —
    # and that path requires more than just the name to emit a chunk.
    assert chunks == []

    chunks_minimal = chunk_parsed_resume("New Candidate", {"skills": ["Python"]})
    assert len(chunks_minimal) == 1
    assert chunks_minimal[0]["section"] == SECTION_SKILLS


def test_chunk_parsed_resume_is_tenant_agnostic_pure_function():
    # Calling twice with identical input produces identical output —
    # no hidden state / non-determinism in chunking itself.
    a = chunk_parsed_resume("X", SAMPLE_PARSED_DATA)
    b = chunk_parsed_resume("X", SAMPLE_PARSED_DATA)
    assert a == b


def test_cosine_similarity_identical_vectors():
    assert cosine_similarity([1.0, 0.0, 0.0], [1.0, 0.0, 0.0]) == 1.0


def test_cosine_similarity_orthogonal_vectors():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_cosine_similarity_handles_zero_vector():
    # A zero vector (e.g. a bad embedding) must not raise a divide-by-zero.
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_keyword_score_ranks_relevant_content_higher():
    query = "FastAPI experience"
    relevant = "Built REST APIs with FastAPI and PostgreSQL."
    irrelevant = "Certifications: AWS Certified Developer"

    assert keyword_score(query, relevant) > keyword_score(query, irrelevant)


def test_keyword_score_empty_query_returns_zero():
    assert keyword_score("", "some content") == 0.0


def test_best_score_of_empty_list_is_zero():
    assert best_score([]) == 0.0


def test_best_score_returns_top_ranked_chunk_score():
    chunks = [{"score": 0.9, "content": "a"}, {"score": 0.4, "content": "b"}]
    assert best_score(chunks) == 0.9
