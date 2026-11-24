"""Copilot agent tool adapters (no DB, no network)."""
import uuid
from types import SimpleNamespace as NS

from app.services.agents.copilot import tools_candidate
from app.services.agents.registry import ToolContext
from app.services.ai import copilot_service as legacy

CID = str(uuid.uuid4())


class _Rows:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class _DB:
    def __init__(self, rows):
        self.rows = rows
        self.params = None

    async def execute(self, stmt, params=None):
        self.params = params
        return _Rows(self.rows)


def _ctx(rows=()):
    return ToolContext(organization_id="org-1", user_id="u-1", user_role="recruiter", db=_DB(list(rows)))


async def _full(db, org, cid):
    return {"id": cid, "full_name": "Ankit Shah", "skills": ["Python"], "parsed_data": {}} if org == "org-1" else None


async def test_resolve_by_id_uses_org_scoped_fetch(monkeypatch):
    monkeypatch.setattr(legacy, "_fetch_candidate_full", _full)
    c, problem = await tools_candidate.resolve_candidate({"candidate_id": CID}, _ctx())
    assert problem is None and c["full_name"] == "Ankit Shah"


async def test_resolve_ambiguous_name_asks_which(monkeypatch):
    monkeypatch.setattr(legacy, "_fetch_candidate_full", _full)
    rows = [NS(id=uuid.uuid4(), full_name="Rahul Mehta", current_title="Dev"),
            NS(id=uuid.uuid4(), full_name="Rahul Shah", current_title="QA")]
    ctx = _ctx(rows)
    c, problem = await tools_candidate.resolve_candidate({"candidate_name": "rahul"}, ctx)
    assert c is None and len(problem.data["ambiguous"]) == 2
    assert ctx.db.params["oid"] == "org-1"  # name lookup stays inside the org


async def test_resolve_exact_name_wins_over_partial(monkeypatch):
    monkeypatch.setattr(legacy, "_fetch_candidate_full", _full)
    rows = [NS(id=uuid.uuid4(), full_name="Ankit Shah", current_title=None),
            NS(id=uuid.uuid4(), full_name="Ankit Shaharia", current_title=None)]
    c, problem = await tools_candidate.resolve_candidate({"candidate_name": "Ankit Shah"}, _ctx(rows))
    assert problem is None and c["full_name"] == "Ankit Shah"


async def test_ask_resume_returns_excerpts_without_an_llm_call(monkeypatch):
    monkeypatch.setattr(legacy, "_fetch_candidate_full", _full)

    async def fake_search(db, org, cid, question, top_k=5):
        return [{"section": "experience", "content": "Built FastAPI services at Acme " * 40, "score": 0.9}]

    async def no_llm(*a, **k):
        raise AssertionError("ask_resume must not call an LLM")

    monkeypatch.setattr(tools_candidate.resume_rag, "semantic_search_candidate", fake_search)
    monkeypatch.setattr(tools_candidate.resume_rag, "best_score", lambda chunks: 0.9)
    monkeypatch.setattr(legacy, "_generate_text_with_fallback", no_llm)
    result = await tools_candidate.ask_resume({"candidate_id": CID, "question": "FastAPI?"}, _ctx())
    excerpt = result.data["excerpts"][0]
    assert excerpt["section"] == "experience"
    assert len(excerpt["text"]) <= tools_candidate.EXCERPT_CHARS
    assert result.focus["candidate_id"] == CID


async def test_schedule_prepare_resolves_exact_interviewer_and_rejects_ambiguous(monkeypatch):
    from app.services.agents.copilot import tools_write

    async def fake_resolve(args, ctx):
        return {"id": CID, "full_name": "PUNIT KUMAR"}, None

    monkeypatch.setattr(tools_candidate, "resolve_candidate", fake_resolve)
    team = [NS(full_name="HR Recruiter", email="recruiter@hybent.com"),
            NS(full_name="HR Recruiter 2", email="recruiter2@hybent.com")]

    args, problem = await tools_write._prepare_schedule(
        {"candidate_name": "punit", "interviewer_names": "HR Recruiter", "scheduled_at": "2026-10-04 12:00"}, _ctx(team))
    assert problem is None
    assert args["candidate_name"] == "PUNIT KUMAR" and args["interviewer_names"] == "HR Recruiter"

    _, problem = await tools_write._prepare_schedule(
        {"candidate_name": "punit", "interviewer_names": "HR", "scheduled_at": "2026-10-04 12:00"}, _ctx(team))
    assert "matches several" in problem


def test_prefer_exact_match():
    rows = [NS(full_name="HR Recruiter", email="a@x"), NS(full_name="HR Recruiter 2", email="b@x")]
    assert [r.full_name for r in legacy._prefer_exact(rows, "hr recruiter")] == ["HR Recruiter"]
    assert len(legacy._prefer_exact(rows, "HR")) == 2


