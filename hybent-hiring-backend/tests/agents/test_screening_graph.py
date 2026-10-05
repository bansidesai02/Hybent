"""Candidate Screening Agent graph, end to end with fake data and a scripted LLM
(no network, no DB)."""
import json
import uuid
from types import SimpleNamespace

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from app.services.agents import llm
from app.services.agents.llm import LLMTurn
from app.services.agents.screening import actions, repo
from app.services.agents.screening.graph import build_graph
from app.services.agents.screening.nodes import _parse_ai_decision
from app.services.agents.screening.rules import rule_decision
from app.services.agents.screening.state import ScreeningContext
from app.services.ai_credit_service import AICreditsService

ORG = uuid.uuid4()
PY_JOB = SimpleNamespace(
    id=uuid.uuid4(), title="Python Developer", skills_required=["Python", "Django", "PostgreSQL", "REST"],
    description="Build Django REST APIs on PostgreSQL.", min_experience_years=2, location="Ahmedabad",
)
SALES_JOB = SimpleNamespace(
    id=uuid.uuid4(), title="Business Development Executive", skills_required=["Sales", "Lead Generation", "CRM"],
    description="B2B sales.", min_experience_years=1, location="Pune",
)


def _candidate(**over):
    c = {
        "id": str(uuid.uuid4()), "full_name": "Ankit Shah", "email": "ankit@example.com", "phone": "+91 9000000000",
        "location": "Ahmedabad", "current_title": "Python Developer", "current_company": "Acme",
        "years_experience": 4, "skills": ["Python", "Django", "PostgreSQL", "REST", "Docker"],
        "summary": "Backend developer.", "notice_period_days": "30", "expected_ctc": "12 LPA",
        "pipeline_stage": "needs_review", "match_score": None, "created_at": None,
        "parsed": {"current_title": "Python Developer", "experience": [
            {"title": "Python Developer", "company": "Acme", "duration": "4 years", "description": "Django REST APIs"},
        ], "education": [], "projects": [], "certifications": []},
    }
    c.update(over)
    return c


class FakeRepo:
    def __init__(self, candidate, jobs=(PY_JOB, SALES_JOB), duplicate=None, applied=(), screened=False):
        self.candidate, self.jobs, self.duplicate = candidate, list(jobs), duplicate
        self.applied, self.screened = [str(j) for j in applied], screened
        self.saved = []

    def install(self, monkeypatch):
        async def load_candidate(db, org, cid):
            return self.candidate if self.candidate and self.candidate["id"] == cid else None

        async def already_screened(db, org, cid):
            return self.screened

        async def find_duplicate(db, org, cand):
            return self.duplicate

        async def applied_job_ids(db, org, cid):
            return self.applied

        async def active_jobs(db, org):
            return self.jobs

        async def save_recommendation(db, org, cid, **fields):
            assert org == ORG
            self.saved.append({"candidate_id": cid, **fields})
            return str(uuid.uuid4())

        for fn in (load_candidate, already_screened, find_duplicate, applied_job_ids, active_jobs, save_recommendation):
            monkeypatch.setattr(repo, fn.__name__, fn)
        return self


class ScriptedLLM:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    async def __call__(self, messages, **kwargs):
        self.calls.append(messages)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return LLMTurn(content=reply, prompt_tokens=900, completion_tokens=80)


@pytest.fixture(autouse=True)
def credits_ok(monkeypatch):
    async def ok(*a, **k):
        return None
    monkeypatch.setattr(AICreditsService, "check_credits_available", ok)


async def _run(candidate_id, graph=None):
    graph = graph or build_graph(InMemorySaver())
    return await graph.ainvoke(
        {"candidate_id": candidate_id},
        {"configurable": {"thread_id": f"screening:{candidate_id}"}},
        context=ScreeningContext(organization_id=ORG, db=None),
    )


