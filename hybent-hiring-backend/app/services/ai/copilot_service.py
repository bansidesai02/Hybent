import asyncio
import copy
import json
import re
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Optional

from app.services.groq_client import SafeGroq as Groq, get_best_groq_model
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks
import zoneinfo

from app.core.config import settings
from app.services.ai.copilot_intelligence import (
    preprocess_query,
    is_jd_creation_intent,
    extract_role_from_jd_query,
    validate_job_role,
)
from app.services.ai.copilot_router import (
    CopilotIntent,
    RoutedIntent,
    GENERAL_HELP_REPLY,
    is_greeting,
    classify_intent,
    resolve_context,
    build_last_context,
)
from app.services.ai import resume_rag
from app.services.ai.match_scorer import evaluate_candidate_match, get_experience_years_for_skill
from app.services.ai_metering import ai_feature

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    if settings.gemini_api_key:
        genai.configure(api_key=settings.gemini_api_key)
except Exception as exc:
    logger.warning(f"Gemini configuration error: {exc}")
    genai = None

GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"


async def _generate_text_with_fallback(system_content: str, user_content: str, temperature: float = 0.2) -> Optional[str]:
    """
    Groq -> Gemini text generation, for the tools that compose free-form
    prose (resume Q&A, interview questions) rather than call a fixed tool.
    Same 2-tier shape as classify_intent's Groq->Gemini failover and
    match_scorer's 3-tier scoring pipeline — if Groq is fully unavailable
    (both keys, every model), the chat turn still gets a real answer
    instead of a canned error. Returns None only if both providers fail.
    """
    if settings.groq_api_key:
        try:
            client = Groq(api_key=settings.groq_api_key)
            resp = client.chat.completions.create(
                model=get_best_groq_model(client),
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content},
                ],
                temperature=temperature,
            )
            text_out = (resp.choices[0].message.content or "").strip()
            if text_out:
                return text_out
        except Exception as e:
            logger.warning(f"Groq text generation failed, trying Gemini: {e}")

    if genai is not None and settings.gemini_api_key:
        try:
            model = genai.GenerativeModel(GEMINI_FALLBACK_MODEL)
            response = await asyncio.to_thread(
                model.generate_content,
                f"{system_content.strip()}\n\n{user_content.strip()}",
                generation_config={"temperature": temperature},
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.error(f"Gemini text generation fallback also failed: {e}")

    return None

# ── Models & Prompt ──────────────────────────────────────────────────────────

GROQ_MODEL = "openai/gpt-oss-120b"  # label for failed-request logging only
# NOTE: The main chat loop and intent router call get_best_groq_model() at request
# time (same resilient multi-model/multi-key fallback used by resume_parser.py and
# match_scorer.py) instead of pinning to a single model here. Historically this file
# hardcoded "llama-3.1-8b-instant" — the weakest available model — for the entire
# tool-selection/reasoning loop, which is why the Copilot missed simple questions
# that the (correctly, 70B-class) resume parser and match scorer never struggled with.

COPILOT_SYSTEM_PROMPT = """### 1. YOUR MISSION
You are Hybent Hiring Copilot — a production-grade AI Hiring Assistant. Help recruiters search for candidates, analyze their pipeline, manage team members, schedule interviews, and navigate the Hybent Hiring platform.
DO NOT write SQL. Use the tools provided. Never hallucinate candidate names or data.

### 2. STRICT IDENTITY & SECURITY BOUNDARIES
- **NEVER disclose technical details about the AI provider, APIs, backend, infrastructure, or model names.**
- If the user asks 'which model are you using?', 'who created you?', 'are you GPT-4/OpenAI?', or similar technical questions, ALWAYS respond that you are **Hybent Hiring Copilot**, custom-built by the Hybent AI engineering team to assist you.
- NEVER claim to be GPT-4, OpenAI, ChatGPT, Gemini, Claude, Groq, or any other third-party LLM, provider, or brand.
- Never discuss model parameters, server details, or internal code details. Keep your identity purely as Hybent's custom AI.

### 3. ABBREVIATION & SHORT FORM UNDERSTANDING
Recruiters often use abbreviations. ALWAYS expand them before calling tools:
- BDE → Business Development Executive → use `search_candidates` with query="Business Development Executive"
- BDM → Business Development Manager → use `search_candidates` with query="Business Development Manager"
- SDE / SDE1 / SDE2 → Software Development Engineer
- QA / SQA → Quality Assurance
- HR → Human Resources (use `search_candidates` with query="HR" for candidate searches)
- TA → Talent Acquisition
- PM → Product Manager
- PO → Product Owner
- BA / BSA → Business Analyst
- TL → Team Lead
- EM → Engineering Manager
- CTO / CEO / CFO / COO → C-Suite roles
- UI / UX / UI/UX → UI UX Designer
- MERN / MEAN → use respective stack keywords
- JS → JavaScript, TS → TypeScript, PY → Python
- ML / AI / DL / NLP / CV → AI/ML roles
- DS / DA → Data Science / Data Analyst
- BI → Business Intelligence
- DBA → Database Administrator
- RoR → Ruby on Rails
- RN → React Native
- DevOps → DevOps Engineer
- SRE → Site Reliability Engineer

### 4. INTENT → TOOL MAPPING (follow these patterns)
| Recruiter says | Tool to use | Parameter settings |
|---------------|-------------|--------------------|
| "Show React developers" / "Find Python candidates" / "Need BDE" | `search_candidates` | `query="Business Development Executive"` (expand abbreviations) |
| "Who was added this week?" / "New candidates this week" | `search_candidates` | `date_range="this_week"` |
| "Find candidates from Ahmedabad" / "Only Ahmedabad" | `search_candidates` | `location="Ahmedabad"` |
| "Who is immediately available?" / "Immediate joiner" / "0 notice" | `search_candidates` | `notice_period_max=0` |
| "Candidates with 5+ years" / "Need senior developer" | `search_candidates` | `experience_min=5` |
| "Fresher" / "Entry level" | `search_candidates` | `experience_min=0`, `experience_max=1` |
| "Budget 10 LPA" / "Under 12 LPA" | `search_candidates` | `salary_max_lpa=10` |
| "Show rejected candidates" | `search_candidates` | `status="rejected"` |
| "Who is in technical round?" | `search_candidates` | `status="technical_round"` |
| "Find Senior Engineers" / "Show Product Managers" | `search_candidates` | `designation="Senior Engineer"` |
| "How many candidates do we have?" | `get_analytics` | `metric="overview"` |
| "Show pipeline breakdown" | `get_pipeline_summary` | (no arguments) |
| "What interviews are tomorrow?" | `search_interviews` | `date_range="tomorrow"` |
| "Who applied for the React job?" / "candidates for OdooPython" | `get_candidates_for_job` | `job_title="React"` |
| "Schedule interview for Rohan tomorrow at 2pm" | `schedule_meeting` | all required args |
| "Move Priya to Technical Round Selected" | `update_candidate_stage` | `candidate_name="Priya"`, `new_stage="technical_round_selected"` |

### 5. FOLLOW-UP & REFINEMENT RULES
- If recruiter sends a vague query like "Need Developer" without specifying type, ASK:
  "Do you mean Frontend, Backend, or Fullstack developer? What's the experience requirement and location?"
- If recruiter sends only a location or filter after a previous search, REFINE the previous search (don't restart).
- Context accumulates: "Python developer" → "Only Ahmedabad" → "5 years" → "Immediate joiner"
  Each subsequent message refines the previous search.
- For incomplete queries, ask ONE clarifying question — don't overwhelm with multiple questions.
- **Scheduling an interview** (candidate name resolved): an interviewer MUST be assigned — never treat
  "interviewer" as optional or silently skip it. **Never call `search_users` for this** — the
  `TEAM_MEMBERS` list is already given to you in this system prompt below; pick real names from it
  directly. (A `search_users` call's raw output becomes the ENTIRE reply with no further editing — that's
  what caused the "Found 1 team member..." card to loop back every turn instead of ever reaching a real
  clarification, so this tool must never be used mid-scheduling.)
  Ask for whatever's still missing in one message: one bold line naming who's being scheduled, a real
  Markdown bullet list (`- `, not a plain line break) of exactly what's needed (date and time; interview
  stage; interviewer), then the stage choices as `[SUGGEST:Technical Round|HR Round|Practical Round]` (pick
  2-3 that fit where this candidate already is) and REAL names from `TEAM_MEMBERS` (never placeholders,
  never a name not in that list) as their own `[SUGGEST:...]` line — one message can carry more than one
  `[SUGGEST:...]` line as long as each is about a different choice. Name stages the way the product does —
  "Technical Round", "HR Round", "Practical Round", "Techno-Functional Round", "Management Round", "Final
  Round" — never the raw internal value like `technical_round`. If `TEAM_MEMBERS` is "none on file", say so
  in your own words and ask who should conduct it instead of offering chips.
  **Every follow-up in this flow must only ask for what's STILL missing** — re-read the conversation so far
  and never re-list a field the recruiter already answered (if they already said "Technical Round", don't
  ask for the stage again or re-show those chips). Once date/time, stage, and interviewer are ALL known,
  call `schedule_meeting` immediately — don't ask a confirming question first, the approval card is the
  confirmation step. Do not call `schedule_meeting` before an interviewer has actually been chosen — the
  backend will also refuse to book a name that doesn't match a real user in this org, so never pass one
  you're not sure of. Example: "**Scheduling Krish Desai's interview.** I need:\n- Date and time\n-
  Interview stage\n- Interviewer" followed by the stage `[SUGGEST:...]` line and the interviewer
  `[SUGGEST:...]` line — not a wall of parenthetical examples.
  **ALWAYS end this exact kind of reply with `[PENDING_TOOL:schedule_meeting]` on its own line, last, after
  everything else** (it's stripped before the recruiter sees it) — this is how the next turn knows a short
  reply like "Technical Round" or a bare date/time is continuing THIS scheduling conversation rather than
  being a brand-new, unrelated question. Only add this marker when you are genuinely still waiting on
  schedule_meeting info from the recruiter — never on a completed booking or any other reply.

### 6. CANDIDATE SEARCH RULES
- **ALWAYS use `search_candidates`** for general skill/role/candidate searches — even abbreviations like BDE, SDE, QA.
- **Only use `get_candidates_for_job`** when recruiter explicitly says "who applied for [job]", "candidates for [job opening]", "applicants for [specific position]".
- **query parameter**: Pass the EXPANDED full form (e.g., query="Business Development Executive" not query="BDE").
- **Multiple skills**: Use space-separated in query (e.g., query="Python FastAPI PostgreSQL").

### 7. FORMATTING RULES — ANSWER FIRST, ALWAYS
You are a professional recruiter assistant, not a chatbot that thinks out loud. The recruiter should
see the actual answer on the FIRST line, before any context or explanation.

- **Never repeat the question back.** Never open with "I searched..." / "Based on the available
  information..." / "According to the data..." / "Based on the retrieved context..." — start with the
  answer itself.
- **Match response length to the question.** A one-fact question ("Ankit ka experience kitna hai?")
  gets 1-2 lines. A "explain his complete profile" question gets a structured multi-section answer.
  Never pad a simple answer into a paragraph, and never compress a genuinely detailed request into one line.
- **Bold the headline fact.** The number, yes/no, percentage, or key finding is bold and on its own line
  first — e.g. `**24 candidates found.**`, `**Yes — Python is mentioned in his resume.**`, `**82% match**`.
- **Use the shape the question calls for, not one universal template:**
  - *Count* ("kitne candidates hain?" / "how many..."): a "how many" question gets ONLY the bold count
    line back — nothing else, no candidate names, no cards — plus `[SUGGEST:Show candidates]`. The list
    appears ONLY when the recruiter explicitly asks to see it or says yes to that suggestion. This is
    different from "Python candidates dikhao" (a search/list question — that one shows results directly,
    per progressive disclosure below).
  - *Single fact* (experience/skill/education for one named candidate): 1-2 line direct answer. Only add
    a supporting detail if it's genuinely informative (e.g. most recent role, where the skill appears).
  - *Yes/No skill question*: bold Yes/No first, then one line of where it's evidenced.
  - *Search/list* ("Python aur FastAPI wale dikhao"): bold count first, then candidates — respect the
    progressive-disclosure and large-result rules below rather than always dumping a full list.
  - *Match/fit question*: bold percentage first, then short "Matched" / "Missing" bullet lists (skills
    only — do not restate the whole score breakdown unless asked), then one factual closing line. Never
    make the hiring decision for the recruiter.
  - *Comparison* (two+ named candidates/jobs): a compact Markdown table (columns = the entities, rows =
    experience/skills/match/stage as relevant) followed by one short factual summary line — not two
    separate paragraphs.
  - *Pipeline/stage count*: bold count line, then what stage it's for.
  - *Job requirements*: candidate-facing bullet groups ("Core requirements" / "Preferred"), not prose.
  - *Interview questions*: a numbered list, optionally with one line noting they're grounded in the
    candidate's resume/projects.
- **Candidate cards**: when actually listing candidates (not just naming them), show `👤 **[Full Name]**`
  per candidate, full card format with emoji fields only when the user wants details on ONE candidate or
  explicitly asked for a detailed list, blocks separated by `---`. When just naming a short set of
  candidates, plain `👤 **[Full Name]**` lines are enough — don't force the full card for a quick mention.
- **Progressive disclosure — do not dump large result sets:**
  - ≤5 results: show them directly.
  - 6-20 results: show a useful subset (e.g. top 5-8 by match/relevance) plus the total count, and offer
    to show the rest or narrow further.
  - 50+ results: NEVER list them. Give the count, a short real breakdown computed from the actual data
    (e.g. "6 have 80%+ match", "14 mention Python") if you have the numbers, and offer specific narrowing
    options (by skill, experience, stage) instead of a wall of cards.
  - Only include breakdown numbers you can actually compute from the tool's data — never estimate or invent.
- **Suggested next actions** — use the `[SUGGEST:label one|label two]` marker (each label is something the
  recruiter could plausibly say next) ONLY when there's a genuine next step: the result was large/truncated,
  more detail is clearly useful, or the recruiter is mid-workflow. Do NOT append a suggestion to every
  answer — a plain 1-2 line factual answer usually needs nothing after it. Never stack more than one
  `[SUGGEST:...]` marker in a single reply, and never offer an action that doesn't make sense for what
  was just asked.
- **Zero results**: bold "No matching candidates found." (or job/interview/etc. as relevant), one line
  naming what was searched for, then — only if genuinely useful — a `[SUGGEST:...]` with sensible
  alternatives derived from the actual filters used (e.g. remove one filter, broaden a range). Never say
  just "No data found."
- **Missing/partial data**: say plainly what's missing in one short line — "I couldn't find salary
  information for this candidate." — never hedge with retrieval/AI language.
- **Natural language, no internal terminology**: never say "chunk", "RAG", "retrieved context",
  "database", "the tool returned", or similar. Speak the way a colleague would — "His resume mentions...",
  "I couldn't find...", "Found X candidates."
- **No stray formatting marks**: never leave a bare pair of backticks, an empty code span, or any
  placeholder punctuation sitting on its own line — every bullet item ends cleanly with real words, not a
  dangling `` `` ``, `()`, or similar artifact.
- For genuine ambiguity where context truly doesn't resolve it (e.g. "Score?" with no candidate/job in
  context), ask ONE direct clarifying question instead of guessing.

### 8. PLATFORM GUIDE
- **Recruiter Dashboard**: Pipeline overview, upcoming interviews, recent activities, KPIs.
- **Candidates page**: All candidates in your org with filter/search.
- **Kanban Pipeline**: Visual board by stages. Drag-and-drop stage updates.
- **Jobs page**: Create and manage job openings.
- **Scheduler/Calendar**: Book interviews with Google Calendar + Meet integration.
- **Talent Pool**: Candidates tagged for future roles.
- **Bulk Import**: Upload Excel/CSV for bulk candidate addition.

### 9. WORKFLOW
- **Add Candidate**: Candidates → "Add Candidate" (manual) or "Invite Candidate" (email).
- **Schedule Interview**: Select candidate → "Schedule Round" → set interviewers, date/time → Save.
- **Evaluate**: Interviewer submits Scorecard. Recruiter reviews before stage progression.
- **Offer Flow**: Candidate must be in 'HR Round Selected' before offer. Hired cannot be rejected.
- **Language**: ALWAYS respond in English or Hinglish (Roman script only).
- **No hallucination**: ONLY report what the database returns.

### 10. JOB DESCRIPTION (JD) GENERATION & REFINEMENT
- You can directly generate and refine comprehensive, industry-standard Job Descriptions (JDs).
- When generating or customizing a JD, structure it cleanly in Markdown with Role Overview, Key Responsibilities, Required Skills, and Preferred Qualifications.
- If the recruiter asks to refine or modify an existing JD (e.g., changing experience level, adding skills, tweaking responsibilities), make the changes directly in the chat with a complete updated description.
- If the job title requested is invalid or gibberish, decline politely and ask for a valid job title.
- If the title is vague or incomplete, ask clarifying questions to get the specific domain or requirements.

### 11. EVIDENCE-FIRST ANSWERS — NEVER FABRICATE
- Every candidate/job-specific factual claim (experience, skills, education, certifications, salary, notice period, match score, status) must come from a tool result or retrieved data — never invent or guess.
- If a tool result doesn't contain the answer, say so plainly (e.g. "I don't see that information in the available candidate data") instead of guessing.
- Match scores and their breakdowns come from Hybent's existing scoring engine only — never estimate or restate a score you weren't given.
- You help recruiters evaluate candidates; you do not make the final hiring decision for them.
"""

# ── Tool Definitions for Groq SDK ───────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_candidates",
            "description": "Search for candidates by name, email, status, skill, designation, location, experience, notice period, or date added. Use 'query' for general skill/keyword search.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "General search term for skills, technologies, or job titles. ALWAYS expand abbreviations: BDE→'Business Development Executive', SDE→'Software Development Engineer', QA→'Quality Assurance', HR→'Human Resources', etc. Pass the full expanded form."},
                    "name": {"type": "string", "description": "Candidate's full name or partial name."},
                    "email": {"type": "string", "description": "Candidate's email address."},
                    "status": {"type": "string", "description": "Pipeline stage: 'applied', 'shortlisted', 'screening', 'technical_round', 'practical_round', 'hr_round', 'offered', 'hired', 'rejected', 'interview' (all active interview stages)."},
                    "location": {"type": "string", "description": "Filter by location or city (e.g. 'Ahmedabad', 'Bangalore'). Use 'remote' for WFH/remote candidates."},
                    "notice_period_max": {"type": "integer", "description": "Maximum notice period in days (0 = immediate joiners, 15, 30, 60, 90)."},
                    "date_range": {"type": "string", "description": "Filter by when candidate was added: 'today', 'this_week', 'this_month'."},
                    "experience_min": {"type": "number", "description": "Minimum years of experience. Use 0 for freshers, 5 for senior roles."},
                    "experience_max": {"type": "number", "description": "Maximum years of experience. Use 2 for junior/fresher roles."},
                    "salary_max_lpa": {"type": "number", "description": "Maximum expected salary in LPA (e.g. 10 for 'budget 10 LPA', 'under 12 LPA')."},
                    "designation": {"type": "string", "description": "Job title/designation filter (e.g. 'Senior Engineer', 'Frontend Developer')."},
                    "tag": {"type": "string", "description": "Filter by talent pool tag."},
                    "sort_by": {"type": "string", "description": "Sort results: 'experience' (highest first) or 'created_at' (newest first)."},
                    "detailed": {"type": "boolean", "description": "Set to true ONLY if the user explicitly requested detailed information, full profiles, or 'in details'. Default is false."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_analytics",
            "description": "Get hiring analytics and statistics for the organization: total candidates, pipeline breakdown, interview counts, offer stats, or today's activity summary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric": {
                        "type": "string",
                        "enum": ["overview", "pipeline", "interviews", "offers", "today"],
                        "description": "What to analyze: 'overview' (all KPIs), 'pipeline' (stage counts), 'interviews' (interview stats), 'offers' (offer stats), 'today' (today's activity)."
                    }
                },
                "required": ["metric"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_interviews",
            "description": "Search for scheduled interviews by candidate name, date range, or status. Use this for 'upcoming interviews', 'today's interviews', 'tomorrow's meetings'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_name": {"type": "string", "description": "Optional: filter by candidate name."},
                    "date_range": {
                        "type": "string",
                        "enum": ["today", "tomorrow", "this_week"],
                        "description": "Filter by date: 'today', 'tomorrow', 'this_week'."
                    },
                    "status": {
                        "type": "string",
                        "enum": ["scheduled", "completed", "cancelled"],
                        "description": "Interview status: 'scheduled', 'completed', 'cancelled'."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_candidates_for_job",
            "description": "Find candidates who have applied for a specific job opening. Use when recruiter asks 'who applied for X role' or 'candidates for Y position'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_title": {"type": "string", "description": "Partial or full job title to search (e.g. 'React Developer', 'Python Engineer', 'Product Manager')."},
                    "detailed": {"type": "boolean", "description": "Set to true ONLY if the user explicitly requested detailed information, full profiles, or 'in details'. Default is false."}
                },
                "required": ["job_title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_summary",
            "description": "Retrieve the current counts of candidates in each pipeline stage (applied, screening, interview, interviewed, offer, rejected).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_users",
            "description": "Search ONLY for internal team members, recruiters, or interviewers by name or email. Do NOT use for job applicants or candidates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "role": {"type": "string", "description": "Filter to one role exactly: 'interviewer', 'recruiter', or 'admin'. Use role='interviewer' to find who can be assigned to an interview before scheduling one."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_jobs",
            "description": "Search for job openings by title or status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Partial job title to search."},
                    "status": {"type": "string", "description": "Job status: 'active', 'draft', 'closed', 'paused'."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_meeting",
            "description": "Schedule a new interview. WARNING: MUST ask for the candidate's exact name if not provided. Do NOT assume or pick a random candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_name": {"type": "string"},
                    "meeting_title": {"type": "string"},
                    "scheduled_at": {"type": "string", "description": "ISO 8601 datetime string."},
                    "interviewer_names": {"type": "string", "description": "Comma-separated interviewer names."},
                    "interview_stage": {"type": "string", "description": "Pipeline stage to set for candidate."}
                },
                "required": ["candidate_name", "meeting_title", "scheduled_at"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_candidate_stage",
            "description": "Move a candidate to a new pipeline stage without scheduling a meeting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_name": {"type": "string", "description": "Full name of the candidate."},
                    "new_stage": {
                        "type": "string",
                        "description": "Target stage: pre_screening_selected, pre_screening_rejected, technical_round_selected, technical_round_rejected, practical_round_selected, practical_round_rejected, techno_functional_selected, management_round_selected, hr_round_selected, offered, hired, rejected."
                    }
                },
                "required": ["candidate_name", "new_stage"]
            }
        }
    }
]


