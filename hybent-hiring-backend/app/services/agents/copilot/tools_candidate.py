"""
Candidate-level read tools for the Copilot agent: details, resume Q&A,
match explanation, comparison, similar candidates, feedback, offers,
pre-screening, activity, reports and interview-question material.

Every tool accepts a `candidate_id` (from FOCUS or an earlier result) or a
`candidate_name`, resolved inside the org. Most reuse the existing tool_*
functions in copilot_service. Tools that used to call an LLM themselves
(resume Q&A, interview questions) now return the resume excerpts instead
and the agent writes the answer in its own call — one LLM call, not two.
"""
import uuid
from typing import Optional

from sqlalchemy import text

from app.services.agents.registry import ToolContext, ToolResult, params
from app.services.agents.copilot.toolset import REGISTRY
from app.services.ai import copilot_service as legacy
from app.services.ai import resume_rag

EXCERPT_CHARS = 500

# Shared by every candidate tool. The prompt explains: prefer the id from
# FOCUS / earlier results, else the name.
_CANDIDATE = {"candidate_id": {"type": "string"}, "candidate_name": {"type": "string"}}


async def resolve_candidate(args: dict, ctx: ToolContext) -> tuple[Optional[dict], Optional[ToolResult]]:
    """(candidate row, None) or (None, a ToolResult explaining the problem)."""
    cid = str(args.get("candidate_id") or "").strip()
    if cid:
        try:
            uuid.UUID(cid)
        except ValueError:
            cid = ""
    if cid:
        c = await legacy._fetch_candidate_full(ctx.db, ctx.organization_id, cid)
        if c:
            return c, None
    name = str(args.get("candidate_name") or "").strip()
    if not name:
        return None, ToolResult(data={"error": "Which candidate? Ask the recruiter for a name."}, summary="Need a candidate", ok=False)
    rows = (await ctx.db.execute(
        text(
            "SELECT id, full_name, current_title FROM candidates"
            " WHERE organization_id = :oid AND is_deleted = false AND full_name ILIKE :n"
            " ORDER BY created_at DESC LIMIT 5"
        ),
        {"oid": ctx.organization_id, "n": f"%{name}%"},
    )).fetchall()
    if not rows:
        return None, ToolResult(data={"error": f"No candidate named '{name}' in this organisation."}, summary="Not found", ok=False)
    exact = [r for r in rows if r.full_name.strip().lower() == name.lower()]
    if len(rows) > 1 and len(exact) != 1:
        return None, ToolResult(
            data={"ambiguous": [{"id": str(r.id), "name": r.full_name, "title": r.current_title} for r in rows],
                  "instruction": "Several candidates match. Ask the recruiter which one."},
            summary=f"{len(rows)} candidates match",
        )
    c = await legacy._fetch_candidate_full(ctx.db, ctx.organization_id, str((exact or rows)[0].id))
    return c, None


def _focus(c: dict) -> dict:
    return {"candidate_id": str(c["id"]), "candidate_name": c["full_name"]}


def _text_result(text_out: str, c: Optional[dict], summary: str) -> ToolResult:
    """Wrap a formatted legacy answer: shown as a card, and the same text is
    what the model reasons over."""
    return ToolResult(data={"text": text_out}, display=text_out, summary=summary, focus=_focus(c) if c else {})


def _candidate_tool(name: str, description: str, extra: Optional[dict] = None, required: Optional[list] = None,
                    status: str = "", status_args: tuple = ("candidate_name",)):
    return REGISTRY.tool(
        name, description, params({**_CANDIDATE, **(extra or {})}, required=required),
        kind="read", status=status, status_args=status_args,
    )


