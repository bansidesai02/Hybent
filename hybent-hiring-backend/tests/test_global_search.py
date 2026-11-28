"""
Global Search, GitHub search, job syndication and the Hybent Talent Network.

Outside services (People Data Labs, GitHub, the AI parser, email) are mocked:
these tests never spend credits or send mail.
"""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.talent_network import TalentContactRequest, TalentProfile
from app.services import github_search, job_syndication
from app.services import global_search_service as gs
from app.services import talent_network as tn
from tests.conftest import auth_headers


# ── Pure logic ──────────────────────────────────────────────────────────────

def test_normalize_filters_cleans_and_swaps_years():
    f = gs.normalize_filters({
        "job_titles": [" React Developer ", "react developer", 5, "", "a", "b", "c", "d"],
        "skills": ["React", "JS"], "city": "  Pune ", "country": None,
        "min_years": 9, "max_years": 3,
    })
    assert f["job_titles"] == ["react developer", "a", "b", "c"]
    assert f["skills"] == ["react", "js"]
    assert f["city"] == "pune"
    assert (f["min_years"], f["max_years"]) == (3, 9)


def test_normalize_filters_rejects_garbage():
    f = gs.normalize_filters("not a dict")
    assert f == {"job_titles": [], "skills": [], "city": None, "country": None, "min_years": None, "max_years": None}
    assert gs.normalize_filters({"min_years": "abc", "max_years": 500})["max_years"] is None


@pytest.mark.parametrize("skills,wanted,ok", [
    (["React.js"], "react", True), (["ReactJS"], "react", True), (["Node.js"], "node", True),
    (["Java"], "javascript", False), (["C#"], "c#", True),
])
def test_has_skill_tolerates_js_suffixes(skills, wanted, ok):
    assert gs.has_skill(skills, wanted) is ok


def test_title_similarity_exact_phrase_and_overlap():
    titles = ["react developer", "frontend developer"]
    assert gs.title_similarity("react developer", titles) == 1.0
    assert gs.title_similarity("react developer who loves react native", titles) == 0.85
    assert 0 < gs.title_similarity("senior software developer", titles) < 0.85
    assert gs.title_similarity("technical lead", titles) == 0.0


def test_role_only_search_never_scores_100():
    f = gs.normalize_filters({"job_titles": ["software engineer"]})
    hit = {"job_title": "Software Engineer", "skills": []}
    gs.score_hit(hit, f)
    assert hit["match_score"] <= 70
    assert "Add skills or pick a job" in hit["match_reason"]


def test_scores_spread_by_skills_and_title():
    f = gs.normalize_filters({"job_titles": ["react developer"], "skills": ["react", "typescript"]})
    best = {"job_title": "React Developer", "skills": ["ReactJS", "TypeScript"]}
    half = {"job_title": "Frontend Developer", "skills": ["react.js"]}
    none = {"job_title": "Accountant", "skills": ["tally"]}
    ranked = gs.rank([none, half, best], f)
    assert [h["job_title"] for h in ranked] == ["React Developer", "Frontend Developer", "Accountant"]
    assert ranked[0]["match_score"] > ranked[1]["match_score"] > ranked[2]["match_score"]
    assert ranked[1]["missing_skills"] == ["typescript"]


def test_pdl_query_searches_both_city_spellings():
    q = gs.build_pdl_query(gs.normalize_filters({"job_titles": ["python developer"], "city": "bengaluru",
                                                 "country": "india", "min_years": 3}))
    musts = q["bool"]["must"]
    assert {"terms": {"location_locality": ["bangalore", "bengaluru"]}} in musts
    assert {"range": {"inferred_years_experience": {"gte": 3}}} in musts


def test_placeholder_email_never_deliverable():
    assert gs.placeholder_email("abc-123", "github").endswith("@no-email.invalid")
    assert gs.placeholder_email("abc-123", "github").startswith("github-abc123@")


