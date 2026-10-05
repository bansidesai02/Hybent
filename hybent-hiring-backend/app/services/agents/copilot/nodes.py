"""
Copilot agent graph nodes.

    agent ──tool calls──▶ tools ──▶ agent ──…──▶ finalize
      │                       └─write call─▶ approval ⏸ (interrupt) ─resume─▶ agent
      └────no tool calls──────────────────────▶ finalize

Everything the user sees is pushed through LangGraph's custom stream
(runtime.stream_writer) as ready-to-send SSE payloads:
  {"type": "step",  "id", "label", "state": running|done|error, "detail"?}
  {"type": "chunk", "content"}
"""
import asyncio
import json
import logging
import re
import uuid
from dataclasses import replace

from langgraph.runtime import Runtime
from langgraph.types import interrupt

from app.core.config import settings
from app.services.agents.llm import stream_chat
from app.services.agents.registry import ToolContext, ToolResult
from app.services.agents.copilot.prompts import STATIC_SYSTEM_PROMPT, FINAL_ANSWER_NUDGE, dynamic_context
from app.services.agents.copilot.state import CopilotContext, CopilotState
from app.services.agents.copilot.toolset import REGISTRY

logger = logging.getLogger(__name__)

# ── Cost guards ──────────────────────────────────────────────────────────────
MAX_ITERATIONS = 5          # LLM calls per run before a final answer is forced
RUN_TOKEN_BUDGET = 16_000   # prompt+completion tokens per run before forcing an answer
AGENT_MAX_TOKENS = 1_200    # output cap per LLM call
HISTORY_MESSAGES = 12       # earlier chat messages sent (6 user/assistant turns)
HISTORY_MSG_CHARS = 700     # each earlier message is truncated to this
TOOL_RESULT_CHARS = 6_000   # a single tool result sent back to the model
PARALLEL_TOOLS = 3          # concurrent read tools (each takes a DB connection)

FALLBACK_REPLY = "Sorry, I couldn't put an answer together for that. Could you rephrase it?"
APPROVAL_REPLY = "I've prepared this action. Please review and approve to proceed."


# ── [[show:ID]] expansion ────────────────────────────────────────────────────

# Models don't always copy the marker exactly ([Show: r1], [show:r1]...), so
# match single or double brackets, any case, optional spaces.
_SHOW_RE = re.compile(r"\[\[?\s*show\s*:\s*([\w-]+)\s*\]\]?", re.IGNORECASE)
_SHOW_PREFIX = re.compile(r"\[\[?\s*(s(h(o(w(\s*(:(\s*[\w-]*)?)?)?)?)?)?)?$", re.IGNORECASE)
_MAX_TOKEN = 32


class ShowExpander:
    """Replaces show markers ([[show:ID]]) in streamed text with the display
    card for ID. Text that might be the start of a marker is held back until
    it resolves either way."""

    def __init__(self, displays: dict):
        self.displays = displays or {}
        self.buf = ""
        self.shown: set[str] = set()

    def feed(self, text: str) -> str:
        self.buf += text
        out = []
        while self.buf:
            i = self.buf.find("[")
            if i == -1:
                out.append(self.buf)
                self.buf = ""
                break
            out.append(self.buf[:i])
            self.buf = self.buf[i:]
            m = _SHOW_RE.match(self.buf)
            if m:
                token = m.group(0)
                if token.startswith("[[") and not token.endswith("]]") and len(self.buf) == m.end():
                    break  # "[[show:r1]" — the second "]" may be in the next chunk
                out.append(self._card(m.group(1)))
                self.buf = self.buf[m.end():]
                continue
            if len(self.buf) <= _MAX_TOKEN and _SHOW_PREFIX.match(self.buf):
                break  # could still become a marker — wait for more text
            out.append("[")
            self.buf = self.buf[1:]
        return "".join(out)

    def flush(self) -> str:
        rest, self.buf = self.buf, ""
        m = _SHOW_RE.fullmatch(rest)
        return self._card(m.group(1)) if m else rest

    def _card(self, display_id: str) -> str:
        card = self.displays.get(display_id) or self.displays.get(display_id.lower())
        if not card or display_id in self.shown:
            return ""
        self.shown.add(display_id)
        return f"\n\n{card}\n\n"