@_candidate_tool(
    "get_candidate_details",
    "One candidate's full profile.",
    status="Opening profile",
)
async def get_candidate_details(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    parsed = c.get("parsed_data") or {}
    data = {
        **legacy._compact_candidate(c),
        "email": c.get("email"),
        "applied_for": c.get("applied_job_title"),
        "summary": (c.get("summary") or parsed.get("summary") or "")[:400] or None,
        "education": [
            " — ".join(p for p in [e.get("degree"), e.get("institution"), str(e.get("year") or "")] if p)
            for e in (parsed.get("education") or []) if isinstance(e, dict)
        ][:4],
        "projects": [p.get("name") for p in (parsed.get("projects") or []) if isinstance(p, dict) and p.get("name")][:5],
        "certifications": [x for x in (parsed.get("certifications") or []) if isinstance(x, str)][:5],
        "skills": (c.get("skills") or [])[:15],
    }
    data = {k: v for k, v in data.items() if v not in (None, "", [])}
    card = await legacy.tool_get_candidate_details(str(c["id"]), ctx.organization_id, ctx.db)
    return ToolResult(data=data, display=card, summary=c["full_name"], focus=_focus(c))


@_candidate_tool(
    "ask_resume",
    "Search one candidate's resume text for a specific question; returns excerpts to answer from.",
    extra={"question": {"type": "string"}},
    required=["question"],
    status="Reading resume", status_args=("candidate_name", "question"),
)
async def ask_resume(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    question = args.get("question") or "resume summary"
    chunks = await resume_rag.semantic_search_candidate(ctx.db, ctx.organization_id, str(c["id"]), question, top_k=5)
    if not chunks or resume_rag.best_score(chunks) < resume_rag.MIN_RELEVANCE_SCORE:
        return ToolResult(
            data={"candidate": c["full_name"], "excerpts": [], "note": "Nothing relevant in the resume. Say so plainly."},
            summary="Nothing relevant found", focus=_focus(c),
        )
    excerpts = [{"section": ch.get("section"), "text": (ch.get("content") or "")[:EXCERPT_CHARS]} for ch in chunks]
    return ToolResult(
        data={"candidate": c["full_name"], "excerpts": excerpts},
        summary=f"Found {len(excerpts)} relevant section{'s' if len(excerpts) != 1 else ''}", focus=_focus(c),
    )


@_candidate_tool(
    "explain_match_score",
    "Explain a candidate's match score (for their applied job, or job_title).",
    extra={"job_title": {"type": "string"}},
    status="Checking match score", status_args=("candidate_name", "job_title"),
)
async def explain_match_score(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    out = await legacy.tool_explain_match_score(str(c["id"]), args.get("job_title"), ctx.organization_id, ctx.db)
    return _text_result(out, c, "Score explained")


@REGISTRY.tool(
    "compare_candidates",
    "Compare 2-4 candidates side by side.",
    params({
        "candidate_ids": {"type": "array", "items": {"type": "string"}},
        "candidate_names": {"type": "array", "items": {"type": "string"}},
    }),
    status="Comparing candidates", status_args=("candidate_names",),
)
async def compare_candidates(args: dict, ctx: ToolContext) -> ToolResult:
    picked, problems = [], []
    for cid in (args.get("candidate_ids") or [])[:4]:
        c, problem = await resolve_candidate({"candidate_id": cid}, ctx)
        (picked.append(c) if c else problems.append(problem.data))
    for name in (args.get("candidate_names") or [])[:4]:
        if len(picked) >= 4:
            break
        c, problem = await resolve_candidate({"candidate_name": name}, ctx)
        (picked.append(c) if c else problems.append(problem.data))
    unique = list({str(c["id"]): c for c in picked}.values())
    if len(unique) < 2:
        return ToolResult(data={"error": "Need at least two candidates to compare.", "problems": problems}, summary="Need 2 candidates", ok=False)
    table = await legacy.tool_compare_candidates([str(c["id"]) for c in unique], ctx.organization_id, ctx.db)
    return ToolResult(
        data={"candidates": [legacy._compact_candidate(c) for c in unique], "problems": problems or None},
        display=table, summary=f"Compared {len(unique)} candidates",
    )


@_candidate_tool(
    "find_similar_candidates",
    "Candidates with a similar profile.",
    status="Finding similar profiles",
)
async def find_similar_candidates(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    out = await legacy.tool_find_similar_candidates(str(c["id"]), ctx.organization_id, ctx.db)
    return _text_result(out, c, "Similar profiles ready")


@_candidate_tool(
    "get_interview_feedback",
    "Interview scorecards/feedback for a candidate.",
    status="Reading interview feedback",
)
async def get_interview_feedback(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    out = await legacy.tool_get_interview_feedback(str(c["id"]), ctx.organization_id, ctx.db)
    return _text_result(out, c, "Feedback loaded")


@_candidate_tool(
    "get_pre_screening_status",
    "A candidate's AI pre-screening status/summary.",
    status="Checking pre-screening",
)
async def get_pre_screening_status(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    out = await legacy.tool_get_pre_screening_status(str(c["id"]), ctx.organization_id, ctx.db)
    return _text_result(out, c, "Status loaded")


@REGISTRY.tool(
    "get_offers",
    "Offers for a candidate, or all offers by status.",
    params({**_CANDIDATE, "status": {"type": "string", "enum": ["draft", "sent", "accepted", "declined", "withdrawn"]}}),
    status="Checking offers", status_args=("candidate_name", "status"),
)
async def get_offers(args: dict, ctx: ToolContext) -> ToolResult:
    c = None
    if args.get("candidate_id") or args.get("candidate_name"):
        c, problem = await resolve_candidate(args, ctx)
        if problem:
            return problem
    out = await legacy.tool_get_offers(
        str(c["id"]) if c else None, args.get("status"), ctx.organization_id, ctx.db, user_message=ctx.user_message,
    )
    return _text_result(out, c, "Offers loaded")


@REGISTRY.tool(
    "get_activity",
    "Recent activity log, optionally for one candidate.",
    params(_CANDIDATE),
    status="Checking recent activity", status_args=("candidate_name",),
)
async def get_activity(args: dict, ctx: ToolContext) -> ToolResult:
    c = None
    if args.get("candidate_id") or args.get("candidate_name"):
        c, problem = await resolve_candidate(args, ctx)
        if problem:
            return problem
    out = await legacy.tool_get_activity(
        ctx.user_id, ctx.user_role, ctx.organization_id, ctx.db, resource_id=str(c["id"]) if c else None,
    )
    return _text_result(out, c, "Activity loaded")


@REGISTRY.tool(
    "get_analytics_report",
    "Reports: time to hire, source, funnel, job performance, interviewer performance, fairness.",
    params({"metric": {"type": "string"}, "job_title": {"type": "string"}}),
    status="Building report", status_args=("metric", "job_title"),
)
async def get_analytics_report(args: dict, ctx: ToolContext) -> ToolResult:
    out = await legacy.tool_get_analytics_report(
        args.get("metric"), args.get("job_title"), ctx.user_id, ctx.user_role, ctx.organization_id, ctx.db,
    )
    return _text_result(out, None, "Report ready")


@_candidate_tool(
    "get_interview_question_material",
    "Resume facts for writing a candidate's interview questions; you then write 6-8 grounded questions.",
    extra={"job_title": {"type": "string"}},
    status="Preparing interview questions", status_args=("candidate_name", "job_title"),
)
async def get_interview_question_material(args: dict, ctx: ToolContext) -> ToolResult:
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    query = f"skills experience projects responsibilities {args.get('job_title') or ''}".strip()
    chunks = await resume_rag.semantic_search_candidate(ctx.db, ctx.organization_id, str(c["id"]), query, top_k=6)
    facts = [(ch.get("content") or "")[:EXCERPT_CHARS] for ch in chunks or []]
    if not facts and c.get("skills"):
        facts = [f"Skills: {', '.join(c['skills'][:20])}"]
    if not facts:
        return ToolResult(data={"error": "Not enough resume information to write targeted questions."}, summary="Not enough resume data", ok=False)
    return ToolResult(
        data={"candidate": c["full_name"], "target_role": args.get("job_title"), "facts": facts},
        summary="Resume facts ready", focus=_focus(c),
    )
