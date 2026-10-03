"""Copilot agent graph, end to end with a scripted LLM (no network, no DB)."""
import uuid

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.services.agents.copilot import nodes
from app.services.agents.copilot.graph import build_graph
from app.services.agents.copilot.nodes import ShowExpander
from app.services.agents.copilot.state import RESET, CopilotContext
from app.services.agents.llm import LLMTurn, ToolCall
from app.services.ai import copilot_service as legacy


class _DB:
    async def rollback(self):
        pass


class ScriptedLLM:
    """Plays back LLM turns in order; records what each call was sent."""

    def __init__(self, *turns):
        self.turns = list(turns)
        self.calls = []

    async def __call__(self, messages, *, tools=None, tool_choice="auto", max_tokens=0, on_text=None, **_):
        self.calls.append({"messages": messages, "tool_choice": tool_choice, "tools": tools})
        turn = self.turns.pop(0)
        if on_text and turn.content:
            for piece in _split(turn.content):
                on_text(piece)
        return turn


def _split(text, size=4):
    return [text[i:i + size] for i in range(0, len(text), size)]


@pytest.fixture
def saved(monkeypatch):
    store = {}

    async def fake_load(db, conversation_id, organization_id, user_id):
        return dict(store.get("ctx") or {})

    async def fake_save(db, organization_id, user_id, conversation_id, user_message, reply, last_context=None, background_tasks=None):
        store.update(reply=reply, ctx=last_context, user_message=user_message)
        return conversation_id

    async def fake_read_tool(name, args, organization_id, db, user_message=None, sink=None):
        if name == "search_candidates":
            sink["data"] = {"total": 1, "candidates": [{"id": "c-1", "name": "Ankit Shah", "skills": ["Python"]}]}
            return "**Found 1 candidate.**\n\n👤 **Ankit Shah**\n\n[SUGGEST:Show details]"
        if name == "get_pipeline_summary":
            sink["data"] = {"total": 9, "applied": 9}
            return "📊 **Pipeline Summary** (Total: 9 candidates)"
        return ""

    monkeypatch.setattr(legacy, "_load_last_context", fake_load)
    monkeypatch.setattr(legacy, "_save_conversation_to_db", fake_save)
    monkeypatch.setattr(legacy, "execute_read_tool", fake_read_tool)
    return store


def _ctx(message):
    return CopilotContext(
        organization_id=uuid.uuid4(), user_id=uuid.uuid4(), user_role="recruiter", db=_DB(),
        conversation_id=str(uuid.uuid4()), user_message=message, current_time="Mon", team="Priya (recruiter)",
    )


def _input(message):
    return {"messages": [RESET, {"role": "user", "content": message}], "displays": {"__reset__": True},
            "focus": {}, "answer": "", "iterations": 0, "tokens_used": 0, "pending": None}


async def _run(graph, message, thread="t1"):
    events = []
    async for mode, payload in graph.astream(
        _input(message), {"configurable": {"thread_id": thread}}, context=_ctx(message),
        stream_mode=["custom", "updates"],
    ):
        if mode == "custom":
            events.append(payload)
    return events


def _call(id, name, args="{}"):
    return ToolCall(id=id, name=name, arguments=args)


async def test_multi_tool_run_streams_steps_then_answer_with_card(monkeypatch, saved):
    llm = ScriptedLLM(
        LLMTurn(tool_calls=[_call("a", "search_candidates", '{"query": "python", "location": null}'),
                            _call("b", "get_pipeline_summary")], prompt_tokens=900, completion_tokens=30),
        LLMTurn(content="**1 candidate found.**\n[[show:r1]]\nPipeline has 9.", prompt_tokens=1200, completion_tokens=20),
    )
    monkeypatch.setattr(nodes, "stream_chat", llm)
    events = await _run(build_graph(InMemorySaver()), "python devs and pipeline")

    steps = [e for e in events if e["type"] == "step"]
    labels = {e["id"]: e["label"] for e in steps if e["state"] == "running"}
    assert labels["a"] == "Searching candidates · python"
    assert labels["b"] == "Reading the pipeline"
    done = {e["id"]: e.get("detail") for e in steps if e["state"] == "done"}
    assert done["a"] == "Found 1 candidate"

    # Every step finishes before the answer text starts.
    first_chunk = next(i for i, e in enumerate(events) if e["type"] == "chunk")
    assert all(events[i]["type"] == "step" for i in range(first_chunk))

    answer = "".join(e["content"] for e in events if e["type"] == "chunk")
    assert "👤 **Ankit Shah**" in answer and "[[show" not in answer
    assert "[SUGGEST:Show details]" not in answer  # card's own suggestion stripped
    assert saved["reply"] == answer.strip()
    assert saved["ctx"]["candidate_id"] == "c-1"  # single result becomes focus

    # Second call got tool results as JSON with the display id.
    tool_msgs = [m for m in llm.calls[1]["messages"] if m["role"] == "tool"]
    assert [m["tool_call_id"] for m in tool_msgs] == ["a", "b"]
    assert '"display": "r1"' in tool_msgs[0]["content"]
    # Static prompt first and unchanged → cacheable prefix.
    assert llm.calls[0]["messages"][0] == llm.calls[1]["messages"][0]


