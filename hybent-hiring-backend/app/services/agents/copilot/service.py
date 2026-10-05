"""
Copilot agent v2 entry point: runs the LangGraph agent and streams SSE.

SSE contract (same framing as the legacy path — JSON + blank line):
  meta   {conversation_id}                 first, as soon as the thread exists
  step   {id, label, state, detail?, tool?} live progress ("Searching candidates…")
  chunk  {content}                         answer text, token by token
  approval {conversation_id, pending_tool_call, reply}   (write tools)
  done   {}
Older frontends ignore `step`, so this ships before the UI does.
"""
import json
import logging
import uuid
import zoneinfo
from datetime import datetime
from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_metering import ai_feature
from app.services.agents.copilot.graph import get_graph
from app.services.agents.copilot.state import RESET, CopilotContext

logger = logging.getLogger(__name__)

ERROR_REPLY = "Sorry, something went wrong on my end. Please try that again."
RATE_LIMIT_REPLY = "I'm getting a lot of requests right now and hit my usage limit. Please try again in a minute."
STALE_APPROVAL_REPLY = "That action is no longer waiting for approval. Please ask me again and I'll prepare it fresh."
_FOCUS_KEYS = ("candidate_id", "candidate_name", "job_id", "job_title", "skill")
_TEAM_TTL = 300


def _is_rate_limit(exc: BaseException) -> bool:
    text_ = str(exc).lower()
    return getattr(exc, "status_code", None) == 429 or "rate limit" in text_ or "429" in text_


def sse(event_type: str, data: Optional[dict] = None) -> str:
    return json.dumps({"type": event_type, **(data or {})}, default=str) + "\n\n"


async def _org_now(db: AsyncSession, organization_id) -> str:
    tz_name = "Asia/Kolkata"
    try:
        row = (await db.execute(text("SELECT timezone FROM organizations WHERE id = :oid"), {"oid": organization_id})).fetchone()
        if row and row[0]:
            tz_name = row[0]
    except Exception as exc:
        logger.warning("Copilot agent: org timezone lookup failed: %s", exc)
        await db.rollback()
    try:
        now = datetime.now(zoneinfo.ZoneInfo(tz_name))
    except Exception:
        now = datetime.now()
    return now.strftime("%A, %b %d, %Y %I:%M %p")


async def _team_list(db: AsyncSession, organization_id) -> str:
    from app.services.ai.copilot_service import _cache_get, _cache_set

    key = f"team:{organization_id}"
    cached = _cache_get(key)
    if cached:
        return cached
    rows = (await db.execute(
        text(
            "SELECT full_name, role FROM users WHERE organization_id = :oid"
            " AND role IN ('admin', 'recruiter', 'interviewer') ORDER BY full_name"
        ),
        {"oid": organization_id},
    )).fetchall()
    team = ", ".join(f"{r.full_name} ({r.role})" for r in rows) if rows else "none on file"
    _cache_set(key, team, ttl=_TEAM_TTL)
    return team


async def _ensure_conversation(db: AsyncSession, organization_id, user_id, conversation_id: Optional[str], title: str):
    """Returns (conversation_id, created). The id doubles as the LangGraph
    thread id, so it must exist (and belong to this user) before the run."""
    from app.services.ai.copilot_service import _get_or_create_conversation

    return await _get_or_create_conversation(db, organization_id, user_id, conversation_id, title)


async def resume_from_approved_tool_call(
    db: AsyncSession, organization_id, user_id, conversation_id: Optional[str], approved_tool_call: dict,
) -> Optional[dict]:
    """The approval card sends back `approved_tool_call` (legacy shape). If
    the pending action was staged by this agent, turn it into a resume;
    otherwise return None and let the legacy path execute it."""
    from app.services.ai.copilot_service import _load_last_context

    if not conversation_id:
        return None
    last_ctx = await _load_last_context(db, conversation_id, organization_id, user_id) or {}
    pending = last_ctx.get("pending_action") or {}
    if pending.get("agent") != "v2":
        return None
    return {"action_id": (approved_tool_call or {}).get("id"), "approved": True}


