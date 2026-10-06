"""
Copilot Intent Router
======================
General-purpose intent classification + entity extraction + follow-up
context resolution for the Recruiter Copilot, sitting in front of the
existing tool-calling loop in copilot_service.py.

copilot_intelligence.py already does excellent query normalization
(abbreviation expansion, fuzzy typo correction, Hinglish stopwords) — this
module reuses that rather than duplicating it, and adds what was missing:
a general intent taxonomy covering resume/match/pipeline/comparison/
similarity questions (not just candidate_search), plus resolution of
conversational follow-ups ("iska score?", "aur FastAPI?") against a
persisted structured context instead of relying on the model re-reading
raw chat history every turn.
"""
import asyncio
import json
import logging
import re
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.groq_client import SafeGroq as Groq, get_best_groq_model
from app.services.ai.copilot_intelligence import expand_abbreviations

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    if settings.gemini_api_key:
        genai.configure(api_key=settings.gemini_api_key)
except Exception as exc:
    logger.warning(f"[Router] Gemini configuration error: {exc}")
    genai = None

# Second-tier model when Groq is fully unavailable (both keys rate-limited,
# or down). Kept as one named constant, not scattered across call sites, so
# it's a one-line fix if Gemini deprecates this model — the same class of
# bug found in match_scorer.py's fallback tier, which still pointed at a
# retired "gemini-1.5-flash" and would have failed silently.
GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"


class CopilotIntent(str, Enum):
    GENERAL = "general"
    CANDIDATE_SEARCH = "candidate_search"
    CANDIDATE_DETAILS = "candidate_details"
    RESUME_QUERY = "resume_query"
    SKILL_QUERY = "skill_query"
    EXPERIENCE_QUERY = "experience_query"
    EDUCATION_QUERY = "education_query"
    PROJECT_QUERY = "project_query"
    CERTIFICATION_QUERY = "certification_query"
    JOB_QUERY = "job_query"
    JOB_MATCH = "job_match"
    SCORE_EXPLANATION = "score_explanation"
    PIPELINE_QUERY = "pipeline_query"
    INTERVIEW_QUERY = "interview_query"
    CANDIDATE_COMPARISON = "candidate_comparison"
    SIMILAR_CANDIDATE_SEARCH = "similar_candidate_search"
    INTERVIEW_FEEDBACK_QUERY = "interview_feedback_query"
    OFFER_QUERY = "offer_query"
    ANALYTICS_QUERY = "analytics_query"
    IMPORT_QUERY = "import_query"
    PRE_SCREENING_QUERY = "pre_screening_query"
    ACTIVITY_QUERY = "activity_query"


class RoutedIntent(BaseModel):
    intent: CopilotIntent = CopilotIntent.GENERAL
    candidate_names: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    job_title: Optional[str] = None
    metric: Optional[str] = None
    date_range: Optional[str] = None
    question: Optional[str] = None
    uses_followup_reference: bool = False


# ── Fast paths (no LLM call) ───────────────────────────────────────────────────

_GREETING_RE = re.compile(
    r"^(hi+|hello+|hey+|yo|hola|namaste|namaskar|"
    r"good\s*(morning|afternoon|evening|night)|what'?s\s*up|sup)[\s!.,?]*$",
    re.IGNORECASE,
)
_HELP_RE = re.compile(
    r"^(what can you (help( me)?( with)?|do)|how can you help( me)?|what do you do|"
    r"tum kya kar sakte ho|aap kya kar sakte ho|tum kya kar sakti ho|"
    r"what are your (features|capabilities)|who are you)[\s!.,?]*$",
    re.IGNORECASE,
)


def is_greeting(text_in: str) -> bool:
    """Trivial greetings/help-prompts that should get a direct conversational
    reply with zero retrieval and zero LLM classification call (spec: 'Hi'
    must not be routed through RAG or tools)."""
    t = (text_in or "").strip()
    return bool(_GREETING_RE.match(t) or _HELP_RE.match(t))