async def test_iteration_cap_forces_final_answer(monkeypatch, saved):
    monkeypatch.setattr(nodes, "MAX_ITERATIONS", 2)
    looping = [LLMTurn(tool_calls=[_call(f"x{i}", "get_pipeline_summary")]) for i in range(2)]
    llm = ScriptedLLM(*looping, LLMTurn(content="**9 candidates** in the pipeline."))
    monkeypatch.setattr(nodes, "stream_chat", llm)
    await _run(build_graph(InMemorySaver()), "pipeline?")
    assert [c["tool_choice"] for c in llm.calls] == ["auto", "auto", "none"]
    assert saved["reply"] == "**9 candidates** in the pipeline."


async def test_unknown_tool_is_reported_back_not_crashing(monkeypatch, saved):
    llm = ScriptedLLM(
        LLMTurn(tool_calls=[_call("z", "drop_tables")]),
        LLMTurn(content="I can't do that."),
    )
    monkeypatch.setattr(nodes, "stream_chat", llm)
    await _run(build_graph(InMemorySaver()), "do something weird")
    tool_msg = [m for m in llm.calls[1]["messages"] if m["role"] == "tool"][0]
    assert "not available" in tool_msg["content"]
    assert saved["reply"] == "I can't do that."


async def test_new_turn_resets_messages_on_same_thread(monkeypatch, saved):
    graph = build_graph(InMemorySaver())
    monkeypatch.setattr(nodes, "stream_chat", ScriptedLLM(LLMTurn(content="Hi one")))
    await _run(graph, "one")
    llm = ScriptedLLM(LLMTurn(content="Hi two"))
    monkeypatch.setattr(nodes, "stream_chat", llm)
    await _run(graph, "two")
    convo = [m for m in llm.calls[0]["messages"] if m["role"] != "system"]
    assert convo == [{"role": "user", "content": "two"}]


@pytest.mark.parametrize("pieces", [
    ["Top: [", "[sh", "ow:r", "1]] done"],
    ["Top: [Show: r1] done"],
    ["Top: [show:", "r1]", " done"],
    ["Top: [[ SHOW : r1 ]", "] done"],
])
def test_show_expander_accepts_marker_variants(pieces):
    ex = ShowExpander({"r1": "CARD"})
    out = "".join(ex.feed(p) for p in pieces) + ex.flush()
    assert out == "Top: \n\nCARD\n\n done"


def test_show_expander_leaves_other_brackets_alone():
    ex = ShowExpander({"r1": "CARD"})
    text = "See [SUGGEST:Show details|Schedule] and [x] and [shoe] [show:r9]"
    out = "".join(ex.feed(c) for c in text) + ex.flush()
    assert out == "See [SUGGEST:Show details|Schedule] and [x] and [shoe] "


def test_show_expander_handles_tokens_split_across_chunks():
    ex = ShowExpander({"r1": "CARD"})
    out = "".join(ex.feed(p) for p in ["Top: [", "[sh", "ow:r", "1]] done [x] [[show:r9]]"]) + ex.flush()
    assert out == "Top: \n\nCARD\n\n done [x] "
    ex2 = ShowExpander({})
    assert ex2.feed("[SUGGEST:a|b]") + ex2.flush() == "[SUGGEST:a|b]"


# ── Approvals (interrupt / resume) ───────────────────────────────────────────

from langgraph.types import Command  # noqa: E402


async def _stream(graph, graph_input, message, thread):
    events, interrupts = [], []
    async for mode, payload in graph.astream(
        graph_input, {"configurable": {"thread_id": thread}}, context=_ctx(message),
        stream_mode=["custom", "updates"], durability="exit",
    ):
        if mode == "custom":
            events.append(payload)
        elif "__interrupt__" in payload:
            interrupts.extend(i.value for i in payload["__interrupt__"])
    return events, interrupts


@pytest.fixture
def writes(monkeypatch):
    done = []

    async def fake_resolve(args, ctx):
        # Real lookups are covered in test_copilot_tools.py.
        return {"id": "c-1", "full_name": args.get("candidate_name")}, None

    from app.services.agents.copilot import tools_candidate
    monkeypatch.setattr(tools_candidate, "resolve_candidate", fake_resolve)

    async def fake_write_tool(name, args, organization_id, user_id, db):
        done.append((name, args))
        return f"✅ **{args['candidate_name']}** has been moved to **Technical Round Selected**."

    monkeypatch.setattr(legacy, "execute_write_tool", fake_write_tool)
    return done