async def test_strong_match_asks_ai_and_records_its_decision(monkeypatch):
    cand = _candidate()
    fake = FakeRepo(cand).install(monkeypatch)
    ai = ScriptedLLM(json.dumps({
        "recommendation": "pre_screen", "job_id": str(PY_JOB.id),
        "reasons": ["4 years of Django REST work", "Based in Ahmedabad"], "risks": ["Notice period 30 days"],
        "confidence": "high",
    }))
    monkeypatch.setattr(llm, "stream_chat", ai)

    result = await _run(cand["id"])

    assert len(ai.calls) == 1
    saved = fake.saved[0]
    assert saved["recommendation"] == "pre_screen"
    assert saved["job_id"] == PY_JOB.id
    assert saved["decided_by_engine"] == "ai"
    assert saved["status"] == "pending"
    assert saved["matches"][0]["job_id"] == str(PY_JOB.id)  # best match first
    assert result["recommendation_id"]
    # Resume text goes in as data; the candidate's name is never sent.
    sent = json.dumps(ai.calls[0])
    assert "Django" in sent and "Ankit" not in sent


async def test_low_match_is_settled_by_rules_without_ai(monkeypatch):
    cand = _candidate(
        current_title="Chef", skills=["Cooking", "Baking"], years_experience=6,
        parsed={"current_title": "Chef", "experience": [], "education": [], "projects": [], "certifications": []},
    )
    fake = FakeRepo(cand).install(monkeypatch)
    ai = ScriptedLLM()
    monkeypatch.setattr(llm, "stream_chat", ai)

    await _run(cand["id"])

    assert ai.calls == []
    assert fake.saved[0]["recommendation"] == "talent_pool"
    assert fake.saved[0]["decided_by_engine"] == "rules"


async def test_no_open_jobs_goes_to_talent_pool(monkeypatch):
    cand = _candidate()
    fake = FakeRepo(cand, jobs=()).install(monkeypatch)
    monkeypatch.setattr(llm, "stream_chat", ScriptedLLM())

    await _run(cand["id"])

    assert fake.saved[0]["recommendation"] == "talent_pool"
    assert fake.saved[0]["job_id"] is None


async def test_duplicate_stops_before_matching(monkeypatch):
    cand = _candidate()
    dup = {"id": str(uuid.uuid4()), "full_name": "Ankit Shah", "pipeline_stage": "technical_round"}
    fake = FakeRepo(cand, duplicate=dup).install(monkeypatch)
    ai = ScriptedLLM()
    monkeypatch.setattr(llm, "stream_chat", ai)

    result = await _run(cand["id"])

    assert ai.calls == []
    assert "matches" not in result or not result["matches"]
    assert fake.saved[0]["recommendation"] == "duplicate"
    assert fake.saved[0]["duplicate_of_id"] == uuid.UUID(dup["id"])


@pytest.mark.parametrize("over, screened, reason", [
    ({"pipeline_stage": "technical_round"}, False, "in_pipeline"),
    ({}, True, "already_screened"),
])
async def test_skips_candidates_with_nothing_to_screen(monkeypatch, over, screened, reason):
    cand = _candidate(**over)
    fake = FakeRepo(cand, screened=screened).install(monkeypatch)

    result = await _run(cand["id"])

    assert result["stop_reason"] == reason
    assert fake.saved == []


async def test_missing_candidate_stops(monkeypatch):
    fake = FakeRepo(None).install(monkeypatch)
    result = await _run(str(uuid.uuid4()))
    assert result["stop_reason"] == "missing"
    assert fake.saved == []


async def test_ai_failure_falls_back_to_rule_draft(monkeypatch):
    cand = _candidate()
    fake = FakeRepo(cand).install(monkeypatch)
    monkeypatch.setattr(llm, "stream_chat", ScriptedLLM(RuntimeError("groq down")))

    await _run(cand["id"])

    saved = fake.saved[0]
    assert saved["decided_by_engine"] == "rules"
    assert saved["recommendation"] in ("pre_screen", "shortlist")
    assert saved["job_id"] == PY_JOB.id


async def test_junk_ai_reply_falls_back_to_rule_draft(monkeypatch):
    cand = _candidate()
    fake = FakeRepo(cand).install(monkeypatch)
    monkeypatch.setattr(llm, "stream_chat", ScriptedLLM("Sure! I think they're great."))

    await _run(cand["id"])

    assert fake.saved[0]["decided_by_engine"] == "rules"


