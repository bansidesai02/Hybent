"""stream_copilot_agent: SSE framing, approval round trip, stale approvals."""
import json
import uuid

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.services.agents import checkpointer
from app.services.agents.copilot import graph as graph_mod, nodes, service
from app.services.agents.llm import LLMTurn, ToolCall
from app.services.ai import copilot_service as legacy
from app.services.ai_credit_service import AICreditsService


class _DB:
    async def rollback(self):
        pass


@pytest.fixture
def env(monkeypatch):
    store = {"saves": []}

    async def fake_resolve(args, ctx):
        # Real lookups are covered in test_copilot_tools.py.
        return {"id": "c-1", "full_name": args.get("candidate_name")}, None

    from app.services.agents.copilot import tools_candidate
    monkeypatch.setattr(tools_candidate, "resolve_candidate", fake_resolve)
    monkeypatch.setattr(checkpointer, "_saver", InMemorySaver())
    monkeypatch.setattr(graph_mod, "_graph", None)

    async def ok(*a, **k):
        return None

    async def ensure(db, org, user, conv_id, title):
        return conv_id or "conv-1", conv_id is None

    async def now(db, org):
        return "Mon 11:00 AM"

    async def team(db, org):
        return "Priya (interviewer)"

    async def load(db, conv_id, org, user):
        return dict(store.get("ctx") or {})

    async def save(db, org, user, conv_id, msg, reply, last_context=None, background_tasks=None):
        store["saves"].append((msg, reply))
        if last_context is not None:
            store["ctx"] = last_context
        return conv_id

    async def write_tool(name, args, org, user, db):
        store["written"] = (name, args)
        return "✅ Done."

    monkeypatch.setattr(AICreditsService, "check_credits_available", ok)
    monkeypatch.setattr(service, "_ensure_conversation", ensure)
    monkeypatch.setattr(service, "_org_now", now)
    monkeypatch.setattr(service, "_team_list", team)
    monkeypatch.setattr(legacy, "_load_last_context", load)
    monkeypatch.setattr(legacy, "_save_conversation_to_db", save)
    monkeypatch.setattr(legacy, "execute_write_tool", write_tool)
    return store


def _script(monkeypatch, *turns):
    turns = list(turns)

    async def fake(messages, *, on_text=None, **_):
        turn = turns.pop(0)
        if on_text and turn.content:
            on_text(turn.content)
        return turn

    monkeypatch.setattr(nodes, "stream_chat", fake)


async def _events(**kwargs):
    base = dict(user_message="hello there friend", history=[], organization_id=uuid.uuid4(), db=_DB(),
                user_id=uuid.uuid4(), user_role="recruiter")
    out = []
    async for raw in service.stream_copilot_agent(**{**base, **kwargs}):
        assert raw.endswith("\n\n")
        out.append(json.loads(raw))
    return out


async def test_plain_answer_sse_order(monkeypatch, env):
    _script(monkeypatch, LLMTurn(content="**9 candidates** are in the pipeline."))
    events = await _events(user_message="pipeline size?")
    types = [e["type"] for e in events]
    assert types[0] == "meta" and events[0]["conversation_id"] == "conv-1"
    assert types[-1] == "done"
    assert "step" in types and "chunk" in types
    assert env["saves"][-1] == ("pipeline size?", "**9 candidates** are in the pipeline.")


async def test_approval_round_trip_and_stale_card(monkeypatch, env):
    move = '{"candidate_name": "Rahul Mehta", "new_stage": "hired"}'
    _script(monkeypatch, LLMTurn(tool_calls=[ToolCall("w1", "update_candidate_stage", move)]))
    events = await _events(user_message="hire rahul")
    approval = next(e for e in events if e["type"] == "approval")
    action_id = approval["pending_tool_call"]["id"]
    assert approval["conversation_id"] == "conv-1"
    assert "written" not in env

    # Same card approved via the legacy approved_tool_call shape → resume.
    resume = await service.resume_from_approved_tool_call(None, None, None, "conv-1", {"id": action_id})
    assert resume == {"action_id": action_id, "approved": True}

    _script(monkeypatch, LLMTurn(content="**Done.** Rahul is hired."))
    events = await _events(user_message="User approved the action. Please proceed.", conversation_id="conv-1", resume=resume)
    assert env["written"][0] == "update_candidate_stage"
    assert "".join(e.get("content", "") for e in events if e["type"] == "chunk") == "**Done.** Rahul is hired."

    # Approving the same card again must not run it twice.
    env.pop("written")
    events = await _events(user_message="User approved the action. Please proceed.", conversation_id="conv-1", resume=resume)
    assert "written" not in env
    assert service.STALE_APPROVAL_REPLY in [e.get("content") for e in events]


async def test_greeting_skips_the_agent(monkeypatch, env):
    async def boom(*a, **k):
        raise AssertionError("no LLM call for a greeting")

    monkeypatch.setattr(nodes, "stream_chat", boom)
    events = await _events(user_message="hi")
    assert [e["type"] for e in events] == ["meta", "chunk", "done"]