_MOVE = '{"candidate_name": "Rahul Mehta", "new_stage": "technical_round_selected"}'


async def test_write_pauses_for_approval_then_continues(monkeypatch, saved, writes):
    graph = build_graph(InMemorySaver())
    llm = ScriptedLLM(
        LLMTurn(tool_calls=[_call("w1", "update_candidate_stage", _MOVE)]),
        LLMTurn(content="**Done.** Rahul is now Technical Round Selected. [SUGGEST:Schedule his interview]"),
    )
    monkeypatch.setattr(nodes, "stream_chat", llm)

    events, interrupts = await _stream(graph, _input("move rahul to technical selected"), "move rahul", "tw")
    assert writes == []  # nothing ran yet
    assert len(interrupts) == 1
    card = interrupts[0]["pending_tool_call"]
    assert card["name"] == "update_candidate_stage" and card["args"]["candidate_name"] == "Rahul Mehta"
    assert saved["ctx"]["pending_action"]["id"] == card["id"]  # reload can restore the card
    assert saved["ctx"]["pending_action"]["agent"] == "v2"
    assert any(e["type"] == "step" and e.get("detail") == "Waiting for your approval" for e in events)

    events, _ = await _stream(graph, Command(resume={"action_id": card["id"], "approved": True}), "approved", "tw")
    assert writes == [("update_candidate_stage", {"candidate_name": "Rahul Mehta", "new_stage": "technical_round_selected"})]
    answer = "".join(e["content"] for e in events if e["type"] == "chunk")
    assert answer.startswith("**Done.**")
    assert "pending_action" not in saved["ctx"]
    # The agent saw the write's real outcome before answering.
    tool_msg = [m for m in llm.calls[1]["messages"] if m["role"] == "tool"][0]
    assert "has been moved" in tool_msg["content"]


async def test_declined_or_mismatched_approval_does_not_run(monkeypatch, saved, writes):
    graph = build_graph(InMemorySaver())
    monkeypatch.setattr(nodes, "stream_chat", ScriptedLLM(
        LLMTurn(tool_calls=[_call("w1", "update_candidate_stage", _MOVE)]),
        LLMTurn(content="Okay, I won't move him."),
    ))
    _, interrupts = await _stream(graph, _input("move rahul"), "move rahul", "td")
    await _stream(graph, Command(resume={"action_id": "someone-elses-id", "approved": True}), "approved", "td")
    assert writes == []
    assert saved["reply"] == "Okay, I won't move him."


async def test_write_with_placeholder_name_asks_instead_of_staging(monkeypatch, saved, writes):
    graph = build_graph(InMemorySaver())
    llm = ScriptedLLM(
        LLMTurn(tool_calls=[_call("w1", "update_candidate_stage", '{"candidate_name": "the candidate", "new_stage": "hired"}')]),
        LLMTurn(content="Which candidate should I move?"),
    )
    monkeypatch.setattr(nodes, "stream_chat", llm)
    _, interrupts = await _stream(graph, _input("move to hired"), "move to hired", "tp")
    assert interrupts == [] and writes == []
    assert saved["reply"] == "Which candidate should I move?"


async def test_new_message_while_approval_pending_starts_fresh(monkeypatch, saved, writes):
    graph = build_graph(InMemorySaver())
    monkeypatch.setattr(nodes, "stream_chat", ScriptedLLM(
        LLMTurn(tool_calls=[_call("w1", "update_candidate_stage", _MOVE)]),
    ))
    _, interrupts = await _stream(graph, _input("move rahul"), "move rahul", "tn")
    assert interrupts
    llm = ScriptedLLM(LLMTurn(content="Pipeline has 9."))
    monkeypatch.setattr(nodes, "stream_chat", llm)
    _, interrupts = await _stream(graph, _input("actually, pipeline?"), "actually, pipeline?", "tn")
    assert interrupts == [] and writes == []
    assert saved["reply"] == "Pipeline has 9."
    snapshot = await graph.aget_state({"configurable": {"thread_id": "tn"}})
    assert not snapshot.interrupts and not snapshot.values.get("pending")


def test_tool_schemas_are_valid_and_writes_need_approval():
    from app.services.agents.copilot.toolset import REGISTRY

    names = REGISTRY.names()
    assert len(names) == len(set(names))
    for schema in REGISTRY.schemas():
        fn = schema["function"]
        props = fn["parameters"]["properties"]
        assert set(fn["parameters"].get("required", [])) <= set(props), fn["name"]
    writes = {n for n in names if REGISTRY.get(n).kind == "write"}
    assert writes == {"schedule_meeting", "update_candidate_stage", "send_pre_screening_invite"}
    # Generic DB writes must never be model-callable.
    assert "db_update" not in names
    # Stable order → identical prompt prefix on every call.
    assert REGISTRY.schemas() == REGISTRY.schemas()
