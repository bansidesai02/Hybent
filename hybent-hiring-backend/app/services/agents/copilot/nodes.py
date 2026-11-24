"""
Copilot agent graph nodes.

    agent ──tool calls──▶ tools ──▶ agent ──…──▶ finalize
      │        (write calls are only planned: they join `staged`)
      └─no tool calls, plan not empty─▶ stage ─▶ approval ⏸ (interrupt) ─resume─▶ agent

Models call one action per turn, so a request like "shortlist A and email
B" is planned over a few turns, then approved as one list and run in order.

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
APPROVAL_REPLY_MANY = "I've prepared {n} actions. Please review the list and approve to run them in order."
MAX_BATCH_ACTIONS = 10      # write actions approved together in one card
PLAN_TOKENS_PER_ACTION = 5_000  # extra run budget per planned action
PLANNED_NOTE = (
    "Planned as step {n}; NOT done yet. It runs only after the recruiter approves the full list. "
    "The recruiter asked: \"{request}\". Check every action and every candidate in that request: if any "
    "isn't planned yet, call its tool now. Only when all are planned, reply with one short line "
    "listing ONLY the steps that were planned, in plain words (no tool names), saying they will run after approval — never that anything is done, sent or drafted. If a part of the request got an "
    "error instead, say in that line that it couldn't be planned and why. No [SUGGEST] line: the approval "
    "card below has the Approve / Dismiss buttons."
)
_SUGGEST_LINE = re.compile(r"\n*\[SUGGEST:[^\]]*\]\s*")
ALREADY_DONE_NOTE = (
    "Already done in this request — the recruiter approved it and the outcome note above has the result. "
    "Do NOT call it again. Report that outcome to the recruiter now."
)
# Args that say WHAT an action changes and for whom. Free text (reason,
# body, title) is left out, so "cancel X's interview" with a reworded reason
# still counts as the same action.
_ACTION_IDENTITY = (
    "candidate_name", "recipient_name", "job_title", "new_stage", "tag", "new_time", "scheduled_at",
    "new_status", "field", "subject",
)


def action_key(name: str, args: dict) -> str:
    ident = {k: str(args[k]).strip().lower() for k in _ACTION_IDENTITY if args.get(k) not in (None, "")}
    return json.dumps([name, ident], sort_keys=True)


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
    # Each planned action costs one extra turn (models call one per turn), so
    # the caps grow with the plan; MAX_BATCH_ACTIONS bounds that.
    planned = len(state.get("staged") or [])
    force_final = (
        iterations >= MAX_ITERATIONS + planned
        or tokens_used >= RUN_TOKEN_BUDGET + PLAN_TOKENS_PER_ACTION * planned
    )
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
    # While actions are planned, this turn's text is the one-line plan summary
    # shown above the approval card. Hold it back so a [SUGGEST] line ("Confirm")
    # can be dropped before it reaches the recruiter; the card approves.
    planning = bool(state.get("staged"))
    held: list[str] = []

    def emit(piece: str):
        nonlocal step_open
        if not piece:
            return
        if planning:
            held.append(piece)
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
    if planning:
        planning = False
        emit(_SUGGEST_LINE.sub("\n\n", "".join(held)).strip())
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
    if last.get("tool_calls"):
        return "tools"
    # Done planning: show every planned action on one approval card.
    return "stage" if state.get("staged") else "finalize"


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


def _pending_calls(pending: dict) -> list[dict]:
    """[{tool_call_id, name, args}, ...]. Older checkpoints held one call
    directly on the pending dict."""
    if pending.get("calls"):
        return pending["calls"]
    return [{"tool_call_id": pending["tool_call_id"], "name": pending["name"], "args": pending["args"]}]


def approval_card(action_id: str, calls: list[dict]) -> dict:
    """What the approval card shows. One action keeps the original shape
    {id, name, args}; several become name "run_actions" with a numbered
    summary in args (readable by older UIs) plus `steps` for the list view."""
    if len(calls) == 1:
        return {"id": action_id, "name": calls[0]["name"], "args": calls[0]["args"]}
    steps = []
    for c in calls:
        tool = REGISTRY.get(c["name"])
        steps.append({"name": c["name"], "title": tool.status_label(c["args"]) if tool else c["name"], "args": c["args"]})
    return {
        "id": action_id,
        "name": "run_actions",
        "args": {f"Step {i}": s["title"] for i, s in enumerate(steps, 1)},
        "steps": steps,
    }


async def stage(state: CopilotState, runtime: Runtime[CopilotContext]) -> dict:
    """The agent finished planning: save every planned action as one pending
    approval (so a reload still shows the card) and tell the recruiter. Runs
    once — the approval node only waits. Approved actions then run in order."""
    from app.services.ai.copilot_service import _load_last_context, _save_conversation_to_db

    ctx = runtime.context
    write = runtime.stream_writer
    action_id = uuid.uuid4().hex
    calls = list(state.get("staged") or [])
    # Chips like "Confirm" would only send text, not approve; the card does that.
    state = {**state, "answer": _SUGGEST_LINE.sub("\n\n", state.get("answer") or "").strip()}
    reply = APPROVAL_REPLY if len(calls) == 1 else APPROVAL_REPLY_MANY.format(n=len(calls))
    # Name the real steps: the model's summary may mention an action that
    # couldn't be planned; this line and the card are the source of truth.
    labels = [REGISTRY.get(c["name"]).status_label(c["args"]) if REGISTRY.get(c["name"]) else c["name"] for c in calls]
    reply += "\n\n" + "\n".join(f"{i}. {label}" for i, label in enumerate(labels, 1))
    if state.get("answer") and not state["answer"].endswith("\n"):
        reply = "\n\n" + reply
    write({"type": "chunk", "content": reply})

    card = approval_card(action_id, calls)
    last_ctx = await _load_last_context(ctx.db, ctx.conversation_id, ctx.organization_id, ctx.user_id) or {}
    last_ctx.update(state.get("focus") or {})
    last_ctx["pending_action"] = {
        "id": action_id, "tool": card["name"], "args": card["args"], "steps": card.get("steps"), "agent": "v2",
    }
    await _save_conversation_to_db(
        ctx.db, ctx.organization_id, ctx.user_id, ctx.conversation_id,
        ctx.user_message, ((state.get("answer") or "") + reply).strip(), last_context=last_ctx,
    )
    return {"pending": {"id": action_id, "calls": calls}, "staged": []}


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
    # Write calls aren't run here: they join the plan, which the recruiter
    # approves as one list once the agent stops adding to it.
    staged: list[dict] = list(state.get("staged") or [])
    seen_writes = {action_key(s["name"], s["args"]) for s in staged}
    done_this_turn = set(state.get("done_actions") or [])
    tctx.planned = staged  # same list: grows as this turn's writes are planned

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
            if not problem and action_key(name, args) in done_this_turn:
                # Models re-call a just-approved action (the request still says
                # "cancel X"); running it again would fail and hide the success.
                problem = ALREADY_DONE_NOTE
            if not problem and len(staged) >= MAX_BATCH_ACTIONS:
                problem = (
                    f"At most {MAX_BATCH_ACTIONS} actions can be approved at once. "
                    "Tell the recruiter the rest can follow after these."
                )
            if not problem and tool.prepare:
                try:
                    args, problem = await tool.prepare(args, tctx)
                except Exception as exc:
                    logger.error("Copilot prepare for %s failed: %s", name, exc, exc_info=True)
                    try:
                        await tctx.db.rollback()
                    except Exception:
                        pass
                    problem = "Couldn't check those details right now. Ask the recruiter to try again."
            key = action_key(name, args)
            if not problem and key in seen_writes:
                problem = "Same action already planned above; not added twice."
            if problem:
                results[call_id] = _tool_message(call_id, {"error": problem})
            else:
                seen_writes.add(key)
                staged.append({"tool_call_id": call_id, "name": name, "args": args})
                write({
                    "type": "step", "id": call_id, "state": "done", "label": tool.status_label(args),
                    "detail": "Waiting for your approval", "tool": tool.name,
                })
                results[call_id] = _tool_message(call_id, {
                    "status": PLANNED_NOTE.format(n=len(staged), request=(ctx.user_message or "")[:500]),
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

    return {
        # Tool messages follow the assistant message, in tool_call order.
        "messages": [results[c["id"]] for c in calls if c["id"] in results],
        "displays": displays,
        "focus": focus_update,
        "staged": staged,
    }


async def approval(state: CopilotState, runtime: Runtime[CopilotContext]) -> dict:
    """Pause until the recruiter approves or declines the pending write.

    Everything before interrupt() re-runs on resume, so this node does no
    work (and streams nothing) until it has the decision."""
    pending = state["pending"]
    calls = _pending_calls(pending)
    decision = interrupt({
        "pending_tool_call": approval_card(pending["id"], calls),
        "reply": APPROVAL_REPLY if len(calls) == 1 else APPROVAL_REPLY_MANY.format(n=len(calls)),
    })

    ctx = runtime.context
    write = runtime.stream_writer
    approved = (
        isinstance(decision, dict)
        and decision.get("approved") is True
        and decision.get("action_id") == pending["id"]
    )
    focus: dict = {}
    outcomes = []
    # Run in the order planned (e.g. move stage, then schedule). Each action
    # stands alone, so one failing doesn't stop the rest; every outcome is
    # reported back so the answer can say exactly what did and didn't happen.
    for i, call in enumerate(calls, 1):
        tool = REGISTRY.get(call["name"])
        label = tool.status_label(call["args"]) if tool else call["name"]
        if not approved or tool is None:
            payload = {"result": "The recruiter did not approve this action, so it was NOT done. Don't retry it unless asked."}
        else:
            step_id = f"{call['tool_call_id']}-run"
            write({"type": "step", "id": step_id, "state": "running", "label": label, "tool": tool.name})
            try:
                result = await _run_tool(tool.name, call["args"], _tool_context(ctx), own_session=False)
            except Exception as exc:
                logger.error("Copilot write tool %s failed: %s", tool.name, exc, exc_info=True)
                result = ToolResult(data={"error": "The action failed."}, summary="Failed", ok=False)
            write({
                "type": "step", "id": step_id, "state": "done" if result.ok else "error",
                "label": label, "detail": result.summary, "tool": tool.name,
            })
            payload = {"result": result.data}
            if not result.ok:
                payload["status"] = "FAILED: this action was NOT done. Apologise briefly, say what failed, and offer the next step."
            focus.update({k: v for k, v in (result.focus or {}).items() if v})
        outcomes.append(f"{i}. {label}: " + json.dumps(payload, ensure_ascii=False, default=str))
    if approved and len(calls) > 1:
        # The focus of a batch is the last candidate touched; that's arbitrary,
        # so leave follow-ups ("iska") to ask which one.
        focus = {}
    # Each planned call already got its "planned" tool message, so the real
    # outcomes come back as one note the agent answers from.
    head = (
        "The recruiter approved the planned actions and they have now been RUN. These are final — never call "
        "these actions again. Answer the recruiter now, reporting each outcome (done or failed). Outcome of each, in order:"
    ) if approved else "The recruiter declined the planned actions:"
    report = head + "\n" + "\n".join(outcomes)
    if len(report) > TOOL_RESULT_CHARS * 2:
        report = report[:TOOL_RESULT_CHARS * 2] + "…(truncated)"

    return {
        "messages": [{"role": "system", "content": report}],
        "done_actions": list(state.get("done_actions") or []) + [action_key(c["name"], c["args"]) for c in calls],
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
