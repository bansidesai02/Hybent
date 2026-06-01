import json
import re
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Optional, Any

from groq import Groq
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks
import zoneinfo

from app.config import settings

logger = logging.getLogger(__name__)

# ── Models & Prompt ──────────────────────────────────────────────────────────

GROQ_MODEL = "llama-3.1-8b-instant"

COPILOT_SYSTEM_PROMPT = """### 1. YOUR MISSION
You are Hireon Copilot — a production-grade AI Hiring Assistant. Help recruiters search for candidates, analyze their pipeline, manage team members, schedule interviews, and navigate the Hireon platform.
DO NOT write SQL. Use the tools provided. Never hallucinate candidate names or data.

### 2. INTENT → TOOL MAPPING (follow these patterns)
| Recruiter says | Tool to use | Parameter settings |
|---------------|-------------|--------------------|
| "Show React developers" / "Find Python candidates" | `search_candidates` | `query="react"` (or the requested skill) |
| "Who was added this week?" / "New candidates this week" | `search_candidates` | `date_range="this_week"` |
| "Find candidates from Ahmedabad" | `search_candidates` | `location="Ahmedabad"` |
| "Who is immediately available?" / "0 notice period" | `search_candidates` | `notice_period_max=0` |
| "Candidates with 5+ years experience" | `search_candidates` | `experience_min=5` |
| "Show rejected candidates" / "Rejected profiles" | `search_candidates` | `status="rejected"` |
| "Who is in technical round?" | `search_candidates` | `status="technical_round"` |
| "Show shortlisted candidates" | `search_candidates` | `status="shortlisted"` |
| "Show candidates in HR round" | `search_candidates` | `status="hr_round"` |
| "Find Senior Engineers" / "Show Product Managers" | `search_candidates` | `designation="Senior Engineer"` |
| "How many candidates do we have?" / "Pipeline stats" | `get_analytics` | `metric="overview"` |
| "What happened today?" / "Today's activity" | `get_analytics` | `metric="today"` |
| "Show pipeline breakdown" / "Stage-wise count" | `get_pipeline_summary` | (no arguments) |
| "What interviews are tomorrow?" / "Upcoming interviews" | `search_interviews` | `date_range="tomorrow"` |
| "Today's scheduled interviews" | `search_interviews` | `date_range="today"`, `status="scheduled"` |
| "Who applied for the React job?" / "list of data engineer candidates" / "candidates for OdooPython" | `get_candidates_for_job` | `job_title="React"` (or requested job title) |
| "Schedule interview for Rohan tomorrow at 2pm" | `schedule_meeting` | `candidate_name="Rohan"`, `meeting_title="Interview"`, `scheduled_at="tomorrow at 2pm"` |
| "Move Priya to Technical Round Selected" | `update_candidate_stage` | `candidate_name="Priya"`, `new_stage="technical_round_selected"` |

### 3. RULES
- **CONTEXT**: If you see `[Viewing Candidate: Name (ID)]`, use that name automatically for tools. Do not ask for it again.
- **CLARIFY**: If multiple candidates or interviewers match a name, list the options and ask the user to pick one.
- **JOB OPENING VS GENERAL SKILL SEARCH**:
  - If the user is looking for candidates of a specific job opening or role (e.g., "OdooPython job", "Data Engineer candidates", "who applied for the Frontend position"), ALWAYS use `get_candidates_for_job` with the job title as the argument.
  - Only use `search_candidates` for general searches based on skills, technologies, locations, or experience levels (e.g., "React developers", "Python candidates from Bangalore").
- **FORMATTING CANDIDATE LISTS & DETAILS**:
  By default, only show candidate names (e.g. `👤 **[Full Name]**`). Do NOT include details like email, skills, experience, stage, or expected salary unless the user explicitly requests details (e.g. 'in details', 'full details', 'show details', 'detailed information').
  When the user explicitly requests details, you MUST use this exact format for each candidate card (only include non-null fields):
  👤 **[Full Name]**
  📧 [Email]
  💼 [Current Title at Company]
  📍 [Location]
  ⭐ [X Years Experience]
  🛠️ Skills: [comma-separated skills]
  ⏳ Notice Period: [N days]
  📌 Stage: [Pipeline Stage]
  💰 Expected Salary: [Salary]
  
  Every candidate block MUST be separated by a `---` divider on its own line. Before listing candidates, always say "Found X candidates:" so the user knows the count. Do NOT group into bulleted lists.
- **ANALYTICS RESPONSES**: When returning analytics/stats, use clear numbered lists or a table with emojis. Do NOT return raw numbers — always contextualize them (e.g. "📊 You have **47 active candidates** in your pipeline").
- **TONE**: Professional and warm. Support Hinglish (mix of Hindi + English in Roman script) but always respond in English or Hinglish only.
- **RESPONSE LANGUAGE**: ALWAYS respond in English or Hinglish (Roman script). NEVER respond in Indonesian, Malay, Spanish, French, Chinese, or any other language, even if the transcribed speech seems to contain those words due to STT errors.
- **GENERAL QUESTIONS**: For greetings, general recruiting advice, platform navigation, current time/date — answer directly from your knowledge + CURRENT_TIME. No tool needed.
- **IDENTITY**: You are Hireon Copilot. If addressed by another name, politely correct the user.
- **NO INTERNET**: You cannot search the web. Use only internal tools or general knowledge.
- **AMBIGUITY**: When a tool returns multiple matches, summarize the options and ask for clarification. Never proceed with an ambiguous name.
- **NO HALLUCINATION**: Never invent candidates, names, or data. Only report what the database returns.

### 4. HIREON PLATFORM GUIDE
- **Recruiter Dashboard**: Overview of pipeline, upcoming interviews, recent activities, and performance KPIs.
- **Candidates page**: All candidates in your org. Filter by stage, status, search by skill. Each card shows contact info, skills, experience, and stage.
- **Kanban Pipeline**: Visual board grouped by high-level stages. Drag-and-drop to update stage.
- **Jobs page**: Create and manage job openings (active, draft, closed). Each job tracks applicants.
- **Scheduler/Calendar**: Book and view interview rounds. Google Calendar + Google Meet integration.
- **Team/Users**: Manage team members, assign recruiter or interviewer roles.
- **Talent Pool**: Candidates tagged for future roles. Add comments, tags, and track separately.
- **Bulk Import**: Upload Excel/CSV files to import candidates in bulk. History shows all past imports.

### 5. WORKFLOW INSTRUCTIONS
- **Add Candidate**: Go to Candidates → "Add Candidate" (manual) or "Invite Candidate" (email token).
- **Schedule Interview**: Select candidate → "Schedule Round" → choose interviewers → set date/time → Save. Auto-generates Meet link + sends invitations.
- **Evaluate**: After interview, interviewer submits Scorecard. Recruiter reviews feedback before stage progression.
- **Offer Flow**: Candidate must be in 'HR Round Selected' or 'Interviewed' before moving to Offer. Hired candidates cannot be rejected.
- **Candidate Portal**: Candidates can view their journey, complete assignments, access Prep Hub (AI mock interviews), and review offers.
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
                    "query": {"type": "string", "description": "General search term for skills, technologies, or job titles (e.g. 'python', 'react', 'machine learning')."},
                    "name": {"type": "string", "description": "Candidate's full name or partial name."},
                    "email": {"type": "string", "description": "Candidate's email address."},
                    "status": {"type": "string", "description": "Pipeline stage: 'applied', 'shortlisted', 'screening', 'technical_round', 'practical_round', 'hr_round', 'offered', 'hired', 'rejected', 'interview' (all active interview stages)."},
                    "location": {"type": "string", "description": "Filter by location or city (e.g. 'Ahmedabad', 'Bangalore')."},
                    "notice_period_max": {"type": "integer", "description": "Maximum notice period in days (0 = immediate joiners, 15, 30, 60, 90)."},
                    "date_range": {"type": "string", "description": "Filter by when candidate was added: 'today', 'this_week', 'this_month'."},
                    "experience_min": {"type": "integer", "description": "Minimum years of experience."},
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
                    "email": {"type": "string"}
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

# ── Stopwords (intentionally EXCLUDES tech skills — they are search terms) ───

# These are words that should be stripped from the query when building SQL search.
# Do NOT add technology names (react, python, django, etc.) here — they are
# the most important search terms and must pass through to the DB.
_QUERY_STOPWORDS = {
    # Common filler words
    "show", "find", "list", "search", "get", "give", "tell", "fetch",
    "candidate", "candidates", "profile", "profiles", "resume", "resumes", "cv",
    "added", "this", "week", "today", "month", "year", "years",
    "with", "from", "in", "at", "who", "for", "all", "any", "me", "please",
    "we", "our", "us", "them", "their", "those",
    # Hinglish filler
    "mein", "hai", "ke", "ka", "ki", "ko", "se", "aur", "bhi", "toh",
    "hi", "ho", "tha", "thi", "the", "karo", "dikhao", "nikalo", "dhundo", "db",
    "kuch", "hoga", "hogi", "honge", "wala", "wali",
    # Experience-related (handled by experience_min parameter)
    "experience", "exp", "saal",
    # Salary-related (not searchable via query)
    "ctc", "salary", "lpa", "lakh", "lakhs", "expected", "current",
    # Stage/status words (handled by status parameter)
    "pipeline", "stage", "status",
    # Generic HR words
    "top", "best", "good", "strong", "latest", "recent", "recently", "newly",
    # Common English articles/prepositions
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "do", "does", "did", "have", "has", "had", "will", "would", "could", "should"
}

# ── Cache ────────────────────────────────────────────────────────────────────

_COPILOT_CACHE: dict = {}
_CACHE_TTL = 60  # seconds


def _cache_get(key: str) -> Optional[str]:
    """Return cached value if fresh, else None."""
    now = time.time()
    if key in _COPILOT_CACHE:
        ts, val = _COPILOT_CACHE[key]
        if now - ts < _CACHE_TTL:
            return val
        else:
            del _COPILOT_CACHE[key]
    return None


def _cache_set(key: str, val: str):
    """Store value in cache, evict entries older than TTL."""
    now = time.time()
    # Evict stale entries (keep cache from growing unbounded)
    stale = [k for k, (ts, _) in _COPILOT_CACHE.items() if now - ts >= _CACHE_TTL]
    for k in stale:
        del _COPILOT_CACHE[k]
    _COPILOT_CACHE[key] = (now, val)


def _format_experience(c: dict) -> Optional[str]:
    """Return best available experience string from candidate dict."""
    # Prefer the human-readable string, fall back to float
    rel = c.get("relevant_experience")
    if rel and str(rel).strip():
        val = str(rel).strip()
        # Add "Years Experience" suffix if not already present
        if not any(x in val.lower() for x in ("year", "yr", "exp")):
            val = f"{val} Years Experience"
        return val
    exp_str = c.get("experience_years")
    if exp_str and str(exp_str).strip():
        val = str(exp_str).strip()
        if not any(x in val.lower() for x in ("year", "yr", "exp")):
            val = f"{val} Years Experience"
        return val
    exp_float = c.get("years_experience")
    if exp_float is not None:
        return f"{exp_float} Years Experience"
    return None


# ── Read Tool Executor ───────────────────────────────────────────────────────

async def execute_read_tool(name: str, args: dict, organization_id: str, db: AsyncSession, user_message: Optional[str] = None) -> str:
    """Execute read-only tools with caching."""
    cache_key = f"{name}:{organization_id}:{json.dumps(args, sort_keys=True)}"
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"Copilot cache hit for tool: {name}")
        return cached

    try:
        result_text = ""

        # ── search_candidates ─────────────────────────────────────────────
        if name == "search_candidates":
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

                if status_val in ("shortlisted", "pre_screening_selected"):
                    conds.append("pipeline_stage = 'pre_screening_selected'")

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

                elif status_val in ("hr_round", "hr"):
                    conds.append(
                        "pipeline_stage IN ('hr_round', 'hr_round_selected')"
                    )

                elif status_val in ("interview", "interviews", "in_interview", "scheduled"):
                    # All active interview stages
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
                        " 'rejected', 'pre_screening_rejected', 'technical_round_rejected',"
                        " 'technical_round_back_out', 'practical_round_rejected',"
                        " 'practical_round_back_out', 'techno_functional_rejected',"
                        " 'management_round_rejected', 'hr_round_rejected',"
                        " 'offered_back_out', 'offer_withdrawn'"
                        ")"
                    )

                else:
                    # Direct stage match (e.g. 'techno_functional_round')
                    conds.append("pipeline_stage ILIKE :s")
                    params["s"] = f"%{status_val}%"

            if args.get("location"):
                conds.append("location ILIKE :loc")
                params["loc"] = f"%{args['location']}%"

            # Notice period — only explicit "0" or "immediate", NOT NULL
            if args.get("notice_period_max") is not None:
                npm = int(args["notice_period_max"])
                if npm == 0:
                    conds.append(
                        "(notice_period_days = '0'"
                        " OR LOWER(notice_period_days) LIKE '%immediate%'"
                        " OR LOWER(notice_period_days) LIKE '%0 day%')"
                    )
                else:
                    conds.append(
                        "(notice_period_days = '0'"
                        " OR LOWER(notice_period_days) LIKE '%immediate%'"
                        " OR ("
                        "  notice_period_days ~ '^[0-9]+$'"
                        "  AND CAST(notice_period_days AS INTEGER) <= :npm"
                        " )"
                        ")"
                    )
                    params["npm"] = npm

            if args.get("experience_min") is not None:
                conds.append("years_experience >= :exp_min")
                params["exp_min"] = float(args["experience_min"])

            # Date range — calendar-accurate
            if args.get("date_range"):
                dr = args["date_range"].lower()
                if dr == "today":
                    # True calendar today (midnight in UTC)
                    conds.append("created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')")
                elif dr == "this_week":
                    # Current calendar week (Mon–Sun)
                    conds.append("created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')")
                elif dr == "this_month":
                    conds.append("created_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')")

            # General query — strip only filler words, NOT tech skills
            if args.get("query"):
                q_val = args["query"].lower().strip()
                # Normalize common aliases
                alias_map = {
                    "reactjs": "react",
                    "nodejs": "node",
                    "vuejs": "vue",
                    "angularjs": "angular",
                    "springboot": "spring boot",
                    "postgres": "postgresql",
                    "k8s": "kubernetes",
                }
                for alias, replacement in alias_map.items():
                    q_val = q_val.replace(alias, replacement)

                # Remove punctuation except hyphen and dot (for version numbers)
                q_clean = re.sub(r"[^\w\s\-\.]", " ", q_val)
                words = [
                    w for w in q_clean.split()
                    if w not in _QUERY_STOPWORDS and not w.isdigit() and len(w) >= 2
                ]

                for i, w in enumerate(words):
                    pn = f"q_{i}"
                    # Search: full_name, current_title, current_company, location, skills (array), and applied job titles
                    conds.append(
                        f"(full_name ILIKE :{pn}"
                        f" OR current_title ILIKE :{pn}"
                        f" OR current_company ILIKE :{pn}"
                        f" OR location ILIKE :{pn}"
                        f" OR EXISTS ("
                        f"   SELECT 1 FROM unnest(skills) AS s"
                        f"   WHERE s ILIKE :{pn}"
                        f" )"
                        f" OR EXISTS ("
                        f"   SELECT 1 FROM applications a"
                        f"   JOIN jobs j ON j.id = a.job_id"
                        f"   WHERE a.candidate_id = candidates.id"
                        f"     AND j.title ILIKE :{pn}"
                        f" )"
                        f")"
                    )
                    params[pn] = f"%{w}%"

            order_clause = "ORDER BY created_at DESC"
            if args.get("sort_by") == "experience":
                order_clause = "ORDER BY COALESCE(years_experience, 0) DESC, created_at DESC"
            elif args.get("sort_by") == "created_at":
                order_clause = "ORDER BY created_at DESC"

            # Count matching candidates
            count_sql = (
                f"SELECT COUNT(*) FROM candidates WHERE {' AND '.join(conds)}"
            )
            count_res = await db.execute(text(count_sql), params)
            match_count = count_res.scalar() or 0

            # Dynamic limit based on detailed flag
            limit_val = 50 if detailed else 100

            sql = f"""
                SELECT full_name, email, current_title, current_company, location,
                       relevant_experience, experience_years, years_experience,
                       skills, notice_period_days, pipeline_stage,
                       expected_salary, expected_ctc, current_salary, current_ctc
                FROM candidates
                WHERE {' AND '.join(conds)}
                {order_clause}
                LIMIT {limit_val}
            """
            logger.info("Copilot SQL: %s | params: %s", sql, params)

            res = await db.execute(text(sql), params)
            res_all = res.fetchall()
            logger.info("Copilot search found %d records (total matching: %d)", len(res_all), match_count)

            if not res_all:
                # Build descriptive no-results message
                if args.get("date_range") == "today":
                    result_text = "No candidates were added today."
                elif args.get("date_range") == "this_week":
                    result_text = "No candidates were added this week."
                elif args.get("location"):
                    result_text = f"No candidates found in {args['location']}."
                elif args.get("status"):
                    result_text = f"No candidates found in the '{args['status']}' stage."
                elif args.get("query"):
                    result_text = f"No candidates found matching '{args['query']}'. Try a different skill or keyword."
                else:
                    result_text = "No candidates matched your search criteria."
            else:
                header = f"Found **{match_count}** candidate{'s' if match_count != 1 else ''}:"
                if match_count > limit_val:
                    header += f" (showing top {limit_val})"

                formatted_candidates = []
                for r in res_all:
                    c = dict(r._mapping)
                    if not detailed:
                        formatted_candidates.append(f"👤 **{c['full_name']}**")
                    else:
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
                            if isinstance(skills_val, list):
                                skills_display = ", ".join(skills_val[:8])  # limit to 8 skills
                            else:
                                skills_display = str(skills_val)
                            if skills_display.strip():
                                parts.append(f"🛠️ Skills: {skills_display}")

                        np_val = c.get("notice_period_days")
                        if np_val:
                            label = "Immediate" if str(np_val).strip() in ("0", "0 days") else f"{np_val} days"
                            parts.append(f"⏳ Notice Period: {label}")

                        stage = c.get("pipeline_stage")
                        if stage:
                            parts.append(f"📌 Stage: {stage.replace('_', ' ').title()}")

                        sal = c.get("expected_salary") or c.get("expected_ctc")
                        if sal:
                            parts.append(f"💰 Expected Salary: {sal}")

                        formatted_candidates.append("\n".join(parts))

                result_text = header + "\n\n" + "\n\n---\n\n".join(formatted_candidates)

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
                SELECT i.title, i.scheduled_at, i.status, i.meeting_link,
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
                SELECT c.full_name, c.email, c.current_title, c.location,
                       c.relevant_experience, c.experience_years, c.years_experience,
                       c.skills, c.pipeline_stage, a.match_score, j.title AS job_title
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

                result_text = header + "\n\n" + "\n\n---\n\n".join(formatted_candidates)

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

            sql = f"SELECT full_name, email, role FROM users WHERE {' AND '.join(conds)} LIMIT 15"
            res = await db.execute(text(sql), params)
            res_all = res.fetchall()

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
                result_text = f"Found {len(res_all)} team member{'s' if len(res_all) != 1 else ''}:\n\n" + "\n\n---\n\n".join(formatted_users)

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
                f"SELECT title, status, location, job_type, openings, skills_required"
                f" FROM jobs WHERE {' AND '.join(conds)} ORDER BY created_at DESC LIMIT 15"
            )
            res = await db.execute(text(sql), params)
            res_all = res.fetchall()

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
                    skills_req = j.get("skills_required")
                    if skills_req:
                        if isinstance(skills_req, list):
                            parts.append(f"   🛠️ Skills: {', '.join(skills_req[:6])}")
                    formatted_jobs.append("\n".join(parts))
                result_text = f"Found {len(res_all)} job{'s' if len(res_all) != 1 else ''}:\n\n" + "\n\n---\n\n".join(formatted_jobs)

        else:
            return "Unknown tool."

        if result_text:
            _cache_set(cache_key, result_text)
        return result_text

    except Exception as e:
        logger.error(f"Error in execute_read_tool [{name}]: {e}", exc_info=True)
        return f"Error searching data: {str(e)}"


# ── Write Tool Executor ──────────────────────────────────────────────────────

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
            from app.models.organization import Organization
            from app.models.user import User

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
            candidates = c_res.fetchall()
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
                    matches = u_res.fetchall()
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

            send_interview_invite(
                candidate_email=c.email, candidate_name=c.full_name,
                round_name=title, job_role=job_title, company_name=org.name,
                scheduled_at=time_str, meeting_link=cal["meeting_link"],
                duration_minutes=60, interview_type="video", org_logo_url=org.logo_url
            )

            for u in interviewer_ids:
                send_interviewer_invite(
                    interviewer_email=u.email, interviewer_name=u.full_name,
                    candidate_name=c.full_name, round_name=title, job_role=job_title,
                    company_name=org.name, scheduled_at=time_str, meeting_link=cal["meeting_link"],
                    duration_minutes=60, interview_type="video", org_logo_url=org.logo_url
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
            candidates = c_res.fetchall()
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

        # ── db_update ─────────────────────────────────────────────────────
        if name == "db_update":
            table_name = args.get("table_name")
            record_id = args.get("record_id")
            update_data = args.get("update_data")

            if not table_name or not record_id or not update_data:
                return "❌ Missing table_name, record_id, or update_data."

            allowed_tables = ["candidates", "users", "jobs", "interviews", "applications"]
            if table_name not in allowed_tables:
                return f"❌ Updates to table '{table_name}' are not allowed."

            set_clauses = []
            params = {
                "rid": uuid.UUID(record_id) if isinstance(record_id, str) else record_id,
                "oid": uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
            }

            for k, v in update_data.items():
                if not re.match(r"^[a-zA-Z0-9_]+$", k):
                    return f"❌ Invalid column name: {k}"
                if isinstance(v, str):
                    try:
                        v = uuid.UUID(v)
                    except ValueError:
                        pass
                set_clauses.append(f"{k} = :{k}")
                params[k] = v

            sql = (
                f"UPDATE {table_name} SET {', '.join(set_clauses)}, updated_at = NOW()"
                f" WHERE id = :rid AND organization_id = :oid"
            )
            await db.execute(text(sql), params)
            await db.commit()
            return f"✅ Successfully updated {table_name} record."

        return "Write tool executed."

    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        logger.error(f"Error in execute_write_tool [{name}]: {e}", exc_info=True)
        return f"❌ Error during execution: {str(e)}"


# ── Hallucinated Tool Call Extractor ─────────────────────────────────────────

def extract_hallucinated_tool_call(text_content: str) -> Optional[tuple[str, dict]]:
    """Parse tool calls from raw text if the LLM hallucinated instead of using API."""
    known_tools = [
        "search_candidates", "search_users", "search_jobs",
        "schedule_meeting", "db_update", "update_candidate_stage",
        "get_pipeline_summary", "get_analytics", "search_interviews",
        "get_candidates_for_job"
    ]
    text_clean = text_content.replace('\\"', '"').replace("\\'", "'").replace('\\n', '\n')

    for tool_name in known_tools:
        idx = text_clean.find(tool_name)
        if idx != -1:
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

WRITE_TOOLS = {"schedule_meeting", "update_candidate_stage", "db_update"}


# ── Main Streaming Chat Service ───────────────────────────────────────────────

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
):
    client = Groq(api_key=settings.groq_api_key)
    oid_str = str(organization_id)
    uid_str = str(user_id)

    def sse(event_type: str, data: dict):
        d = {"type": event_type}
        d.update(data)
        return json.dumps(d) + "\n\n"

    # ── 1. Handle Approved Tool Execution ─────────────────────────────────
    if approved_tool_call:
        name = approved_tool_call.get("name")
        args = approved_tool_call.get("args", {})
        result_text = await execute_write_tool(name, args, oid_str, uid_str, db)
        conversation_id = await _save_conversation_to_db(
            db, organization_id, user_id, conversation_id, user_message, result_text
        )
        yield sse("meta", {"conversation_id": conversation_id})
        yield sse("chunk", {"content": result_text})
        yield sse("done", {})
        return

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
    sys_prompt = (
        f"{COPILOT_SYSTEM_PROMPT}\n\n"
        f"CURRENT_TIME: {curr_time}\n"
        f"(Always convert relative dates like 'tomorrow', 'next week' to YYYY-MM-DD HH:MM format"
        f" based on CURRENT_TIME when calling tools.)"
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
        stream_resp = client.chat.completions.create(
            model=GROQ_MODEL,
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
                        db, organization_id, user_id, conversation_id, user_message, reply
                    )
                    yield sse("meta", {"conversation_id": conversation_id})
                    yield sse("chunk", {"content": reply})
                    yield sse("done", {})
                    return

                # Require approval for write operations
                reply = "I've prepared this action. Please review and approve to proceed."
                conversation_id = await _save_conversation_to_db(
                    db, organization_id, user_id, conversation_id, user_message, reply
                )
                yield sse("approval", {
                    "conversation_id": conversation_id,
                    "pending_tool_call": {"name": tool_call_name, "args": args, "id": tool_call_id},
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
                            db, organization_id, user_id, conversation_id, user_message, reply
                        )
                        yield sse("meta", {"conversation_id": conversation_id})
                        yield sse("chunk", {"content": reply})
                        yield sse("done", {})
                        return
                    reply = "I've prepared this action. Please review and approve to proceed."
                    conversation_id = await _save_conversation_to_db(
                        db, organization_id, user_id, conversation_id, user_message, reply
                    )
                    yield sse("approval", {
                        "conversation_id": conversation_id,
                        "pending_tool_call": {"name": h_name, "args": h_args},
                        "reply": reply
                    })
                    yield sse("done", {})
                    return

        # ── 6. Save & Done ────────────────────────────────────────────────
        conversation_id = await _save_conversation_to_db(
            db, organization_id, user_id, conversation_id, user_message, full_text
        )
        yield sse("meta", {"conversation_id": conversation_id})
        yield sse("done", {})

    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        logger.error(f"Copilot stream error: {e}", exc_info=True)
        error_msg = f"Sorry, I encountered an error: {str(e)}"
        yield sse("chunk", {"content": error_msg})
        yield sse("done", {})


# ── Conversation Persistence ──────────────────────────────────────────────────

async def _save_conversation_to_db(
    db: AsyncSession,
    organization_id,
    user_id,
    conversation_id: Optional[str],
    user_message: str,
    assistant_reply: str
) -> str:
    from app.models.copilot_conversation import CopilotConversation, CopilotMessage

    conversation = None
    if conversation_id:
        try:
            res = await db.execute(
                select(CopilotConversation).where(
                    CopilotConversation.id == uuid.UUID(conversation_id)
                )
            )
            conversation = res.scalar_one_or_none()
        except Exception:
            pass

    if not conversation:
        # Title: first 60 chars of user message, cleaned up
        title = user_message[:60].strip()
        conversation = CopilotConversation(
            organization_id=organization_id,
            user_id=user_id,
            title=title
        )
        db.add(conversation)
        await db.flush()

    db.add(CopilotMessage(conversation_id=conversation.id, role="user", content=user_message))
    db.add(CopilotMessage(conversation_id=conversation.id, role="assistant", content=assistant_reply))
    await db.commit()
    return str(conversation.id)
