"""
AI match scoring: compare candidate skills/experience against job requirements.
Uses a 3-tier evaluation pipeline:
  1. Groq (Llama-3.3-70b-versatile)
  2. Google Gemini (gemini-1.5-flash) failover
  3. Offline Deterministic Heuristic Fallback Scorer
"""
import asyncio
import json
import logging
import re
import time
import uuid
from typing import Optional

import google.generativeai as genai
from app.services.groq_client import SafeGroq as Groq
from fastapi import BackgroundTasks
from app.core.config import settings
from app.services.ai_usage_tracker import log_ai_usage

logger = logging.getLogger(__name__)

groq_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else None

if settings.gemini_api_key:
    try:
        genai.configure(api_key=settings.gemini_api_key)
    except Exception as exc:
        logger.warning(f"Gemini configuration error: {exc}")

SYSTEM_PROMPT = """
You are an expert technical recruiter AI with 10+ years of hiring experience.
Your only job is to evaluate how well a candidate's resume matches a job description
and return a structured match score. Be consistent — the same inputs must always
produce the same score. Never assume skills not explicitly mentioned in the resume.
"""

USER_PROMPT_TEMPLATE = """
You will be given a candidate's resume data and a job description.
Analyze them and return ONLY a valid JSON object — no explanation, no markdown.

════════════════════════════════════════
SCORING WEIGHTS (must always sum to 100%)
════════════════════════════════════════
- Skills Match        → 50%
- Title Match         → 20%
- Experience Match    → 20%
- Education Match     → 10%

════════════════════════════════════════
SCORING RULES — READ CAREFULLY
════════════════════════════════════════

1. SKILLS SCORE (0–100):
   - Exact skill match → full credit
   - Synonym match (e.g. JS = JavaScript, Postgres = PostgreSQL) → full credit
   - Related/partial skill → half credit
   - Missing required skill → no credit
   - Formula: (credits earned ÷ total required skills) × 100

2. TITLE SCORE (0–100):
   - Exact title match → 100
   - Same domain, different seniority (e.g. Junior vs Senior Dev) → 75
   - Related role (e.g. Backend Dev applying for Fullstack) → 50
   - Unrelated title → 10
   - No title data → 50 (neutral)

3. EXPERIENCE SCORE (0–100):
   - Meets or slightly exceeds requirement (up to 2× required years) → 100
   - Each year BELOW requirement → subtract 15 points
   - Over-qualified (more than 2× required years) → 85
   - No experience data → 50 (neutral)

4. EDUCATION SCORE (0–100):
   - Exceeds requirement → 100
   - Meets requirement exactly → 100
   - One level below (e.g. Bachelor's when Master's required) → 60
   - Two levels below → 20
   - No education data → 50 (neutral)

   Education levels for reference:
   High School < Diploma < Bachelor's < Master's < PhD

════════════════════════════════════════
CRITICAL PENALTY RULE FOR MISSING CORE SKILLS
════════════════════════════════════════
If the candidate is COMPLETELY MISSING the primary core technical skill required by the Job Title (e.g. missing "Python" for a "Python Developer" role, or missing "React" for a "React Developer" role), you MUST apply the following penalty:
- Skills Score MUST be exactly 0.
- Title Score MUST be exactly 10.
- The overall final_score MUST NEVER exceed 40.0, regardless of experience or education.

════════════════════════════════════════
FINAL SCORE FORMULA
════════════════════════════════════════
final_score = (skills_score × 0.50)
            + (title_score  × 0.20)
            + (experience_score × 0.20)
            + (education_score  × 0.10)

Round final_score to 1 decimal place.

════════════════════════════════════════
INPUT DATA
════════════════════════════════════════

JOB DESCRIPTION:
- Job Title:             {job_title}
- Min Experience:        {required_years} years
- Required Skills:       {required_skills}
- Education Required:    {required_education}

CANDIDATE RESUME:
- Name:                  {candidate_name}
- Current Title:         {candidate_title}
- Years of Experience:   {candidate_years}
- Skills:                {candidate_skills}
- Education:             {candidate_education}

════════════════════════════════════════
OUTPUT FORMAT — RETURN ONLY THIS JSON
════════════════════════════════════════
{{
  "final_score": 78.5,
  "skills_score": 80,
  "title_score": 75,
  "experience_score": 85,
  "education_score": 60,
  "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
  "missing_skills": ["Kubernetes", "Redis"],
  "shortlisted": true,
  "reasoning": "A structured, multi-line professional evaluation."
}}

RULES FOR OUTPUT:
- "shortlisted" = true if final_score >= {match_threshold}, otherwise false
- "reasoning": Provide a comprehensive, high-quality ATS-style evaluation (80–120 words). 
  Use the following structure with clear headings:
  
  OVERALL ALIGNMENT: (1-2 sentences on how well they fit the role)
  STRENGTHS: (Bullet points of key matching skills/experience)
  GAPS: (Specific missing skills or experience gaps causing deductions)
  VERDICT: (Final professional recommendation)

  Maintain an objective, expert recruiter tone. Be specific about why points were deducted.
- Never output anything outside the JSON object
- Never add markdown, backticks, or commentary
"""