# ── Message building ─────────────────────────────────────────────────────────

def _history_messages(history: list[dict]) -> list[dict]:
    out = []
    for h in (history or [])[-HISTORY_MESSAGES:]:
        role = h.get("role")
        content = (h.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        if len(content) > HISTORY_MSG_CHARS:
            content = content[:HISTORY_MSG_CHARS] + " …"
        out.append({"role": role, "content": content})
    return out


def build_llm_messages(state: CopilotState, ctx: CopilotContext, force_final: bool) -> list[dict]:
    messages = [
        {"role": "system", "content": STATIC_SYSTEM_PROMPT},
        {"role": "system", "content": dynamic_context(
            current_time=ctx.current_time,
            team=ctx.team,
            page_context=ctx.page_context,
            focus=state.get("focus"),
            complaint=ctx.complaint,
        )},
        *_history_messages(ctx.history),
        *state.get("messages", []),
    ]
    if force_final:
        messages.append({"role": "system", "content": FINAL_ANSWER_NUDGE})
    return messages


# ── Nodes ────────────────────────────────────────────────────────────────────

async def agent(state: CopilotState, runtime: Runtime[CopilotContext]) -> dict:
    ctx = runtime.context
    write = runtime.stream_writer
    iterations = state.get("iterations", 0)
    tokens_used = state.get("tokens_used", 0)
    force_final = iterations >= MAX_ITERATIONS or tokens_used >= RUN_TOKEN_BUDGET
    if force_final:
        logger.info("Copilot agent: forcing final answer (iterations=%s tokens=%s)", iterations, tokens_used)

    step_id = f"think-{iterations}"
    write({
        "type": "step", "id": step_id, "state": "running",
        "label": "Thinking",
    })
    step_open = True

    expander = ShowExpander(state.get("displays") or {})
    streamed: list[str] = []

    def emit(piece: str):
        nonlocal step_open
        if not piece:
            return
        if step_open:
            write({"type": "step", "id": step_id, "state": "done"})
            step_open = False
        streamed.append(piece)
        write({"type": "chunk", "content": piece})

    turn = await stream_chat(
        build_llm_messages(state, ctx, force_final),
        tools=REGISTRY.schemas(),
        tool_choice="none" if force_final else "auto",
        max_tokens=AGENT_MAX_TOKENS,
        model=settings.copilot_agent_model or None,
        on_text=lambda t: emit(expander.feed(t)),
    )
    emit(expander.flush())
    if step_open:
        write({"type": "step", "id": step_id, "state": "done"})

    new_text = "".join(streamed)
    if turn.tool_calls and new_text and not new_text.endswith("\n"):
        # Text written before tool calls; keep it apart from what comes next.
        write({"type": "chunk", "content": "\n\n"})
        new_text += "\n\n"

    msg = turn.assistant_message()
    if force_final:
        msg.pop("tool_calls", None)  # never act on calls made past the cap
    return {
        "messages": [msg],
        "iterations": iterations + 1,
        "tokens_used": tokens_used + turn.total_tokens,
        "answer": (state.get("answer") or "") + new_text,
    }


def route_after_agent(state: CopilotState) -> str:
    last = (state.get("messages") or [{}])[-1]
    return "tools" if last.get("tool_calls") else "finalize"


def _tool_message(call_id: str, payload) -> dict:
    content = json.dumps(payload, ensure_ascii=False, default=str)
    if len(content) > TOOL_RESULT_CHARS:
        content = content[:TOOL_RESULT_CHARS] + "…(truncated)"
    return {"role": "tool", "tool_call_id": call_id, "content": content}


async def _run_tool(name: str, args: dict, tctx: ToolContext, own_session: bool) -> ToolResult:
    tool = REGISTRY.get(name)
    if own_session:
        from app.core.database import get_session_factory
        async with get_session_factory()() as session:
            return await tool.handler(args, replace(tctx, db=session))
    try:
        return await tool.handler(args, tctx)
    except Exception:
        try:
            await tctx.db.rollback()
        except Exception:
            pass
        raise


def _tool_context(ctx: CopilotContext) -> ToolContext:
    return ToolContext(
        organization_id=str(ctx.organization_id),
        user_id=str(ctx.user_id),
        user_role=ctx.user_role,
        db=ctx.db,
        user_message=ctx.user_message,
        page_context=ctx.page_context,
        background_tasks=ctx.background_tasks,
    )


def _parse_args(call: dict) -> dict:
    try:
        args = json.loads(call["function"].get("arguments") or "{}")
    except json.JSONDecodeError:
        return {}
    if not isinstance(args, dict):
        return {}
    return {k: v for k, v in args.items() if v not in (None, "")}


async def _stage_for_approval(state: CopilotState, ctx: CopilotContext, write, call_id: str, tool, args: dict) -> dict:
    """Save the write action as pending (so a reload still shows the approval
    card) and tell the recruiter. Runs once — the approval node only waits."""
    from app.services.ai.copilot_service import _load_last_context, _save_conversation_to_db

    action_id = uuid.uuid4().hex
    write({
        "type": "step", "id": call_id, "state": "done", "label": tool.status_label(args),
        "detail": "Waiting for your approval", "tool": tool.name,
    })
    reply = APPROVAL_REPLY
    if state.get("answer") and not state["answer"].endswith("\n"):
        reply = "\n\n" + reply
    write({"type": "chunk", "content": reply})

    last_ctx = await _load_last_context(ctx.db, ctx.conversation_id, ctx.organization_id, ctx.user_id) or {}
    last_ctx.update(state.get("focus") or {})
    last_ctx["pending_action"] = {"id": action_id, "tool": tool.name, "args": args, "agent": "v2"}
    await _save_conversation_to_db(
        ctx.db, ctx.organization_id, ctx.user_id, ctx.conversation_id,
        ctx.user_message, ((state.get("answer") or "") + reply).strip(), last_context=last_ctx,
    )
    return {"id": action_id, "tool_call_id": call_id, "name": tool.name, "args": args}


async def tools(state: CopilotState, runtime: Runtime[CopilotContext]) -> dict:
    ctx = runtime.context
    write = runtime.stream_writer
    calls = (state.get("messages") or [{}])[-1].get("tool_calls") or []
    tctx = _tool_context(ctx)
    tctx.recruiter_text = " ".join(
        [h.get("content") or "" for h in (ctx.history or []) if h.get("role") == "user"]
        + [m.get("content") or "" for m in state.get("messages", []) if m.get("role") == "user"]
    ).lower()

    displays = dict(state.get("displays") or {})
    focus_update: dict = {}
    results: dict[str, dict] = {}
    runnable = []
    write_call = None

    for call in calls:
        call_id = call["id"]
        name = call["function"]["name"]
        tool = REGISTRY.get(name)
        if tool is None:
            results[call_id] = _tool_message(call_id, {"error": f"'{name}' is not available."})
            continue
        args = _parse_args(call)
        if tool.kind == "write":
            problem = tool.validate(args) if tool.validate else None
            if not problem and tool.prepare and write_call is None:
                try:
                    args, problem = await tool.prepare(args, tctx)
                except Exception as exc:
                    logger.error("Copilot prepare for %s failed: %s", name, exc, exc_info=True)
                    try:
                        await tctx.db.rollback()
                    except Exception:
                        pass
                    problem = "Couldn't check those details right now. Ask the recruiter to try again."
            if problem:
                results[call_id] = _tool_message(call_id, {"error": problem})
            elif write_call is None:
                write_call = (call_id, tool, args)
            else:
                results[call_id] = _tool_message(call_id, {
                    "error": "Only one action can wait for approval at a time. Offer this one after the first is done.",
                })
            continue
        runnable.append((call_id, tool, args))

    sem = asyncio.Semaphore(PARALLEL_TOOLS)
    own_session = len(runnable) > 1  # one AsyncSession can't run queries concurrently

    async def run(call_id, tool, args):
        write({"type": "step", "id": call_id, "state": "running", "label": tool.status_label(args), "tool": tool.name})
        async with sem:
            try:
                result = await _run_tool(tool.name, args, tctx, own_session)
            except Exception as exc:
                logger.error("Copilot tool %s failed: %s", tool.name, exc, exc_info=True)
                result = ToolResult(data={"error": "This lookup failed."}, summary="Couldn't complete", ok=False)
        write({
            "type": "step", "id": call_id, "state": "done" if result.ok else "error",
            "label": tool.status_label(args), "detail": result.summary, "tool": tool.name,
        })
        return call_id, result

    for call_id, result in await asyncio.gather(*(run(*r) for r in runnable)):
        payload = {"result": result.data}
        if result.display:
            display_id = f"r{len(displays) + 1}"
            displays[display_id] = result.display
            payload = {"display": display_id, **payload}
        focus_update.update({k: v for k, v in (result.focus or {}).items() if v})
        results[call_id] = _tool_message(call_id, payload)

    update = {
        # Tool messages follow the assistant message, in tool_call order. A
        # write call's message is added by the approval node once decided.
        "messages": [results[c["id"]] for c in calls if c["id"] in results],
        "displays": displays,
        "focus": focus_update,
    }
    if write_call is not None:
        update["pending"] = await _stage_for_approval(
            {**state, "focus": {**(state.get("focus") or {}), **focus_update}}, ctx, write, *write_call,
        )
    return update


def route_after_tools(state: CopilotState) -> str:
    return "approval" if state.get("pending") else "agent"


async def approval(state: CopilotState, runtime: Runtime[CopilotContext]) -> dict:
    """Pause until the recruiter approves or declines the pending write.

    Everything before interrupt() re-runs on resume, so this node does no
    work (and streams nothing) until it has the decision."""
    pending = state["pending"]
    decision = interrupt({
        "pending_tool_call": {"id": pending["id"], "name": pending["name"], "args": pending["args"]},
        "reply": APPROVAL_REPLY,
    })

    ctx = runtime.context
    write = runtime.stream_writer
    tool = REGISTRY.get(pending["name"])
    approved = (
        isinstance(decision, dict)
        and decision.get("approved") is True
        and decision.get("action_id") == pending["id"]
    )
    focus: dict = {}
    if not approved or tool is None:
        payload = {"result": "The recruiter did not approve this action, so it was NOT done. Don't retry it unless asked."}
    else:
        label = tool.status_label(pending["args"])
        write({"type": "step", "id": f"{pending['tool_call_id']}-run", "state": "running", "label": label, "tool": tool.name})
        try:
            result = await _run_tool(tool.name, pending["args"], _tool_context(ctx), own_session=False)
        except Exception as exc:
            logger.error("Copilot write tool %s failed: %s", tool.name, exc, exc_info=True)
            result = ToolResult(data={"error": "The action failed."}, summary="Failed", ok=False)
        write({
            "type": "step", "id": f"{pending['tool_call_id']}-run", "state": "done" if result.ok else "error",
            "label": label, "detail": result.summary, "tool": tool.name,
        })
        payload = {"result": result.data}
        focus = {k: v for k, v in (result.focus or {}).items() if v}

    return {
        "messages": [_tool_message(pending["tool_call_id"], payload)],
        "pending": None,
        "focus": focus,
        # The pre-approval text was already saved with the approval request;
        # what follows is a fresh reply.
        "answer": "",
    }


async def finalize(state: CopilotState, runtime: Runtime[CopilotContext]) -> dict:
    ctx = runtime.context
    answer = (state.get("answer") or "").strip()
    if not answer:
        answer = FALLBACK_REPLY
        runtime.stream_writer({"type": "chunk", "content": answer})

    from app.services.ai.copilot_service import _load_last_context, _save_conversation_to_db

    last_ctx = await _load_last_context(ctx.db, ctx.conversation_id, ctx.organization_id, ctx.user_id) or {}
    last_ctx.pop("pending_action", None)
    last_ctx.update(state.get("focus") or {})
    await _save_conversation_to_db(
        ctx.db, ctx.organization_id, ctx.user_id, ctx.conversation_id,
        ctx.user_message, answer, last_context=last_ctx,
    )
    return {"answer": answer}