def _allow_null_on_optional_params(tools: list[dict]) -> list[dict]:
    """Groq's tool-call validation rejects `null` against a bare `"type":
    "string"` schema — but the model routinely passes `null` for an optional
    filter it isn't using (e.g. `search_users({"role": "interviewer",
    "name": null, "email": null})` instead of omitting the unused keys),
    which used to blow up the whole turn with a raw schema-validation error
    surfaced straight to the recruiter ("Tool call validation failed:
    parameters ... did not match schema"). Every optional property's type
    gets `"null"` added here so that's a valid call, not a crash, while
    every `"required"` property is left exactly as declared.
    """
    for tool in tools:
        params = tool.get("function", {}).get("parameters", {})
        required = set(params.get("required") or [])
        for prop_name, prop in (params.get("properties") or {}).items():
            if prop_name in required:
                continue
            t = prop.get("type")
            if isinstance(t, str) and t != "null":
                prop["type"] = [t, "null"]
    return tools


TOOLS = _allow_null_on_optional_params(TOOLS)

# ── Stopwords (intentionally EXCLUDES tech skills — they are search terms) ───
# Delegate to intelligence module's stopwords; keep minimal here.
_QUERY_STOPWORDS = {
    "show", "find", "list", "search", "get", "give", "tell", "fetch", "need", "want",
    "candidate", "candidates", "profile", "profiles", "resume", "resumes", "cv",
    "added", "this", "week", "today", "month", "year", "years",
    "with", "from", "in", "at", "who", "for", "all", "any", "me", "please",
    "we", "our", "us", "them", "their", "those",
    "mein", "hai", "ke", "ka", "ki", "ko", "se", "aur", "bhi", "toh",
    "hi", "ho", "tha", "thi", "the", "karo", "dikhao", "nikalo", "dhundo", "db",
    "kuch", "hoga", "hogi", "honge", "wala", "wali", "chahiye",
    "experience", "exp", "saal",
    "ctc", "salary", "lpa", "lakh", "lakhs", "expected", "current",
    "pipeline", "stage", "status",
    "top", "best", "good", "strong", "latest", "recent", "recently", "newly",
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "do", "does", "did", "have", "has", "had", "will", "would", "could", "should",
    "i", "guy", "guys", "person", "people", "someone", "looking",
}

# ── Cache ────────────────────────────────────────────────────────────────────

_COPILOT_CACHE: dict = {}
# Different TTLs: analytics data can be cached longer than search results
_CACHE_TTL_SEARCH = 30     # seconds — search results (fresh data needed)
_CACHE_TTL_ANALYTICS = 120  # seconds — analytics (less time-sensitive)


def _cache_get(key: str) -> Optional[str]:
    """Return cached value if fresh, else None."""
    now = time.time()
    if key in _COPILOT_CACHE:
        ts, val, ttl = _COPILOT_CACHE[key]
        if now - ts < ttl:
            return val
        else:
            del _COPILOT_CACHE[key]
    return None


def _cache_set(key: str, val: str, ttl: int = _CACHE_TTL_SEARCH):
    """Store value in cache with specified TTL. Evicts stale entries."""
    now = time.time()
    # Evict stale entries (keep cache bounded)
    stale = [k for k, (ts, _, t) in _COPILOT_CACHE.items() if now - ts >= t]
    for k in stale:
        del _COPILOT_CACHE[k]
    # Limit cache size to 500 entries to prevent memory growth
    if len(_COPILOT_CACHE) >= 500:
        oldest = sorted(_COPILOT_CACHE.items(), key=lambda x: x[1][0])[:50]
        for k, _ in oldest:
            del _COPILOT_CACHE[k]
    _COPILOT_CACHE[key] = (now, val, ttl)


def _format_experience(c: dict) -> Optional[str]:
    """Return best available experience string from candidate dict."""
    # Prefer the human-readable string, fall back to float
    rel = c.get("relevant_experience")
    if rel and str(rel).strip():
        val = str(rel).strip()
        # Add "Years Experience" suffix only if the value isn't already a
        # complete duration (e.g. "8 Months" shouldn't become "8 Months Years Experience")
        if not any(x in val.lower() for x in ("year", "yr", "month", "exp")):
            val = f"{val} Years Experience"
        return val
    exp_str = c.get("experience_years")
    if exp_str and str(exp_str).strip():
        val = str(exp_str).strip()
        if not any(x in val.lower() for x in ("year", "yr", "month", "exp")):
            val = f"{val} Years Experience"
        return val
    exp_float = c.get("years_experience")
    if exp_float is not None:
        return f"{exp_float} Years Experience"
    return None


def _compact_candidate(c: dict) -> dict:
    """A candidate row trimmed to what an agent needs to reason about it —
    ids for follow-up tool calls plus the fields recruiters filter on."""
    out = {
        "id": str(c["id"]) if c.get("id") else None,
        "name": c.get("full_name"),
        "title": c.get("current_title"),
        "company": c.get("current_company"),
        "location": c.get("location"),
        "experience": _format_experience(c),
        "skills": (c.get("skills") or [])[:6] if isinstance(c.get("skills"), list) else c.get("skills"),
        "stage": c.get("pipeline_stage"),
        "match_score": round(float(c["match_score"]), 1) if c.get("match_score") is not None else None,
        "notice": c.get("notice_period_days"),
        "expected_ctc": c.get("expected_salary") or c.get("expected_ctc"),
    }
    return {k: v for k, v in out.items() if v not in (None, "", [])}


def _format_candidate_block(c: dict, detailed: bool) -> str:
    """One candidate as either a bare name line or a full emoji-field card."""
    if not detailed:
        return f"👤 **{c['full_name']}**"

    parts = [f"👤 **{c['full_name']}**"]

    if c.get("email"):
        parts.append(f"📧 {c['email']}")

    title = c.get("current_title")
    company = c.get("current_company")
    if title and company:
        parts.append(f"💼 {title} at {company}")
    elif title:
        parts.append(f"💼 {title}")
    elif company:
        parts.append(f"💼 Works at {company}")

    if c.get("location"):
        parts.append(f"📍 {c['location']}")

    exp_str = _format_experience(c)
    if exp_str:
        parts.append(f"⭐ {exp_str}")

    skills_val = c.get("skills")
    if skills_val:
        skills_display = ", ".join(skills_val[:10]) if isinstance(skills_val, list) else str(skills_val)
        if skills_display.strip():
            parts.append(f"🛠️ Skills: {skills_display}")

    np_val = c.get("notice_period_days")
    if np_val and str(np_val).strip():
        raw_np = str(np_val).strip()
        if raw_np.lower() in ("0", "0 days", "0 day") or "immediate" in raw_np.lower():
            label = "Immediate"
        else:
            label = raw_np if "day" in raw_np.lower() else f"{raw_np} days"
        parts.append(f"⏳ Notice: {label}")

    stage = c.get("pipeline_stage")
    if stage:
        parts.append(f"📌 Stage: {stage.replace('_', ' ').title()}")

    sal = c.get("expected_salary") or c.get("expected_ctc")
    if sal:
        parts.append(f"💰 Expected: {sal}")

    return "\n".join(parts)


# Progressive-disclosure thresholds for search_candidates — see spec §6/§17:
# small sets are shown in full, mid-size sets show a ranked subset with a
# suggestion to see more, and large sets never get dumped into the chat.
_SEARCH_SHOW_ALL_MAX = 5
_SEARCH_SUBSET_SIZE = 8
_SEARCH_LARGE_THRESHOLD = 20


# ── Read Tool Executor ───────────────────────────────────────────────────────

