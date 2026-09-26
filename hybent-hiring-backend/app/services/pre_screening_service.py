"""
AI Pre-Screening Service
Generates 10 personalised interview questions using Groq and handles audio file management.
"""
import json
import logging
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks

from app.core.config import settings
from app.services.groq_client import SafeGroq as Groq, get_best_groq_model
from app.services.ai_usage_tracker import log_ai_usage
from app.services.ai_metering import ai_feature

logger = logging.getLogger(__name__)

groq_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else None

QUESTION_SYSTEM_PROMPT = """
You are an expert technical recruiter and interview coach with 15+ years of experience.
Your task is to generate exactly 10 pre-screening interview questions for a specific candidate.
Return ONLY a valid JSON array — no explanation, no markdown, no extra text.
"""

QUESTION_USER_TEMPLATE = """
Generate exactly 10 pre-screening questions for this candidate and job.

JOB DETAILS:
- Title: {job_title}
- Description: {job_description}
- Required Skills: {required_skills}
- Experience Required: {required_experience} years

CANDIDATE RESUME SUMMARY:
- Name: {candidate_name}
- Current Title: {candidate_title}
- Skills: {candidate_skills}
- Experience: {candidate_experience} years
- Summary: {candidate_summary}

INSTRUCTIONS:
- 3 questions based on the job description (requirements, responsibilities, tech stack) → category: "job_description"
- 3 questions based on the candidate's resume (skills, experience, past projects) → category: "resume"
- 4 questions on professional awareness, situational judgment, or role fit → category: "role_awareness"
- Each question must be clear, concise, and answerable verbally in 1-3 minutes.
- Avoid yes/no questions. Use open-ended behavioral or situational format.

Return ONLY this JSON array (exactly 10 items):
[
  {{"id": 1, "text": "...", "category": "job_description"}},
  {{"id": 2, "text": "...", "category": "job_description"}},
  {{"id": 3, "text": "...", "category": "job_description"}},
  {{"id": 4, "text": "...", "category": "resume"}},
  {{"id": 5, "text": "...", "category": "resume"}},
  {{"id": 6, "text": "...", "category": "resume"}},
  {{"id": 7, "text": "...", "category": "role_awareness"}},
  {{"id": 8, "text": "...", "category": "role_awareness"}},
  {{"id": 9, "text": "...", "category": "role_awareness"}},
  {{"id": 10, "text": "...", "category": "role_awareness"}}
]
"""

SUMMARY_SYSTEM_PROMPT = """
You are an expert HR analyst. Your job is to analyze a candidate's pre-screening session
and produce a structured summary for the hiring team.
Return ONLY valid JSON — no extra text.
"""

SUMMARY_USER_TEMPLATE = """
Analyze this candidate's pre-screening responses and provide a summary.

Candidate: {candidate_name}
Role: {job_title}

Questions and Transcripts:
{qa_pairs}

Return this JSON:
{{
  "overall_impression": "2-3 sentence summary",
  "communication_score": <1-5>,
  "technical_score": <1-5>,
  "culture_fit_score": <1-5>,
  "key_strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"],
  "recommendation": "proceed|hold|reject",
  "recommendation_reason": "1-2 sentence explanation"
}}
"""


def _fallback_questions(job_title: str) -> list[dict]:
    """Return 10 generic questions when AI is unavailable."""
    return [
        {"id": 1,  "text": f"What attracted you to this {job_title} role, and how does it align with your career goals?", "category": "job_description"},
        {"id": 2,  "text": f"What do you understand about the key responsibilities of a {job_title}?", "category": "job_description"},
        {"id": 3,  "text": "How do you stay updated with the latest trends and technologies relevant to this role?", "category": "job_description"},
        {"id": 4,  "text": "Can you walk me through a recent project where you made a significant technical contribution?", "category": "resume"},
        {"id": 5,  "text": "Describe a challenging problem you solved in your previous role and the approach you took.", "category": "resume"},
        {"id": 6,  "text": "What accomplishment from your career are you most proud of, and why?", "category": "resume"},
        {"id": 7,  "text": "How do you prioritise tasks when working on multiple projects with tight deadlines?", "category": "role_awareness"},
        {"id": 8,  "text": "Describe a situation where you had to adapt quickly to a major change at work.", "category": "role_awareness"},
        {"id": 9,  "text": "How do you handle disagreements with teammates or managers about technical decisions?", "category": "role_awareness"},
        {"id": 10, "text": "Where do you see your career heading in the next 2-3 years, and how does this role fit into that?", "category": "role_awareness"},
    ]


