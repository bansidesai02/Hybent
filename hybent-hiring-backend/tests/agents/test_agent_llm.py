"""Unit tests for app/services/agents/llm.py and registry.py (no network)."""
from types import SimpleNamespace as NS

import pytest

from app.services.agents import llm as agent_llm
from app.services.agents.llm import ToolCallAccumulator, stream_chat
from app.services.agents.registry import ToolRegistry, ToolResult, params


def _tc(index, id=None, name=None, arguments=None):
    return NS(index=index, id=id, function=NS(name=name, arguments=arguments))


def _chunk(content=None, tool_calls=None, usage=None):
    return NS(
        choices=[NS(delta=NS(content=content, tool_calls=tool_calls))],
        x_groq=NS(usage=usage) if usage else None,
        model="openai/gpt-oss-120b",
    )


def test_accumulator_merges_split_arguments_and_parallel_calls():
    acc = ToolCallAccumulator()
    acc.add([_tc(0, id="a", name="search_candidates", arguments='{"que')])
    acc.add([_tc(0, arguments='ry": "python"}')])
    acc.add([_tc(1, id="b", name="search_jobs", arguments="{}")])
    calls = acc.result()
    assert [c.name for c in calls] == ["search_candidates", "search_jobs"]
    assert calls[0].parsed_args() == {"query": "python"}
    assert calls[1].id == "b"


def test_bad_json_arguments_parse_to_empty_dict():
    acc = ToolCallAccumulator()
    acc.add([_tc(0, id="a", name="x", arguments="{oops")])
    assert acc.result()[0].parsed_args() == {}


class _FakeCompletions:
    def __init__(self, chunks=None, error=None):
        self.chunks = chunks or []
        self.error = error
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return iter(self.chunks)


def _patch_groq(monkeypatch, completions):
    fake = NS(chat=NS(completions=completions))
    monkeypatch.setattr(agent_llm, "SafeGroq", lambda **_: fake)
    monkeypatch.setattr(agent_llm, "get_best_groq_model", lambda _c=None: "openai/gpt-oss-120b")


async def test_stream_chat_streams_text_and_reports_usage(monkeypatch):
    comp = _FakeCompletions([
        _chunk("Hel"), _chunk("lo"),
        _chunk(usage=NS(prompt_tokens=100, completion_tokens=5)),
    ])
    _patch_groq(monkeypatch, comp)
    seen = []
    turn = await stream_chat([{"role": "user", "content": "hi"}], on_text=seen.append, max_tokens=50)
    assert seen == ["Hel", "lo"]
    assert turn.content == "Hello"
    assert turn.tool_calls == []
    assert turn.total_tokens == 105
    assert comp.kwargs["stream"] is True and comp.kwargs["max_tokens"] == 50
    assert "tools" not in comp.kwargs


async def test_stream_chat_returns_tool_calls(monkeypatch):
    comp = _FakeCompletions([
        _chunk(tool_calls=[_tc(0, id="c1", name="search_candidates", arguments='{"query":')]),
        _chunk(tool_calls=[_tc(0, arguments=' "react"}')]),
    ])
    _patch_groq(monkeypatch, comp)
    turn = await stream_chat([{"role": "user", "content": "react devs"}], tools=[{"type": "function"}])
    assert comp.kwargs["tool_choice"] == "auto"
    assert turn.tool_calls[0].parsed_args() == {"query": "react"}
    msg = turn.assistant_message()
    assert msg["tool_calls"][0]["function"]["name"] == "search_candidates"


async def test_stream_chat_falls_back_to_gemini_when_groq_fails(monkeypatch):
    _patch_groq(monkeypatch, _FakeCompletions(error=RuntimeError("all keys down")))

    async def fake_gemini(messages, error, on_text):
        on_text("from gemini")
        return agent_llm.LLMTurn(content="from gemini", model="gemini")

    monkeypatch.setattr(agent_llm, "_gemini_fallback", fake_gemini)
    seen = []
    turn = await stream_chat([{"role": "user", "content": "hi"}], on_text=seen.append)
    assert turn.content == "from gemini" and seen == ["from gemini"]


async def test_registry_schema_and_status_label():
    reg = ToolRegistry()

    @reg.tool(
        "search_candidates", "Search candidates",
        params({"query": {"type": "string"}, "location": {"type": "string"}}, required=["query"]),
        status="Searching candidates", status_args=("query", "location"),
    )
    async def _search(args, ctx):
        return ToolResult(data=[])

    tool = reg.get("search_candidates")
    schema = reg.schemas()[0]["function"]["parameters"]
    assert schema["properties"]["query"]["type"] == "string"
    assert schema["properties"]["location"]["type"] == ["string", "null"]
    assert tool.status_label({"query": "python", "location": None}) == "Searching candidates · python"
    assert tool.status_label({"query": "python", "location": "Pune"}) == "Searching candidates · python · Pune"
    with pytest.raises(ValueError):
        reg.tool("search_candidates", "dup", params({}))(_search)
