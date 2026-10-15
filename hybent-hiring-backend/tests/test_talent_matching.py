"""Talent-pool matching against open jobs: the jobs list's Re-engage count and
the Talent DB's suggested matches. Pure DB + the deterministic scorer."""
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from tests.conftest import auth_headers


def _cand(org, name, title, skills, years, stage=None):
    return Candidate(organization_id=org.id, email=f"{name.split()[0].lower()}@example.com", full_name=name,
                     current_title=title, skills=skills, years_experience=years, pipeline_stage=stage,
                     tags=[], parsed_data={"skills": skills, "experience": [], "education": []})


async def _setup(db, org):
    python_job = Job(organization_id=org.id, title="Python Developer", description="APIs", status="active",
                     skills_required=["Python", "Django", "FastAPI", "SQL"], min_experience_years=2)
    bd_job = Job(organization_id=org.id, title="Business Development Executive", description="Sales",
                 status="active", min_experience_years=13,
                 skills_required=["Business Development", "B2B Sales", "Lead Generation", "CRM"])
    general = Job(organization_id=org.id, title="General Application", description="Any", status="active",
                  skills_required=[])
    # Titles differ from the jobs' — the old exact-title rule matched neither.
    punit = _cand(org, "Punit Kumar", "Python Developer (AI/ML Focus)", ["Python", "Django", "FastAPI", "SQL", "PyTorch"], 3.2)
    abhishek = _cand(org, "Abhishek Gupta", "Business Development Consultant",
                     ["Business Development", "B2B Sales", "Lead Generation", "CRM", "Negotiation"], 13, "pre_screening")
    designer = _cand(org, "Riya Shah", "Graphic Designer", ["Figma", "Photoshop"], 4)
    hired = _cand(org, "Hired Person", "Python Developer", ["Python", "Django", "FastAPI", "SQL"], 5, "hired")
    db.add_all([python_job, bd_job, general, punit, abhishek, designer, hired])
    await db.commit()
    return python_job, bd_job, general, punit, abhishek


async def test_reengage_counts_match_by_fit_not_exact_title(client, db_session, organization, recruiter_user):
    python_job, bd_job, general, punit, _ = await _setup(db_session, organization)
    r = await client.get("/v1/jobs", headers=auth_headers(recruiter_user))
    counts = {j["title"]: j["re_engage_count"] for j in r.json()["data"]["items"]}
    assert counts == {"Python Developer": 1, "Business Development Executive": 1, "General Application": 0}

    # Once applied to the job, they're no longer someone to re-engage for it.
    db_session.add(Application(organization_id=organization.id, job_id=python_job.id, candidate_id=punit.id))
    await db_session.commit()
    r = await client.get("/v1/jobs", headers=auth_headers(recruiter_user))
    assert {j["title"]: j["re_engage_count"] for j in r.json()["data"]["items"]}["Python Developer"] == 0


async def test_suggested_matches_and_stats(client, db_session, organization, recruiter_user):
    await _setup(db_session, organization)
    r = await client.get("/v1/talent-pool/suggested-matches", headers=auth_headers(recruiter_user))
    by_job = {m["job_title"]: [c["full_name"] for c in m["candidates"]] for m in r.json()["data"]}
    assert by_job == {"Python Developer": ["Punit Kumar"], "Business Development Executive": ["Abhishek Gupta"]}
    score = r.json()["data"][0]["candidates"][0]["match_score"]
    assert 55 <= score <= 100

    stats = (await client.get("/v1/talent-pool/stats", headers=auth_headers(recruiter_user))).json()["data"]
    assert stats["re_matched_count"] == 2
