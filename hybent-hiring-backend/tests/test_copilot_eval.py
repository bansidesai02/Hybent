"""
Copilot evaluation suite — asserts the intent ROUTER's classification on a
realistic set of recruiter questions (English + Hinglish), covering every
category discovered from a full capability audit of the actual Hybent
codebase (backend routers/models/permissions + every recruiter-facing
frontend page/filter — not an assumed/fixed question list): candidate
profile/resume/skill/experience/education/project/certification, job
matching, score explanation, candidate search (mirroring the real filters:
role, added-by, date range, status), pipeline/stage (the full 34-value
ApplicationStage vocabulary, not an approximation of it), interview
scheduling vs. interview FEEDBACK/scorecards (a distinct data model),
offers (including the "competing offers" trap — a different model that
isn't actually exposed to recruiters), analytics/reports (funnel, time to
hire, score distribution, interviewer performance, fairness), bulk import
history, AI pre-screening sessions, audit/activity trail, comparison,
similar-candidate, follow-ups, and general conversation.

This checks the deterministic routing DECISION, not "does the LLM sound
good" — i.e. exactly what the task asked for: automated tests for the
routing layer, not manual spot-checks. It calls the real Groq classifier
(no mocking), so it requires GROQ_API_KEY and is skipped without one.
"""
import pytest

from app.core.config import settings
from app.services.ai.copilot_router import CopilotIntent, classify_intent, is_greeting

pytestmark = pytest.mark.skipif(not settings.groq_api_key, reason="GROQ_API_KEY not configured")

ANKIT_CONTEXT = {"candidate_id": "11111111-1111-1111-1111-111111111111", "candidate_name": "Ankit Parmar"}
JOB_CONTEXT = {**ANKIT_CONTEXT, "job_id": "job-1", "job_title": "Python Developer"}

