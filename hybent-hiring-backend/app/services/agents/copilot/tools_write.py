"""
Write tools for the Copilot agent. Every one pauses the run for the
recruiter's approval (graph `approval` node) before its handler runs.

Handlers reuse the existing `execute_write_tool` in copilot_service, which
resolves names to real records inside the org and does the actual change.
"""
import re
import uuid
from typing import Optional

from app.services.agents.registry import ToolContext, ToolResult, params
from app.services.agents.copilot.toolset import REGISTRY
from app.services.ai import copilot_service as legacy

WRITE_ROLES = {"admin", "recruiter"}

_PLACEHOLDER_NAMES = {
    "", "none", "null", "unknown", "candidate", "a candidate", "the candidate",
    "candidate_name", "placeholder",
}


def _needs_real_candidate(args: dict) -> Optional[str]:
    name = str(args.get("candidate_name") or "").lower().strip("[]() ")
    if name in _PLACEHOLDER_NAMES:
        return "No real candidate name given. Ask the recruiter which candidate (exact name or email)."
    return None


def _validate_schedule(args: dict) -> Optional[str]:
    missing = _needs_real_candidate(args)
    if missing:
        return missing
    if not str(args.get("scheduled_at") or "").strip():
        return "Date and time are missing. Ask the recruiter when the interview should be."
    if not str(args.get("interviewer_names") or "").strip():
        return "No interviewer chosen. Ask the recruiter who should take it, offering names from TEAM_MEMBERS."
    return None


_STAGES = (
    "pre_screening_selected, pre_screening_rejected, technical_round_selected, technical_round_rejected, "
    "practical_round_selected, practical_round_rejected, techno_functional_selected, management_round_selected, "
    "hr_round_selected, offered, hired, rejected"
)

SCHEMAS = {
    "schedule_meeting": (
        "Book an interview. Needs candidate, date/time and interviewer(s) the recruiter named (from TEAM_MEMBERS). "
        "Never pick an interviewer yourself; ask.",
        params({
            "candidate_name": {"type": "string"},
            "meeting_title": {"type": "string"},
            "scheduled_at": {"type": "string", "description": "YYYY-MM-DD HH:MM"},
            "interviewer_names": {"type": "string", "description": "Comma-separated"},
            "interview_stage": {"type": "string"},
        }, required=["candidate_name", "meeting_title", "scheduled_at"]),
    ),
    "update_candidate_stage": (
        "Move a candidate to a pipeline stage.",
        params({
            "candidate_name": {"type": "string"},
            "new_stage": {"type": "string", "description": _STAGES},
        }, required=["candidate_name", "new_stage"]),
    ),
}


def _legacy_schema(name: str) -> tuple[str, dict]:
    return SCHEMAS[name]


async def _run_write(name: str, args: dict, ctx: ToolContext) -> ToolResult:
    if (ctx.user_role or "").lower() not in WRITE_ROLES:
        return ToolResult(data={"error": "Not permitted for this user."}, summary="Not permitted", ok=False)
    text = await legacy.execute_write_tool(name, dict(args), ctx.organization_id, ctx.user_id, ctx.db)
    legacy._COPILOT_CACHE.clear()  # cached reads are stale after a write
    ok = not (text or "").lstrip().startswith(("❌", "❓"))
    return ToolResult(data={"outcome": text}, summary="Done" if ok else "Didn't go through", ok=ok)