def test_github_query_only_for_tech_roles():
    react = gs.normalize_filters({"job_titles": ["react developer"], "city": "bangalore"})
    hr = gs.normalize_filters({"job_titles": ["hr executive"], "city": "pune"})
    assert github_search.language_for(react) == "JavaScript"
    assert github_search.is_tech_search(react) and not github_search.is_tech_search(hr)
    assert github_search.build_query(hr) is None
    assert 'location:"bangalore"' in github_search.build_query(react)


@pytest.mark.parametrize("loc,city,ok", [
    ("Ahemedabad", "ahmedabad", True), ("Ahmdabad, Gujarat", "ahmedabad", True),
    ("Bengaluru", "bangalore", True), ("Pune", "ahmedabad", False), (None, "pune", False),
])
def test_network_city_match_tolerates_typos(loc, city, ok):
    assert tn.city_matches(loc, city) is ok


def test_short_name_hides_surname():
    assert tn.short_name("Priya Sharma") == "Priya S."
    assert tn.short_name("Priya Kumari Sharma") == "Priya S."
    assert tn.short_name("Madonna") == "Madonna"


@pytest.mark.parametrize("loc,expected", [
    ("Bengaluru · Hybrid", ("Bengaluru", "India")), ("Pune (Remote)", ("Pune", "India")),
    ("Dubai, UAE", ("Dubai", "UAE")), (None, ("", "India")),
])
def test_feed_city_country(loc, expected):
    assert job_syndication._city_country(loc) == expected


def test_feed_cdata_cannot_be_broken_out_of():
    """Text with "]]>" and markup must come back out of the XML unchanged,
    not end the CDATA block and inject elements."""
    import xml.etree.ElementTree as ET
    evil = "evil ]]><injected/> & <b>"
    node = ET.fromstring(f"<description>{job_syndication._cdata(evil)}</description>")
    assert node.text == evil and len(node) == 0


# ── Fixtures ────────────────────────────────────────────────────────────────

def _job(org, **kw) -> Job:
    return Job(organization_id=org.id, title=kw.pop("title", "React Developer"), description="Build UIs.",
               skills_required=kw.pop("skills_required", ["React", "TypeScript"]), **kw)


@pytest.fixture
def no_outside(monkeypatch):
    """PDL and GitHub answer from canned data."""
    async def fake_pdl(org_id, f):
        return {"total": 1, "cached": False, "results": [{
            "external_id": "pdl-1", "full_name": "Ravi Mehta", "job_title": "React Developer", "company": "Acme",
            "location": "Ahmedabad", "years_experience": None, "skills": ["react", "javascript"],
            "matched_skills": [], "has_email": True, "has_phone": False, "has_linkedin": True,
            "linkedin_url": None, "source": "pdl"}]}

    async def fake_gh(f):
        return {"total": 0, "cached": False, "results": []}

    async def fake_parse(q):
        return gs.normalize_filters({"job_titles": ["react developer"], "skills": ["react"]})

    monkeypatch.setattr(gs, "search_outside", fake_pdl)
    monkeypatch.setattr(github_search, "search_github", fake_gh)
    monkeypatch.setattr(gs, "parse_query", fake_parse)


@pytest.fixture
def no_mail(monkeypatch):
    sent = []
    monkeypatch.setattr(tn, "_send", lambda to, subject, content: sent.append((to, subject)))
    return sent


# ── Global Search API ───────────────────────────────────────────────────────