# The recruiter is scolding the Copilot or saying it did something they never
# asked for. Such a turn must open with an apology — and never be routed into
# the JD writer or a canned data answer, which would "act" on the complaint.
_COMPLAINT_RE = re.compile(
    r"\b(?:i|we)\s+(?:did\s*n[o']?t|didnt|never|had\s*n[o']?t)\s+(?:ask|tell|told|say|said|want|request|mention)"
    r"|\b(?:did|do)\s*n[o']?t\s+(?:ask|tell)\s+you\b"
    r"|\bwho\s+(?:asked|told)\s+you\b"
    r"|\bwhy\s+(?:did|would|have)\s+you\b"
    r"|\bnot\s+what\s+i\s+(?:asked|said|wanted|meant)\b"
    r"|\byou\s+(?:were\s*n[o']?t|werent)\s+(?:supposed|asked)\b"
    r"|\bi\s+(?:said|told\s+you)\s+(?:not|no|don'?t|dont|never)\b"
    r"|\bstop\s+doing\b"
    r"|\b(?:stupid|useless|nonsense|rubbish|idiot|dumb|wtf|what\s+the\s+hell)\b"
    # Hinglish
    r"|\bmaine\s+(?:kab|kaha|kahan)\s+(?:bola|kaha|maanga|manga)"
    r"|\bmaine\s+(?:ye|yeh|ya|aisa|aesa|esa|ise|isko)?\s*(?:to|toh)?\s*(?:nahi|nahin|nhi|ni)\s+(?:bola|kaha|maanga|manga|bataya)"
    r"|\bkisne\s+(?:bola|kaha)"
    r"|\b(?:tumne|tune|aapne)\s+(?:ye|yeh|aisa)?\s*(?:kyu|kyun|kyon)\b"
    r"|\b(?:kyu|kyun|kyon)\s+(?:kiya|kia|kar\s*diya|kardiya)\b"
    r"|\b(?:bakwas|bakwaas|bekar|bekaar|faltu|pagal)\b",
    re.IGNORECASE,
)


def is_complaint(text_in: str) -> bool:
    """The recruiter is upset with something the Copilot said or did."""
    return bool(_COMPLAINT_RE.search(text_in or ""))


# Shared by the legacy and agent system prompts.
APOLOGY_RULES = """When the recruiter is upset with you — scolding, frustrated, or saying you did something they didn't ask for ("I didn't tell you to do that", "maine ye nahi bola", "why did you…"):
- Your FIRST sentence is a short, sincere apology that names the specific mistake, e.g. "Sorry — you didn't ask me to move Priya, and I shouldn't have." This overrides "answer first".
- Don't argue, justify yourself, or blame the recruiter. Apologise once, then move on — no grovelling.
- Don't repeat the unwanted action or start a new one on your own. If something was actually changed, say plainly what and offer to undo it. Then ask, in one line, what they'd like instead.
- Reply in their language (English or Hinglish) and stay calm and professional, even if they are rude."""

# Added for the turn itself when `is_complaint` matches.
COMPLAINT_NOTE = (
    "The recruiter's latest message is a complaint about something you said or did. Start your reply with a "
    "brief, sincere apology for that specific thing, following the rules for when the recruiter is upset. "
    "Do not call tools or prepare any action unless the message also clearly asks for something concrete "
    "(e.g. undo it, or do X instead)."
)


GENERAL_HELP_REPLY = (
    "Hi! I'm Hybent Recruiter Copilot. I can help you:\n\n"
    "- Search candidates by skill, role, location or experience\n"
    "- Look up a candidate's profile, resume details, or match score\n"
    "- Explain why a candidate's match score is what it is\n"
    "- Compare candidates or find similar ones\n"
    "- Check your pipeline/interview status\n"
    "- Draft job descriptions and interview questions\n\n"
    "Just ask naturally — English or Hinglish both work. e.g. *\"Ankit ka Python experience kitna hai?\"*"
)


# ── LLM-based classification ────────────────────────────────────────────────────