async def execute_read_tool(
    name: str, args: dict, organization_id: str, db: AsyncSession,
    user_message: Optional[str] = None, sink: Optional[dict] = None,
) -> str:
    """Execute read-only tools with caching.

    Returns the markdown shown to the recruiter. When `sink` is given (the
    v2 agent), sink["data"] also receives a compact JSON-able version of the
    result for the model to reason over.
    """
    cache_key = f"{name}:{organization_id}:{json.dumps(args, sort_keys=True)}"
    if sink is not None:
        cache_key = f"v2:{cache_key}"
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"Copilot cache hit for tool: {name}")
        if sink is None:
            return cached
        payload = json.loads(cached)
        sink["data"] = payload.get("data")
        return payload.get("text", "")

    if sink is None:
        sink = {}
        want_data = False
    else:
        want_data = True

    def _cache_result(text_val: str, ttl: int) -> None:
        if want_data:
            _cache_set(cache_key, json.dumps({"text": text_val, "data": sink.get("data")}, default=str), ttl=ttl)
        else:
            _cache_set(cache_key, text_val, ttl=ttl)

    try:
        result_text = ""

        # ── search_candidates ─────────────────────────────────────────────
        if name == "search_candidates":
            # ── Intelligence pre-processing ──────────────────────────────────
            # Run the raw query through the NLP pipeline before SQL construction
            raw_query = args.get("query", "")
            intent = None
            extra_synonym_terms: list[str] = []
            if raw_query:
                intent = preprocess_query(raw_query)
                # Override args with structured intent values
                # (only if LLM didn't already extract them)
                if intent.had_abbreviation or intent.had_typo_correction:
                    # Replace query with cleaned expanded form
                    if intent.query_terms:
                        args["query"] = " ".join(intent.query_terms)
                    elif intent.expanded_query:
                        args["query"] = intent.expanded_query
                # Merge extracted filters (don't override LLM-provided values)
                if intent.location and not args.get("location"):
                    args["location"] = intent.location
                if intent.experience_min is not None and args.get("experience_min") is None:
                    args["experience_min"] = intent.experience_min
                if intent.experience_max is not None and not args.get("experience_max"):
                    args["experience_max"] = intent.experience_max
                if intent.notice_period_max is not None and args.get("notice_period_max") is None:
                    args["notice_period_max"] = intent.notice_period_max
                if intent.salary_max_lpa is not None and not args.get("salary_max_lpa"):
                    args["salary_max_lpa"] = intent.salary_max_lpa
                extra_synonym_terms = intent.synonym_terms

            if not args.get("query") and raw_query:
                args["query"] = raw_query  # fallback: use raw query
            # ─────────────────────────────────────────────────────────────────
            detailed = False
            if args.get("detailed"):
                detailed = True
            elif user_message:
                um_lower = user_message.lower()
                detail_keywords = [
                    "detail", "detailed", "in depth", "sari info", "sari detail",
                    "complete", "full profile", "full resume", "resume detail",
                    "description", "sari information", "puri detail", "sab detail"
                ]
                if any(kw in um_lower for kw in detail_keywords):
                    detailed = True

            conds, params = ["organization_id = :oid"], {"oid": organization_id}

            # Name — only search full_name, never skills
            if args.get("name"):
                conds.append("full_name ILIKE :n")
                params["n"] = f"%{args['name']}%"

            if args.get("email"):
                conds.append("email ILIKE :e")
                params["e"] = f"%{args['email']}%"

            # Designation / job title
            if args.get("designation"):
                conds.append("current_title ILIKE :desig")
                params["desig"] = f"%{args['designation']}%"

            # Tag filter
            if args.get("tag"):
                conds.append(":tag = ANY(tags)")
                params["tag"] = args["tag"]

            # ── Status / Stage mapping ────────────────────────────────────
            if args.get("status"):
                status_val = args["status"].lower().strip()

                # Real ApplicationStage enum (app/utils/permissions.py) has both a
                # pre_screening_* family AND a separate screening_* family
                # (screening_selected/screening_rejected) — "shortlisted"/"rejected"
                # must cover both, not just pre_screening_*, or candidates in the
                # screening_* stages silently never match.
                if status_val in ("shortlisted", "pre_screening_selected", "screening_selected"):
                    conds.append("pipeline_stage IN ('pre_screening_selected', 'screening_selected')")

                elif status_val in ("applied", "in_review", "new"):
                    conds.append(
                        "(pipeline_stage IN ('applied', 'screening', 'needs_review', '')"
                        " OR pipeline_stage IS NULL)"
                    )

                elif status_val in ("screening", "pre_screening"):
                    conds.append(
                        "pipeline_stage IN ('pre_screening', 'pre_screening_selected',"
                        " 'screening', 'needs_review')"
                    )

                elif status_val in ("technical_round", "technical"):
                    conds.append(
                        "pipeline_stage IN ('technical_round', 'technical_round_selected')"
                    )

                elif status_val in ("practical_round", "practical"):
                    conds.append(
                        "pipeline_stage IN ('practical_round', 'practical_round_selected')"
                    )

                elif status_val in ("techno_functional_round", "techno_functional", "technofunctional", "techno functional"):
                    conds.append(
                        "pipeline_stage IN ('techno_functional_round', 'techno_functional_selected')"
                    )

                elif status_val in ("management_round", "management"):
                    conds.append(
                        "pipeline_stage IN ('management_round', 'management_round_selected')"
                    )

                elif status_val in ("hr_round", "hr"):
                    conds.append(
                        "pipeline_stage IN ('hr_round', 'hr_round_selected')"
                    )

                elif status_val in ("interview", "interviews", "in_interview", "scheduled"):
                    conds.append(
                        "pipeline_stage IN ("
                        " 'pre_screening', 'technical_round', 'practical_round',"
                        " 'techno_functional_round', 'management_round', 'hr_round',"
                        " 'technical_round_selected', 'practical_round_selected',"
                        " 'techno_functional_selected', 'management_round_selected',"
                        " 'hr_round_selected', 'interview', 'interviewed'"
                        ")"
                    )

                elif status_val in ("offered", "offer"):
                    conds.append("pipeline_stage IN ('offered', 'hired', 'hired_joined')")

                elif status_val == "hired":
                    conds.append("pipeline_stage IN ('hired', 'hired_joined')")

                elif status_val in ("rejected", "reject", "not_selected"):
                    conds.append(
                        "pipeline_stage IN ("
                        " 'rejected', 'screening_rejected', 'pre_screening_rejected',"
                        " 'technical_round_rejected', 'technical_round_back_out',"
                        " 'practical_round_rejected', 'practical_round_back_out',"
                        " 'techno_functional_rejected', 'management_round_rejected',"
                        " 'hr_round_rejected', 'offered_back_out', 'offer_withdrawn'"
                        ")"
                    )

                else:
                    conds.append("pipeline_stage ILIKE :s")
                    params["s"] = f"%{status_val}%"

            if args.get("location"):
                loc_val = args["location"].strip()
                if loc_val.lower() in ("remote", "wfh", "work from home"):
                    conds.append(
                        "(LOWER(location) LIKE '%remote%' OR LOWER(work_mode_preference) LIKE '%remote%'"
                        " OR LOWER(location) LIKE '%work from home%')"
                    )
                elif loc_val.lower() == "hybrid":
                    conds.append(
                        "(LOWER(location) LIKE '%hybrid%' OR LOWER(work_mode_preference) LIKE '%hybrid%')"
                    )
                else:
                    conds.append("location ILIKE :loc")
                    params["loc"] = f"%{loc_val}%"

            # ── Notice period — FIXED: safe numeric extraction, no crash ────
            if args.get("notice_period_max") is not None:
                npm = int(args["notice_period_max"])
                if npm == 0:
                    conds.append(
                        "(LOWER(COALESCE(notice_period_days,'')) IN ('0', '0 days', '0 day')"
                        " OR LOWER(COALESCE(notice_period_days,'')) LIKE '%immediate%'"
                        " OR LOWER(COALESCE(notice_period_days,'')) LIKE '%0 day%')"
                    )
                else:
                    # Extract numeric part safely — handles '30 days', '30', '30 Days', etc.
                    conds.append(
                        "(LOWER(COALESCE(notice_period_days,'')) IN ('0', '0 days')"
                        " OR LOWER(COALESCE(notice_period_days,'')) LIKE '%immediate%'"
                        " OR ("
                        "  REGEXP_REPLACE(COALESCE(notice_period_days,''), '[^0-9]', '', 'g') ~ '^[0-9]+$'"
                        "  AND REGEXP_REPLACE(COALESCE(notice_period_days,''), '[^0-9]', '', 'g') != ''"
                        "  AND CAST(REGEXP_REPLACE(COALESCE(notice_period_days,''), '[^0-9]', '', 'g') AS INTEGER) <= :npm"
                        " )"
                        ")"
                    )
                    params["npm"] = npm

            if args.get("experience_min") is not None:
                conds.append("COALESCE(years_experience, 0) >= :exp_min")
                params["exp_min"] = float(args["experience_min"])

            if args.get("experience_max") is not None:
                conds.append("COALESCE(years_experience, 0) <= :exp_max")
                params["exp_max"] = float(args["experience_max"])

            # ── Salary filter ─────────────────────────────────────────────
            if args.get("salary_max_lpa") is not None:
                # expected_salary / expected_ctc contain strings like '10 LPA', '12.5 LPA'
                # Extract numeric part and compare
                conds.append(
                    "("
                    " (expected_salary IS NOT NULL AND"
                    "  REGEXP_REPLACE(expected_salary, '[^0-9.]', '', 'g') ~ '^[0-9]+(\\.[0-9]+)?$' AND"
                    "  CAST(REGEXP_REPLACE(expected_salary, '[^0-9.]', '', 'g') AS FLOAT) <= :sal_max)"
                    " OR"
                    " (expected_ctc IS NOT NULL AND"
                    "  REGEXP_REPLACE(expected_ctc, '[^0-9.]', '', 'g') ~ '^[0-9]+(\\.[0-9]+)?$' AND"
                    "  CAST(REGEXP_REPLACE(expected_ctc, '[^0-9.]', '', 'g') AS FLOAT) <= :sal_max)"
                    ")"
                )
                params["sal_max"] = float(args["salary_max_lpa"])

            # Date range
            if args.get("date_range"):
                dr = args["date_range"].lower()
                if dr == "today":
                    conds.append("created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')")
                elif dr == "this_week":
                    conds.append("created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')")
                elif dr == "this_month":
                    conds.append("created_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')")

            # ── General query — UPGRADED: 10+ field search with synonyms ──
            if args.get("query"):
                q_val = args["query"].lower().strip()
                # Normalize common shorthand aliases in the query itself
                alias_map = {
                    "reactjs": "react", "nodejs": "node", "vuejs": "vue",
                    "angularjs": "angular", "springboot": "spring boot",
                    "postgres": "postgresql", "k8s": "kubernetes",
                    "js": "javascript", "ts": "typescript",
                    "py": "python", "rn": "react native",
                }
                for alias, replacement in alias_map.items():
                    q_val = re.sub(r'(?<![a-z])' + re.escape(alias) + r'(?![a-z])', replacement, q_val)

                # Helper to build AND condition for a list of words
                def _build_words_clause(words_list: list[str], prefix: str) -> str:
                    clauses = []
                    for idx, w in enumerate(words_list):
                        pn = f"{prefix}_{idx}"
                        params[pn] = f"%{w}%"
                        clauses.append(
                            f"(full_name ILIKE :{pn}"
                            f" OR current_title ILIKE :{pn}"
                            f" OR current_company ILIKE :{pn}"
                            f" OR location ILIKE :{pn}"
                            f" OR COALESCE(summary, '') ILIKE :{pn}"
                            f" OR COALESCE(applied_job_title, '') ILIKE :{pn}"
                            f" OR COALESCE(source, '') ILIKE :{pn}"
                            f" OR COALESCE(parsed_data::text, '') ILIKE :{pn}"
                            f" OR EXISTS ("
                            f"   SELECT 1 FROM unnest(skills) AS s WHERE s ILIKE :{pn}"
                            f" )"
                            f" OR EXISTS ("
                            f"   SELECT 1 FROM unnest(tags) AS t WHERE t ILIKE :{pn}"
                            f" )"
                            f" OR EXISTS ("
                            f"   SELECT 1 FROM applications a"
                            f"   JOIN jobs j ON j.id = a.job_id"
                            f"   WHERE a.candidate_id = candidates.id"
                            f"     AND j.title ILIKE :{pn}"
                            f" )"
                            f")"
                        )
                    return f"({' AND '.join(clauses)})"

                # 1. Main expanded words (ANDed)
                q_clean = re.sub(r"[^\w\s\-\.]", " ", q_val)
                main_words = [
                    w for w in q_clean.split()
                    if w not in _QUERY_STOPWORDS and not w.isdigit() and len(w) >= 2
                ]
                
                group_clauses = []
                if main_words:
                    group_clauses.append(_build_words_clause(main_words, "q_main"))

                # 2. Original query words (ANDed) — for abbreviation/typo matches
                original_words = []
                if intent and intent.raw_query:
                    raw_clean = re.sub(r"[^\w\s\-\.]", " ", intent.raw_query.lower())
                    original_words = [
                        w for w in raw_clean.split()
                        if w not in _QUERY_STOPWORDS and not w.isdigit() and len(w) >= 2
                    ]
                    if original_words and original_words != main_words:
                        group_clauses.append(_build_words_clause(original_words, "q_orig"))

                # 3. Synonym groups (each synonym phrase is ANDed internally, but ORed globally)
                unique_syns = list(dict.fromkeys(extra_synonym_terms))[:4]
                for s_idx, syn in enumerate(unique_syns):
                    syn_clean = re.sub(r"[^\w\s\-\.]", " ", syn.lower())
                    syn_words = [
                        w for w in syn_clean.split()
                        if w not in _QUERY_STOPWORDS and len(w) >= 2
                    ]
                    if syn_words and syn_words != main_words and syn_words != original_words:
                        group_clauses.append(_build_words_clause(syn_words, f"q_syn_{s_idx}"))

                if group_clauses:
                    conds.append(f"({' OR '.join(group_clauses)})")

            # ── Ordering & Limits ──────────────────────────────────────────
            order_clause = "ORDER BY created_at DESC"
            if args.get("sort_by") == "experience":
                order_clause = "ORDER BY COALESCE(years_experience, 0) DESC, created_at DESC"
            elif args.get("sort_by") == "created_at":
                order_clause = "ORDER BY created_at DESC"
            # Default ordering: experience DESC for quality ranking
            # (best candidates first when no explicit sort)
            elif args.get("query") or args.get("designation"):
                order_clause = "ORDER BY COALESCE(years_experience, 0) DESC, COALESCE(match_score, 0) DESC, created_at DESC"

            # Count matching candidates
            count_sql = (
                f"SELECT COUNT(*) FROM candidates WHERE {' AND '.join(conds)}"
            )
            count_res = await db.execute(text(count_sql), params)
            match_count = count_res.scalar() or 0

            # Dynamic limit based on detailed flag
            limit_val = 50 if detailed else 100

            sql = f"""
                SELECT id, full_name, email, phone, current_title, current_company, location,
                       relevant_experience, experience_years, years_experience,
                       skills, tags, notice_period_days, pipeline_stage,
                       expected_salary, expected_ctc, current_salary, current_ctc,
                       match_score, summary, work_mode_preference
                FROM candidates
                WHERE {' AND '.join(conds)}
                {order_clause}
                LIMIT {limit_val}
            """
            logger.info("Copilot SQL (search_candidates): params=%s", params)

            res = await db.execute(text(sql), params)
            res_all = res.fetchall()
            logger.info("Copilot search found %d records (total matching: %d)", len(res_all), match_count)

            sink["data"] = {"total": match_count, "candidates": []}
            if not res_all:
                # Build descriptive no-results message with helpful suggestions
                raw_q = args.get("query", "")
                original_q = intent.raw_query if intent else raw_q
                if args.get("date_range") == "today":
                    result_text = "**No candidates found.** None were added today."
                elif args.get("date_range") == "this_week":
                    result_text = "**No candidates found.** None were added this week."
                elif args.get("location"):
                    result_text = (
                        f"**No matching candidates found** in {args['location']}."
                        f"\n\n[SUGGEST:Search without the location filter]"
                    )
                elif args.get("status"):
                    result_text = f"**No candidates found** in the '{args['status']}' stage."
                elif original_q:
                    result_text = (
                        f"**No matching candidates found** for '{original_q}'."
                        f"\n\n[SUGGEST:Try a broader search term|Remove some filters]"
                    )
                else:
                    result_text = "**No candidates found** matching your search criteria."
            else:
                header = f"**Found {match_count} candidate{'s' if match_count != 1 else ''}.**"

                # A pure "how many" question gets ONLY the count — never the
                # list — regardless of how small the result set is. The list
                # only appears if the recruiter explicitly asked for it, or
                # says yes to the suggestion. ("kitne candidates hain?" is a
                # different question from "Python candidates dikhao", even
                # though both call this same tool.)
                um_lower = (user_message or "").lower()
                _count_kw = ("kitne", "kitna", "kitni", "how many", "count of", "number of", "total number")
                _list_kw = (
                    "dikha", "show me", "show them", "show all", "show candidates",
                    "list them", "list all", "list candidates", "puri list", "full list",
                )
                is_count_only = any(kw in um_lower for kw in _count_kw) and not any(kw in um_lower for kw in _list_kw)

                if is_count_only:
                    result_text = f"{header}\n\n[SUGGEST:Show candidates]"
                    _cache_result(result_text, _CACHE_TTL_SEARCH)
                    return result_text

                # ── AI Ranking: score each candidate post-fetch ────────────
                query_words = []
                if args.get("query"):
                    query_words = [w.lower() for w in re.sub(r'[^\w\s]', ' ', args["query"]).split() if len(w) >= 2]

                def _score_candidate(c: dict) -> float:
                    score = 0.0
                    # Skill match (highest weight)
                    skills = c.get("skills") or []
                    if isinstance(skills, list) and query_words:
                        skill_matches = sum(
                            1 for s in skills
                            for qw in query_words
                            if qw in s.lower()
                        )
                        score += skill_matches * 3.0
                    # Title match
                    title = (c.get("current_title") or "").lower()
                    for qw in query_words:
                        if qw in title:
                            score += 2.0
                    # Experience
                    exp = c.get("years_experience") or 0
                    if exp:
                        score += min(float(exp) * 0.3, 3.0)  # cap at 3
                    # Has match_score from DB (AI resume scoring)
                    ms = c.get("match_score")
                    if ms:
                        score += float(ms) * 0.1
                    # Profile completeness
                    if c.get("email"): score += 0.5
                    if c.get("phone"): score += 0.3
                    if c.get("summary"): score += 0.5
                    if skills: score += 0.5
                    return score

                # Sort by AI score (best first)
                ranked_dicts = sorted(
                    (dict(r._mapping) for r in res_all), key=_score_candidate, reverse=True
                )
                sink["data"] = {
                    "total": match_count,
                    "candidates": [_compact_candidate(c) for c in ranked_dicts[:_SEARCH_SUBSET_SIZE]],
                }

                if match_count > _SEARCH_LARGE_THRESHOLD:
                    # Large result set — never dump into chat. Count + a real,
                    # computed breakdown (nothing estimated) + narrowing options.
                    sample = ranked_dicts  # everything actually fetched (up to limit_val)
                    breakdown = []
                    high_match = sum(1 for c in sample if (c.get("match_score") or 0) >= 80)
                    if high_match:
                        breakdown.append(f"- {high_match} have an 80%+ match score")
                    exp3 = sum(1 for c in sample if (c.get("years_experience") or 0) >= 3)
                    if exp3:
                        breakdown.append(f"- {exp3} have 3+ years of experience")
                    if args.get("notice_period_max") is None:
                        immediate = sum(
                            1 for c in sample
                            if "immediate" in str(c.get("notice_period_days") or "").lower()
                            or str(c.get("notice_period_days") or "").strip() in ("0", "0 days")
                        )
                        if immediate:
                            breakdown.append(f"- {immediate} are immediate joiners")

                    result_text = header
                    if breakdown:
                        result_text += "\n\nQuick breakdown:\n" + "\n".join(breakdown)
                    result_text += "\n\n[SUGGEST:Show top matches|Filter by experience|Filter by stage]"

                elif match_count > _SEARCH_SHOW_ALL_MAX:
                    # Mid-size set — show a ranked, useful subset rather than
                    # everything, and offer to see the rest.
                    subset = ranked_dicts[:_SEARCH_SUBSET_SIZE]
                    blocks = [_format_candidate_block(c, detailed) for c in subset]
                    result_text = (
                        f"{header} Showing top {len(subset)}.\n\n---\n\n"
                        + "\n\n---\n\n".join(blocks)
                    )
                    if match_count > len(subset):
                        result_text += "\n\n[SUGGEST:Show all|Narrow the search]"

                else:
                    blocks = [_format_candidate_block(c, detailed) for c in ranked_dicts]
                    result_text = header + "\n\n---\n\n" + "\n\n---\n\n".join(blocks)

        # ── get_analytics ─────────────────────────────────────────────────
        elif name == "get_analytics":
            metric = (args.get("metric") or "overview").lower()

            if metric == "overview":
                sql = """
                    SELECT
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid) AS total_candidates,
                        (SELECT COUNT(*) FROM jobs WHERE organization_id = :oid AND status = 'active') AS active_jobs,
                        (SELECT COUNT(*) FROM jobs WHERE organization_id = :oid) AS total_jobs,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid AND status = 'scheduled') AS upcoming_interviews,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid) AS total_interviews,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage IN ('offered', 'hired', 'hired_joined')) AS offers_extended,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage IN ('hired', 'hired_joined')) AS total_hired,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage IN ('rejected','pre_screening_rejected',
                            'technical_round_rejected','technical_round_back_out',
                            'practical_round_rejected','practical_round_back_out',
                            'techno_functional_rejected','management_round_rejected',
                            'hr_round_rejected','offered_back_out','offer_withdrawn')) AS total_rejected,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')) AS added_this_week,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')) AS added_today
                """
                res = await db.execute(text(sql), {"oid": organization_id})
                row = dict(res.fetchone()._mapping)
                sink["data"] = row

                result_text = (
                    "📊 **Hiring Overview**\n\n"
                    f"👥 **Total Candidates**: {row['total_candidates']}\n"
                    f"  ↳ Added today: {row['added_today']} | This week: {row['added_this_week']}\n"
                    f"💼 **Active Jobs**: {row['active_jobs']} (of {row['total_jobs']} total)\n"
                    f"📅 **Upcoming Interviews**: {row['upcoming_interviews']} | Total conducted: {row['total_interviews']}\n"
                    f"🎯 **Offers Extended**: {row['offers_extended']}\n"
                    f"✅ **Hired**: {row['total_hired']}\n"
                    f"❌ **Rejected**: {row['total_rejected']}"
                )

            elif metric == "pipeline":
                sql = """
                    SELECT pipeline_stage, COUNT(*) AS cnt
                    FROM candidates
                    WHERE organization_id = :oid
                    GROUP BY pipeline_stage
                    ORDER BY cnt DESC
                """
                res = await db.execute(text(sql), {"oid": organization_id})
                rows = res.fetchall()

                stage_lines = []
                total = 0
                for r in rows:
                    stage = r.pipeline_stage or "No Stage"
                    cnt = r.cnt
                    total += cnt
                    label = stage.replace("_", " ").title()
                    stage_lines.append(f"  • **{label}**: {cnt}")

                sink["data"] = {"total": total, "stages": {(r.pipeline_stage or "none"): r.cnt for r in rows}}
                result_text = (
                    f"📊 **Pipeline Breakdown** (Total: {total} candidates)\n\n"
                    + "\n".join(stage_lines)
                )

            elif metric == "interviews":
                sql = """
                    SELECT
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid
                            AND scheduled_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
                            AND scheduled_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
                            AND status = 'scheduled') AS today_count,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid
                            AND scheduled_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')
                            AND status = 'scheduled') AS this_week_count,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid
                            AND scheduled_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')) AS this_month_count,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid
                            AND status = 'completed') AS completed_count,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid
                            AND status = 'cancelled') AS cancelled_count
                """
                res = await db.execute(text(sql), {"oid": organization_id})
                row = dict(res.fetchone()._mapping)
                sink["data"] = row
                result_text = (
                    "📅 **Interview Statistics**\n\n"
                    f"📌 Today's scheduled interviews: **{row['today_count']}**\n"
                    f"📆 This week's scheduled: **{row['this_week_count']}**\n"
                    f"📊 This month total: **{row['this_month_count']}**\n"
                    f"✅ Completed: **{row['completed_count']}**\n"
                    f"❌ Cancelled: **{row['cancelled_count']}**"
                )

            elif metric == "offers":
                sql = """
                    SELECT
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage IN ('offered', 'hired', 'hired_joined')) AS total_offered,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage IN ('hired', 'hired_joined')) AS accepted,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage IN ('offered_back_out', 'offer_withdrawn')) AS declined,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND pipeline_stage = 'offered') AS pending
                """
                res = await db.execute(text(sql), {"oid": organization_id})
                row = dict(res.fetchone()._mapping)
                total = row["total_offered"] or 0
                accept_rate = round((row["accepted"] / total * 100), 1) if total > 0 else 0
                sink["data"] = {**row, "acceptance_rate_pct": accept_rate}
                result_text = (
                    "🎯 **Offer Statistics**\n\n"
                    f"📤 Total Offers Extended: **{total}**\n"
                    f"✅ Accepted / Hired: **{row['accepted']}**\n"
                    f"⏳ Pending Response: **{row['pending']}**\n"
                    f"❌ Declined / Withdrawn: **{row['declined']}**\n"
                    f"📈 Acceptance Rate: **{accept_rate}%**"
                )

            elif metric == "today":
                sql = """
                    SELECT
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')) AS candidates_added,
                        (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid
                            AND scheduled_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
                            AND scheduled_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
                            AND status = 'scheduled') AS interviews_today,
                        (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                            AND updated_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')
                            AND pipeline_stage IS NOT NULL) AS stages_updated
                """
                res = await db.execute(text(sql), {"oid": organization_id})
                row = dict(res.fetchone()._mapping)
                sink["data"] = row
                result_text = (
                    "📋 **Today's Activity**\n\n"
                    f"👤 New candidates added: **{row['candidates_added']}**\n"
                    f"📅 Interviews scheduled today: **{row['interviews_today']}**\n"
                    f"🔄 Candidate stages updated: **{row['stages_updated']}**"
                )
            else:
                result_text = "Supported metrics: 'overview', 'pipeline', 'interviews', 'offers', 'today'."

        # ── search_interviews ─────────────────────────────────────────────
        elif name == "search_interviews":
            conds = ["i.organization_id = :oid"]
            params: dict = {"oid": organization_id}

            if args.get("candidate_name"):
                conds.append("c.full_name ILIKE :cname")
                params["cname"] = f"%{args['candidate_name']}%"

            if args.get("status"):
                conds.append("i.status = :istatus")
                params["istatus"] = args["status"].lower()

            if args.get("date_range"):
                dr = args["date_range"].lower()
                if dr == "today":
                    conds.append(
                        "i.scheduled_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')"
                        " AND i.scheduled_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'"
                    )
                elif dr == "tomorrow":
                    conds.append(
                        "i.scheduled_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'"
                        " AND i.scheduled_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '2 days'"
                    )
                elif dr == "this_week":
                    conds.append(
                        "i.scheduled_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')"
                        " AND i.scheduled_at < DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') + INTERVAL '7 days'"
                    )

            sql = f"""
                SELECT i.id, i.candidate_id, i.title, i.scheduled_at, i.status, i.meeting_link,
                       c.full_name AS candidate_name, c.email AS candidate_email,
                       c.current_title AS candidate_title
                FROM interviews i
                JOIN candidates c ON c.id = i.candidate_id
                WHERE {' AND '.join(conds)}
                ORDER BY i.scheduled_at ASC
                LIMIT 15
            """
            res = await db.execute(text(sql), params)
            rows = res.fetchall()
            sink["data"] = [
                {
                    "id": str(r.id), "candidate_id": str(r.candidate_id), "candidate": r.candidate_name,
                    "title": r.title, "scheduled_at": str(r.scheduled_at), "status": r.status,
                }
                for r in rows
            ]

            if not rows:
                result_text = "No interviews found matching your criteria."
            else:
                lines = [f"📅 **Found {len(rows)} interview{'s' if len(rows) != 1 else ''}:**\n"]
                for r in rows:
                    iv = dict(r._mapping)
                    # Format scheduled_at nicely
                    try:
                        dt = iv["scheduled_at"]
                        if hasattr(dt, "strftime"):
                            time_str = dt.strftime("%a, %b %d %Y at %I:%M %p")
                        else:
                            time_str = str(dt)
                    except Exception:
                        time_str = str(iv.get("scheduled_at", ""))

                    status_emoji = {"scheduled": "🟡", "completed": "✅", "cancelled": "❌"}.get(
                        iv.get("status", ""), "🔵"
                    )
                    entry = (
                        f"{status_emoji} **{iv['title']}**\n"
                        f"   👤 {iv['candidate_name']}"
                        + (f" — {iv['candidate_title']}" if iv.get('candidate_title') else "")
                        + f"\n   🕐 {time_str}\n"
                        + (f"   🔗 [Join Meeting]({iv['meeting_link']})\n" if iv.get("meeting_link") else "")
                    )
                    lines.append(entry)
                result_text = "\n".join(lines)

        # ── get_candidates_for_job ────────────────────────────────────────
        elif name == "get_candidates_for_job":
            detailed = False
            if args.get("detailed"):
                detailed = True
            elif user_message:
                um_lower = user_message.lower()
                detail_keywords = [
                    "detail", "detailed", "in depth", "sari info", "sari detail",
                    "complete", "full profile", "full resume", "resume detail",
                    "description", "sari information", "puri detail", "sab detail"
                ]
                if any(kw in um_lower for kw in detail_keywords):
                    detailed = True

            job_title = args.get("job_title", "")
            if not job_title:
                return "Please provide a job title to search."

            # Dynamic limit based on detailed flag
            limit_val = 50 if detailed else 100

            sql = f"""
                SELECT c.id, c.full_name, c.email, c.current_title, c.location,
                       c.relevant_experience, c.experience_years, c.years_experience,
                       c.skills, c.pipeline_stage, a.match_score, j.id AS job_id, j.title AS job_title
                FROM candidates c
                JOIN applications a ON a.candidate_id = c.id
                JOIN jobs j ON j.id = a.job_id
                WHERE j.organization_id = :oid
                  AND j.title ILIKE :jt
                ORDER BY a.match_score DESC NULLS LAST, c.created_at DESC
                LIMIT {limit_val}
            """
            res = await db.execute(text(sql), {"oid": organization_id, "jt": f"%{job_title}%"})
            rows = res.fetchall()
            sink["data"] = {
                "job_id": str(rows[0].job_id) if rows else None,
                "job_title": rows[0].job_title if rows else None,
                "total": len(rows),
                "candidates": [_compact_candidate(dict(r._mapping)) for r in rows[:_SEARCH_SUBSET_SIZE]],
            }

            if not rows:
                # Try to find if the job exists at all
                job_check = await db.execute(
                    text("SELECT title FROM jobs WHERE organization_id = :oid AND title ILIKE :jt LIMIT 1"),
                    {"oid": organization_id, "jt": f"%{job_title}%"}
                )
                job_row = job_check.fetchone()
                if not job_row:
                    result_text = f"No job found matching '{job_title}'. Try a different job title."
                else:
                    result_text = f"No candidates have applied for '{job_row.title}' yet."
            else:
                actual_job_title = rows[0]._mapping.get("job_title", job_title)
                header = f"Found **{len(rows)}** candidate{'s' if len(rows) != 1 else ''} for **{actual_job_title}**:"
                if len(rows) >= limit_val:
                    header += f" (showing top {limit_val})"

                formatted_candidates = []
                for r in rows:
                    c = dict(r._mapping)
                    if not detailed:
                        formatted_candidates.append(f"👤 **{c['full_name']}**")
                    else:
                        parts = [f"👤 **{c['full_name']}**"]
                        if c.get("email"):
                            parts.append(f"📧 {c['email']}")
                        if c.get("current_title"):
                            parts.append(f"💼 {c['current_title']}")
                        if c.get("location"):
                            parts.append(f"📍 {c['location']}")
                        exp_str = _format_experience(c)
                        if exp_str:
                            parts.append(f"⭐ {exp_str}")
                        skills_val = c.get("skills")
                        if skills_val:
                            if isinstance(skills_val, list):
                                skills_display = ", ".join(skills_val[:8])
                            else:
                                skills_display = str(skills_val)
                            if skills_display.strip():
                                parts.append(f"🛠️ Skills: {skills_display}")
                        if c.get("pipeline_stage"):
                            parts.append(f"📌 Stage: {c['pipeline_stage'].replace('_', ' ').title()}")
                        if c.get("match_score") is not None:
                            parts.append(f"🎯 Match Score: {round(float(c['match_score']), 1)}%")
                        formatted_candidates.append("\n".join(parts))

                result_text = header + "\n\n---\n\n" + "\n\n---\n\n".join(formatted_candidates)

        # ── get_pipeline_summary ─────────────────────────────────────────
        elif name == "get_pipeline_summary":
            sql = """
                SELECT pipeline_stage, COUNT(*) AS count
                FROM candidates
                WHERE organization_id = :oid
                GROUP BY pipeline_stage
            """
            res = await db.execute(text(sql), {"oid": organization_id})
            rows = res.fetchall()

            from app.routers.candidates import STAGE_TO_BUCKET, REJECTION_STAGES

            buckets = {
                "applied": 0,
                "screening": 0,
                "interview": 0,
                "interviewed": 0,
                "offer": 0,
                "rejected": 0
            }

            for row in rows:
                stage = row.pipeline_stage
                count = row.count
                bucket = STAGE_TO_BUCKET.get(stage)
                if not bucket and stage in REJECTION_STAGES:
                    bucket = "rejected"
                if not bucket:
                    if stage is None or stage in ("needs_review", "", "applied"):
                        bucket = "applied"
                    else:
                        continue
                if bucket in buckets:
                    buckets[bucket] += count

            total = sum(buckets.values())
            sink["data"] = {"total": total, **buckets}
            bucket_emojis = {
                "applied": "📥",
                "screening": "🔍",
                "interview": "📅",
                "interviewed": "🎤",
                "offer": "🎯",
                "rejected": "❌"
            }
            lines = [f"📊 **Pipeline Summary** (Total: {total} candidates)\n"]
            for bucket_name, count in buckets.items():
                pct = round(count / total * 100, 1) if total > 0 else 0
                emoji = bucket_emojis.get(bucket_name, "•")
                lines.append(f"{emoji} **{bucket_name.title()}**: {count} ({pct}%)")
            result_text = "\n".join(lines)

        # ── search_users ─────────────────────────────────────────────────
        elif name == "search_users":
            conds: list = ["organization_id = :oid"]
            params = {"oid": organization_id}
            if args.get("name"):
                conds.append("full_name ILIKE :n")
                params["n"] = f"%{args['name']}%"
            if args.get("email"):
                conds.append("email ILIKE :e")
                params["e"] = f"%{args['email']}%"
            if args.get("role"):
                conds.append("role = :role")
                params["role"] = args["role"].lower().strip()

            sql = f"SELECT full_name, email, role FROM users WHERE {' AND '.join(conds)} LIMIT 15"
            res = await db.execute(text(sql), params)
            res_all = res.fetchall()
            sink["data"] = [{"name": r.full_name, "email": r.email, "role": r.role} for r in res_all]

            if not res_all:
                result_text = "No team members found."
            else:
                formatted_users = []
                for r in res_all:
                    u = dict(r._mapping)
                    parts = [
                        f"👤 **{u['full_name']}**",
                        f"📧 {u['email']}",
                        f"🔑 Role: {u['role'].replace('_', ' ').title()}"
                    ]
                    formatted_users.append("\n".join(parts))
                result_text = (
                    f"**Found {len(res_all)} team member{'s' if len(res_all) != 1 else ''}.**\n\n---\n\n"
                    + "\n\n---\n\n".join(formatted_users)
                )

        # ── search_jobs ──────────────────────────────────────────────────
        elif name == "search_jobs":
            conds: list = ["organization_id = :oid"]
            params = {"oid": organization_id}

            # FIX: Actually apply the title and status filters
            if args.get("title"):
                conds.append("title ILIKE :jt")
                params["jt"] = f"%{args['title']}%"
            if args.get("status"):
                conds.append("status = :jstatus")
                params["jstatus"] = args["status"].lower()

            sql = (
                "SELECT j.id, j.title, j.status, j.location, j.job_type, j.openings, j.skills_required,"
                " (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count"
                f" FROM jobs j WHERE {' AND '.join(conds)} ORDER BY j.created_at DESC LIMIT 15"
            )
            res = await db.execute(text(sql), params)
            res_all = res.fetchall()
            sink["data"] = [
                {
                    "id": str(r.id), "title": r.title, "status": r.status, "location": r.location,
                    "openings": r.openings, "applications": r.application_count,
                }
                for r in res_all
            ]

            if not res_all:
                result_text = "No job openings found."
            else:
                formatted_jobs = []
                for r in res_all:
                    j = dict(r._mapping)
                    status_emoji = {
                        "active": "🟢", "draft": "📝", "closed": "🔴", "paused": "⏸️"
                    }.get(j.get("status", ""), "•")
                    parts = [
                        f"💼 **{j['title']}**",
                        f"   {status_emoji} Status: {j['status'].replace('_', ' ').title()}",
                    ]
                    if j.get("location"):
                        parts.append(f"   📍 {j['location']}")
                    if j.get("openings"):
                        parts.append(f"   👥 Openings: {j['openings']}")
                    parts.append(f"   📥 Applications: {j.get('application_count', 0)}")
                    skills_req = j.get("skills_required")
                    if skills_req:
                        if isinstance(skills_req, list):
                            parts.append(f"   🛠️ Skills: {', '.join(skills_req[:6])}")
                    formatted_jobs.append("\n".join(parts))
                result_text = f"Found {len(res_all)} job{'s' if len(res_all) != 1 else ''}:\n\n" + "\n\n---\n\n".join(formatted_jobs)

        else:
            return "Unknown tool."

        if result_text:
            # Use longer TTL for analytics/pipeline (less volatile)
            is_analytics = name in ("get_analytics", "get_pipeline_summary")
            _cache_result(result_text, _CACHE_TTL_ANALYTICS if is_analytics else _CACHE_TTL_SEARCH)
        return result_text

    except Exception as e:
        logger.error(f"Error in execute_read_tool [{name}]: {e}", exc_info=True)
        return f"Error searching data: {str(e)}"