async def _prepare_candidate(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    """Resolve the candidate to one real record before asking for approval,
    and pin the exact full name so the write can't hit a namesake."""
    from app.services.agents.copilot.tools_candidate import resolve_candidate

    c, problem = await resolve_candidate(args, ctx)
    if problem:
        data = problem.data
        if data.get("ambiguous"):
            names = ", ".join(f"{x['name']}" + (f" ({x['title']})" if x.get("title") else "") for x in data["ambiguous"])
            return args, f"Several candidates match: {names}. Ask the recruiter which one."
        return args, data.get("error") or "Candidate not found."
    # Exact full name only (an id would show up raw on the approval card);
    # execute_write_tool prefers an exact name match.
    resolved = {k: v for k, v in args.items() if k != "candidate_id"}
    return {**resolved, "candidate_name": c["full_name"]}, None


_TIME_HINT = re.compile(
    r"\d|today|tomorrow|tmrw|kal|parso|monday|tuesday|wednesday|thursday|friday|saturday|sunday"
    r"|morning|afternoon|evening|noon|next week|aaj|subah|shaam|dopahar",
    re.IGNORECASE,
)


def _said_by_recruiter(name: str, recruiter_text: str) -> bool:
    """True if any word of `name` (3+ letters) appears in what the recruiter typed."""
    words = [w for w in re.findall(r"[a-z0-9]+", name.lower()) if len(w) >= 3]
    return any(w in recruiter_text for w in words)


async def _prepare_schedule(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    from sqlalchemy import text

    # The model must not choose these for the recruiter (it tends to invent a
    # time and grab the first team member). Only enforced when we have the
    # conversation text.
    if ctx.recruiter_text:
        if not _TIME_HINT.search(ctx.recruiter_text):
            return args, "The recruiter hasn't said when. Ask for the date and time; don't pick one."
        invented = [
            n.strip() for n in str(args.get("interviewer_names") or "").split(",")
            if n.strip() and not _said_by_recruiter(n, ctx.recruiter_text)
        ]
        if invented:
            return args, (
                f"The recruiter never chose {', '.join(invented)}. Ask who should take the interview, "
                "offering names from TEAM_MEMBERS as [SUGGEST:...]."
            )

    args, problem = await _prepare_candidate(args, ctx)
    if problem:
        return args, problem
    resolved = []
    for raw in [n.strip() for n in str(args.get("interviewer_names") or "").split(",") if n.strip()]:
        rows = (await ctx.db.execute(
            text(
                "SELECT full_name, email FROM users WHERE organization_id = :o AND role <> 'candidate'"
                " AND (full_name ILIKE :n OR email ILIKE :n)"
            ),
            {"o": ctx.organization_id, "n": f"%{raw}%"},
        )).fetchall()
        rows = legacy._prefer_exact(rows, raw)
        if not rows:
            return args, f"No team member called '{raw}'. Ask the recruiter who should take the interview (TEAM_MEMBERS)."
        if len(rows) > 1:
            options = ", ".join(r.full_name for r in rows)
            return args, f"'{raw}' matches several team members: {options}. Ask the recruiter which one."
        resolved.append(rows[0].full_name)
    return {**args, "interviewer_names": ", ".join(resolved)}, None


_desc, _params = _legacy_schema("schedule_meeting")


@REGISTRY.tool(
    "schedule_meeting", _desc, _params, kind="write",
    status="Scheduling interview", status_args=("candidate_name", "scheduled_at"),
    validate=_validate_schedule, prepare=_prepare_schedule,
)
async def schedule_meeting(args: dict, ctx: ToolContext) -> ToolResult:
    return await _run_write("schedule_meeting", args, ctx)


_desc, _params = _legacy_schema("update_candidate_stage")


@REGISTRY.tool(
    "update_candidate_stage", _desc, _params, kind="write",
    status="Moving candidate", status_args=("candidate_name", "new_stage"),
    validate=_needs_real_candidate, prepare=_prepare_candidate,
)
async def update_candidate_stage(args: dict, ctx: ToolContext) -> ToolResult:
    return await _run_write("update_candidate_stage", args, ctx)


@REGISTRY.tool(
    "send_pre_screening_invite",
    "Email a candidate an AI pre-screening interview invite, optionally for a job.",
    params({"candidate_id": {"type": "string"}, "candidate_name": {"type": "string"}, "job_title": {"type": "string"}},
           required=["candidate_name"]),
    kind="write",
    status="Sending pre-screening invite", status_args=("candidate_name", "job_title"),
    validate=_needs_real_candidate, prepare=_prepare_candidate,
)
async def send_pre_screening_invite(args: dict, ctx: ToolContext) -> ToolResult:
    """Runs the same code path as the Pre-screening page's "Send invite"."""
    from fastapi import BackgroundTasks, HTTPException
    from sqlalchemy import select, text

    from app.models.user import User
    from app.routers.pre_screening import create_session
    from app.schemas.pre_screening import CreateSessionRequest
    from app.services.agents.copilot.tools_candidate import resolve_candidate

    if (ctx.user_role or "").lower() not in WRITE_ROLES:
        return ToolResult(data={"error": "Not permitted for this user."}, summary="Not permitted", ok=False)
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    job_id = None
    if args.get("job_title"):
        row = (await ctx.db.execute(
            text("SELECT id FROM jobs WHERE organization_id = :oid AND title ILIKE :t ORDER BY created_at DESC LIMIT 1"),
            {"oid": ctx.organization_id, "t": f"%{args['job_title']}%"},
        )).fetchone()
        if not row:
            return ToolResult(data={"error": f"No job matching '{args['job_title']}'."}, summary="Job not found", ok=False)
        job_id = row.id
    user = (await ctx.db.execute(select(User).where(User.id == uuid.UUID(ctx.user_id)))).scalar_one()
    try:
        out = await create_session(
            body=CreateSessionRequest(candidate_id=c["id"], job_id=job_id),
            current_user=user,
            db=ctx.db,
            background_tasks=ctx.background_tasks or BackgroundTasks(),
        )
        await ctx.db.commit()
    except HTTPException as exc:
        await ctx.db.rollback()
        detail = str(exc.detail)
        if detail.startswith("completed_session:"):
            detail = "This candidate already completed a pre-screening for this job."
        return ToolResult(data={"error": detail}, summary="Didn't go through", ok=False)
    return ToolResult(
        data={"sent_to": out.get("candidate_email"), "candidate": out.get("candidate_name"),
              "questions": out.get("questions_count"), "expires_at": out.get("expires_at")},
        summary="Invite sent",
        focus={"candidate_id": str(c["id"]), "candidate_name": c["full_name"]},
    )