ROUTER_SYSTEM_PROMPT = """You are the intent router for Hybent Recruiter Copilot, an HR/recruiting assistant used by Indian recruiters who mix English and Hinglish (Roman-script Hindi).

Classify the recruiter's message into exactly one intent and extract entities. Return ONLY a valid JSON object — no markdown, no explanation.

INTENTS:
- general: small talk, platform/how-to questions, anything not about a specific candidate/job/pipeline fact
- candidate_search: find/list candidates matching skills/role/location/experience/status (no single named candidate)
- candidate_details: asking about ONE named candidate's overall profile/current role/status
- resume_query: open-ended questions about a candidate's resume content — summarize it, issues in it, what to verify, where a skill is mentioned
- skill_query: does candidate X know skill Y / what are candidate X's skills
- experience_query: how much experience does candidate X have (overall, or specifically with one skill)
- education_query: candidate X's education/degree
- project_query: candidate X's projects
- certification_query: candidate X's certifications
- job_query: questions about a job opening's requirements/details
- job_match: how well candidate X matches job Y
- score_explanation: why candidate X's match score is what it is / what's missing
- pipeline_query: COUNTS of candidates by pipeline stage/status across the whole org (e.g. "kitne candidates screening mein hain", "management round pe kitne log hain" — pipeline stage names include "technical/practical/management/techno-functional/hr round"; "kitne"/"how many" + a stage name = pipeline_query, even if the stage name contains the word "round")
- interview_query: a SCHEDULED interview (when/who/status/join link), OR asking to generate interview questions for a candidate — not a stage count
- candidate_comparison: comparing two or more named candidates
- similar_candidate_search: find candidates similar to one named candidate
- interview_feedback_query: interviewer feedback/scorecard/rating/recommendation for a candidate's interview(s) — "how did the interview go", "what did the interviewer think", "rating/recommendation"
- offer_query: job offer status/details — pending offers, offer salary, accepted/declined offers, competing offers a candidate has
- analytics_query: hiring metrics/reports — time to hire, recruitment funnel, hire/reject/backout counts, score distribution, interviewer performance/bias, pass rates by stage or source
- import_query: bulk/CSV/Excel import history — when an import ran, how many created/duplicate/failed
- pre_screening_query: AI pre-screening / "voice screening" / automated screening call session status or summary for a candidate (distinct from a live interview with a human interviewer)
- activity_query: audit trail / "who did what" / recent activity on a candidate or job

DISAMBIGUATION (these are commonly confused — read carefully):
- A question about ONE NAMED candidate's own current stage/status ("Ankit kis stage mein hai?", "what stage is Ankit in") is candidate_details, NOT pipeline_query — pipeline_query is only for counting/aggregating across candidates, never for one named candidate's own status.
- "How many candidates were added [today/this week/this month]" is candidate_search (it already supports date-range filtering), not pipeline_query — pipeline_query is specifically about STAGE distribution, not creation-date counts.
- "Voice screening" / "AI screening questions" / "automated screening call" = pre_screening_query, even though the word "screening" alone elsewhere usually means the early pipeline stage (pipeline_query/candidate_search).

IMPORTANT: If the message is asking to PERFORM a database action rather than asking a question — schedule/book an interview, move/update a candidate's pipeline stage, add/create/edit a candidate/job record, or generate a job description — classify it as "general". Those mutate data and are handled by a separate action system; you only route read/informational questions.
EXCEPTION: "generate/prepare/write interview QUESTIONS for a candidate" is NOT a database action — it's Copilot composing text, same as summarizing a resume. Always classify that as interview_query, never general.

Recruiters write naturally, e.g. Hinglish: "Ankit ka experience kitna hai?", "Python aata hai use?", "iska score kam kyu hai?", "aur FastAPI?". Resolve pronouns ("iska", "uska", "isska", "ye candidate", "ye role") and bare follow-ups ("aur FastAPI?", "kitna score?", "kya missing hai") using CURRENT_CONTEXT below — if the message doesn't name a candidate/job but CURRENT_CONTEXT already has one, reuse that name/title and set uses_followup_reference=true.

CURRENT_CONTEXT: {last_context_json}

Return this exact JSON shape (use null / empty list when not applicable, never invent values not implied by the message or context):
{{
  "intent": "<one of the intents above>",
  "candidate_names": ["<candidate names mentioned or implied from context>"],
  "skills": ["<skills mentioned>"],
  "job_title": "<job title mentioned or implied from context, or null>",
  "metric": "<pipeline stage / status / analytics metric mentioned, or null>",
  "date_range": "<today/tomorrow/this_week/this_month if mentioned, or null>",
  "question": "<the core question in clean English, for open-ended resume questions>",
  "uses_followup_reference": true or false
}}"""