# ── Router-Driven Intent Tools ────────────────────────────────────────────────
# These back the new intents from copilot_router.py (candidate_details,
# resume_query, skill/experience/education/project/certification_query,
# job_match, score_explanation, candidate_comparison, similar_candidate_search,
# interview question generation). Unlike the Groq-tool-calling TOOLS above,
# these are invoked deterministically from the router's already-extracted
# entities — no second LLM call is spent choosing them.

async def _fetch_candidate_full(db: AsyncSession, organization_id: str, candidate_id: str) -> Optional[dict]:
    """Single-candidate lookup, tenant-scoped — the shared read used by every
    router-driven tool below."""
    res = await db.execute(
        text(
            "SELECT id, full_name, email, phone, location, current_title, current_company,"
            " skills, years_experience, experience_years, relevant_experience, notice_period_days,"
            " expected_salary, expected_ctc, current_salary, current_ctc, pipeline_stage,"
            " match_score, score_breakdown, applied_job_title, parsed_data, summary,"
            " linkedin_url, github_url, portfolio_url, tags"
            " FROM candidates WHERE id = :cid AND organization_id = :oid"
        ),
        {"cid": candidate_id, "oid": organization_id},
    )
    row = res.fetchone()
    return dict(row._mapping) if row else None


def _format_score_breakdown(candidate_name: str, job_title: str, score: Optional[float], breakdown: dict) -> str:
    """Answer-first match explanation: bold % first, then matched/missing
    skill bullets, then the stored evaluator reasoning as a short closing
    line — never a fresh restated summary (that would risk drifting from
    what the scoring engine actually said)."""
    matched = breakdown.get("matched_skills") or []
    missing = breakdown.get("missing_skills") or []
    reasoning = (breakdown.get("reasoning") or "").strip()
    score_label = f"{round(float(score), 1)}%" if score is not None else "N/A"

    parts = [f"**{score_label} match** — {candidate_name} for {job_title}"]

    if matched:
        parts.append("Matched:\n" + "\n".join(f"- {s}" for s in matched))
    if missing:
        parts.append("Missing:\n" + "\n".join(f"- {s}" for s in missing))
    if reasoning:
        parts.append(reasoning)
    return "\n\n".join(parts)


async def tool_get_candidate_details(candidate_id: str, organization_id: str, db: AsyncSession) -> str:
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."

    parts = [f"👤 **{c['full_name']}**"]
    title, company = c.get("current_title"), c.get("current_company")
    if title and company:
        parts.append(f"💼 {title} at {company}")
    elif title:
        parts.append(f"💼 {title}")
    if c.get("email"):
        parts.append(f"📧 {c['email']}")
    if c.get("phone"):
        parts.append(f"📞 {c['phone']}")
    if c.get("location"):
        parts.append(f"📍 {c['location']}")
    exp_str = _format_experience(c)
    if exp_str:
        parts.append(f"⭐ {exp_str}")
    skills = c.get("skills") or []
    if skills:
        parts.append(f"🛠️ Skills: {', '.join(skills[:15])}")
    if c.get("pipeline_stage"):
        parts.append(f"📌 Stage: {c['pipeline_stage'].replace('_', ' ').title()}")
    if c.get("applied_job_title"):
        parts.append(f"🎯 Applied for: {c['applied_job_title']}")
    if c.get("match_score") is not None:
        parts.append(f"📊 Match Score: {round(float(c['match_score']), 1)}%")
    np_val = c.get("notice_period_days")
    if np_val and str(np_val).strip():
        parts.append(f"⏳ Notice: {np_val}")
    return "\n".join(parts)