@ai_feature("pre_screening_questions")
async def generate_questions(
    job_title: str,
    job_description: str,
    required_skills: list[str],
    required_experience: Optional[float],
    candidate_name: str,
    candidate_title: Optional[str],
    candidate_skills: list[str],
    candidate_experience: Optional[float],
    candidate_summary: Optional[str],
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """Generate 10 personalised screening questions using Groq."""
    if organization_id:
        from app.services.ai_credit_service import AICreditsService
        await AICreditsService.check_credits_available(None, organization_id, "pre_screening_questions")

    if not groq_client:
        logger.warning("Groq not configured — returning fallback questions")
        return _fallback_questions(job_title)

    prompt = QUESTION_USER_TEMPLATE.format(
        job_title=job_title or "the role",
        job_description=(job_description or "Not provided")[:1500],
        required_skills=", ".join(required_skills or []) or "Not specified",
        required_experience=required_experience or "Not specified",
        candidate_name=candidate_name,
        candidate_title=candidate_title or "Not specified",
        candidate_skills=", ".join(candidate_skills or []) or "Not specified",
        candidate_experience=candidate_experience or "Not specified",
        candidate_summary=(candidate_summary or "Not provided")[:800],
    )

    start_time = time.time()
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": QUESTION_SYSTEM_PROMPT.strip()},
                {"role": "user", "content": prompt.strip()},
            ],
            model=get_best_groq_model(groq_client),
            response_format={"type": "json_object"},
            temperature=0.5,
        )

        if hasattr(response, "usage"):
            p_tokens = response.usage.prompt_tokens
            c_tokens = response.usage.completion_tokens
            t_tokens = response.usage.total_tokens

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty AI response")

        parsed = json.loads(content)

        # Handle both array root and wrapped {"questions": [...]} 
        if isinstance(parsed, list):
            questions = parsed
        else:
            questions = parsed.get("questions", parsed.get("items", []))

        if not isinstance(questions, list) or len(questions) < 10:
            raise ValueError(f"Expected 10 questions, got {len(questions) if isinstance(questions, list) else 0}")

        # Validate and normalise
        normalised = []
        for i, q in enumerate(questions[:10]):
            normalised.append({
                "id": i + 1,
                "text": str(q.get("text", q.get("question", ""))).strip(),
                "category": str(q.get("category", "role_awareness")).strip(),
            })

        return normalised

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"AI question generation failed: {e}")
        return _fallback_questions(job_title)
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider="Groq",
                model=get_best_groq_model(groq_client),
                feature="pre_screening_questions",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id,
            )


@ai_feature("pre_screening_summary")
async def generate_session_summary(
    candidate_name: str,
    job_title: str,
    questions: list[dict],
    responses: list,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None,
) -> dict:
    """Generate an overall AI summary for a completed pre-screening session."""
    if organization_id:
        from app.services.ai_credit_service import AICreditsService
        await AICreditsService.check_credits_available(None, organization_id, "pre_screening_summary")

    if not groq_client:
        return {"overall_impression": "AI summary unavailable.", "recommendation": "hold"}

    qa_pairs = []
    for q in questions:
        resp = next((r for r in responses if r.question_index == q["id"] - 1), None)
        transcript = resp.transcript if resp and resp.transcript else "[No response recorded]"
        qa_pairs.append(f"Q{q['id']} [{q['category']}]: {q['text']}\nA: {transcript}\n")

    prompt = SUMMARY_USER_TEMPLATE.format(
        candidate_name=candidate_name,
        job_title=job_title or "the role",
        qa_pairs="\n".join(qa_pairs),
    )

    start_time = time.time()
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT.strip()},
                {"role": "user", "content": prompt.strip()},
            ],
            model=get_best_groq_model(groq_client),
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        if hasattr(response, "usage"):
            p_tokens = response.usage.prompt_tokens
            c_tokens = response.usage.completion_tokens
            t_tokens = response.usage.total_tokens

        content = response.choices[0].message.content
        return json.loads(content) if content else {}

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"Session summary generation failed: {e}")
        return {"overall_impression": f"Summary generation failed: {e}", "recommendation": "hold"}
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider="Groq",
                model=get_best_groq_model(groq_client),
                feature="pre_screening_summary",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id,
            )