@ai_feature("ai_copilot")
async def stream_copilot_agent(
    user_message: str,
    history: list[dict],
    organization_id: uuid.UUID,
    db: AsyncSession,
    page_context: Optional[dict] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    conversation_id: Optional[str] = None,
    user_role: Optional[str] = None,
    resume: Optional[dict] = None,
):
    from app.services.ai_credit_service import AICreditsService
    from app.services.ai import copilot_service as legacy
    from app.services.ai.copilot_router import GENERAL_HELP_REPLY, is_greeting

    await AICreditsService.check_credits_available(db, organization_id, "ai_copilot")

    if resume is None:
        # Zero-cost fast paths: no agent run, no tool schemas sent.
        if is_greeting(user_message):
            conv_id = await legacy._save_conversation_to_db(
                db, organization_id, user_id, conversation_id, user_message, GENERAL_HELP_REPLY,
                background_tasks=background_tasks,
            )
            yield sse("meta", {"conversation_id": conv_id})
            yield sse("chunk", {"content": GENERAL_HELP_REPLY})
            yield sse("done")
            return
        # Job descriptions (new, or an edit to the one in this chat) skip the agent.
        jd_kind, prev_jd, jd_change = await legacy.jd_turn(db, organization_id, user_id, conversation_id, user_message)
        if jd_kind:
            async for chunk in legacy.stream_jd_reply(
                db, organization_id, user_id, conversation_id, user_message, history,
                jd_kind, prev_jd, background_tasks=background_tasks, instruction=jd_change,
            ):
                yield chunk
            return

    conv_id, created = await _ensure_conversation(db, organization_id, user_id, conversation_id, user_message)
    yield sse("meta", {"conversation_id": conv_id})

    ctx = CopilotContext(
        organization_id=organization_id,
        user_id=user_id,
        user_role=user_role,
        db=db,
        conversation_id=conv_id,
        user_message=user_message,
        history=history,
        page_context=page_context,
        current_time=await _org_now(db, organization_id),
        team=await _team_list(db, organization_id),
        background_tasks=background_tasks,
    )
    config = {"configurable": {"thread_id": f"copilot:{conv_id}"}}
    graph = get_graph()

    if resume is not None:
        from langgraph.types import Command

        snapshot = await graph.aget_state(config)
        pending = (snapshot.values or {}).get("pending") or {}
        if not snapshot.interrupts or pending.get("id") != resume.get("action_id"):
            # Paused run is gone (server restarted without Postgres, or the
            # recruiter moved on) — never run an action from a stale card.
            last_ctx = await legacy._load_last_context(db, conv_id, organization_id, user_id) or {}
            last_ctx.pop("pending_action", None)
            await legacy._save_conversation_to_db(
                db, organization_id, user_id, conv_id, user_message, STALE_APPROVAL_REPLY, last_context=last_ctx,
            )
            yield sse("chunk", {"content": STALE_APPROVAL_REPLY})
            yield sse("done")
            return
        graph_input = Command(resume=resume)
    else:
        last_ctx = await legacy._load_last_context(db, conv_id, organization_id, user_id) or {}
        focus = {k: last_ctx[k] for k in _FOCUS_KEYS if last_ctx.get(k)}
        if page_context:
            # The page the recruiter is on is fresher than chat history.
            focus.update({k: page_context[k] for k in _FOCUS_KEYS if page_context.get(k)})
        graph_input = {
            "messages": [RESET, {"role": "user", "content": user_message}],
            "displays": {"__reset__": True},
            "focus": focus,
            "answer": "",
            "iterations": 0,
            "tokens_used": 0,
            "pending": None,
        }

    answer_parts: list[str] = []
    try:
        async for mode, payload in graph.astream(
            graph_input, config, context=ctx, stream_mode=["custom", "updates"], durability="exit",
        ):
            if mode == "custom":
                if payload.get("type") == "chunk":
                    answer_parts.append(payload.get("content", ""))
                yield sse(payload.pop("type"), payload)
            elif mode == "updates" and "__interrupt__" in payload:
                for intr in payload["__interrupt__"]:
                    yield sse("approval", {"conversation_id": conv_id, **(intr.value or {})})
    except Exception as exc:
        logger.error("Copilot agent run failed: %s", exc, exc_info=True)
        try:
            await db.rollback()
        except Exception:
            pass
        reply = RATE_LIMIT_REPLY if _is_rate_limit(exc) else ERROR_REPLY
        yield sse("chunk", {"content": ("\n\n" if answer_parts else "") + reply})
        if not answer_parts:
            try:
                await legacy._save_conversation_to_db(db, organization_id, user_id, conv_id, user_message, reply)
            except Exception:
                logger.exception("Copilot agent: could not save the error reply")
        try:
            await AICreditsService.log_failed_request(
                db=db, organization_id=organization_id, user_id=user_id, feature="ai_copilot",
                provider="Groq", model="agent", error_detail=str(exc)[:500], duration_ms=0,
            )
        except Exception:
            pass

    yield sse("done")

    if created and background_tasks is not None:
        background_tasks.add_task(
            legacy._generate_and_save_title,
            conv_id, str(organization_id), str(user_id), user_message, "".join(answer_parts)[:1000],
        )
