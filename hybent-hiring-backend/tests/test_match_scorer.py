import pytest
from app.services.ai.match_scorer import compute_heuristic_match_score

class MockJob:
    def __init__(self, title, skills_required, min_experience_years):
        self.title = title
        self.skills_required = skills_required
        self.min_experience_years = min_experience_years

def test_compute_heuristic_match_score_full_match():
    job = MockJob(
        title="Senior React Developer",
        skills_required=["React", "TypeScript", "Node.js"],
        min_experience_years=3.0
    )
    candidate_skills = ["React", "TypeScript", "Node.js", "GraphQL"]
    candidate_title = "Senior React Developer"
    years_experience = 4.0
    candidate_education = [{"degree": "Bachelor of Science", "institution": "Tech Univ"}]

    score, breakdown = compute_heuristic_match_score(
        candidate_skills=candidate_skills,
        candidate_title=candidate_title,
        years_experience=years_experience,
        candidate_education=candidate_education,
        job=job,
        match_threshold=70.0
    )

    assert score >= 90.0
    assert breakdown["skills_score"] == 100
    assert breakdown["title_score"] == 100
    assert breakdown["experience_score"] == 100
    assert breakdown["shortlisted"] is True
    assert "React" in breakdown["matched_skills"]

def test_compute_heuristic_match_score_partial_match():
    job = MockJob(
        title="Python Developer",
        skills_required=["Python", "FastAPI", "Docker", "PostgreSQL"],
        min_experience_years=5.0
    )
    candidate_skills = ["Python", "FastAPI"]
    candidate_title = "Junior Software Developer"
    years_experience = 2.0
    candidate_education = []

    score, breakdown = compute_heuristic_match_score(
        candidate_skills=candidate_skills,
        candidate_title=candidate_title,
        years_experience=years_experience,
        candidate_education=candidate_education,
        job=job,
        match_threshold=70.0
    )

    assert score < 70.0
    assert breakdown["skills_score"] == 51
    assert breakdown["shortlisted"] is False
    assert "Docker" in breakdown["missing_skills"]

def test_compute_heuristic_match_score_missing_core_skill():
    job = MockJob(
        title="React Developer",
        skills_required=["React", "TypeScript", "Redux"],
        min_experience_years=3.0
    )
    # Candidate has Python and Django, completely missing React/TypeScript/Redux
    candidate_skills = ["Python", "Django", "PostgreSQL", "Flask"]
    candidate_title = "Backend Developer"
    years_experience = 3.2
    candidate_education = [{"degree": "Bachelor of Technology", "institution": "GTU"}]

    score, breakdown = compute_heuristic_match_score(
        candidate_skills=candidate_skills,
        candidate_title=candidate_title,
        years_experience=years_experience,
        candidate_education=candidate_education,
        job=job,
        match_threshold=70.0
    )

    assert score <= 40.0
    assert breakdown["skills_score"] == 0.0
    assert breakdown["title_score"] <= 30.0
    assert breakdown["shortlisted"] is False

