"""
Platform knowledge tool for the Copilot agent.

Answers "what can Hybent do / how much does it cost / where do I find X"
from the same knowledge the public site assistant uses (SITE_KNOWLEDGE), plus
the pages a recruiter actually has in the app. The model must answer product
questions from this result only, so it never invents features or prices.
"""
from app.services.agents.registry import ToolContext, ToolResult, params
from app.services.agents.copilot.toolset import REGISTRY
from app.services.ai.site_assistant import SITE_KNOWLEDGE

# Sections of SITE_KNOWLEDGE a recruiter can ask about inside the product.
_SECTIONS = ("Hybent Hiring — the product", "Pricing — Hybent Hiring", "Platform & technology")

# Mirrors the recruiter sidebar (hybent-hiring-frontend navConfig.tsx).
IN_APP_GUIDE = """# Where things are in the app (recruiter sidebar)
- Main: Overview (dashboard KPIs, upcoming interviews), Recruiter Copilot, Gmail Inbox.
- Candidates: To review, Upload Resume, Upload / Add JD, Talent DB (search every parsed candidate).
- Hiring: Open Positions (jobs), Pipeline (Kanban by stage), Schedule (book interviews with Google Calendar/Meet), AI Calls, Offers.
- Intelligence: AI Insights.
- Workspace: Team, AI Credits, Billing, Audit Logs, Settings.
- Rules: an offer needs the candidate to be HR Round Selected first; hired candidates can't be rejected; interviewers don't need a paid seat."""


def _sections(knowledge: str) -> str:
    parts = knowledge.split("\n# ")
    keep = [p if p.startswith("# ") else "# " + p for p in parts if p.lstrip("# ").startswith(_SECTIONS)]
    return "\n\n".join(s.strip() for s in keep)


PLATFORM_KNOWLEDGE = _sections(SITE_KNOWLEDGE) + "\n\n" + IN_APP_GUIDE


@REGISTRY.tool(
    "platform_help",
    "Facts about the Hybent Hiring product itself: plans, pricing, AI credits, seats, features, and where pages are in the app. "
    "Only for questions about the product (e.g. 'Pro plan price', 'where do I add a recruiter'). "
    "Never for the team's own data: candidates, jobs, team members, interviews, offers, rates, reports or activity. "
    "'Need a developer' / 'find X' are candidate requests, not product questions. "
    "Questions about you (which model/AI you are, who built you) are answered directly, without this.",
    params({"topic": {"type": "string", "description": "What the recruiter asked about, e.g. pricing, copilot, ai credits"}}),
    kind="read",
    status="Checking Hybent help",
)
async def platform_help(args: dict, ctx: ToolContext) -> ToolResult:
    return ToolResult(
        data={
            "knowledge": PLATFORM_KNOWLEDGE,
            "rule": "Answer only from this knowledge. If it doesn't cover the question, say you don't have that detail and suggest info@hybent.com.",
        },
        summary="Found product info",
    )
