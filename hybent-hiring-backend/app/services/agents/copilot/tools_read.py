"""
Read tools for the Copilot agent.

Thin adapters over the existing `execute_read_tool` in copilot_service: the
SQL, ranking, caching and org scoping all stay there. Each adapter returns
compact JSON for the model plus the existing markdown card for the user.
Schemas are short v2 versions of copilot_service.TOOLS (same argument names).
"""
import re

from app.services.agents.registry import ToolContext, ToolResult, params
from app.services.agents.copilot.toolset import REGISTRY
from app.services.ai import copilot_service as legacy

_SUGGEST_RE = re.compile(r"\n*\[SUGGEST:[^\]]*\]")


_S = {"type": "string"}
_N = {"type": "number"}

# Short schemas: these are sent on every agent call, so every word costs.
# Argument names match copilot_service.execute_read_tool, which does the work.
SCHEMAS: dict[str, tuple[str, dict]] = {
    "search_candidates": (
        "Search candidates. 'query' = skills/role keywords (expand abbreviations). Combine filters as needed.",
        params({
            "query": _S, "name": _S, "email": _S, "location": _S, "designation": _S, "tag": _S,
            "status": {"type": "string", "description": "Stage, e.g. applied, screening, technical_round, hr_round, offered, hired, rejected, interview"},
            "experience_min": _N, "experience_max": _N,
            "notice_period_max": {"type": "integer", "description": "Days; 0 = immediate joiner"},
            "salary_max_lpa": _N,
            "date_range": {"type": "string", "enum": ["today", "this_week", "this_month"], "description": "When added"},
            "sort_by": {"type": "string", "enum": ["experience", "created_at"]},
            "detailed": {"type": "boolean", "description": "Full cards; only if asked for details"},
        }),
    ),
    "get_candidates_for_job": (
        "Applicants of a specific job opening.",
        params({"job_title": _S, "detailed": {"type": "boolean"}}, required=["job_title"]),
    ),
    "search_jobs": ("Job openings by title/status.", params({
        "title": _S, "status": {"type": "string", "enum": ["active", "draft", "closed", "paused"]},
    })),
    "search_users": ("Internal team members (not candidates).", params({
        "name": _S, "email": _S, "role": {"type": "string", "enum": ["interviewer", "recruiter", "admin"]},
    })),
    "search_interviews": ("Scheduled interviews.", params({
        "candidate_name": _S,
        "date_range": {"type": "string", "enum": ["today", "tomorrow", "this_week"]},
        "status": {"type": "string", "enum": ["scheduled", "completed", "cancelled"]},
    })),
    "get_pipeline_summary": ("Candidate counts per pipeline stage bucket.", params({})),
    "get_analytics": ("Hiring KPIs: total candidates, jobs, interviews, offers, hires, today's activity.", params({
        "metric": {"type": "string", "enum": ["overview", "pipeline", "interviews", "offers", "today"]},
    }, required=["metric"])),
}


def _legacy_schema(name: str) -> tuple[str, dict]:
    return SCHEMAS[name]


def _clean_args(args: dict) -> dict:
    # Models send null/"" for unused optional fields; drop them so they don't
    # filter anything and the cache key stays stable.
    return {k: v for k, v in (args or {}).items() if v not in (None, "", [])}


async def _run_legacy(name: str, args: dict, ctx: ToolContext) -> tuple[str, object]:
    sink: dict = {}
    text = await legacy.execute_read_tool(
        name, _clean_args(args), ctx.organization_id, ctx.db, user_message=ctx.user_message, sink=sink,
    )
    # The model writes its own follow-up suggestion; the card's would duplicate it.
    return _SUGGEST_RE.sub("", text or "").strip(), sink.get("data")


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _register(name: str, status: str, *status_args: str):
    description, parameters = _legacy_schema(name)
    return REGISTRY.tool(name, description, parameters, kind="read", status=status, status_args=status_args)


@_register("search_candidates", "Searching candidates", "query", "designation", "location", "status")
async def search_candidates(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("search_candidates", args, ctx)
    if not isinstance(data, dict):
        return ToolResult(data={"error": text or "Search failed"}, summary="Search failed", ok=False)
    total = data.get("total", 0)
    focus = {}
    cands = data.get("candidates") or []
    if total == 1 and cands:
        focus = {"candidate_id": cands[0].get("id"), "candidate_name": cands[0].get("name")}
    return ToolResult(data=data, display=text if total else "", summary=f"Found {_plural(total, 'candidate')}", focus=focus)


@_register("get_candidates_for_job", "Finding applicants", "job_title")
async def get_candidates_for_job(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("get_candidates_for_job", args, ctx)
    if not isinstance(data, dict):
        return ToolResult(data={"message": text}, summary="No matching job", ok=bool(text))
    total = data.get("total", 0)
    focus = {"job_id": data["job_id"], "job_title": data.get("job_title")} if data.get("job_id") else {}
    if not total:
        data = {**data, "message": text}
    return ToolResult(data=data, display=text if total else "", summary=f"Found {_plural(total, 'applicant')}", focus=focus)


@_register("search_jobs", "Looking up jobs", "title", "status")
async def search_jobs(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("search_jobs", args, ctx)
    data = data if isinstance(data, list) else []
    focus = {"job_id": data[0]["id"], "job_title": data[0]["title"]} if len(data) == 1 else {}
    return ToolResult(data={"jobs": data}, display=text if data else "", summary=f"Found {_plural(len(data), 'job')}", focus=focus)


@_register("search_users", "Looking up team members", "name", "role")
async def search_users(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("search_users", args, ctx)
    data = data if isinstance(data, list) else []
    return ToolResult(data={"users": data}, display=text if data else "", summary=f"Found {_plural(len(data), 'team member')}")


@_register("search_interviews", "Checking interviews", "date_range", "candidate_name")
async def search_interviews(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("search_interviews", args, ctx)
    data = data if isinstance(data, list) else []
    return ToolResult(data={"interviews": data}, display=text if data else "", summary=f"Found {_plural(len(data), 'interview')}")


@_register("get_pipeline_summary", "Reading the pipeline")
async def get_pipeline_summary(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("get_pipeline_summary", args, ctx)
    total = (data or {}).get("total", 0) if isinstance(data, dict) else 0
    return ToolResult(data=data or {"message": text}, display=text, summary=f"{_plural(total, 'candidate')} across the pipeline")


@_register("get_analytics", "Pulling analytics", "metric")
async def get_analytics(args: dict, ctx: ToolContext) -> ToolResult:
    text, data = await _run_legacy("get_analytics", args, ctx)
    return ToolResult(data=data or {"message": text}, display=text if data else "", summary="Analytics ready")