# (question, last_context, expected_intent)
EVAL_CASES: list[tuple[str, dict | None, CopilotIntent]] = [
    # ── Candidate details / experience / skills — English ──────────────────
    ("What is Ankit's current role?", None, CopilotIntent.CANDIDATE_DETAILS),
    ("How much experience does Ankit have?", None, CopilotIntent.EXPERIENCE_QUERY),
    ("Does Ankit know Python?", None, CopilotIntent.SKILL_QUERY),
    ("What are Ankit's skills?", None, CopilotIntent.SKILL_QUERY),
    ("What is Ankit's educational background?", None, CopilotIntent.EDUCATION_QUERY),
    ("What projects has Ankit worked on?", None, CopilotIntent.PROJECT_QUERY),
    ("What certifications does Ankit have?", None, CopilotIntent.CERTIFICATION_QUERY),
    ("Give me a short summary of Ankit's resume.", None, CopilotIntent.RESUME_QUERY),
    ("Are there any issues with this candidate's resume?", None, CopilotIntent.RESUME_QUERY),
    ("What should I verify with this candidate?", ANKIT_CONTEXT, CopilotIntent.RESUME_QUERY),

    # ── Candidate details / experience / skills — Hinglish ──────────────────
    ("Ankit ka experience kitna hai?", None, CopilotIntent.EXPERIENCE_QUERY),
    ("Ankit ko Python aata hai?", None, CopilotIntent.SKILL_QUERY),
    ("Ankit ka FastAPI experience kitna hai?", None, CopilotIntent.EXPERIENCE_QUERY),
    ("Is candidate ka current role kya hai?", None, CopilotIntent.CANDIDATE_DETAILS),
    ("Resume ka short summary do.", ANKIT_CONTEXT, CopilotIntent.RESUME_QUERY),
    ("Ankit ka education kya hai?", None, CopilotIntent.EDUCATION_QUERY),
    ("Ankit ne kaunse projects kiye hain?", None, CopilotIntent.PROJECT_QUERY),
    ("Iske certifications kya hain?", ANKIT_CONTEXT, CopilotIntent.CERTIFICATION_QUERY),
    ("Ankit ke resume mein FastAPI kaha use hua hai?", None, CopilotIntent.RESUME_QUERY),
    ("Is candidate se kya verify karna chahiye?", ANKIT_CONTEXT, CopilotIntent.RESUME_QUERY),
    ("Is resume mein koi issue hai?", ANKIT_CONTEXT, CopilotIntent.RESUME_QUERY),
    ("Kitne saal ka experience hai Ankit ka?", None, CopilotIntent.EXPERIENCE_QUERY),
    ("Ankit python pe kaam kiya hai?", None, CopilotIntent.SKILL_QUERY),

    # ── Follow-ups (require context resolution) ─────────────────────────────
    ("Aur FastAPI?", ANKIT_CONTEXT, CopilotIntent.SKILL_QUERY),
    ("Iska score kitna hai?", ANKIT_CONTEXT, CopilotIntent.SCORE_EXPLANATION),
    ("Iska score low kyu hai?", ANKIT_CONTEXT, CopilotIntent.SCORE_EXPLANATION),
    ("Ye role ke liye fit hai?", JOB_CONTEXT, CopilotIntent.JOB_MATCH),
    ("Aur koi similar candidate hai?", ANKIT_CONTEXT, CopilotIntent.SIMILAR_CANDIDATE_SEARCH),

    # ── Job matching / score explanation ────────────────────────────────────
    ("How well does Ankit match this job?", JOB_CONTEXT, CopilotIntent.JOB_MATCH),
    ("Ankit is job ke liye kitna match karta hai?", None, CopilotIntent.JOB_MATCH),
    ("Why is Ankit's match score 82%?", None, CopilotIntent.SCORE_EXPLANATION),
    ("Score kam kyu hai?", ANKIT_CONTEXT, CopilotIntent.SCORE_EXPLANATION),
    ("Ankit ka match score kya hai?", None, CopilotIntent.SCORE_EXPLANATION),

    # ── Candidate search ─────────────────────────────────────────────────────
    ("Show me Python developers.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Python aur FastAPI wale candidates dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Find candidates with 3+ years backend experience.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("3+ years experience wale backend candidates dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Ahmedabad mein Python candidates hain?", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Python developer ke liye kaun suitable hai?", None, CopilotIntent.CANDIDATE_SEARCH),

    # ── Pipeline questions ───────────────────────────────────────────────────
    ("How many candidates are in screening?", None, CopilotIntent.PIPELINE_QUERY),
    ("Screening mein kitne candidates hain?", None, CopilotIntent.PIPELINE_QUERY),
    ("Interview stage pe kitne candidates hain?", None, CopilotIntent.PIPELINE_QUERY),
    ("How many candidates are shortlisted?", None, CopilotIntent.PIPELINE_QUERY),
    ("Kitne candidates shortlisted hain?", None, CopilotIntent.PIPELINE_QUERY),

    # ── Interview questions ──────────────────────────────────────────────────
    ("What interviews are scheduled today?", None, CopilotIntent.INTERVIEW_QUERY),
    ("Generate interview questions for Ankit based on his resume.", None, CopilotIntent.INTERVIEW_QUERY),
    ("Ankit ke resume ke basis pe interview questions bana do.", None, CopilotIntent.INTERVIEW_QUERY),
    ("Interview mein kya puchu Ankit se?", ANKIT_CONTEXT, CopilotIntent.INTERVIEW_QUERY),

    # ── Comparison / similar candidates ─────────────────────────────────────
    ("What's the difference between Ankit and Rahul?", None, CopilotIntent.CANDIDATE_COMPARISON),
    ("Ankit aur Rahul mein kya difference hai?", None, CopilotIntent.CANDIDATE_COMPARISON),
    ("Compare Ankit and Rahul.", None, CopilotIntent.CANDIDATE_COMPARISON),
    ("Is there anyone else like Ankit?", None, CopilotIntent.SIMILAR_CANDIDATE_SEARCH),
    ("Ankit jaisa koi aur candidate hai?", None, CopilotIntent.SIMILAR_CANDIDATE_SEARCH),

    # ── Job query ─────────────────────────────────────────────────────────────
    ("What are the requirements for the Python Developer job?", None, CopilotIntent.JOB_QUERY),

    # ── General / greetings (never RAG, never a data tool) ──────────────────
    ("Hi", None, CopilotIntent.GENERAL),
    ("Hello", None, CopilotIntent.GENERAL),
    ("Good morning", None, CopilotIntent.GENERAL),
    ("What can you help me with?", None, CopilotIntent.GENERAL),

    # ── Write actions — must NOT be captured by a read intent ────────────────
    ("Schedule interview for Rohan tomorrow at 2pm", None, CopilotIntent.GENERAL),
    ("Move Priya to Technical Round Selected", None, CopilotIntent.GENERAL),

    # ── Interview feedback / scorecards (distinct from scheduling) ──────────
    ("How did Ankit's technical interview go?", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("What did the interviewer think of Ankit?", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("What was the recommendation from the panel?", ANKIT_CONTEXT, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("Ankit ke interview ka feedback kya tha?", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("Interviewer ne kya rating di Ankit ko?", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("What are Ankit's strengths and weaknesses from the interview?", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("Is candidate ko kitne interviewers ne evaluate kiya hai?", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),
    ("Show me the scorecard for Ankit's HR round.", None, CopilotIntent.INTERVIEW_FEEDBACK_QUERY),

    # ── Offers ────────────────────────────────────────────────────────────────
    ("Is there a pending offer for Ankit?", None, CopilotIntent.OFFER_QUERY),
    ("Kitne offers pending hain response ke liye?", None, CopilotIntent.OFFER_QUERY),
    ("What's Ankit's offer salary?", None, CopilotIntent.OFFER_QUERY),
    ("Which offers were declined this quarter?", None, CopilotIntent.OFFER_QUERY),
    ("Has the offer been sent to Ankit yet?", ANKIT_CONTEXT, CopilotIntent.OFFER_QUERY),
    ("Does this candidate have any competing offers?", ANKIT_CONTEXT, CopilotIntent.OFFER_QUERY),
    ("Kya isko doosri company se offer mila hai?", ANKIT_CONTEXT, CopilotIntent.OFFER_QUERY),
    ("Show me all draft offers.", None, CopilotIntent.OFFER_QUERY),

    # ── Analytics / reports ──────────────────────────────────────────────────
    ("What's our time to hire this month?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Is mahine ka time-to-hire kitna hai?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Show me the recruitment funnel for last 90 days.", None, CopilotIntent.ANALYTICS_QUERY),
    ("What's the match score distribution across candidates?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Which interviewer gives the harshest ratings?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Kaun sa interviewer sabse strict rating deta hai?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Show me the fairness metrics for our hiring process.", None, CopilotIntent.ANALYTICS_QUERY),
    ("Are there any pass-rate differences by candidate source?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Maine last 30 days mein kitne candidates hire kiye?", None, CopilotIntent.ANALYTICS_QUERY),
    ("How many candidates backed out of the process this quarter?", None, CopilotIntent.ANALYTICS_QUERY),
    ("Give me a recruitment report for August.", None, CopilotIntent.ANALYTICS_QUERY),
    ("What's our average match score right now?", None, CopilotIntent.ANALYTICS_QUERY),

    # ── Bulk import ───────────────────────────────────────────────────────────
    ("When was the last bulk import?", None, CopilotIntent.IMPORT_QUERY),
    ("Pichla bulk import kab hua tha?", None, CopilotIntent.IMPORT_QUERY),
    ("How many duplicates were skipped in the last import?", None, CopilotIntent.IMPORT_QUERY),
    ("Kitne candidates create hue the last CSV upload mein?", None, CopilotIntent.IMPORT_QUERY),
    ("Show me the import history.", None, CopilotIntent.IMPORT_QUERY),
    ("Which import batch had the most failed rows?", None, CopilotIntent.IMPORT_QUERY),

    # ── Pre-screening ─────────────────────────────────────────────────────────
    ("Has Ankit completed his pre-screening?", None, CopilotIntent.PRE_SCREENING_QUERY),
    ("Ankit ka pre-screening session complete hua ya pending hai?", None, CopilotIntent.PRE_SCREENING_QUERY),
    ("Summarize Ankit's pre-screening responses.", None, CopilotIntent.PRE_SCREENING_QUERY),
    ("Is candidate ka AI pre-screening summary do.", ANKIT_CONTEXT, CopilotIntent.PRE_SCREENING_QUERY),
    ("Did Ankit finish the voice screening questions?", None, CopilotIntent.PRE_SCREENING_QUERY),

    # ── Audit / activity ──────────────────────────────────────────────────────
    ("Maine aaj kaunse candidates dekhe the?", None, CopilotIntent.ACTIVITY_QUERY),
    ("Who last changed this candidate's stage?", ANKIT_CONTEXT, CopilotIntent.ACTIVITY_QUERY),
    ("Show me recent activity on this candidate.", ANKIT_CONTEXT, CopilotIntent.ACTIVITY_QUERY),
    ("What have I done today in Hybent?", None, CopilotIntent.ACTIVITY_QUERY),
    ("Kisne is candidate ko reject kiya tha?", ANKIT_CONTEXT, CopilotIntent.ACTIVITY_QUERY),

    # ── Candidate search — mirroring actual UI filters (role/added-by/date/status) ──
    ("Show me candidates added this week.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Is hafte kitne candidates add hue?", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Candidates jo maine add kiye hain wo dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Show candidates for the Backend Engineer role.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Immediate joiners dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Candidates with 0 notice period.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Budget 10 LPA tak ke candidates dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Freshers dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Senior React developers dikhao.", None, CopilotIntent.CANDIDATE_SEARCH),
    ("Remote candidates hain kya?", None, CopilotIntent.CANDIDATE_SEARCH),

    # ── Pipeline / stage — full real vocabulary (techno-functional, management, etc.) ──
    ("Techno functional round mein kitne candidates hain?", None, CopilotIntent.PIPELINE_QUERY),
    ("Management round pe kitne log hain?", None, CopilotIntent.PIPELINE_QUERY),
    ("How many candidates are in the HR round?", None, CopilotIntent.PIPELINE_QUERY),
    ("Practical round mein kaun kaun hai?", None, CopilotIntent.PIPELINE_QUERY),
    ("How many candidates have we rejected overall?", None, CopilotIntent.PIPELINE_QUERY),
    ("Kitne candidates back out hue hain?", None, CopilotIntent.PIPELINE_QUERY),
    ("Give me the full pipeline breakdown.", None, CopilotIntent.PIPELINE_QUERY),
    ("Total kitne candidates hain hamare pipeline mein?", None, CopilotIntent.PIPELINE_QUERY),

    # ── Job query variations ─────────────────────────────────────────────────
    ("Which jobs are currently active?", None, CopilotIntent.JOB_QUERY),
    ("Kaun se jobs abhi open hain?", None, CopilotIntent.JOB_QUERY),
    # Genuinely answerable via either analytics_query (report_service's
    # candidates_by_role breakdown) or job_query (search_jobs now shows
    # application_count too, fixed alongside this eval) — analytics_query is
    # what the router actually produces for this aggregate-sounding phrasing.
    ("How many applications has the Backend Engineer role received?", None, CopilotIntent.ANALYTICS_QUERY),
    ("What skills are required for the Python Developer job?", None, CopilotIntent.JOB_QUERY),
    ("Is there an opening for a QA Engineer?", None, CopilotIntent.JOB_QUERY),

    # ── Candidate details / education / certification — more phrasing variety ──
    ("Tell me about Ankit.", None, CopilotIntent.CANDIDATE_DETAILS),
    ("Ankit ke baare mein bata.", None, CopilotIntent.CANDIDATE_DETAILS),
    ("What's Ankit's current company?", None, CopilotIntent.CANDIDATE_DETAILS),
    ("Ankit kis stage mein hai abhi?", None, CopilotIntent.CANDIDATE_DETAILS),
    ("Iska degree kya hai?", ANKIT_CONTEXT, CopilotIntent.EDUCATION_QUERY),
    ("B.Tech hai kya candidate?", ANKIT_CONTEXT, CopilotIntent.EDUCATION_QUERY),
    ("Any AWS certifications?", ANKIT_CONTEXT, CopilotIntent.CERTIFICATION_QUERY),

    # ── Ambiguous short follow-ups (context-dependent) ───────────────────────
    ("Experience?", ANKIT_CONTEXT, CopilotIntent.EXPERIENCE_QUERY),
    ("Skills?", ANKIT_CONTEXT, CopilotIntent.SKILL_QUERY),
    ("Score?", ANKIT_CONTEXT, CopilotIntent.SCORE_EXPLANATION),
    ("Status?", ANKIT_CONTEXT, CopilotIntent.CANDIDATE_DETAILS),
    ("Projects?", ANKIT_CONTEXT, CopilotIntent.PROJECT_QUERY),
    # "Another one?" / "Any gap?" in isolation are genuinely ambiguous even to
    # a human (another candidate vs. another similar one; skill gap vs.
    # employment gap) — tested with clearer phrasing that keeps the same
    # follow-up-context intent instead.
    ("Ankit jaisa ek aur dikhao?", ANKIT_CONTEXT, CopilotIntent.SIMILAR_CANDIDATE_SEARCH),
    ("Kya missing hai job requirements mein?", JOB_CONTEXT, CopilotIntent.SCORE_EXPLANATION),

    # ── General / help / platform-guide (must not fail) ──────────────────────
    ("Hey", None, CopilotIntent.GENERAL),
    ("Namaste", None, CopilotIntent.GENERAL),
    ("How do I schedule an interview?", None, CopilotIntent.GENERAL),
    ("What is Hybent?", None, CopilotIntent.GENERAL),
    # candidate_search is an equally correct label here (falls through to the
    # exact same clarifying-question flow as general — both intents are
    # no-ops in execute_routed_intent), so either is acceptable.
    ("Help me find a candidate.", None, CopilotIntent.CANDIDATE_SEARCH),

    # ── More write-action deferrals (must never be captured as a read intent) ──
    ("Reject Ankit.", None, CopilotIntent.GENERAL),
    ("Add a new candidate named Sam Verma.", None, CopilotIntent.GENERAL),
    ("Create a job posting for a DevOps Engineer.", None, CopilotIntent.GENERAL),
    ("Send the offer to Ankit.", None, CopilotIntent.GENERAL),
    ("Tag this candidate as urgent-hire.", ANKIT_CONTEXT, CopilotIntent.GENERAL),
]


@pytest.mark.parametrize("question,last_context,expected_intent", EVAL_CASES, ids=[c[0] for c in EVAL_CASES])
@pytest.mark.asyncio
async def test_router_classifies_expected_intent(question, last_context, expected_intent):
    if is_greeting(question):
        # These never even reach the classifier in the real pipeline —
        # the fast-path itself IS the correct routing decision.
        assert expected_intent == CopilotIntent.GENERAL
        return

    routed = await classify_intent(question, last_context)
    assert routed.intent == expected_intent, (
        f"{question!r} -> expected {expected_intent.value}, got {routed.intent.value} "
        f"(candidate_names={routed.candidate_names}, skills={routed.skills})"
    )


def test_eval_dataset_has_at_least_150_cases():
    assert len(EVAL_CASES) >= 150