def compute_heuristic_match_score(
    candidate_skills: list[str],
    candidate_title: Optional[str],
    years_experience: Optional[float],
    candidate_education: list[dict],
    job,
    match_threshold: float = 70.0,
    note: str = ""
) -> tuple[float, dict]:
    """
    Deterministic offline heuristic scorer used when AI services fail or are unconfigured.
    Calculates actual match metrics instead of returning dummy 50% flat defaults.
    """
    req_skills_raw = getattr(job, "skills_required", []) or []
    req_skills = [s.strip() for s in req_skills_raw if isinstance(s, str) and s.strip()]
    cand_skills = [s.strip() for s in (candidate_skills or []) if isinstance(s, str) and s.strip()]
    cand_skills_lower = [s.lower() for s in cand_skills]

    matched_skills = []
    missing_skills = []

    if req_skills:
        for rs in req_skills:
            rs_lower = rs.lower()
            if any(rs_lower in cs or cs in rs_lower for cs in cand_skills_lower):
                matched_skills.append(rs)
            else:
                missing_skills.append(rs)
        skills_score = round((len(matched_skills) / len(req_skills)) * 100.0, 1)
    else:
        matched_skills = cand_skills[:5]
        missing_skills = []
        skills_score = 80.0

    # Title score
    job_title = (getattr(job, "title", "") or "").strip().lower()
    cand_title = (candidate_title or "").strip().lower()
    
    if not cand_title:
        title_score = 50.0
    elif job_title == cand_title:
        title_score = 100.0
    else:
        job_words = set(re.findall(r'\w+', job_title))
        cand_words = set(re.findall(r'\w+', cand_title))
        overlap = job_words.intersection(cand_words)
        if overlap:
            title_score = 75.0
        else:
            title_score = 40.0

    # Experience score
    req_years = float(getattr(job, "min_experience_years", 0) or 0)
    cand_years = float(years_experience) if years_experience is not None else 0.0

    if cand_years >= req_years:
        experience_score = 100.0
    else:
        diff = req_years - cand_years
        experience_score = max(0.0, round(100.0 - (diff * 15.0), 1))

    # Education score
    education_score = 70.0
    if candidate_education and len(candidate_education) > 0:
        education_score = 85.0

    # Critical penalty rule if missing core skills
    if req_skills and len(matched_skills) == 0:
        skills_score = 0.0
        title_score = min(title_score, 40.0)

    final_score = round(
        (skills_score * 0.50) +
        (title_score * 0.20) +
        (experience_score * 0.20) +
        (education_score * 0.10),
        1
    )

    shortlisted = final_score >= match_threshold
    
    reasoning_str = (
        f"OVERALL ALIGNMENT: Candidate matched {len(matched_skills)} of {len(req_skills)} required skills ({skills_score}% skills match).\n"
        f"STRENGTHS: Skills matched: {', '.join(matched_skills) if matched_skills else 'General background'}. Experience: {cand_years} yrs vs required {req_years} yrs.\n"
        f"GAPS: Missing skills: {', '.join(missing_skills) if missing_skills else 'None'}.\n"
        f"VERDICT: {'Recommended for shortlist' if shortlisted else 'Does not meet match threshold'}. {note}".strip()
    )

    return final_score, {
        "final_score": final_score,
        "skills_score": int(skills_score),
        "title_score": int(title_score),
        "experience_score": int(experience_score),
        "education_score": int(education_score),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "shortlisted": shortlisted,
        "reasoning": reasoning_str
    }


async def _evaluate_candidate_match_gemini(prompt: str) -> Optional[dict]:
    """Secondary LLM failover using Gemini 1.5 Flash."""
    if not settings.gemini_api_key:
        return None
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await asyncio.to_thread(
            model.generate_content,
            f"{SYSTEM_PROMPT.strip()}\n\n{prompt.strip()}",
            generation_config={"response_mime_type": "application/json", "temperature": 0.1}
        )
        if response and response.text:
            cleaned = response.text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
    except Exception as e:
        logger.warning(f"Gemini candidate match evaluation failover error: {e}")
    return None