async def tool_get_resume_fact(
    intent: CopilotIntent, candidate_id: str, skills: list[str], organization_id: str, db: AsyncSession
) -> Optional[str]:
    """
    Handles skill/experience/education/project/certification_query from
    structured data (candidate.skills, candidate.parsed_data,
    candidate.years_experience) — no RAG/LLM call needed for the common
    case. Returns None when the structured data can't confidently answer
    (e.g. a specific skill's duration that only appears in free-text
    experience descriptions) so the caller can fall back to resume_qa (RAG).
    """
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."
    name = c["full_name"]
    parsed = c.get("parsed_data") or {}

    if intent == CopilotIntent.SKILL_QUERY:
        cand_skills = c.get("skills") or []
        cand_skills_lower = {s.lower() for s in cand_skills}
        if skills:
            yes, no = [], []
            for sk in skills:
                sk_l = sk.lower()
                found = sk_l in cand_skills_lower or any(sk_l in s.lower() or s.lower() in sk_l for s in cand_skills)
                (yes if found else no).append(sk)
            lines = []
            if yes:
                lines.append(f"✅ Yes — **{name}** lists: {', '.join(yes)}")
            if no:
                lines.append(f"⚠️ Not listed in **{name}**'s skills: {', '.join(no)}")
            return "\n".join(lines) if lines else None
        return f"🛠️ **{name}**'s skills: {', '.join(cand_skills)}" if cand_skills else f"I don't see skill data on file for **{name}**."

    if intent == CopilotIntent.EXPERIENCE_QUERY:
        if skills:
            sk = skills[0]
            years = get_experience_years_for_skill(sk.lower(), parsed.get("experience") or [])
            if years and years > 0:
                return f"⭐ **{name}** has approximately **{years} years** of experience with {sk}, based on their work history."
            return None  # let the caller fall back to resume_qa for a qualitative answer
        exp_str = _format_experience(c)
        if exp_str:
            return f"⭐ **{name}** has {exp_str.lower()}, based on the employment dates available in their resume."
        return f"I couldn't find enough information in the available resume to accurately determine **{name}**'s total experience."

    if intent == CopilotIntent.EDUCATION_QUERY:
        lines = []
        for e in parsed.get("education") or []:
            if not isinstance(e, dict):
                continue
            degree, inst, year = (e.get("degree") or "").strip(), (e.get("institution") or "").strip(), e.get("year")
            line = " at ".join([p for p in [degree, inst] if p])
            if year:
                line = f"{line} ({year})" if line else str(year)
            if line:
                lines.append(line)
        if not lines:
            return f"I don't see education details on file for **{name}**."
        return f"🎓 **{name}**'s education:\n" + "\n".join(f"- {l}" for l in lines)

    if intent == CopilotIntent.PROJECT_QUERY:
        lines = []
        for p in parsed.get("projects") or []:
            if not isinstance(p, dict):
                continue
            pname = (p.get("name") or "").strip()
            tech = ", ".join(t for t in (p.get("technologies") or []) if isinstance(t, str))
            if not pname and not tech:
                continue
            lines.append(f"- **{pname or 'Project'}**" + (f" ({tech})" if tech else ""))
        if not lines:
            return f"I don't see any projects listed for **{name}**."
        return f"📁 **{name}**'s projects:\n" + "\n".join(lines)

    if intent == CopilotIntent.CERTIFICATION_QUERY:
        certs = [c2 for c2 in (parsed.get("certifications") or []) if isinstance(c2, str) and c2.strip()]
        if not certs:
            return f"I don't see any certifications listed for **{name}**."
        return f"📜 **{name}**'s certifications: {', '.join(certs)}"

    return None


async def tool_resume_qa(candidate_id: str, question: str, organization_id: str, db: AsyncSession) -> str:
    """RAG-grounded fallback for open-ended resume questions — summaries,
    'where is X used', 'what to verify', 'any issues', and anything the
    structured fields in tool_get_resume_fact couldn't answer directly."""
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."

    chunks = await resume_rag.semantic_search_candidate(db, organization_id, candidate_id, question or "resume summary", top_k=5)
    if not chunks or resume_rag.best_score(chunks) < resume_rag.MIN_RELEVANCE_SCORE:
        return f"I couldn't find enough information in **{c['full_name']}**'s available resume data to accurately answer that."

    context_text = "\n\n".join(f"[{ch['section']}] {ch['content']}" for ch in chunks)
    prompt = (
        "Answer the recruiter's question using ONLY the resume excerpts below. "
        "If the excerpts don't actually contain the answer, say so plainly instead of guessing. "
        "Be concise (2-4 sentences), professional, and evidence-based.\n\n"
        f"RESUME EXCERPTS:\n{context_text}\n\nQUESTION: {question}"
    )
    text_out = await _generate_text_with_fallback(
        "You answer strictly from the given resume excerpts. Never invent facts not present in them.",
        prompt,
        temperature=0.2,
    )
    return text_out or "I couldn't generate an answer from the available resume data right now."


async def tool_explain_match_score(
    candidate_id: str, job_title: Optional[str], organization_id: str, db: AsyncSession
) -> str:
    """
    Explains a candidate's match score. The stored candidate.match_score /
    candidate.score_breakdown (written by match_scorer.evaluate_candidate_match
    at resume-upload/scoring time) is the source of truth and is used
    whenever it applies. Only when a *different* job than the one the
    candidate was scored against is named do we call evaluate_candidate_match
    again (read-only, not persisted) — never a second/competing scorer.
    """
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."

    applied_job_title = c.get("applied_job_title")
    same_job = not job_title or (applied_job_title and job_title.strip().lower() in applied_job_title.strip().lower())

    if same_job:
        score, breakdown = c.get("match_score"), c.get("score_breakdown")
        if score is None:
            return f"I don't have a match score on file for **{c['full_name']}** yet — they haven't been scored against a job."
        return _format_score_breakdown(c["full_name"], job_title or applied_job_title or "their applied role", score, breakdown or {})

    job_res = await db.execute(
        text("SELECT id, title, skills_required, min_experience_years FROM jobs WHERE organization_id = :oid AND title ILIKE :t LIMIT 1"),
        {"oid": organization_id, "t": f"%{job_title}%"},
    )
    job_row = job_res.fetchone()
    if not job_row:
        return f"I couldn't find that job in the current Hybent data."

    parsed = c.get("parsed_data") or {}
    org_uuid = uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
    fresh_score, fresh_breakdown = await evaluate_candidate_match(
        candidate_data=parsed,
        candidate_skills=c.get("skills") or [],
        years_experience=c.get("years_experience"),
        job=job_row,
        match_threshold=70.0,
        organization_id=org_uuid,
    )
    return _format_score_breakdown(c["full_name"], job_row.title, fresh_score, fresh_breakdown)


async def tool_compare_candidates(candidate_ids: list[str], organization_id: str, db: AsyncSession) -> str:
    """Side-by-side Markdown table — scannable in one glance rather than
    stacked per-candidate blocks the recruiter has to scroll between."""
    rows = [c for c in [await _fetch_candidate_full(db, organization_id, cid) for cid in candidate_ids] if c]
    if len(rows) < 2:
        return "I need at least two candidates found in your records to compare."

    def edu_str(c: dict) -> str:
        edu = (c.get("parsed_data") or {}).get("education") or []
        return "; ".join(
            " at ".join(p for p in [e.get("degree", ""), e.get("institution", "")] if p)
            for e in edu if isinstance(e, dict)
        ) or "Not available"

    def skills_str(c: dict) -> str:
        skills = c.get("skills") or []
        return ", ".join(skills[:8]) if skills else "Not available"

    def score_str(c: dict) -> str:
        return f"{round(float(c['match_score']), 1)}%" if c.get("match_score") is not None else "Not available"

    def stage_str(c: dict) -> str:
        stage = c.get("pipeline_stage")
        return stage.replace("_", " ").title() if stage else "Not available"

    names = [c["full_name"] for c in rows]
    header = f"|  | {' | '.join(names)} |"
    divider = "|---" * (len(rows) + 1) + "|"
    table_rows = [
        ("Experience", [_format_experience(c) or "Not available" for c in rows]),
        ("Skills", [skills_str(c) for c in rows]),
        ("Education", [edu_str(c) for c in rows]),
        ("Match score", [score_str(c) for c in rows]),
        ("Stage", [stage_str(c) for c in rows]),
    ]
    body = "\n".join(f"| {label} | {' | '.join(vals)} |" for label, vals in table_rows)

    return f"**Comparing {', '.join(names)}**\n\n{header}\n{divider}\n{body}"


async def tool_find_similar_candidates(candidate_id: str, organization_id: str, db: AsyncSession) -> str:
    """Structured skill-overlap prefilter (SQL array overlap) + semantic
    rerank via resume_rag — never a full-org unfiltered scan."""
    base = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not base:
        return "I couldn't find that candidate in the available records."

    base_skills = base.get("skills") or []
    if not base_skills:
        return f"I don't have enough skill data on **{base['full_name']}** to find similar candidates."

    res = await db.execute(
        text(
            "SELECT id FROM candidates"
            " WHERE organization_id = :oid AND id != :cid AND is_deleted = false"
            " AND skills && :skills"
            " ORDER BY created_at DESC LIMIT 30"
        ),
        {"oid": organization_id, "cid": candidate_id, "skills": base_skills},
    )
    prefilter_ids = [r.id for r in res.fetchall()]
    if not prefilter_ids:
        return f"I couldn't find any other candidates with overlapping skills to **{base['full_name']}**."

    query_text = f"{base.get('current_title') or ''} skilled in {', '.join(base_skills[:10])}"
    ranked = await resume_rag.semantic_search_candidates(db, organization_id, query_text, prefilter_ids, top_k=5)
    cand_ids = [r["candidate_id"] for r in ranked] if ranked else prefilter_ids[:5]

    lines = [f"🔎 Candidates similar to **{base['full_name']}**:\n"]
    base_skills_lower = {s.lower() for s in base_skills}
    for cid in cand_ids:
        c = await _fetch_candidate_full(db, organization_id, cid)
        if not c:
            continue
        shared = sorted(base_skills_lower & {s.lower() for s in (c.get("skills") or [])})
        lines.append(
            f"👤 **{c['full_name']}** — {_format_experience(c) or 'experience not available'}"
            f", shared skills: {', '.join(shared) if shared else 'n/a'}"
        )
    return "\n".join(lines)


async def tool_generate_interview_questions(
    candidate_id: str, job_title: Optional[str], organization_id: str, db: AsyncSession
) -> str:
    """RAG-grounded interview questions — pulls the candidate's actual
    skills/experience/projects and generates questions that only reference
    facts present in the retrieved resume content (spec: never claim facts
    not present in the resume)."""
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."

    chunks = await resume_rag.semantic_search_candidate(
        db, organization_id, candidate_id,
        f"skills experience projects responsibilities {job_title or ''}".strip(),
        top_k=8,
    )
    if chunks:
        context_text = "\n\n".join(ch["content"] for ch in chunks)
    else:
        skills = c.get("skills") or []
        if not skills:
            return f"I don't have enough resume information for **{c['full_name']}** to generate targeted interview questions."
        context_text = f"Skills: {', '.join(skills)}"

    job_context = f"\nTarget role: {job_title}" if job_title else ""
    prompt = (
        "You are an expert technical interviewer. Using ONLY the candidate facts below "
        "(never invent technologies, employers, or experience not mentioned), write 6-8 targeted "
        "interview questions grouped under short headings (e.g. Technical, Experience, Projects). "
        "Each question must reference something concrete from the facts below.\n\n"
        f"CANDIDATE FACTS:\n{context_text}{job_context}"
    )
    text_out = await _generate_text_with_fallback(
        "You write grounded, specific interview questions. Never reference facts not given to you.",
        prompt,
        temperature=0.4,
    )
    return text_out or "Couldn't generate interview questions right now — please try again."


async def tool_get_interview_feedback(candidate_id: str, organization_id: str, db: AsyncSession) -> str:
    """Interviewer scorecards for a candidate — same join scorecards.py's
    GET /candidate/{id} uses (Scorecard join Interview by candidate_id, org-scoped)."""
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."

    res = await db.execute(
        text(
            "SELECT sc.overall_rating, sc.recommendation, sc.criteria_scores, sc.strengths,"
            " sc.weaknesses, sc.summary, sc.submitted_at, u.full_name AS submitted_by_name,"
            " i.title AS interview_title, i.interview_type"
            " FROM scorecards sc"
            " JOIN interviews i ON sc.interview_id = i.id"
            " LEFT JOIN users u ON sc.submitted_by_id = u.id"
            " WHERE i.candidate_id = :cid AND sc.organization_id = :oid"
            " ORDER BY sc.submitted_at DESC"
        ),
        {"cid": candidate_id, "oid": organization_id},
    )
    rows = res.fetchall()
    if not rows:
        return f"No interview feedback has been submitted yet for **{c['full_name']}**."

    rec_label = {
        "strong_yes": "Strong Hire", "yes": "Hire", "maybe": "Maybe",
        "no": "No Hire", "strong_no": "Strong No Hire",
    }
    lines = [f"🎤 **{c['full_name']}** — Interview Feedback ({len(rows)} scorecard{'s' if len(rows) != 1 else ''}):\n"]
    for r in rows:
        row = dict(r._mapping)
        by = row.get("submitted_by_name") or "An interviewer"
        title = row.get("interview_title") or "Interview"
        parts = [f"**{title}** — {by}"]
        if row.get("overall_rating") is not None:
            parts.append(f"⭐ {row['overall_rating']}/5")
        rec = row.get("recommendation")
        if rec:
            parts.append(f"Recommendation: {rec_label.get(rec, rec)}")
        strengths = (row.get("strengths") or "").strip()
        weaknesses = (row.get("weaknesses") or "").strip()
        summary = (row.get("summary") or "").strip()
        detail = " | ".join(parts)
        block = f"---\n{detail}"
        if strengths:
            block += f"\n✅ Strengths: {strengths}"
        if weaknesses:
            block += f"\n⚠️ Areas to improve: {weaknesses}"
        if summary:
            block += f"\n{summary}"
        lines.append(block)
    return "\n".join(lines)


async def tool_get_offers(
    candidate_id: Optional[str], status_filter: Optional[str], organization_id: str, db: AsyncSession,
    user_message: str = "",
) -> str:
    """Offer status — org-scoped (matches offers.py's list_offers; no recruiter-ownership
    restriction exists on offers in the actual API, so none is added here either).

    "Competing offers" (OtherOffer — what other companies have offered the
    candidate) is a DIFFERENT model from Hybent's own Offer records, and is
    self-reported by the candidate via the portal only — recruiter-facing
    candidate endpoints never eager-load it, so it's always empty there
    today. Answering a "competing offers" question with Hybent's own offer
    status would be actively misleading, so that phrasing is detected and
    given an honest "not available" answer instead of being silently
    treated as a regular offer_query.
    """
    if re.search(r"competing offer|other offer|another offer|multiple offer", user_message, re.IGNORECASE):
        return (
            "I don't have visibility into other companies' offers a candidate may have received — "
            "that's only ever recorded by the candidate themselves through their portal, and isn't "
            "currently exposed through the recruiter view."
        )

    conds = ["o.organization_id = :oid"]
    params = {"oid": organization_id}
    if candidate_id:
        conds.append("c.id = :cid")
        params["cid"] = candidate_id
    if status_filter:
        conds.append("o.status = :status")
        params["status"] = status_filter.lower().strip()

    res = await db.execute(
        text(
            "SELECT o.status, o.base_salary, o.salary_currency, o.position_title,"
            " o.start_date, o.sent_at, o.responded_at, o.decline_reason, c.full_name AS candidate_name"
            " FROM offers o"
            " JOIN applications a ON o.application_id = a.id"
            " JOIN candidates c ON a.candidate_id = c.id"
            f" WHERE {' AND '.join(conds)}"
            " ORDER BY o.created_at DESC LIMIT 20"
        ),
        params,
    )
    rows = res.fetchall()
    if not rows:
        if candidate_id:
            return "No offer has been created for this candidate yet."
        return "No offers found matching that criteria."

    status_emoji = {
        "draft": "📝", "sent": "📤", "accepted": "✅", "declined": "❌",
        "revoked": "🚫", "expired": "⏳",
    }
    lines = [f"🎯 **Found {len(rows)} offer{'s' if len(rows) != 1 else ''}:**\n"]
    for r in rows:
        row = dict(r._mapping)
        emoji = status_emoji.get(row["status"], "•")
        salary = f"{row.get('salary_currency') or ''} {row['base_salary']:,.0f}".strip() if row.get("base_salary") is not None else "N/A"
        parts = [
            f"{emoji} **{row['candidate_name']}** — {row.get('position_title') or 'Role'}",
            f"Status: {row['status'].title()} | Salary: {salary}",
        ]
        if row.get("start_date"):
            parts.append(f"Start date: {row['start_date']}")
        if row["status"] == "declined" and row.get("decline_reason"):
            parts.append(f"Decline reason: {row['decline_reason']}")
        lines.append(" | ".join(parts))
    return "\n".join(lines)


