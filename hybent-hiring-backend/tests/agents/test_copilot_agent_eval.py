"""
Copilot agent v2 evaluation — real Groq, no DB.

For each prompt in copilot_eval.jsonl (English + Hinglish), sends the
agent's real first LLM call (static prompt + tool schemas + dynamic
context) and checks the FIRST step it takes: the tool(s) it calls, or no
tool (null in `expect_any`) when it should answer/ask directly. Also prints
token usage so cost per message can be compared across models:

    COPILOT_EVAL_MODEL=openai/gpt-oss-20b .venv/bin/pytest tests/agents/test_copilot_agent_eval.py -s

Skipped without GROQ_API_KEY.
"""
import json
import os
from pathlib import Path

import pytest

from app.core.config import settings
from app.services.agents.copilot import graph as _graph  # noqa: F401 — registers tools
from app.services.agents.copilot.nodes import build_llm_messages
from app.services.agents.copilot.state import CopilotContext
from app.services.agents.copilot.toolset import REGISTRY
from app.services.agents.llm import stream_chat

pytestmark = pytest.mark.skipif(not settings.groq_api_key, reason="GROQ_API_KEY not configured")

CASES = [json.loads(line) for line in Path(__file__).with_name("copilot_eval.jsonl").read_text().splitlines() if line.strip()]
MODEL = os.environ.get("COPILOT_EVAL_MODEL")  # None → the production default
MIN_ACCURACY = 0.85

_results: list[dict] = []


def _ctx(q: str) -> CopilotContext:
    return CopilotContext(
        organization_id=None, user_id=None, user_role="recruiter", db=None, conversation_id="eval",
        user_message=q, current_time="Monday, Oct 05, 2026 11:00 AM",
        team="Priya Shah (interviewer), Rohan Patel (recruiter), Meera Iyer (admin)",
    )


@pytest.mark.parametrize("case", CASES, ids=[c["q"][:60] for c in CASES])
async def test_first_step(case):
    state = {"messages": [{"role": "user", "content": case["q"]}], "focus": case.get("focus") or {}}
    turn = await stream_chat(
        build_llm_messages(state, _ctx(case["q"]), force_final=False),
        tools=REGISTRY.schemas(), max_tokens=600, model=MODEL,
    )
    called = [tc.name for tc in turn.tool_calls]
    expected = case["expect_any"]
    ok = (not called and None in expected) or any(name in expected for name in called)
    _results.append({"q": case["q"], "called": called, "ok": ok, "tokens": turn.total_tokens})
    assert ok, f"{case['q']!r}: called {called or 'no tool'}, expected one of {expected}"


def test_zz_summary():
    """Runs last: overall accuracy and average tokens for the first step."""
    if not _results:
        pytest.skip("no eval results collected")
    acc = sum(r["ok"] for r in _results) / len(_results)
    avg_tokens = sum(r["tokens"] for r in _results) / len(_results)
    print(f"\nCopilot agent eval: {acc:.0%} first-step accuracy over {len(_results)} prompts, "
          f"avg {avg_tokens:.0f} tokens/call, model={MODEL or 'default'}")
    assert acc >= MIN_ACCURACY