async def test_search_scopes_own_results_to_the_org(client, db_session, admin_headers, organization,
                                                    other_organization, no_outside):
    db_session.add_all([
        Candidate(organization_id=organization.id, email="mine@example.com", full_name="Mine",
                  current_title="React Developer", skills=["React"]),
        Candidate(organization_id=other_organization.id, email="theirs@example.com", full_name="Theirs",
                  current_title="React Developer", skills=["React"]),
    ])
    await db_session.commit()

    r = await client.post("/v1/search/global", json={"query": "react developer"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert [c["full_name"] for c in data["own"]] == ["Mine"]
    assert data["outside"]["results"][0]["match_score"] > 0
    assert data["network"] == []


async def test_search_needs_a_role_or_skill(client, admin_headers, no_outside):
    r = await client.post("/v1/search/global", json={"filters": {"city": "pune"}}, headers=admin_headers)
    assert r.status_code == 400


async def test_search_rejects_another_orgs_job(client, db_session, admin_headers, other_organization, no_outside):
    job = _job(other_organization)
    db_session.add(job)
    await db_session.commit()
    r = await client.post("/v1/search/global", json={"query": "react", "job_id": str(job.id)}, headers=admin_headers)
    assert r.status_code == 404


async def test_import_outside_adds_to_pipeline_once(client, db_session, admin_headers, organization, no_outside):
    job = _job(organization)
    db_session.add(job)
    await db_session.commit()
    person = {"external_id": "pdl-xyz", "full_name": "Ravi Mehta", "job_title": "React Developer",
              "skills": ["react"], "source": "pdl"}

    for _ in range(2):
        r = await client.post("/v1/search/global/import", json={"person": person, "job_id": str(job.id)},
                              headers=admin_headers)
        assert r.status_code == 200, r.text

    cands = (await db_session.execute(select(Candidate).where(Candidate.organization_id == organization.id))).scalars().all()
    assert len(cands) == 1 and cands[0].email.endswith("@no-email.invalid") and cands[0].source == "global_search"
    apps = (await db_session.execute(select(Application).where(Application.candidate_id == cands[0].id))).scalars().all()
    assert len(apps) == 1 and apps[0].match_score is not None


# ── Job syndication ─────────────────────────────────────────────────────────

async def test_feed_and_sitemap_list_only_published_jobs(client, db_session, organization):
    db_session.add_all([
        _job(organization, title="Public Role", publish_externally=True),
        _job(organization, title="Confidential Role", publish_externally=False),
        _job(organization, title="Closed Role", publish_externally=True, status="closed"),
    ])
    await db_session.commit()

    feed = (await client.get("/api/public/job-feed.xml?board=indeed")).text
    assert "Public Role" in feed and "Confidential Role" not in feed and "Closed Role" not in feed
    assert "source=indeed" in feed
    sitemap = (await client.get("/api/public/jobs-sitemap.xml")).text
    assert sitemap.count("<url>") == 1
    # An unknown board is not echoed back into the URLs.
    assert "source=evil" not in (await client.get("/api/public/job-feed.xml?board=evil")).text


def test_new_jobs_publish_by_default():
    from app.schemas.job import JobCreate
    assert JobCreate(title="x", description="y").publish_externally is True


# ── Talent Network ──────────────────────────────────────────────────────────

RESUME = ("resume.pdf", b"%PDF-1.4 fake", "application/pdf")


@pytest.fixture
def resume_ok(monkeypatch):
    """The resume check passes and the background parse is skipped."""
    from app.services.ai import resume_parser
    monkeypatch.setattr(resume_parser, "check_is_resume", lambda *a, **k: None)

    async def no_finish(*a, **k):
        return None
    monkeypatch.setattr(tn, "finish_signup", no_finish)


async def _signup(client, email="priya@example.com", **extra):
    data = {"full_name": "Priya Sharma", "email": email, "location": "Ahmedabad",
            "looking_for": "React developer", "consent": "true", **extra}
    return await client.post("/api/public/talent/signup", data=data, files={"resume": RESUME})


async def test_signup_needs_consent(client, resume_ok):
    r = await _signup(client, consent="false")
    assert r.status_code == 400


async def test_signup_refuses_a_file_that_is_not_a_resume(client, db_session, monkeypatch):
    from app.services.ai import resume_parser

    def not_resume(*a, **k):
        raise resume_parser.NotAResumeError()
    monkeypatch.setattr(resume_parser, "check_is_resume", not_resume)
    r = await _signup(client)
    assert r.status_code == 400
    assert (await db_session.execute(select(TalentProfile))).scalars().first() is None


async def test_profile_hidden_until_email_confirmed(client, db_session, organization, resume_ok):
    assert (await _signup(client)).status_code == 200
    f = gs.normalize_filters({"job_titles": ["react developer"], "city": "ahmedabad"})
    assert await tn.search_network(db_session, organization.id, f) == []

    p = (await db_session.execute(select(TalentProfile))).scalar_one()
    # Twice, as React's dev mode does: both must succeed.
    for _ in range(2):
        r = await client.post(f"/api/public/talent/verify/{p.verify_token}")
        assert r.status_code == 200
    hits = await tn.search_network(db_session, organization.id, f)
    assert len(hits) == 1 and hits[0]["full_name"] == "Priya S."
    assert "email" not in hits[0] and "phone" not in hits[0]


async def _verified_profile(db_session, **kw) -> TalentProfile:
    p = TalentProfile(email=kw.pop("email", "priya@example.com"), full_name="Priya Sharma", phone="+91 90000 00000",
                      location="Ahmedabad", current_title="React Developer", skills=["React"],
                      consent_at=datetime.now(timezone.utc), consent_version=tn.CONSENT_VERSION,
                      email_verified_at=datetime.now(timezone.utc), manage_token=uuid.uuid4().hex, **kw)
    db_session.add(p)
    await db_session.commit()
    return p


async def test_contact_request_accept_creates_candidate_in_pipeline(client, db_session, organization, admin_user,
                                                                    admin_headers, no_mail):
    p = await _verified_profile(db_session)
    job = _job(organization)
    db_session.add(job)
    await db_session.commit()

    body = {"profile_id": str(p.id), "job_id": str(job.id), "message": "Loved your React work"}
    r = await client.post("/v1/search/network/request", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert (await client.post("/v1/search/network/request", json=body, headers=admin_headers)).status_code == 409
    assert no_mail[-1][0] == "priya@example.com"

    req = (await db_session.execute(select(TalentContactRequest))).scalar_one()
    manage = (await client.get(f"/api/public/talent/manage/{p.manage_token}")).json()["data"]
    assert manage["requests"][0]["status"] == "pending"

    r = await client.post(f"/api/public/talent/respond/{req.token}", json={"accept": True})
    assert r.status_code == 200 and r.json()["data"]["status"] == "accepted"
    cand = (await db_session.execute(select(Candidate).where(Candidate.organization_id == organization.id))).scalar_one()
    assert (cand.email, cand.full_name, cand.source) == ("priya@example.com", "Priya Sharma", "talent_network")
    assert (await db_session.execute(select(Application).where(Application.candidate_id == cand.id))).scalar_one()
    assert no_mail[-1][0] == admin_user.email  # the recruiter is told


async def test_decline_shares_nothing(client, db_session, organization, admin_headers, no_mail):
    p = await _verified_profile(db_session)
    await client.post("/v1/search/network/request", json={"profile_id": str(p.id)}, headers=admin_headers)
    req = (await db_session.execute(select(TalentContactRequest))).scalar_one()
    await client.post(f"/api/public/talent/respond/{req.token}", json={"accept": False})
    assert (await db_session.execute(select(Candidate))).scalars().first() is None


async def test_request_status_is_per_org(client, db_session, organization, other_organization,
                                         admin_headers, no_mail):
    p = await _verified_profile(db_session)
    await client.post("/v1/search/network/request", json={"profile_id": str(p.id)}, headers=admin_headers)
    f = gs.normalize_filters({"job_titles": ["react developer"]})
    assert (await tn.search_network(db_session, organization.id, f))[0]["request_status"] == "pending"
    assert (await tn.search_network(db_session, other_organization.id, f))[0]["request_status"] is None


async def test_hidden_or_deleted_profiles_leave_search(client, db_session, organization, admin_headers, no_mail):
    p = await _verified_profile(db_session)
    f = gs.normalize_filters({"job_titles": ["react developer"]})
    await client.patch(f"/api/public/talent/manage/{p.manage_token}", json={"is_visible": False})
    assert await tn.search_network(db_session, organization.id, f) == []
    r = await client.post("/v1/search/network/request", json={"profile_id": str(p.id)}, headers=admin_headers)
    assert r.status_code == 409

    assert (await client.delete(f"/api/public/talent/manage/{p.manage_token}")).status_code == 200
    assert (await client.get(f"/api/public/talent/manage/{p.manage_token}")).status_code == 404


# ── Search history + saved candidates ───────────────────────────────────────

async def test_search_is_kept_and_reopens_without_searching_again(client, db_session, admin_headers,
                                                                  other_org_admin_headers, no_outside, monkeypatch):
    r = await client.post("/v1/search/global", json={"query": "react developer"}, headers=admin_headers)
    run_id = r.json()["data"]["search_id"]

    # Editing a chip re-runs the same search: it updates the entry, not adds one.
    f = r.json()["data"]["filters"]
    await client.post("/v1/search/global", json={"query": "react developer", "filters": f}, headers=admin_headers)
    history = (await client.get("/v1/search/global/history", headers=admin_headers)).json()["data"]
    assert len(history) == 1 and history[0]["id"] == run_id and history[0]["counts"]["outside"] == 1

    # Reopening spends nothing: the outside search must not be called.
    async def boom(*a, **k):
        raise AssertionError("reopening a saved search must not search again")
    monkeypatch.setattr(gs, "search_outside", boom)
    saved = (await client.get(f"/v1/search/global/history/{run_id}", headers=admin_headers)).json()["data"]
    assert saved["outside"]["results"][0]["full_name"] == "Ravi Mehta" and saved["query"] == "react developer"

    # Another company can't see or delete it.
    assert (await client.get(f"/v1/search/global/history/{run_id}", headers=other_org_admin_headers)).status_code == 404
    assert (await client.get("/v1/search/global/history", headers=other_org_admin_headers)).json()["data"] == []
    assert (await client.delete(f"/v1/search/global/history/{run_id}", headers=other_org_admin_headers)).status_code == 404
    assert (await client.delete(f"/v1/search/global/history/{run_id}", headers=admin_headers)).status_code == 200


async def test_saved_list_has_only_candidates_brought_in_from_outside(client, db_session, admin_headers, organization,
                                                                      admin_user, no_outside):
    db_session.add(Candidate(organization_id=organization.id, email="applied@example.com", full_name="Applied Directly",
                             source="careers_page"))
    await db_session.commit()
    person = {"external_id": "gh-42", "full_name": "Dev GitHub", "job_title": "Go developer",
              "skills": ["go"], "source": "github", "github_url": "https://github.com/dev"}
    await client.post("/v1/search/global/import", json={"person": person}, headers=admin_headers)

    data = (await client.get("/v1/search/global/saved", headers=admin_headers)).json()["data"]
    assert data["total"] == 1
    item = data["items"][0]
    assert (item["full_name"], item["origin"], item["has_email"], item["saved_by"]) == \
        ("Dev GitHub", "github", False, admin_user.full_name)


def test_pdl_score_uses_every_skill_not_the_first_dozen():
    """PDL lists skills A-Z: "python" sits past the first 12 for most people."""
    f = gs.normalize_filters({"job_titles": ["backend developer"], "skills": ["python", "django"]})
    skills = sorted([f"skill{i:02d}" for i in range(20)] + ["python", "django"])
    person = gs._pdl_person({"id": "x", "full_name": "a b", "job_title": "backend developer", "skills": skills}, set())
    gs.score_hit(person, f)
    assert person["missing_skills"] == [] and person["match_score"] >= 85


def test_github_unknown_frameworks_are_not_missing():
    f = gs.normalize_filters({"job_titles": ["python developer"], "skills": ["python", "django", "aws"]})
    hit = {"job_title": "Open source enthusiast", "skills": ["python"], "source": "github"}
    gs.score_hit(hit, f)
    assert hit["missing_skills"] == [] and hit["match_score"] >= 55


def test_pdl_query_needs_at_least_one_asked_skill():
    q = gs.build_pdl_query(gs.normalize_filters({"job_titles": ["backend developer"], "skills": ["python", "aws"]}))
    assert {"bool": {"should": [{"term": {"skills": "python"}}, {"term": {"skills": "aws"}}]}} in q["bool"]["must"]


# ── Free trial: 1 Global search ─────────────────────────────────────────────

@pytest.fixture
async def trial_org(db_session, organization):
    from datetime import timedelta
    from app.models.super_admin import CompanySubscription, SubscriptionPlan
    plan = SubscriptionPlan(name="Pro", term_months=1, price_monthly=99.0, price_yearly=1188.0)
    db_session.add(plan)
    await db_session.flush()
    db_session.add(CompanySubscription(organization_id=organization.id, plan_id=plan.id, status="active",
                                       is_trial=True, trial_end=datetime.now(timezone.utc) + timedelta(days=7),
                                       current_period_end=datetime.now(timezone.utc) + timedelta(days=7)))
    await db_session.commit()
    return organization


@pytest.fixture
def trial_search_on(monkeypatch):
    """Trials get their limited Global searches (off by default)."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "trial_global_search_enabled", True)


async def test_trials_have_no_global_search_by_default(client, admin_headers, trial_org, no_outside):
    r = await client.post("/v1/search/global", json={"query": "react developer"}, headers=admin_headers)
    assert r.status_code == 402
    r = await client.post("/v1/search/global/import", json={"person": {"external_id": "x"}}, headers=admin_headers)
    assert r.status_code == 402


@pytest.fixture
def pdl_calls(monkeypatch, no_outside):
    calls = []
    real = gs.search_outside

    async def counting(org_id, f):
        calls.append(f)
        return await real(org_id, f)
    monkeypatch.setattr(gs, "search_outside", counting)
    return calls


async def _gsearch(client, headers, **body):
    r = await client.post("/v1/search/global", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]


async def test_trial_gets_one_global_search(client, admin_headers, trial_org, trial_search_on, pdl_calls):
    # Preview: free sources and the AI's chips, no Global search used.
    d = await _gsearch(client, admin_headers, query="react developer", skip_outside=True)
    assert d["outside_preview"] and d["outside"] is None and not pdl_calls
    assert d["trial_quota"] == {"limit": 1, "used": 0, "remaining": 1}

    # Confirming uses the one search.
    d = await _gsearch(client, admin_headers, query="react developer", filters=d["filters"])
    assert d["outside"]["results"] and d["trial_quota"]["remaining"] == 0

    # Refining the same search (chip edit) is free.
    d = await _gsearch(client, admin_headers, query="react developer", filters=d["filters"])
    assert d["outside"]["results"] and len(pdl_calls) == 2 and d["trial_quota"]["used"] == 1

    # A new search is locked; the free sources still answer.
    d = await _gsearch(client, admin_headers, query="java developer")
    assert d["outside_locked"] and d["outside"] is None and d["own"] is not None and len(pdl_calls) == 2


async def test_trial_examples_are_free(client, admin_headers, trial_org, trial_search_on, pdl_calls):
    d = await _gsearch(client, admin_headers, query="HR executive in Pune")
    assert d["outside"] and d["trial_quota"]["remaining"] == 1


async def test_trial_search_that_finds_nobody_is_not_used_up(client, admin_headers, trial_org, trial_search_on, monkeypatch, no_outside):
    async def empty(org_id, f):
        return {"total": 0, "results": [], "cached": False}
    monkeypatch.setattr(gs, "search_outside", empty)
    d = await _gsearch(client, admin_headers, query="underwater basket weaver")
    assert d["trial_quota"]["remaining"] == 1


async def test_removing_the_search_from_history_does_not_refund_it(client, admin_headers, trial_org, trial_search_on, pdl_calls):
    d = await _gsearch(client, admin_headers, query="react developer")
    await client.delete(f"/v1/search/global/history/{d['search_id']}", headers=admin_headers)
    assert (await client.get("/v1/search/global/history", headers=admin_headers)).json()["data"] == []
    quota = (await client.get("/v1/search/global/quota", headers=admin_headers)).json()["data"]
    assert quota["remaining"] == 0


async def test_paid_companies_have_no_trial_limit(client, admin_headers, pdl_calls):
    for q in ("react developer", "java developer", "go developer"):
        d = await _gsearch(client, admin_headers, query=q)
        assert d["outside"] and "trial_quota" not in d
    assert (await client.get("/v1/search/global/quota", headers=admin_headers)).json()["data"] is None