async def tool_get_analytics_report(
    metric: Optional[str], job_title: Optional[str], user_id: str, user_role: Optional[str],
    organization_id: str, db: AsyncSession,
) -> str:
    """
    Dashboard/report metrics — calls the SAME report_service/analytics_service
    functions the Reports & Analytics / AI Insights pages use (not a
    reimplementation), so Copilot's numbers always match what's on screen,
    including the recruiter-vs-admin scoping those services already enforce
    (a recruiter only sees their own created candidates/jobs here, exactly
    like the Reports page — admins see the whole org).
    """
    import uuid as _uuid
    from app.services import report_service, analytics_service

    org_uuid = _uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
    user_uuid = _uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    is_admin = (user_role or "").lower() in ("admin", "super_admin")
    m = (metric or "").lower()

    if any(k in m for k in ("interviewer", "bias", "calibration")):
        rows = await analytics_service.get_interviewer_performance(org_uuid, db)
        if not rows:
            return "No interviewer performance data available yet — this needs submitted scorecards."
        lines = ["🎤 **Interviewer Performance:**\n"]
        for r in rows:
            avg = f"{r.avg_rating_given:.1f}/5" if r.avg_rating_given is not None else "N/A"
            lines.append(f"- **{r.interviewer_name}**: {r.interviews_conducted} interviews, {r.scorecards_submitted} scorecards, avg rating given {avg}")
        return "\n".join(lines)

    if any(k in m for k in ("fair", "pass rate", "pass_rate")):
        fm = await analytics_service.get_fairness_metrics(org_uuid, db)
        lines = ["⚖️ **Fairness & Pass-Rate Metrics:**\n", "By stage:"]
        for s in fm.pass_rates_by_stage:
            lines.append(f"  - {s.stage}: {s.pass_rate:.1f}%")
        lines.append("\nBy source:")
        for s in fm.pass_rates_by_source:
            lines.append(f"  - {s.source}: {s.pass_rate:.1f}%")
        if fm.interviewer_calibration_variance:
            lines.append("\nInterviewer rating calibration:")
            for c in fm.interviewer_calibration_variance:
                flag = " ⚠️" if abs(c.variance) > 0.5 else ""
                lines.append(f"  - {c.interviewer_name}: gives {c.avg_rating_given:.1f} avg vs org avg {c.global_avg_rating:.1f}{flag}")
        return "\n".join(lines)

    if any(k in m for k in ("score distribution", "score_distribution")):
        buckets = await analytics_service.get_score_distribution(org_uuid, db)
        lines = ["📊 **Match Score Distribution:**\n"]
        for b in buckets:
            lines.append(f"- {b.range}%: {b.count} candidates")
        return "\n".join(lines)

    if any(k in m for k in ("funnel",)) or job_title:
        job_id = None
        if job_title:
            job_res = await db.execute(
                text("SELECT id FROM jobs WHERE organization_id = :oid AND title ILIKE :t LIMIT 1"),
                {"oid": organization_id, "t": f"%{job_title}%"},
            )
            row = job_res.fetchone()
            if row:
                job_id = row.id
        funnel = await analytics_service.get_funnel(org_uuid, job_id, db, user_id=user_uuid if not is_admin else None)
        label = f" for **{job_title}**" if job_title else ""
        lines = [f"📈 **Recruitment Funnel{label}:**\n"]
        for s in funnel.stages:
            if s.count:
                lines.append(f"- {s.stage.replace('_', ' ').title()}: {s.count} ({s.percentage:.1f}%)")
        return "\n".join(lines) if len(lines) > 1 else f"No application data yet{label}."

    if any(k in m for k in ("time to hire", "time_to_hire", "avg time")):
        overview = await analytics_service.get_overview(org_uuid, db, user_id=user_uuid if not is_admin else None)
        if overview.time_to_hire_days is None:
            return "Time-to-hire isn't available yet — Hybent doesn't have enough completed hires with timestamped stage history to compute it."
        return f"⏱️ Average time to hire: **{overview.time_to_hire_days:.1f} days**."

    # Default: the reports.py-equivalent applied/hired/backout/rejected summary
    summary = await report_service.get_report_summary(org_uuid, user_uuid, is_admin, db)
    lines = [
        "📊 **Recruitment Report:**\n",
        f"Applied: **{summary['applied']}**",
        f"Hired: **{summary['hired']}**",
        f"Backed out: **{summary['backout']}**",
        f"Rejected: **{summary['rejected']}**",
    ]
    if summary.get("candidates_by_role"):
        lines.append("\nBy role:")
        for role, count in sorted(summary["candidates_by_role"].items(), key=lambda x: -x[1])[:8]:
            lines.append(f"  - {role}: {count}")
    return "\n".join(lines)


async def tool_get_import_history(organization_id: str, db: AsyncSession) -> str:
    res = await db.execute(
        text(
            "SELECT file_name, total_rows, success_count, failed_count, duplicate_count,"
            " status, created_at FROM import_batches WHERE organization_id = :oid"
            " ORDER BY created_at DESC LIMIT 10"
        ),
        {"oid": organization_id},
    )
    rows = res.fetchall()
    if not rows:
        return "No bulk imports have been run yet."

    lines = [f"📂 **Recent Bulk Imports** ({len(rows)}):\n"]
    for r in rows:
        row = dict(r._mapping)
        date_str = row["created_at"].strftime("%b %d, %Y") if row.get("created_at") else ""
        lines.append(
            f"- **{row['file_name']}** ({date_str}, {row['status']}): "
            f"{row['success_count']} created, {row['duplicate_count']} duplicates skipped, {row['failed_count']} failed"
        )
    return "\n".join(lines)


async def tool_get_pre_screening_status(candidate_id: str, organization_id: str, db: AsyncSession) -> str:
    c = await _fetch_candidate_full(db, organization_id, candidate_id)
    if not c:
        return "I couldn't find that candidate in the available records."

    res = await db.execute(
        text(
            "SELECT status, overall_ai_summary, completed_at, language, created_at"
            " FROM pre_screening_sessions WHERE candidate_id = :cid AND organization_id = :oid"
            " ORDER BY created_at DESC LIMIT 1"
        ),
        {"cid": candidate_id, "oid": organization_id},
    )
    row = res.fetchone()
    if not row:
        return f"**{c['full_name']}** has not been sent a pre-screening session yet."

    r = dict(row._mapping)
    status_label = {"pending": "Invited, not started", "in_progress": "In progress", "completed": "Completed"}.get(r["status"], r["status"])
    lines = [f"🎙️ **{c['full_name']}** — Pre-Screening: **{status_label}**"]
    if r.get("completed_at"):
        lines.append(f"Completed: {r['completed_at'].strftime('%b %d, %Y')}")
    if r["status"] == "completed" and r.get("overall_ai_summary"):
        summary_text = str(r["overall_ai_summary"]).strip()
        if summary_text and summary_text not in ("null", "{}", "None"):
            lines.append(f"\nAI Summary: {summary_text[:600]}")
    elif r["status"] != "completed":
        lines.append("No summary yet — the candidate hasn't completed all questions.")
    return "\n".join(lines)


async def tool_get_activity(
    user_id: str, user_role: Optional[str], organization_id: str, db: AsyncSession, resource_id: Optional[str] = None
) -> str:
    """
    Recent activity / audit trail — replicates activities.py's own role
    scoping exactly: a recruiter only ever sees THEIR OWN actions (the API
    itself returns nothing else to a recruiter), admins see the whole org.
    A Copilot must not claim to know "who else viewed this" for a recruiter
    caller, because the underlying data genuinely isn't visible to them.
    """
    conds = ["al.organization_id = :oid", "al.resource_type IN ('job','candidate','interview','offer','application')"]
    params = {"oid": organization_id}
    role = (user_role or "").lower()

    if resource_id:
        conds.append("al.resource_id = :rid")
        params["rid"] = resource_id

    if role == "recruiter":
        conds.append("al.user_id = :uid")
        params["uid"] = user_id
    # admin/super_admin: org-wide, no extra filter

    res = await db.execute(
        text(
            "SELECT al.action, al.resource_type, al.details, al.created_at, u.full_name AS user_name"
            " FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id"
            f" WHERE {' AND '.join(conds)}"
            " ORDER BY al.created_at DESC LIMIT 15"
        ),
        params,
    )
    rows = res.fetchall()
    if not rows:
        if role == "recruiter":
            return "I don't see any of your own recent activity. Note: as a recruiter, I can only see actions you performed yourself — not the whole team's activity."
        return "No recent activity found."

    lines = ["🕓 **Recent Activity:**\n"]
    for r in rows:
        row = dict(r._mapping)
        by = row.get("user_name") or "System"
        when = row["created_at"].strftime("%b %d, %I:%M %p") if row.get("created_at") else ""
        lines.append(f"- {row['action'].replace('_', ' ').title()} ({row['resource_type']}) by **{by}** — {when}")
    if role == "recruiter":
        lines.append("\n_Showing your own actions only — recruiters can't see other team members' activity._")
    return "\n".join(lines)


async def execute_routed_intent(
    routed: RoutedIntent,
    resolved: dict,
    organization_id: str,
    db: AsyncSession,
    user_message: str,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
) -> Optional[str]:
    """
    Deterministically executes the intents the router confidently classified.
    Returns None to signal "fall through to the legacy free-form tool-calling
    loop" — used for GENERAL/CANDIDATE_SEARCH (which need the model's own
    multi-turn refinement judgment over raw chat history) and any resolution
    edge case not explicitly handled here, so existing behavior is always
    the safety net for anything this router doesn't confidently cover.
    """
    intent = routed.intent

    if intent in (CopilotIntent.GENERAL, CopilotIntent.CANDIDATE_SEARCH):
        return None

    if resolved["not_found"]:
        return f"I couldn't find a candidate named **{resolved['not_found'][0]}** in the available records."

    if resolved["ambiguous"]:
        name, options = next(iter(resolved["ambiguous"].items()))
        opts = "\n".join(f"- {o['name']}" for o in options)
        return f"I found multiple candidates matching '{name}':\n{opts}\n\nCould you specify which one?"

    candidate_id = resolved["candidates"][0]["id"] if resolved["candidates"] else None
    no_candidate_needed = (
        CopilotIntent.PIPELINE_QUERY, CopilotIntent.JOB_QUERY, CopilotIntent.CANDIDATE_COMPARISON,
        CopilotIntent.ANALYTICS_QUERY, CopilotIntent.IMPORT_QUERY, CopilotIntent.ACTIVITY_QUERY,
        CopilotIntent.OFFER_QUERY,
    )
    needs_candidate = intent not in no_candidate_needed

    if needs_candidate and not candidate_id:
        return "Which candidate are you asking about?"

    if intent == CopilotIntent.CANDIDATE_DETAILS:
        return await tool_get_candidate_details(candidate_id, organization_id, db)

    if intent == CopilotIntent.RESUME_QUERY:
        return await tool_resume_qa(candidate_id, routed.question or user_message, organization_id, db)

    if intent in (
        CopilotIntent.SKILL_QUERY, CopilotIntent.EXPERIENCE_QUERY, CopilotIntent.EDUCATION_QUERY,
        CopilotIntent.PROJECT_QUERY, CopilotIntent.CERTIFICATION_QUERY,
    ):
        result = await tool_get_resume_fact(intent, candidate_id, routed.skills, organization_id, db)
        if result is not None:
            return result
        return await tool_resume_qa(candidate_id, routed.question or user_message, organization_id, db)

    if intent == CopilotIntent.JOB_QUERY:
        job_title = resolved.get("job_title")
        if job_title:
            return await execute_read_tool("search_jobs", {"title": job_title}, organization_id, db)
        if candidate_id:
            return await tool_explain_match_score(candidate_id, None, organization_id, db)
        return await execute_read_tool("search_jobs", {}, organization_id, db)

    if intent in (CopilotIntent.JOB_MATCH, CopilotIntent.SCORE_EXPLANATION):
        return await tool_explain_match_score(candidate_id, resolved.get("job_title"), organization_id, db)

    if intent == CopilotIntent.PIPELINE_QUERY:
        return await execute_read_tool("get_pipeline_summary", {}, organization_id, db)

    if intent == CopilotIntent.INTERVIEW_QUERY:
        wants_questions = candidate_id and bool(re.search(r"question|puch|prepare\b|\bask\b", user_message, re.IGNORECASE))
        if wants_questions:
            return await tool_generate_interview_questions(candidate_id, resolved.get("job_title"), organization_id, db)
        cand_name = resolved["candidates"][0]["name"] if resolved["candidates"] else None
        return await execute_read_tool(
            "search_interviews", {"candidate_name": cand_name, "date_range": routed.date_range}, organization_id, db
        )

    if intent == CopilotIntent.CANDIDATE_COMPARISON:
        ids = [cand["id"] for cand in resolved["candidates"]]
        if len(ids) < 2:
            return "Please name at least two candidates to compare."
        return await tool_compare_candidates(ids, organization_id, db)

    if intent == CopilotIntent.SIMILAR_CANDIDATE_SEARCH:
        return await tool_find_similar_candidates(candidate_id, organization_id, db)

    if intent == CopilotIntent.INTERVIEW_FEEDBACK_QUERY:
        return await tool_get_interview_feedback(candidate_id, organization_id, db)

    if intent == CopilotIntent.OFFER_QUERY:
        return await tool_get_offers(candidate_id, routed.metric, organization_id, db, user_message=user_message)

    if intent == CopilotIntent.ANALYTICS_QUERY:
        return await tool_get_analytics_report(
            routed.metric, resolved.get("job_title"), user_id, user_role, organization_id, db
        )

    if intent == CopilotIntent.IMPORT_QUERY:
        return await tool_get_import_history(organization_id, db)

    if intent == CopilotIntent.PRE_SCREENING_QUERY:
        return await tool_get_pre_screening_status(candidate_id, organization_id, db)

    if intent == CopilotIntent.ACTIVITY_QUERY:
        return await tool_get_activity(user_id, user_role, organization_id, db, resource_id=candidate_id)

    return None


# ── Write Tool Executor ──────────────────────────────────────────────────────

def _prefer_exact(rows: list, name: str) -> list:
    """Substring (ILIKE) lookups return 'HR Recruiter 2' for 'HR Recruiter';
    when exactly one row matches the name (or email) exactly, it's the one."""
    if len(rows) <= 1:
        return rows
    wanted = (name or "").strip().lower()
    exact = [
        r for r in rows
        if (getattr(r, "full_name", "") or "").strip().lower() == wanted
        or (getattr(r, "email", "") or "").strip().lower() == wanted
    ]
    return exact if len(exact) == 1 else rows


async def execute_write_tool(name: str, args: dict, organization_id: str, user_id: str, db: AsyncSession) -> str:
    """Execute write/mutation tools."""
    try:
        if name == "schedule_meeting":
            c_name = args.get("candidate_name")
            title = args.get("meeting_title")
            at = args.get("scheduled_at")
            ivs = args.get("interviewer_names")
            stage = args.get("interview_stage")

            # 1. Fetch Org & User details

            oid = uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
            uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

            org_res = await db.execute(
                text("SELECT id, name, timezone, logo_url FROM organizations WHERE id = :oid"),
                {"oid": oid}
            )
            org = org_res.fetchone()
            if not org:
                return "❌ Organization not found."

            user_res = await db.execute(
                text("SELECT google_refresh_token FROM users WHERE id = :uid"),
                {"uid": uid}
            )
            recruiter = user_res.fetchone()

            # 2. Parse date with timezone awareness
            from dateutil.parser import parse as parse_date
            try:
                dt = parse_date(at)
                if dt.tzinfo is None:
                    tz = zoneinfo.ZoneInfo(org.timezone or "Asia/Kolkata")
                    dt = dt.replace(tzinfo=tz)
                dt_utc = dt.astimezone(timezone.utc).replace(tzinfo=None)
            except Exception as e:
                return f"❌ Could not understand the date '{at}'. Please provide a clearer date and time (e.g. '2025-06-10 14:00'). Error: {e}"

            # 3. Find Candidate
            c_res = await db.execute(
                text("SELECT id, full_name, email FROM candidates WHERE full_name ILIKE :n AND organization_id = :o"),
                {"n": f"%{c_name}%", "o": oid}
            )
            candidates = _prefer_exact(c_res.fetchall(), c_name)
            if not candidates:
                return f"❌ Candidate '{c_name}' not found in the database."
            if len(candidates) > 1:
                matches = "\n".join([f"- {r.full_name} ({r.email})" for r in candidates])
                return f"❓ Multiple candidates found for '{c_name}':\n{matches}\n\nPlease specify which one (by full name or email)."

            c = candidates[0]

            # 4. Find most recent Application
            app_res = await db.execute(
                text("SELECT id FROM applications WHERE candidate_id = :cid ORDER BY applied_at DESC LIMIT 1"),
                {"cid": c.id}
            )
            app = app_res.fetchone()
            aid = app[0] if app else None

            # 5. Look up Interviewers
            interviewer_ids, attendee_emails = [], [c.email]
            not_found_ivs = []
            ambiguous_ivs = {}

            if ivs:
                iv_names = [n.strip() for n in ivs.split(",") if n.strip()]
                for ivn in iv_names:
                    u_res = await db.execute(
                        text(
                            "SELECT id, email, full_name FROM users"
                            " WHERE (full_name ILIKE :n OR email ILIKE :n) AND organization_id = :o"
                        ),
                        {"n": f"%{ivn}%", "o": oid}
                    )
                    matches = _prefer_exact(u_res.fetchall(), ivn)
                    if not matches:
                        not_found_ivs.append(ivn)
                    elif len(matches) > 1:
                        ambiguous_ivs[ivn] = [f"{r.full_name} ({r.email})" for r in matches]
                    else:
                        u = matches[0]
                        interviewer_ids.append(u)
                        attendee_emails.append(u.email)

            if ambiguous_ivs:
                msg = "❓ Multiple interviewers found. Please clarify:\n"
                for ivn, options in ambiguous_ivs.items():
                    msg += f"\nFor '{ivn}':\n" + "\n".join([f"  - {opt}" for opt in options])
                return msg

            if not_found_ivs:
                return f"❌ Could not find interviewer(s): {', '.join(not_found_ivs)}. Please confirm they are in your team."

            # 6. Create Calendar Event
            from app.services.calendar_service import create_calendar_event
            cal = await create_calendar_event(
                title=title,
                description=f"Interview with {c.full_name}",
                start_time=dt,
                duration_minutes=60,
                attendee_emails=attendee_emails,
                organizer_refresh_token=recruiter.google_refresh_token if recruiter else None
            )

            # 7. Insert Interview record
            iid = str(uuid.uuid4())
            now_utc = datetime.now(timezone.utc)
            await db.execute(
                text(
                    "INSERT INTO interviews"
                    " (id, candidate_id, application_id, title, scheduled_at, organization_id,"
                    "  status, scheduled_by_id, created_at, updated_at, meeting_link,"
                    "  calendar_event_id, interview_type)"
                    " VALUES (:id, :cid, :aid, :t, :at, :oid, 'scheduled', :sid,"
                    "         :now, :now, :ml, :ce, 'video')"
                ),
                {
                    "id": iid, "cid": c.id, "aid": aid, "t": title,
                    "at": dt_utc, "oid": oid, "sid": uid, "now": now_utc,
                    "ml": cal["meeting_link"], "ce": cal.get("event_id")
                }
            )

            for u in interviewer_ids:
                await db.execute(
                    text(
                        "INSERT INTO interview_panelists (id, interview_id, user_id, role)"
                        " VALUES (:id, :iid, :uid, 'panelist')"
                    ),
                    {"id": str(uuid.uuid4()), "iid": iid, "uid": u.id}
                )

            # Update candidate stage
            new_stage = stage if stage else "technical_round"
            await db.execute(
                text("UPDATE candidates SET pipeline_stage = :s WHERE id = :cid"),
                {"s": new_stage, "cid": c.id}
            )

            # 8. Send Emails & Notifications
            from app.services.email_service import send_interview_invite, send_interviewer_invite
            from app.tasks.notifications import notify_interview_team
            from app.utils.permissions import NotificationType

            tz_str = org.timezone or "Asia/Kolkata"
            local_tz = zoneinfo.ZoneInfo(tz_str)
            time_str = dt.astimezone(local_tz).strftime("%B %d, %Y at %I:%M %p")

            # Fetch job title
            job_title = "the Applied Position"
            if aid:
                j_res = await db.execute(
                    text("SELECT j.title FROM jobs j JOIN applications a ON a.job_id = j.id WHERE a.id = :aid"),
                    {"aid": aid}
                )
                jr = j_res.fetchone()
                if jr:
                    job_title = jr[0]

            # From the Copilot user's own mailbox when they've connected one.
            from app.services.email_accounts_service import EmailAccountsService
            try:
                sender = await EmailAccountsService(db).resolve_sender(oid, uid)
            except Exception:
                sender = None

            send_interview_invite(
                candidate_email=c.email, candidate_name=c.full_name,
                round_name=title, job_role=job_title, company_name=org.name,
                scheduled_at=time_str, meeting_link=cal["meeting_link"],
                duration_minutes=60, interview_type="video", org_logo_url=org.logo_url,
                email_account=sender,
            )

            for u in interviewer_ids:
                send_interviewer_invite(
                    interviewer_email=u.email, interviewer_name=u.full_name,
                    candidate_name=c.full_name, round_name=title, job_role=job_title,
                    company_name=org.name, scheduled_at=time_str, meeting_link=cal["meeting_link"],
                    duration_minutes=60, interview_type="video", org_logo_url=org.logo_url,
                    email_account=sender,
                )

            notify_interview_team.delay(
                iid, NotificationType.INTERVIEW_SCHEDULED, "Interview Scheduled",
                f"A new interview '{title}' has been scheduled for {c.full_name} on {time_str}.",
                {"interview_id": iid, "candidate": c.full_name, "scheduled_at": time_str}
            )

            await db.commit()

            iv_str = f" with **{ivs}**" if ivs else ""
            return (
                f"✅ Successfully scheduled **'{title}'**{iv_str} for **{c.full_name}**"
                f" on **{time_str}**.\n\n"
                f"📧 Invitations sent to candidate and interviewers.\n"
                f"🔗 Google Meet link generated."
            )

        # ── update_candidate_stage ────────────────────────────────────────
        if name == "update_candidate_stage":
            c_name = args.get("candidate_name")
            new_stage = args.get("new_stage")

            oid = uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
            uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

            c_res = await db.execute(
                text(
                    "SELECT id, full_name, email, pipeline_stage"
                    " FROM candidates WHERE full_name ILIKE :n AND organization_id = :o"
                ),
                {"n": f"%{c_name}%", "o": oid}
            )
            candidates = _prefer_exact(c_res.fetchall(), c_name)
            if not candidates:
                return f"❌ Candidate '{c_name}' not found."
            if len(candidates) > 1:
                matches = "\n".join([f"- {r.full_name} ({r.email})" for r in candidates])
                return f"❓ Multiple candidates found for '{c_name}':\n{matches}\n\nPlease specify which one."

            c = candidates[0]
            old_stage = c.pipeline_stage

            await db.execute(
                text(
                    "UPDATE candidates SET pipeline_stage = :s, updated_at = :now"
                    " WHERE id = :cid AND organization_id = :oid"
                ),
                {"s": new_stage, "cid": c.id, "now": datetime.now(timezone.utc), "oid": oid}
            )

            await db.execute(
                text(
                    "UPDATE applications SET stage = :s, updated_at = :now"
                    " WHERE candidate_id = :cid AND organization_id = :oid"
                ),
                {"s": new_stage, "cid": c.id, "now": datetime.now(timezone.utc), "oid": oid}
            )

            from app.services.activity_service import log_activity
            await log_activity(
                db, oid, uid, "UPDATE_STAGE", "candidate", str(c.id),
                {"name": c.full_name, "from": old_stage, "to": new_stage}
            )

            from app.tasks.notifications import notify_organization_roles
            from app.utils.permissions import UserRole, NotificationType, REJECTION_STAGES
            notify_organization_roles.delay(
                str(oid), [UserRole.ADMIN, UserRole.RECRUITER],
                NotificationType.CANDIDATE_UPDATED,
                "Stage Updated",
                f"Candidate '{c.full_name}' moved from {old_stage or 'Applied'} to {new_stage}.",
                {"candidate_id": str(c.id)}
            )

            # Send rejection email if applicable
            if new_stage in REJECTION_STAGES and old_stage not in REJECTION_STAGES:
                from app.services.email_service import send_rejection_email
                org_res = await db.execute(
                    text("SELECT name, logo_url FROM organizations WHERE id = :oid"), {"oid": oid}
                )
                org = org_res.fetchone()
                send_rejection_email(
                    candidate_email=c.email,
                    candidate_name=c.full_name,
                    job_title="the applied position",
                    company_name=org.name if org else "the team",
                    org_logo_url=org.logo_url if org else None
                )

            await db.commit()
            old_label = (old_stage or "Applied").replace("_", " ").title()
            new_label = new_stage.replace("_", " ").title()
            return f"✅ **{c.full_name}** has been moved from **{old_label}** → **{new_label}**."

        return "❌ Unknown action."

    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        logger.error(f"Error in execute_write_tool [{name}]: {e}", exc_info=True)
        return f"❌ Error during execution: {str(e)}"