# ── Language helpers ──────────────────────────────────────────────────────────

LANGUAGE_MAP = {
    "english":  {"name": "English",  "code": "en-IN", "groq_name": "English"},
    "hindi":    {"name": "Hindi",    "code": "hi-IN", "groq_name": "Hindi"},
    "gujarati": {"name": "Gujarati", "code": "gu-IN", "groq_name": "Gujarati"},
}

# Maps our language keys → Whisper language codes
WHISPER_LANGUAGE_MAP: dict[str, str] = {
    "english":  "en",
    "hindi":    "hi",
    "gujarati": "gu",
}

TRANSLATION_SYSTEM_PROMPT = """
You are a professional language translator with expertise in Indian languages.
Translate the interview questions accurately while preserving their professional tone.
Return ONLY a valid JSON object with a "questions" array — no markdown, no extra text.
"""

TRANSLATION_USER_TEMPLATE = """
Translate the following 10 interview questions from English to {target_language}.
Maintain the professional tone and technical accuracy.
Keep category values unchanged (do not translate: job_description, resume, role_awareness).

Questions to translate:
{questions_json}

Return ONLY this JSON structure:
{{
  "questions": [
    {{"id": 1, "text": "<translated text>", "category": "<original category>"}},
    ...
  ]
}}
"""


@ai_feature("translation")
async def translate_questions(
    questions: list[dict],
    language: str,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """
    Translate question texts to Hindi or Gujarati using Groq.
    Falls back to original English questions if translation fails.
    """
    if language == "english" or language not in LANGUAGE_MAP:
        return questions

    if organization_id:
        from app.services.ai_credit_service import AICreditsService
        await AICreditsService.check_credits_available(None, organization_id, "pre_screening_translation")

    if not groq_client:
        logger.warning("Groq not configured — returning original English questions")
        return questions

    target_language = LANGUAGE_MAP[language]["groq_name"]
    questions_json = json.dumps(
        [{"id": q["id"], "text": q["text"], "category": q["category"]} for q in questions],
        ensure_ascii=False,
        indent=2,
    )

    prompt = TRANSLATION_USER_TEMPLATE.format(
        target_language=target_language,
        questions_json=questions_json,
    )

    start_time = time.time()
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": TRANSLATION_SYSTEM_PROMPT.strip()},
                {"role": "user", "content": prompt.strip()},
            ],
            model=get_best_groq_model(groq_client),
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        if hasattr(response, "usage"):
            p_tokens = response.usage.prompt_tokens
            c_tokens = response.usage.completion_tokens
            t_tokens = response.usage.total_tokens

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from translation AI")

        parsed = json.loads(content)
        translated = parsed.get("questions", [])

        if not isinstance(translated, list) or len(translated) < len(questions):
            raise ValueError(f"Unexpected translation output: {len(translated)} questions")

        # Validate and merge — keep original category and id, replace only text
        result = []
        for orig, trans in zip(questions, translated):
            result.append({
                "id": orig["id"],
                "text": str(trans.get("text", orig["text"])).strip() or orig["text"],
                "category": orig["category"],
            })
        return result

    except Exception as e:
        status = "failure"
        error_msg = str(e)
        logger.error(f"Question translation to {language} failed: {e} — returning English")
        return questions
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if background_tasks:
            background_tasks.add_task(
                log_ai_usage,
                provider="Groq",
                model=get_best_groq_model(groq_client),
                feature="pre_screening_translation",
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_msg,
                user_id=user_id,
                organization_id=organization_id,
            )


def make_invite_token() -> str:
    return secrets.token_urlsafe(48)


def token_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=7)


def get_audio_dir(session_id: uuid.UUID) -> Path:
    path = Path(settings.upload_dir) / "pre-screening" / str(session_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_audio_file_path(session_id: uuid.UUID, question_index: int, extension: str = "webm") -> Path:
    return get_audio_dir(session_id) / f"q{question_index}.{extension}"


def audio_url_path(session_id: uuid.UUID, question_index: int, extension: str = "webm") -> str:
    """Relative path stored in DB — served via the protected /audio endpoint."""
    return f"pre-screening/{session_id}/q{question_index}.{extension}"