async def _classify_intent_gemini(system_prompt: str, user_content: str) -> Optional[RoutedIntent]:
    """Secondary classifier — only reached when Groq (both keys, every
    model in the fallback list) has failed. Same failover shape as
    match_scorer.py's Groq -> Gemini tier."""
    if genai is None or not settings.gemini_api_key:
        return None
    try:
        model = genai.GenerativeModel(GEMINI_FALLBACK_MODEL)
        response = await asyncio.to_thread(
            model.generate_content,
            f"{system_prompt.strip()}\n\n{user_content.strip()}",
            generation_config={"response_mime_type": "application/json", "temperature": 0.0},
        )
        if response and response.text:
            cleaned = response.text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`").removeprefix("json").strip()
            return RoutedIntent(**json.loads(cleaned))
    except Exception as e:
        logger.warning(f"[Router] Gemini classification failover error: {e}")
    return None


async def classify_intent(user_message: str, last_context: Optional[dict] = None) -> RoutedIntent:
    """
    One JSON-mode Groq call that classifies intent + extracts entities.
    Pre-normalizes through copilot_intelligence's abbreviation expansion
    (BDE -> Business Development Executive, etc.) so the router sees the
    same expanded vocabulary the rest of the system already understands.

    3-tier failover, same shape as match_scorer.py's scoring pipeline:
    Groq (2 keys x several models, via SafeGroq) -> Gemini -> a GENERAL
    intent carrying the raw message as `question`, so a total AI outage
    degrades to "let the legacy free-form flow try to answer this" instead
    of crashing the chat turn.
    """
    normalized, _ = expand_abbreviations(user_message)
    ctx_json = json.dumps(last_context or {}, ensure_ascii=False)
    system_prompt = ROUTER_SYSTEM_PROMPT.format(last_context_json=ctx_json)

    user_content = f"Message: {user_message}"
    if normalized.strip().lower() != user_message.strip().lower():
        user_content += f"\nNormalized: {normalized}"

    if settings.groq_api_key:
        client = Groq(api_key=settings.groq_api_key)
        last_error = None
        for attempt in range(2):
            try:
                content = user_content
                if attempt == 1 and last_error:
                    content += f"\n\n(Previous attempt produced invalid JSON: {last_error}. Return valid JSON only.)"

                resp = client.chat.completions.create(
                    model=get_best_groq_model(client),
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": content},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                )
                raw = json.loads(resp.choices[0].message.content)
                return RoutedIntent(**raw)
            except Exception as e:  # broad on purpose — classification must never crash the chat turn
                last_error = str(e)
                logger.warning(f"[Router] classify_intent Groq attempt {attempt + 1} failed: {e}")

    gemini_result = await _classify_intent_gemini(system_prompt, user_content)
    if gemini_result is not None:
        return gemini_result

    return RoutedIntent(intent=CopilotIntent.GENERAL, question=user_message)


# ── Follow-up context resolution ────────────────────────────────────────────────

async def _lookup_candidates_by_name(db: AsyncSession, organization_id, name: str):
    """Same ILIKE-on-full_name lookup pattern already used by
    execute_write_tool's candidate resolution in copilot_service.py."""
    res = await db.execute(
        text("SELECT id, full_name, email FROM candidates WHERE organization_id = :oid AND full_name ILIKE :n"),
        {"oid": organization_id, "n": f"%{name}%"},
    )
    return res.fetchall()


async def resolve_context(
    routed: RoutedIntent,
    last_context: Optional[dict],
    db: AsyncSession,
    organization_id,
) -> dict:
    """
    Resolves named/implied candidates and job to concrete IDs, scoped to the
    caller's organization_id (tenant isolation — never looks outside it).

    Returns:
      {
        "candidates": [{"id": str, "name": str}, ...],   # resolved, in order
        "not_found": [str, ...],                          # names with zero matches
        "ambiguous": {name: [{"id","name"}, ...]},        # names with multiple matches
        "job_title": str | None,
        "job_id": str | None,
        "used_followup": bool,
      }
    """
    resolved = {
        "candidates": [],
        "not_found": [],
        "ambiguous": {},
        "job_title": routed.job_title,
        "job_id": None,
        "used_followup": False,
    }

    names = list(dict.fromkeys(routed.candidate_names))  # de-dupe, preserve order
    if not names and last_context and last_context.get("candidate_id"):
        resolved["candidates"].append({
            "id": last_context["candidate_id"],
            "name": last_context.get("candidate_name", ""),
        })
        resolved["used_followup"] = True
    else:
        for name in names:
            rows = await _lookup_candidates_by_name(db, organization_id, name)
            if not rows:
                resolved["not_found"].append(name)
            elif len(rows) > 1:
                resolved["ambiguous"][name] = [{"id": str(r.id), "name": r.full_name} for r in rows]
            else:
                resolved["candidates"].append({"id": str(rows[0].id), "name": rows[0].full_name})

    if not resolved["job_title"] and last_context and last_context.get("job_title") and routed.uses_followup_reference:
        resolved["job_title"] = last_context.get("job_title")
        resolved["job_id"] = last_context.get("job_id")
        resolved["used_followup"] = True

    return resolved


def build_last_context(resolved: dict, previous: Optional[dict] = None) -> dict:
    """
    Builds the structured context to persist on CopilotConversation.last_context
    after a turn. Keeps the previous candidate/job when this turn didn't
    resolve a new one (so a later bare follow-up still has something to
    resolve against), rather than clearing state on every ambiguous turn.
    """
    previous = previous or {}
    ctx = dict(previous)
    if resolved.get("candidates"):
        top = resolved["candidates"][0]
        ctx["candidate_id"] = top["id"]
        ctx["candidate_name"] = top["name"]
    if resolved.get("job_id") or resolved.get("job_title"):
        if resolved.get("job_id"):
            ctx["job_id"] = resolved["job_id"]
        if resolved.get("job_title"):
            ctx["job_title"] = resolved["job_title"]
    return ctx