# ── Hallucinated Tool Call Extractor ─────────────────────────────────────────

def extract_hallucinated_tool_call(text_content: str) -> Optional[tuple[str, dict]]:
    """Parse tool calls from raw text if the LLM hallucinated instead of using API.

    Only fires when a tool name shows up near the START of the reply — i.e.
    the model wrote a fake call INSTEAD OF answering, not a real, complete
    answer that happens to mention a tool name in passing. Without this
    guard, a perfectly good multi-line clarification (e.g. asking for
    interview date/time) could have a stray "update_candidate_stage"-shaped
    fragment further down get detected and get its own canned override text
    appended after the real answer, producing a garbled, self-contradicting
    reply the recruiter actually saw.
    """
    known_tools = [
        "search_candidates", "search_users", "search_jobs",
        "schedule_meeting", "update_candidate_stage",
        "get_pipeline_summary", "get_analytics", "search_interviews",
        "get_candidates_for_job"
    ]
    text_clean = text_content.replace('\\"', '"').replace("\\'", "'").replace('\\n', '\n')
    _HALLUCINATION_SCAN_WINDOW = 60

    for tool_name in known_tools:
        idx = text_clean.find(tool_name)
        if idx != -1 and idx < _HALLUCINATION_SCAN_WINDOW:
            start_json = text_clean.find("{", idx)
            if start_json != -1:
                braces = 0
                for i in range(start_json, len(text_clean)):
                    char = text_clean[i]
                    if char == '{':
                        braces += 1
                    elif char == '}':
                        braces -= 1
                        if braces == 0:
                            json_str = text_clean[start_json:i + 1]
                            try:
                                tool_args = json.loads(json_str)
                                return tool_name, tool_args
                            except json.JSONDecodeError:
                                try:
                                    import ast
                                    tool_args = ast.literal_eval(json_str)
                                    if isinstance(tool_args, dict):
                                        return tool_name, tool_args
                                except Exception:
                                    pass
                            break
            else:
                return tool_name, {}
    return None


# ── Context Resolver ──────────────────────────────────────────────────────────

def resolve_tool_args_context(name: str, args: dict, page_context: Optional[dict]) -> dict:
    """Replace placeholder candidate names with real names from page context."""
    if not isinstance(args, dict):
        args = {}

    c_name = args.get("candidate_name")
    if c_name and name in ["schedule_meeting", "update_candidate_stage"]:
        c_name_lower = c_name.lower().strip("[]() ")
        placeholders = [
            "currently viewed candidate's name", "currently viewed candidate",
            "candidate name", "candidate's name", "candidate_email",
            "candidate", "a candidate", "the candidate", "name",
            "[candidate name]", "placeholder", "unknown"
        ]
        if c_name_lower in placeholders or any(
            p in c_name_lower for p in ["currently viewed", "placeholder", "candidate_name"]
        ):
            if page_context:
                ctx_name = page_context.get("candidate_name")
                if ctx_name:
                    args["candidate_name"] = ctx_name
                    logger.info(f"Resolved placeholder candidate_name → '{ctx_name}' from page_context")

    # Clean placeholder interviewer names
    ivs = args.get("interviewer_names")
    if ivs:
        ivs_lower = ivs.lower().strip("[]() ")
        if ivs_lower in ["interviewer_names", "interviewer name", "interviewer", "interviewers", "placeholder"]:
            args.pop("interviewer_names", None)
            logger.info("Removed placeholder interviewer_names")

    return args


# ── Read-Only Tool Set ────────────────────────────────────────────────────────

READ_TOOLS = {
    "search_candidates", "search_jobs", "search_users",
    "get_pipeline_summary", "get_analytics", "search_interviews",
    "get_candidates_for_job"
}

WRITE_TOOLS = {"schedule_meeting", "update_candidate_stage"}


# ── Main Streaming Chat Service ───────────────────────────────────────────────

@ai_feature("ai_copilot")
async def stream_copilot_chat(
    user_message: str,
    history: list[dict],
    organization_id: uuid.UUID,
    db: AsyncSession,
    page_context: Optional[dict] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    conversation_id: Optional[str] = None,
    approved_tool_call: Optional[dict] = None,
    user_role: Optional[str] = None,
):
    from app.services.ai_credit_service import AICreditsService
    await AICreditsService.check_credits_available(db, organization_id, "ai_copilot")

    start_time = time.time()
    full_text = ""
    status = "success"
    error_msg = None
    
    try:
        async for chunk in _stream_copilot_chat_impl(
            user_message=user_message,
            history=history,
            organization_id=organization_id,
            db=db,
            page_context=page_context,
            background_tasks=background_tasks,
            user_id=user_id,
            conversation_id=conversation_id,
            approved_tool_call=approved_tool_call,
            user_role=user_role,
        ):
            if chunk:
                try:
                    lines = chunk.strip().split("\n")
                    for line in lines:
                        if line:
                            data = json.loads(line)
                            if data.get("type") == "chunk":
                                full_text += data.get("content", "")
                except Exception:
                    pass
            yield chunk
    except Exception as e:
        status = "failure"
        error_msg = str(e)
        raise e
    finally:
        from app.services.ai.copilot_intelligence import is_jd_creation_intent
        is_jd = is_jd_creation_intent(user_message)
        # Successful turns are charged by ai_metering from each Groq/Gemini
        # call's real token usage; only failures are logged here.
        if not is_jd and not approved_tool_call:
            duration_ms = (time.time() - start_time) * 1000
            if status != "success":
                await AICreditsService.log_failed_request(
                    db=db,
                    organization_id=organization_id,
                    user_id=user_id,
                    feature="ai_copilot",
                    provider="Groq",
                    model=GROQ_MODEL,
                    error_detail=error_msg or "Unknown error",
                    duration_ms=duration_ms
                )