async def test_applied_job_reuses_intake_ai_score(monkeypatch):
    cand = _candidate(match_score=91.0)
    fake = FakeRepo(cand, applied=[PY_JOB.id]).install(monkeypatch)
    monkeypatch.setattr(llm, "stream_chat", ScriptedLLM(RuntimeError("skip")))

    await _run(cand["id"])

    top = fake.saved[0]["matches"][0]
    assert top == {**top, "job_id": str(PY_JOB.id), "score": 91.0, "source": "ai"}


# ── Unit: validation of the model's JSON ─────────────────────────────────────

MATCHES = [{"job_id": "j1", "title": "Python Developer", "score": 80}, {"job_id": "j2", "title": "QA", "score": 50}]


def test_parse_rejects_unknown_recommendation():
    assert _parse_ai_decision('{"recommendation": "hire", "reasons": ["x"]}', MATCHES) is None


def test_parse_ignores_job_id_not_among_matches():
    d = _parse_ai_decision('{"recommendation": "pre_screen", "job_id": "evil", "reasons": ["fit"]}', MATCHES)
    assert d["job_id"] == "j1"


def test_parse_drops_job_for_talent_pool_and_needs_reasons():
    d = _parse_ai_decision('{"recommendation": "talent_pool", "job_id": "j1", "reasons": ["later"]}', MATCHES)
    assert d["job_id"] is None
    assert _parse_ai_decision('{"recommendation": "talent_pool", "reasons": []}', MATCHES) is None


def test_rules_thresholds():
    assert rule_decision([])["recommendation"] == "talent_pool"
    assert rule_decision([{"job_id": "j", "title": "T", "score": 30}])["needs_ai"] is False
    assert rule_decision([{"job_id": "j", "title": "T", "score": 60}])["recommendation"] == "shortlist"
    assert rule_decision([{"job_id": "j", "title": "T", "score": 80}])["recommendation"] == "pre_screen"


# ── Approval: the run pauses after recording, and resumes on a decision ─────

@pytest.fixture
def applied(monkeypatch):
    calls = []

    async def fake_apply(db, organization_id, recommendation_id, decision, background_tasks=None):
        calls.append({"org": organization_id, "id": recommendation_id, "decision": decision})
        return {"id": recommendation_id, "status": "approved", "action": "pre_screen"}

    monkeypatch.setattr(actions, "apply_decision", fake_apply)
    return calls


async def test_run_pauses_for_approval_then_applies_the_decision(monkeypatch, applied):
    cand = _candidate()
    fake = FakeRepo(cand).install(monkeypatch)
    monkeypatch.setattr(llm, "stream_chat", ScriptedLLM(RuntimeError("rules only")))
    graph = build_graph(InMemorySaver())
    config = {"configurable": {"thread_id": f"screening:{cand['id']}"}}

    paused = await _run(cand["id"], graph)

    assert paused["__interrupt__"][0].value == {"recommendation_id": paused["recommendation_id"]}
    assert applied == []  # nothing happens before a recruiter decides
    assert len(fake.saved) == 1

    decision = {"action": "approve", "user_id": str(uuid.uuid4())}
    final = await graph.ainvoke(Command(resume=decision), config, context=ScreeningContext(organization_id=ORG, db=None))

    assert applied == [{"org": ORG, "id": paused["recommendation_id"], "decision": decision}]
    assert final["outcome"]["status"] == "approved"
    assert len(fake.saved) == 1  # resuming doesn't screen again
    assert not (await graph.aget_state(config)).interrupts


def test_final_action():
    from app.services.agents.screening.actions import final_action
    assert final_action("pre_screen", {"action": "approve"}) == "pre_screen"
    assert final_action("duplicate", {"action": "approve"}) == "none"
    assert final_action("pre_screen", {"action": "dismiss"}) == "none"
    assert final_action("pre_screen", {"action": "override", "override_to": "talent_pool"}) == "talent_pool"