async def evaluate_candidate_match(
    candidate_data: dict,
    candidate_skills: list[str],
    years_experience: Optional[float],
    job,
    match_threshold: float = 70.0,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None
) -> tuple[float, dict]:
    """
    3-Tier Candidate Match Evaluation:
      1. Primary LLM: Groq (Llama-3.3-70b)
      2. Secondary LLM Failover: Gemini 1.5 Flash
      3. Deterministic Algorithmic Heuristic Scorer
    """
    if organization_id:
        from app.services.ai_credit_service import AICreditsService
        await AICreditsService.check_credits_available(None, organization_id, "candidate_matching")

    # Extract clean string values for prompt injection
    try:
        req_skills_str = ", ".join(job.skills_required or []) if getattr(job, "skills_required", None) else "Not explicitly specified"
    except Exception:
        req_skills_str = "Not explicitly specified"
        
    cand_edu_list = candidate_data.get("education", [])
    cand_edu_str = "Not specified"
    if cand_edu_list:
        cand_edu_str = ", ".join([f"{e.get('degree','')} at {e.get('institution','')}" for e in cand_edu_list if isinstance(e, dict)])

    prompt = USER_PROMPT_TEMPLATE.format(
        job_title=getattr(job, "title", "Role"),
        required_years=getattr(job, "min_experience_years", 0) or 0,
        required_skills=req_skills_str,
        required_education="Not specified",
        
        candidate_name=candidate_data.get("full_name", "Candidate"),
        candidate_title=candidate_data.get("current_title", "None"),
        candidate_years=years_experience if years_experience is not None else "Not specified",
        candidate_skills=", ".join(candidate_skills) if candidate_skills else "None",
        candidate_education=cand_edu_str,
        match_threshold=match_threshold
    )

    start_time = time.time()
    p_tokens, c_tokens, t_tokens = 0, 0, 0
    status = "success"
    error_msg = None

    # Tier 1: Groq LLM
    if groq_client:
        try:
            response = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT.strip()},
                    {"role": "user", "content": prompt.strip()},
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            
            if hasattr(response, 'usage'):
                p_tokens = response.usage.prompt_tokens
                c_tokens = response.usage.completion_tokens
                t_tokens = response.usage.total_tokens

            content = response.choices[0].message.content
            if content:
                result = json.loads(content)
                final_score = float(result.get("final_score", 50.0))
                result["matched_skills"] = result.get("matched_skills", [])
                result["missing_skills"] = result.get("missing_skills", [])
                result["reasoning"] = result.get("reasoning", "Score evaluated via AI engine.")
                result["shortlisted"] = bool(result.get("shortlisted", final_score >= match_threshold))
                
                return final_score, result
        except Exception as e:
            logger.warning(f"Groq match scoring failed ({e}). Escalating to Gemini failover...")

    # Tier 2: Gemini LLM Failover
    gemini_result = await _evaluate_candidate_match_gemini(prompt)
    if gemini_result:
        final_score = float(gemini_result.get("final_score", 50.0))
        gemini_result["matched_skills"] = gemini_result.get("matched_skills", [])
        gemini_result["missing_skills"] = gemini_result.get("missing_skills", [])
        gemini_result["reasoning"] = gemini_result.get("reasoning", "Score evaluated via Gemini AI engine.")
        gemini_result["shortlisted"] = bool(gemini_result.get("shortlisted", final_score >= match_threshold))
        return final_score, gemini_result

    # Tier 3: Deterministic Heuristic Fallback Scorer (Guarantees non-50% real match score)
    status = "failure"
    error_msg = "LLM API keys unavailable or failed. Used deterministic heuristic scorer."
    logger.info("Executing deterministic heuristic candidate match calculation...")

    final_score, breakdown = compute_heuristic_match_score(
        candidate_skills=candidate_skills,
        candidate_title=candidate_data.get("current_title"),
        years_experience=years_experience,
        candidate_education=cand_edu_list if isinstance(cand_edu_list, list) else [],
        job=job,
        match_threshold=match_threshold,
        note="(Evaluated via deterministic heuristic fallback engine)."
    )

    duration_ms = (time.time() - start_time) * 1000
    if background_tasks:
        background_tasks.add_task(
            log_ai_usage,
            provider="HeuristicFallback",
            model="DeterministicScorer",
            feature="candidate_match",
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=t_tokens,
            duration_ms=duration_ms,
            status=status,
            error_detail=error_msg,
            user_id=user_id,
            organization_id=organization_id
        )

    return final_score, breakdown