async def _stream_copilot_chat_impl(
    user_message: str,
    history: list[dict],
    organization_id: uuid.UUID,
    db: AsyncSession,
    page_context: Optional[dict] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    conversation_id: Optional[str] = None,
    approved_tool_call: Optional[dict] = None,
    user_role: Optional[str] = None,
):
    client = Groq(api_key=settings.groq_api_key)
    oid_str = str(organization_id)
    uid_str = str(user_id)

    def sse(event_type: str, data: dict):
        d = {"type": event_type}
        d.update(data)
        return json.dumps(d) + "\n\n"

    # ── Intercept JD Creation Intent & Generate Directly ─────────────────
    if is_jd_creation_intent(user_message):
        raw_role = extract_role_from_jd_query(user_message)
        status, role_name, validation_msg = validate_job_role(raw_role)

        # If empty, invalid, or incomplete, return helpful guidance or error
        if status in ("EMPTY", "INVALID", "INCOMPLETE"):
            saved_conv_id = await _save_conversation_to_db(
                db, organization_id, user_id, conversation_id, user_message, validation_msg,
                background_tasks=background_tasks,
            )
            yield sse("meta", {"conversation_id": saved_conv_id})
            yield sse("chunk", {"content": validation_msg})
            yield sse("done", {})
            return

        # Status is VALID -> Stream complete professional Job Description directly
        jd_system_prompt = (
            "You are Hybent Hiring Copilot — an expert AI technical recruiter and Talent Acquisition specialist at Hybent.\n"
            "Your task is to generate a comprehensive, modern, highly-professional Job Description (JD) "
            "tailored to the user's prompt.\n\n"
            "CRITICAL FORMATTING GUIDELINES:\n"
            "- Output MUST be clean, structured Markdown (never wrap the entire response in a code block).\n"
            "- Use this exact structure:\n\n"
            "## [Job Title]\n\n"
            "**Position:** [Job Title]  \n"
            "**Experience Level:** [e.g. 2-4 Years / Entry Level / 5+ Years as requested or industry standard]  \n"
            "**Location / Work Mode:** [Remote / Hybrid / On-site as requested or 'Hybrid / Remote']  \n"
            "**Employment Type:** Full-time  \n\n"
            "---\n\n"
            "### 📌 Role Overview\n"
            "[2-3 compelling sentences describing the core purpose, mission, and impact of this role]\n\n"
            "### 🎯 Key Responsibilities\n"
            "- [5-7 concise, actionable, high-impact bullet points — each should be a short phrase, max 15 words]\n\n"
            "### 🛠️ Required Qualifications\n"
            "- [5-7 bullet points covering must-have qualifications, experience, and domain expertise — full sentences okay here]\n\n"
            "### 🔑 Core Skills\n"
            "[List ONLY short skill/tool/technology keywords, comma-separated on ONE line. Examples: React, Node.js, Python, AWS, Agile, Salesforce, SQL, REST APIs]\n\n"
            "### ⭐ Preferred / Good to Have\n"
            "- [3-4 bullet points covering nice-to-have skills, certifications, or modern tools]\n\n"
            "### 💡 What We Offer\n"
            "- Competitive compensation & performance-driven incentives\n"
            "- Comprehensive health & wellness coverage\n"
            "- Collaborative team culture & rapid career advancement\n\n"
            "---\n"
            "💬 *Need any changes? You can ask me to adjust the experience, add specific tools/skills, or modify any section.*\n\n"
            "IMPORTANT: The '### 🔑 Core Skills' section MUST contain ONLY short comma-separated keywords (not sentences). "
            "This is used to auto-fill the skills field in a form."
        )

        jd_messages = [
            {"role": "system", "content": jd_system_prompt},
        ]
        for h in history[-4:]:
            jd_messages.append({"role": h["role"], "content": h["content"]})
        jd_messages.append({
            "role": "user",
            "content": f"Generate a complete Job Description for the role: '{role_name}'. User request: '{user_message}'"
        })

        yield sse("meta", {"conversation_id": conversation_id})

        full_jd_text = ""
        try:
            jd_stream = client.chat.completions.create(
                model=get_best_groq_model(client),
                messages=jd_messages,
                stream=True,
                temperature=0.3,
            )
            for chunk in jd_stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    delta_text = chunk.choices[0].delta.content
                    full_jd_text += delta_text
                    yield sse("chunk", {"content": delta_text})
        except Exception as jd_err:
            logger.error(f"Error during AI JD streaming: {jd_err}")
            fallback_text = (
                f"## {role_name}\n\n"
                f"**Position:** {role_name}  \n"
                f"**Employment Type:** Full-time  \n"
                f"**Work Mode:** Hybrid / Remote  \n\n"
                f"---\n\n"
                f"### 📌 Role Overview\n"
                f"We are looking for an exceptional **{role_name}** to join our growing team.\n\n"
                f"### 🎯 Key Responsibilities\n"
                f"- Drive key initiatives and deliver high-quality outcomes for the team\n"
                f"- Collaborate cross-functionally with internal and external stakeholders\n"
                f"- Stay updated with industry best practices and contribute to continuous improvement\n\n"
                f"### 🛠️ Required Qualifications & Core Skills\n"
                f"- Relevant experience and proven track record as a {role_name}\n"
                f"- Strong problem-solving, communication, and collaboration skills\n"
                f"- Proficiency with standard industry tools and methodologies\n"
            )
            full_jd_text = fallback_text
            yield sse("chunk", {"content": fallback_text})

        cta_button = "\n\n[CTA_BUTTON:Create Job with this JD]"
        full_jd_text += cta_button
        yield sse("chunk", {"content": cta_button})

        saved_conv_id = await _save_conversation_to_db(
            db, organization_id, user_id, conversation_id, user_message, full_jd_text,
            background_tasks=background_tasks,
        )
        yield sse("done", {})
        return

    # ── 1. Handle Approved Tool Execution ─────────────────────────────────
    if approved_tool_call:
        # Run the action the server staged when it asked for approval — never
        # the name/args the browser sends back, which a user could rewrite.
        ctx = await _load_last_context(db, conversation_id, organization_id, user_id) or {}
        pending = ctx.get("pending_action") or {}
        if pending and approved_tool_call.get("id") == pending.get("id") and pending.get("tool") in WRITE_TOOLS:
            result_text = await execute_write_tool(pending["tool"], dict(pending.get("args") or {}), oid_str, uid_str, db)
            _COPILOT_CACHE.clear()  # cached reads are stale after a write
        else:
            result_text = "That action is no longer waiting for approval. Please ask me again and I'll prepare it fresh."
        ctx.pop("pending_action", None)
        conversation_id = await _save_conversation_to_db(
            db, organization_id, user_id, conversation_id, user_message, result_text, last_context=ctx,
            background_tasks=background_tasks,
        )
        yield sse("meta", {"conversation_id": conversation_id})
        yield sse("chunk", {"content": result_text})
        yield sse("done", {})
        return

    # ── 1.5 Intent Router ───────────────────────────────────────────────────
    # A reply that's continuing a pending write-tool clarification (the
    # recruiter just answering "which interview stage?" with "Technical
    # Round") must NOT be handed to the router — "Technical Round" alone
    # looks exactly like a pipeline_query to the classifier, which would
    # silently answer an unrelated question (a pipeline breakdown) and
    # drop the in-progress scheduling conversation entirely, which is
    # exactly what used to happen here. See the `[PENDING_TOOL:...]`
    # marker instruction in COPILOT_SYSTEM_PROMPT §5.
    last_assistant_text = ""
    for _msg in reversed(history or []):
        if _msg.get("role") == "assistant":
            last_assistant_text = _msg.get("content") or ""
            break
    mid_write_tool_flow = "[PENDING_TOOL:" in last_assistant_text

    # Greetings/help never touch retrieval or a classification LLM call.
    if is_greeting(user_message):
        saved_conv_id = await _save_conversation_to_db(
            db, organization_id, user_id, conversation_id, user_message, GENERAL_HELP_REPLY,
            background_tasks=background_tasks,
        )
        yield sse("meta", {"conversation_id": saved_conv_id})
        yield sse("chunk", {"content": GENERAL_HELP_REPLY})
        yield sse("done", {})
        return

    last_context = await _load_last_context(db, conversation_id, organization_id, user_id) or {}
    # A page_context candidate/job (recruiter is actively viewing that page)
    # is a fresher signal than whatever was last discussed in chat, so it
    # takes priority. This also finally makes use of page_context.job_id,
    # which the frontend has sent for a while but nothing read before.
    if page_context and page_context.get("candidate_id"):
        last_context = {**last_context, "candidate_id": page_context["candidate_id"], "candidate_name": page_context.get("candidate_name")}
    if page_context and page_context.get("job_id"):
        last_context = {**last_context, "job_id": page_context["job_id"]}

    if not mid_write_tool_flow:
        router_start = time.time()
        routed = await classify_intent(user_message, last_context)
        resolved = await resolve_context(routed, last_context, db, organization_id)
        routed_reply = await execute_routed_intent(routed, resolved, oid_str, db, user_message, user_id=uid_str, user_role=user_role)

        logger.info(
            "Copilot router: intent=%s candidate=%s job=%s handled=%s latency_ms=%.0f",
            routed.intent.value,
            resolved["candidates"][0]["name"] if resolved["candidates"] else None,
            resolved.get("job_title"),
            routed_reply is not None,
            (time.time() - router_start) * 1000,
        )

        if routed_reply is not None:
            new_context = build_last_context(resolved, last_context)
            saved_conv_id = await _save_conversation_to_db(
                db, organization_id, user_id, conversation_id, user_message, routed_reply, last_context=new_context,
                background_tasks=background_tasks,
            )
            yield sse("meta", {"conversation_id": saved_conv_id})
            yield sse("chunk", {"content": routed_reply})
            yield sse("done", {})
            return
    else:
        logger.info("Copilot router: skipped (mid write-tool clarification flow)")

    # ── 2. Build Message History ──────────────────────────────────────────
    timezone_str = "Asia/Kolkata"
    try:
        org_res = await db.execute(
            text("SELECT timezone FROM organizations WHERE id = :oid"),
            {"oid": organization_id}
        )
        org_row = org_res.fetchone()
        if org_row and org_row[0]:
            timezone_str = org_row[0]
    except Exception as e:
        logger.error(f"Error fetching org timezone: {e}")

    try:
        tz = zoneinfo.ZoneInfo(timezone_str)
        local_dt = datetime.now(tz)
    except Exception:
        local_dt = datetime.now()

    curr_time = local_dt.strftime("%A, %b %d, %Y %I:%M %p")

    # Team members, given directly as context rather than left for the model
    # to fetch via `search_users` mid-conversation. Every read-tool call's
    # result is streamed to the recruiter VERBATIM as the whole reply (see
    # "Execute read tool and return formatted results directly" below) —
    # there's no second pass that turns a tool result into prose. So a
    # mid-flow `search_users` call while scheduling an interview doesn't
    # get woven into "I need: ... [interviewer chips]" — its raw "Found 1
    # team member..." card becomes the entire reply, which is exactly the
    # loop the recruiter hit (every turn re-showing the same team-member
    # card instead of asking for what's still missing). Giving the model
    # real names up front means it never needs that tool call for this.
    team_res = await db.execute(
        text("SELECT full_name, role FROM users WHERE organization_id = :oid ORDER BY full_name"),
        {"oid": organization_id},
    )
    team_rows = team_res.fetchall()
    team_list = (
        ", ".join(f"{r.full_name} ({r.role})" for r in team_rows)
        if team_rows else "none on file"
    )

    sys_prompt = (
        f"{COPILOT_SYSTEM_PROMPT}\n\n"
        f"CURRENT_TIME: {curr_time}\n"
        f"(Always convert relative dates like 'tomorrow', 'next week' to YYYY-MM-DD HH:MM format"
        f" based on CURRENT_TIME when calling tools. That 24-hour YYYY-MM-DD HH:MM format is ONLY for"
        f" tool call arguments — never show it to the recruiter. Any date/time you show or give as an"
        f" example IN YOUR REPLY must be 12-hour with AM/PM, e.g. 'Sep 24, 2:00 PM' or 'Tomorrow 2:00 PM'.)\n\n"
        f"TEAM_MEMBERS (this org's actual users — any of them can be assigned as an interviewer;"
        f" use ONLY these names, never invent one, and never call search_users to look this up —"
        f" you already have the full list): {team_list}"
    )

    messages = [{"role": "system", "content": sys_prompt}]

    # Include last 10 messages for better multi-turn context
    for h in history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})

    # Inject page context if viewing a candidate
    prompt = user_message
    if page_context and page_context.get("candidate_id"):
        c_name = page_context.get("candidate_name", "Unknown")
        c_id = page_context.get("candidate_id")
        prompt = f"[Viewing Candidate: {c_name} ({c_id})]\n\n{user_message}"
    messages.append({"role": "user", "content": prompt})

    # ── 3. Stream LLM Response ────────────────────────────────────────────
    try:
        chat_model = get_best_groq_model(client)
        stream_resp = client.chat.completions.create(
            model=chat_model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            stream=True,
            temperature=0.1,  # Low temperature for factual accuracy
        )

        is_tool_call = False
        tool_call_name = ""
        tool_call_args = ""
        tool_call_id = ""
        full_text = ""

        yield sse("meta", {"conversation_id": conversation_id})

        try:
            for chunk in stream_resp:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                if delta.tool_calls:
                    is_tool_call = True
                    tc = delta.tool_calls[0]
                    if tc.id:
                        tool_call_id = tc.id
                    if tc.function.name:
                        tool_call_name += tc.function.name
                    if tc.function.arguments:
                        tool_call_args += tc.function.arguments
                elif not is_tool_call and delta.content:
                    full_text += delta.content
                    yield sse("chunk", {"content": delta.content})

        except Exception as stream_err:
            # Groq failed_generation error thrown mid-stream (common with typos/ambiguous queries).
            # Fall back to a synchronous non-tool call so the user still gets a response.
            err_s = str(stream_err).lower()
            if "failed_generation" in err_s or "failed to call a function" in err_s or "must contain either output" in err_s:
                logger.warning("Groq tool-call failed mid-stream (%s). Falling back to plain-text call.", stream_err)
                # Reset accumulated state from failed stream
                is_tool_call = False
                tool_call_name = ""
                tool_call_args = ""
                full_text = ""
                # Synchronous fallback with a clean user-facing system prompt
                # (avoids leaking internal tool names / Python code to the user)
                fallback_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are Hybent Hiring Copilot, a helpful AI recruiting assistant. "
                            "The user has sent a message that you couldn't fully understand (possibly due to a typo or ambiguous phrasing). "
                            "Respond in a friendly, concise way: acknowledge what they might be looking for and politely ask them to rephrase. "
                            "Do NOT mention tools, functions, Python code, or internal system details. "
                            "Keep the response under 3 sentences."
                        ),
                    },
                    {"role": "user", "content": user_message},
                ]
                fallback_resp = client.chat.completions.create(
                    model=chat_model,
                    messages=fallback_messages,
                    stream=False,
                    temperature=0.3,
                )
                fb_text = (fallback_resp.choices[0].message.content or "").strip()
                if not fb_text:
                    fb_text = "I'm sorry, I couldn't quite understand that. Could you rephrase your request?"
                full_text = fb_text
                yield sse("chunk", {"content": fb_text})
            else:
                raise stream_err

        # ── 4. Handle Tool Call ───────────────────────────────────────────
        if is_tool_call:
            try:
                args = json.loads(tool_call_args) if tool_call_args else {}
            except json.JSONDecodeError:
                args = {}

            args = resolve_tool_args_context(tool_call_name, args, page_context)
            logger.info(f"Tool call: {tool_call_name} | args: {args}")

            if tool_call_name in READ_TOOLS:
                # Execute read tool and return formatted results directly
                result = await execute_read_tool(tool_call_name, args, oid_str, db, user_message=user_message)
                full_text = result
                yield sse("chunk", {"content": result})

            elif tool_call_name in WRITE_TOOLS:
                # Guard: ensure candidate name is not a placeholder
                c_name = str(args.get("candidate_name", "")).lower().strip("[]() ")
                placeholder_names = {
                    "unknown", "a candidate", "candidate", "placeholder",
                    "the candidate", "candidate_name", "", "none"
                }
                if tool_call_name in ("schedule_meeting", "update_candidate_stage") and c_name in placeholder_names:
                    reply = "Please tell me the exact name or email of the candidate you want to perform this action for."
                    conversation_id = await _save_conversation_to_db(
                        db, organization_id, user_id, conversation_id, user_message, reply,
                        background_tasks=background_tasks,
                    )
                    yield sse("meta", {"conversation_id": conversation_id})
                    yield sse("chunk", {"content": reply})
                    yield sse("done", {})
                    return

                # Require approval for write operations
                reply = "I've prepared this action. Please review and approve to proceed."
                conversation_id, action_id = await _stage_pending_action(
                    db, organization_id, user_id, conversation_id, user_message, reply, tool_call_name, args
                )
                yield sse("meta", {"conversation_id": conversation_id})
                yield sse("approval", {
                    "conversation_id": conversation_id,
                    "pending_tool_call": {"name": tool_call_name, "args": args, "id": action_id},
                    "reply": reply
                })
                yield sse("done", {})
                return
            else:
                # Unknown tool — treat as text
                logger.warning(f"Unknown tool called: {tool_call_name}")

        # ── 5. Hallucination fallback ─────────────────────────────────────
        if full_text:
            hallucinated = extract_hallucinated_tool_call(full_text)
            if hallucinated:
                h_name, h_args = hallucinated
                h_args = resolve_tool_args_context(h_name, h_args, page_context)
                c_name = str(h_args.get("candidate_name", "")).lower().strip("[]() ")
                placeholder_names = {"unknown", "a candidate", "candidate", "placeholder", "the candidate", "candidate_name", ""}
                if h_name in WRITE_TOOLS:
                    if c_name in placeholder_names:
                        reply = "Please tell me the exact name of the candidate you want to update."
                        conversation_id = await _save_conversation_to_db(
                            db, organization_id, user_id, conversation_id, user_message, reply,
                            background_tasks=background_tasks,
                        )
                        yield sse("meta", {"conversation_id": conversation_id})
                        yield sse("chunk", {"content": reply})
                        yield sse("done", {})
                        return
                    reply = "I've prepared this action. Please review and approve to proceed."
                    conversation_id, action_id = await _stage_pending_action(
                        db, organization_id, user_id, conversation_id, user_message, reply, h_name, h_args
                    )
                    yield sse("meta", {"conversation_id": conversation_id})
                    yield sse("approval", {
                        "conversation_id": conversation_id,
                        "pending_tool_call": {"name": h_name, "args": h_args, "id": action_id},
                        "reply": reply
                    })
                    yield sse("done", {})
                    return

        # ── 6. Save & Done ────────────────────────────────────────────────
        saved_conv_id = await _save_conversation_to_db(
            db, organization_id, user_id, conversation_id, user_message, full_text,
            background_tasks=background_tasks,
        )
        # Only send meta again if conversation_id changed (new conversation was created)
        if saved_conv_id != conversation_id:
            yield sse("meta", {"conversation_id": saved_conv_id})
        yield sse("done", {})

    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        # Full detail goes to the logs, never to the recruiter — a raw
        # exception string (SQL, a provider's schema-validation error, a
        # stack trace fragment) is exactly the kind of internal/technical
        # leak COPILOT_SYSTEM_PROMPT §2 and §11 rule out everywhere else;
        # this is the one path those prompt rules can't reach, since it
        # fires when the LLM call itself failed rather than replied badly.
        logger.error(f"Copilot stream error: {e}", exc_info=True)
        error_msg = "Sorry, something went wrong on my end. Please try that again."
        yield sse("chunk", {"content": error_msg})
        yield sse("done", {})


# ── Conversation Persistence ──────────────────────────────────────────────────

TITLE_MODEL = "llama-3.1-8b-instant"

_TITLE_SYSTEM_PROMPT = (
    "You are a conversation-title generator for a recruiting AI assistant.\n"
    "Given the user's first message and the assistant's first reply, output a short title "
    "of AT MOST 6 words that captures the topic. Rules:\n"
    "- No quotes, no punctuation at the end, title-case.\n"
    "- Prefer nouns and short phrases: 'Schedule Interview Priya Sharma', 'Candidates for React Role'.\n"
    "- Never start with 'The', 'A', 'An', 'How', 'What', 'Can'.\n"
    "- Output ONLY the title — no explanation, no prefix like 'Title:'."
)


async def _generate_and_save_title(
    conversation_id: str,
    organization_id: str,
    user_id: str,
    user_message: str,
    assistant_reply: str,
) -> None:
    """
    Background task: generate a short AI title for a brand-new conversation
    and persist it. Opens its own DB session so it runs safely after the
    request session has been committed and closed.
    Falls back silently to the existing 60-char title on any error.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.copilot_conversation import CopilotConversation

    try:
        user_snippet = user_message[:400]
        reply_snippet = assistant_reply[:400]
        combined = f"User: {user_snippet}\n\nAssistant: {reply_snippet}"

        title: Optional[str] = None

        # Groq-first
        if settings.groq_api_key:
            try:
                _client = Groq(api_key=settings.groq_api_key)
                resp = await asyncio.to_thread(
                    lambda: _client.chat.completions.create(
                        # A 6-word title doesn't need a reasoning model; the
                        # small one is ~10x cheaper. SafeGroq falls back down
                        # PREFERRED_TEXT_MODELS if it's unavailable.
                        model=TITLE_MODEL,
                        messages=[
                            {"role": "system", "content": _TITLE_SYSTEM_PROMPT},
                            {"role": "user", "content": combined},
                        ],
                        temperature=0.2,
                        max_tokens=20,
                    )
                )
                raw = (resp.choices[0].message.content or "").strip().strip('"').strip("'")
                if raw:
                    title = raw[:100]
            except Exception as e:
                logger.warning(f"Groq title generation failed: {e}")

        # Gemini fallback
        if not title and genai is not None and settings.gemini_api_key:
            try:
                _model = genai.GenerativeModel(GEMINI_FALLBACK_MODEL)
                response = await asyncio.to_thread(
                    lambda: _model.generate_content(f"{_TITLE_SYSTEM_PROMPT}\n\n{combined}")
                )
                raw = (response.text or "").strip().strip('"').strip("'")
                if raw:
                    title = raw[:100]
            except Exception as e:
                logger.warning(f"Gemini title generation failed: {e}")

        if not title:
            return  # keep the 60-char fallback title

        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(CopilotConversation).where(
                    CopilotConversation.id == uuid.UUID(conversation_id),
                    CopilotConversation.organization_id == uuid.UUID(organization_id),
                    CopilotConversation.user_id == uuid.UUID(user_id),
                )
            )
            conv = res.scalar_one_or_none()
            if conv:
                conv.title = title
                await db.commit()
                logger.info(f"AI title set for conversation {conversation_id}: '{title}'")
    except Exception as e:
        logger.warning(f"Title generation background task failed: {e}")


async def _load_last_context(db: AsyncSession, conversation_id: Optional[str], organization_id, user_id) -> Optional[dict]:
    """Loads the structured follow-up context (last discussed candidate/job,
    pending action) persisted on the caller's own conversation."""
    if not conversation_id:
        return None
    from app.models.copilot_conversation import CopilotConversation
    try:
        res = await db.execute(
            select(CopilotConversation).where(
                CopilotConversation.id == uuid.UUID(conversation_id),
                CopilotConversation.organization_id == organization_id,
                CopilotConversation.user_id == user_id,
            )
        )
        conversation = res.scalar_one_or_none()
        # A copy: editing the stored dict in place would hide the change from
        # SQLAlchemy and the edit (e.g. clearing a used approval) would be lost.
        return copy.deepcopy(conversation.last_context) if conversation and conversation.last_context else None
    except Exception:
        return None


async def _save_conversation_to_db(
    db: AsyncSession,
    organization_id,
    user_id,
    conversation_id: Optional[str],
    user_message: str,
    assistant_reply: str,
    last_context: Optional[dict] = None,
    background_tasks: Optional[BackgroundTasks] = None,
) -> str:
    from app.models.copilot_conversation import CopilotConversation, CopilotMessage

    is_new = False
    conversation = None
    if conversation_id:
        try:
            res = await db.execute(
                select(CopilotConversation).where(
                    CopilotConversation.id == uuid.UUID(conversation_id),
                    CopilotConversation.organization_id == organization_id,
                    CopilotConversation.user_id == user_id,
                )
            )
            conversation = res.scalar_one_or_none()
        except Exception:
            pass

    if not conversation:
        is_new = True
        # Fallback title: first 60 chars of user message.
        # A background task will overwrite this with an AI-generated title.
        title = user_message[:60].strip()
        conversation = CopilotConversation(
            organization_id=organization_id,
            user_id=user_id,
            title=title
        )
        db.add(conversation)
        await db.flush()

    if last_context is not None:
        conversation.last_context = last_context

    db.add(CopilotMessage(conversation_id=conversation.id, role="user", content=user_message))
    db.add(CopilotMessage(conversation_id=conversation.id, role="assistant", content=assistant_reply))
    await db.commit()

    conv_id_str = str(conversation.id)

    # Schedule AI title generation only once, for brand-new conversations.
    if is_new and background_tasks is not None:
        background_tasks.add_task(
            _generate_and_save_title,
            conv_id_str,
            str(organization_id),
            str(user_id),
            user_message,
            assistant_reply,
        )

    return conv_id_str


async def _stage_pending_action(
    db: AsyncSession, organization_id, user_id, conversation_id: Optional[str],
    user_message: str, reply: str, tool_name: str, args: dict,
) -> tuple[str, str]:
    """Saves the write action awaiting approval on the conversation and
    returns (conversation_id, action_id). Approval later runs exactly this."""
    ctx = await _load_last_context(db, conversation_id, organization_id, user_id) or {}
    action_id = uuid.uuid4().hex
    ctx["pending_action"] = {"id": action_id, "tool": tool_name, "args": args}
    conv_id = await _save_conversation_to_db(
        db, organization_id, user_id, conversation_id, user_message, reply, last_context=ctx
    )
    return conv_id, action_id