async def test_schedule_prepare_rejects_choices_the_recruiter_never_made(monkeypatch):
    from app.services.agents.copilot import tools_write

    async def fake_resolve(args, ctx):
        return {"id": CID, "full_name": "PUNIT KUMAR"}, None

    monkeypatch.setattr(tools_candidate, "resolve_candidate", fake_resolve)
    team = [NS(full_name="HR Recruiter", email="recruiter@hybent.com")]
    args = {"candidate_name": "punit", "interviewer_names": "HR Recruiter", "scheduled_at": "2026-10-04 10:00"}

    ctx = _ctx(team)
    ctx.recruiter_text = "schedule calendar event for punit"
    _, problem = await tools_write._prepare_schedule(args, ctx)
    assert "hasn't said when" in problem

    ctx.recruiter_text = "schedule punit tomorrow 12 pm"
    _, problem = await tools_write._prepare_schedule(args, ctx)
    assert "never chose HR Recruiter" in problem

    ctx.recruiter_text = "schedule punit tomorrow 12 pm with hr recruiter"
    _, problem = await tools_write._prepare_schedule(args, ctx)
    assert problem is None


async def test_platform_help_is_grounded_in_site_knowledge():
    from app.services.agents.copilot.tools_platform import platform_help

    result = await platform_help({"topic": "pricing"}, None)
    knowledge = result.data["knowledge"]
    assert result.ok
    assert "Pro: $39/month" in knowledge and "Standard: $29/month" in knowledge
    assert "Recruiter sidebar" in knowledge or "recruiter sidebar" in knowledge
    assert "IT Services" not in knowledge  # company services aren't product help


def test_new_actions_are_write_tools_that_need_approval():
    from app.services.agents.copilot import tools_actions  # noqa: F401
    from app.services.agents.copilot.toolset import REGISTRY

    for name in ("tag_candidate", "email_candidate", "reschedule_interview", "cancel_interview"):
        assert REGISTRY.get(name).kind == "write", name


def test_new_actions_refuse_missing_details():
    from app.services.agents.copilot.tools_actions import _validate_email, _validate_reschedule, _validate_tag

    assert _validate_tag({"candidate_name": "Rahul Sharma"})            # no tag
    assert _validate_tag({"candidate_name": "candidate", "tag": "x"})   # placeholder name
    assert _validate_tag({"candidate_name": "Rahul Sharma", "tag": "shortlisted"}) is None
    assert _validate_email({"candidate_name": "Rahul Sharma", "subject": "Hi"})  # no body
    assert _validate_email({"candidate_name": "Rahul Sharma", "subject": "Hi", "body": "Hello"}) is None
    assert _validate_reschedule({"candidate_name": "Rahul Sharma"})      # no time
    assert _validate_reschedule({"candidate_name": "Rahul Sharma", "new_time": "2026-12-01 15:00"}) is None


async def test_actions_blocked_for_interviewers():
    from types import SimpleNamespace

    from app.services.agents.copilot.tools_actions import cancel_interview, email_candidate, tag_candidate

    ctx = SimpleNamespace(user_role="interviewer")
    for fn, args in ((tag_candidate, {"candidate_name": "A", "tag": "x"}),
                     (email_candidate, {"candidate_name": "A", "subject": "s", "body": "b"}),
                     (cancel_interview, {"candidate_name": "A"})):
        result = await fn(args, ctx)
        assert not result.ok and result.data["error"] == "Not permitted for this user."


def test_more_actions_validate_their_inputs():
    from app.services.agents.copilot.tools_actions import (
        _validate_candidate_update, _validate_job_status, _validate_team_email,
    )

    assert _validate_team_email({"recipient_name": "Bansi", "subject": "Hi"})          # no body
    assert _validate_team_email({"recipient_name": "Bansi", "subject": "Hi", "body": "x"}) is None
    assert _validate_job_status({"job_title": "Python Developer", "new_status": "archived"})
    assert _validate_job_status({"job_title": "Python Developer", "new_status": "paused"}) is None
    assert _validate_candidate_update({"candidate_name": "Rahul Sharma"})                 # nothing to change
    assert _validate_candidate_update({"candidate_name": "Rahul Sharma", "years_experience": "five"})
    assert _validate_candidate_update({"candidate_name": "Rahul Sharma", "notice_period_days": "30"}) is None


def test_step1_actions_validate_their_inputs():
    from app.services.agents.copilot.tools_actions import (
        _validate_new_candidate, _validate_offer, _validate_whatsapp,
    )

    assert _validate_offer({"candidate_name": "Rahul Sharma"})                        # no salary
    assert _validate_offer({"candidate_name": "Rahul Sharma", "base_salary": "12 LPA"})  # not a number
    assert _validate_offer({"candidate_name": "Rahul Sharma", "base_salary": 1200000}) is None
    assert _validate_new_candidate({"full_name": "Riya Shah", "email": "not-an-email"})
    assert _validate_new_candidate({"full_name": "Riya Shah", "email": "riya@example.com"}) is None
    assert _validate_whatsapp({"candidate_name": "Rahul Sharma", "template": "hello there"})  # free text
    assert _validate_whatsapp({"candidate_name": "Rahul Sharma", "template": "shortlisted"}) is None
