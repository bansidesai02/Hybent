"""
AI match scoring: compare candidate skills/experience against job requirements.
Uses a 3-tier evaluation pipeline:
  1. Groq (Llama-3.3-70b-versatile)
  2. Google Gemini (gemini-1.5-flash) failover
  3. Offline Deterministic Heuristic Fallback Scorer
"""
import asyncio
from datetime import datetime
import json
import logging
import re
import time
import uuid
from typing import Optional

import google.generativeai as genai
from app.services.groq_client import SafeGroq as Groq, get_best_groq_model
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
Your only job is to evaluate how well a candidate's resume matches a job description and return a structured match score.
Be consistent — the same inputs must always produce the same score.
Return only a valid JSON object matching the requested schema.
"""

USER_PROMPT_TEMPLATE = """
You will be given a candidate's resume data and a job description.
Analyze them and return ONLY a valid JSON object — no explanation, no markdown.

════════════════════════════════════════
EVALUATION GUIDELINES
════════════════════════════════════════
Evaluate the candidate across these areas: Core Skills, Relevant Experience, Projects, Education, Certifications, and Overall Role Fit.

1. CORE SKILLS & TECH ALIASES:
   - Normalize technology aliases and equivalent names (e.g. React/ReactJS/React.js, AWS/Amazon Web Services, Postgres/PostgreSQL).
   - Distinguish related but different technologies (e.g. Java vs JavaScript, Docker vs Kubernetes, HTML vs CSS).
   - Treat required JD skills more importantly than preferred/nice-to-have skills.
   - Consider semantic matches (e.g., "FastAPI" and "building REST APIs"), but never claim a skill match without reasonable evidence.
   - Give more weight to skills demonstrated in Experience/Projects than skills appearing only in the list of Skills.
   - Do not reward keyword stuffing or repeated mentions. Do not invent missing skills.

2. EXPERIENCE & TIMELINES:
   - Calculate technology-specific experience from actual timelines of the jobs. Do not assume total career experience equals experience with every technology.
   - Use Projects as valid supporting evidence, especially for junior/fresher candidates, but distinguish projects from professional experience.
   - Do not invent missing experience or dates.

3. EDUCATION & CERTIFICATIONS:
   - Consider Education and Certifications only according to their relevance to the Job Description. Do not invent missing certifications or degrees.

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
   - Exact/Synonym match → full credit
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

════════════════════════════════════════
CRITICAL PENALTY RULE FOR MISSING CORE SKILLS
════════════════════════════════════════
If the candidate is COMPLETELY MISSING the primary core technical skill required by the Job Title (e.g. missing "Python" for a "Python Developer" role, or missing "React" for a "React Developer" role), you MUST apply the following penalty:
- Skills Score MUST be exactly 0.
- Title Score MUST be exactly 10.
- The overall final_score MUST NEVER exceed 40.0, regardless of experience or education.

100/100 should only be given when the candidate strongly satisfies essentially all important JD requirements.

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
- Experience Details:
{candidate_experience_details}
- Projects:
{candidate_projects}
- Certifications:
{candidate_certifications}
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


aliases = {
    "react": ["react", "reactjs", "react.js"],
    "javascript": ["javascript", "js", "ecmascript"],
    "typescript": ["typescript", "ts"],
    "postgresql": ["postgresql", "postgres"],
    "mongodb": ["mongodb", "mongo"],
    "aws": ["aws", "amazon web services"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "kubernetes": ["kubernetes", "k8s"],
    "node": ["node", "node.js", "nodejs"],
    "html": ["html", "html5"],
    "css": ["css", "css3"],
}

def normalize_skill(skill: str) -> str:
    s_clean = skill.strip().lower()
    for norm_name, alias_list in aliases.items():
        if s_clean in alias_list:
            return norm_name
    return s_clean

def skill_matches(cand_skill: str, req_skill: str) -> bool:
    cand_norm = normalize_skill(cand_skill)
    req_norm = normalize_skill(req_skill)
    if cand_norm == req_norm:
        return True
    if (cand_norm == "java" and req_norm == "javascript") or (cand_norm == "javascript" and req_norm == "java"):
        return False
    if (cand_norm == "docker" and req_norm == "kubernetes") or (cand_norm == "kubernetes" and req_norm == "docker"):
        return False
    if len(cand_norm) > 2 and len(req_norm) > 2:
        if cand_norm in req_norm or req_norm in cand_norm:
            return True
    return False

def get_experience_years_for_skill(rs_lower: str, candidate_experience: list) -> float:
    if not candidate_experience:
        return 0.0
    total_months = 0
    now = datetime.now()
    current_year = now.year
    current_month_name = now.strftime("%b")
    m_map = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
    
    for exp in candidate_experience:
        if hasattr(exp, 'model_dump'):
            exp = exp.model_dump()
        elif hasattr(exp, 'dict'):
            exp = exp.dict()
        desc = (exp.get("description", "") or "").lower()
        title = (exp.get("title", "") or "").lower()
        
        if rs_lower in desc or rs_lower in title or skill_matches(rs_lower, desc) or skill_matches(rs_lower, title):
            duration = str(exp.get('duration', '') or '').strip()
            if not duration:
                continue
            
            years_match = re.search(r'(\d+)\s*(?:yr|year|years?)', duration, re.IGNORECASE)
            months_match = re.search(r'(\d+)\s*(?:mo|month|months?)', duration, re.IGNORECASE)
            if years_match or months_match:
                if years_match:
                    total_months += int(years_match.group(1)) * 12
                if months_match:
                    total_months += int(months_match.group(1))
                continue
                
            norm = re.sub(
                r'\b(present|current|now|today)\b',
                f'{current_month_name} {current_year}',
                duration,
                flags=re.IGNORECASE,
            )
            years_found = re.findall(r'\b((?:19|20)\d{2})\b', norm)
            months_found = re.findall(r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b', norm.lower())
            
            if len(years_found) >= 2:
                try:
                    y1, y2 = int(years_found[0]), int(years_found[-1])
                    if y2 >= y1:
                        m1 = m_map.get(months_found[0], 1) if len(months_found) >= 1 else 1
                        m2 = m_map.get(months_found[-1], 12) if len(months_found) >= 2 else (m1 if len(months_found) == 1 else 12)
                        months_diff = (y2 - y1) * 12 + (m2 - m1) + 1
                        total_months += max(1, months_diff)
                except Exception:
                    pass
            elif len(years_found) == 1:
                total_months += 1
                
    return round(total_months / 12.0, 1)

def compute_heuristic_match_score(
    candidate_skills: list[str],
    candidate_title: Optional[str],
    years_experience: Optional[float],
    candidate_education: list[dict],
    job,
    match_threshold: float = 70.0,
    note: str = "",
    candidate_experience: list[dict] = None,
    candidate_projects: list[dict] = None,
    candidate_certifications: list[str] = None
) -> tuple[float, dict]:
    """
    Deterministic offline heuristic scorer used when AI services fail or are unconfigured.
    Calculates actual candidate-to-job match metrics based on resume vs JD.
    """
    if not job:
        return 0.0, {
            "final_score": 0.0,
            "skills_score": 0,
            "title_score": 0,
            "experience_score": 0,
            "education_score": 0,
            "matched_skills": [],
            "missing_skills": [],
            "shortlisted": False,
            "reasoning": "No Job Description associated for scoring."
        }

    req_skills_raw = getattr(job, "skills_required", []) or []
    req_skills = [s.strip() for s in req_skills_raw if isinstance(s, str) and s.strip()]
    job_title = (getattr(job, "title", "") or "").strip()
    job_title_lower = job_title.lower()

    # Standard skill blueprints for common role titles when req_skills is sparse (< 3)
    domain_blueprints = {
        "python": ["Python", "FastAPI", "Django", "SQL", "PostgreSQL", "Git", "REST API", "Docker"],
        "react": ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Tailwind", "Redux", "Git"],
        "javascript": ["JavaScript", "React", "Node.js", "TypeScript", "HTML", "CSS", "Express", "Git"],
        "java": ["Java", "Spring Boot", "MySQL", "Hibernate", "Microservices", "Git", "REST API"],
        "node": ["Node.js", "Express", "JavaScript", "TypeScript", "MongoDB", "SQL", "REST API"],
        "devops": ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux", "Terraform", "Git"],
        "data": ["Python", "SQL", "Pandas", "NumPy", "Machine Learning", "Scikit-Learn", "Tableau"],
        "sales": ["Sales", "B2B", "CRM", "Lead Generation", "Communication", "Negotiation", "Excel"],
        "business development": ["Business Development", "B2B", "Sales", "Lead Generation", "Client Acquisition", "CRM"]
    }

    if len(req_skills) < 3:
        job_desc = (getattr(job, "description", "") or "").lower()
        full_jd_text = f"{job_title_lower} {job_desc}"
        
        # 1. Expand from domain blueprints if role matches
        for domain_key, blueprint in domain_blueprints.items():
            if domain_key in job_title_lower:
                for bp_skill in blueprint:
                    if bp_skill not in req_skills:
                        req_skills.append(bp_skill)
                break

        # 2. Extract additional tech keywords from JD description
        tech_bank = [
            "python", "javascript", "typescript", "react", "node.js", "java", "c++", "c#",
            "sql", "postgresql", "mysql", "mongodb", "redis", "aws", "docker", "kubernetes",
            "html", "css", "git", "fastapi", "django", "flask", "express", "next.js",
            "tailwind", "rest api", "graphql", "go", "rust", "php", "ruby", "angular", "vue"
        ]
        for kw in tech_bank:
            if re.search(r'\b' + re.escape(kw) + r'\b', full_jd_text):
                if kw.title() not in req_skills:
                    req_skills.append(kw.title())

    cand_skills = [s.strip() for s in (candidate_skills or []) if isinstance(s, str) and s.strip()]
    cand_skills_lower = [s.lower() for s in cand_skills]

    matched_skills = []
    missing_skills = []
    has_relevant_certification = False
    
    # Check if we have rich experience or projects details
    has_details = False
    if (candidate_experience and len(candidate_experience) > 0) or (candidate_projects and len(candidate_projects) > 0):
        has_details = True

    earned_credits = 0.0
    if req_skills:
        for rs in req_skills:
            rs_lower = rs.lower()
            
            # Check experience descriptions/titles
            in_experience = False
            if candidate_experience:
                for exp in candidate_experience:
                    if hasattr(exp, 'model_dump'):
                        exp = exp.model_dump()
                    elif hasattr(exp, 'dict'):
                        exp = exp.dict()
                    desc = (exp.get("description", "") or "").lower()
                    title = (exp.get("title", "") or "").lower()
                    if rs_lower in desc or rs_lower in title or skill_matches(rs_lower, desc) or skill_matches(rs_lower, title):
                        in_experience = True
                        break

            # Check projects
            in_projects = False
            if candidate_projects:
                for proj in candidate_projects:
                    p_desc = (proj.get("description", "") or "").lower()
                    p_name = (proj.get("name", "") or "").lower()
                    p_techs = [str(t).lower() for t in proj.get("technologies", [])]
                    if (any(t == rs_lower or skill_matches(rs_lower, t) for t in p_techs) or 
                        rs_lower in p_desc or rs_lower in p_name):
                        in_projects = True
                        break

            # Check certifications
            in_certifications = False
            if candidate_certifications:
                for cert in candidate_certifications:
                    if rs_lower in cert.lower() or skill_matches(rs_lower, cert):
                        in_certifications = True
                        has_relevant_certification = True
                        break

            # Check skills list
            in_skills = any(cs == rs_lower or skill_matches(cs, rs_lower) for cs in cand_skills_lower)

            if in_skills or in_experience or in_projects or in_certifications:
                matched_skills.append(rs)
                # If we have details, give more weight to skills in experience/projects
                if has_details:
                    if in_experience or in_projects:
                        earned_credits += 1.0
                    else:
                        earned_credits += 0.7
                else:
                    earned_credits += 1.0
            else:
                missing_skills.append(rs)
                
        raw_skills_score = (earned_credits / len(req_skills)) * 100.0
        breadth_bonus = min(10.0, len(cand_skills) * 0.5)
        skills_score = min(100.0, round(raw_skills_score + breadth_bonus, 1))
    else:
        matched_skills = cand_skills[:5]
        missing_skills = []
        skills_score = 50.0 if cand_skills else 0.0

    # Title score with granular seniority evaluation
    cand_title = (candidate_title or "").strip()
    cand_title_lower = cand_title.lower()
    
    if not cand_title_lower:
        title_score = 30.0
    elif job_title_lower == cand_title_lower:
        title_score = 100.0
    else:
        job_words = set(re.findall(r'\w+', job_title_lower))
        cand_words = set(re.findall(r'\w+', cand_title_lower))
        overlap = job_words.intersection(cand_words)
        if overlap:
            title_score = 70.0
            if "intern" in cand_title_lower and "intern" not in job_title_lower:
                title_score = 45.0
            elif "senior" in cand_title_lower and "senior" in job_title_lower:
                title_score = 95.0
        else:
            title_score = 25.0

    # Experience score smooth scaling
    req_years = float(getattr(job, "min_experience_years", 0) or 0)
    cand_years = float(years_experience) if years_experience is not None else 0.0

    if req_years > 0:
        if cand_years >= req_years:
            experience_score = 100.0
        else:
            diff = req_years - cand_years
            experience_score = max(0.0, round(100.0 - (diff * 20.0), 1))
    else:
        if cand_years >= 5.0:
            experience_score = 100.0
        elif cand_years >= 2.0:
            experience_score = 85.0
        elif cand_years >= 1.0:
            experience_score = 70.0
        elif cand_years >= 0.5:
            experience_score = 55.0
        else:
            experience_score = 40.0

    # Education score
    education_score = 50.0
    if candidate_education and len(candidate_education) > 0:
        education_score = 80.0
    if has_relevant_certification:
        education_score = min(100.0, education_score + 20.0)

    # Critical penalty rule if missing core skills
    if req_skills and len(matched_skills) == 0:
        skills_score = 0.0
        title_score = min(title_score, 30.0)

    primary_skills = ["python", "react", "java", "javascript", "node", "devops", "sales"]
    primary_skill_required = None
    for p_skill in primary_skills:
        if p_skill in job_title_lower:
            primary_skill_required = p_skill
            break
            
    has_primary_skill = True
    if primary_skill_required:
        has_primary_skill = any(
            skill_matches(cs, primary_skill_required) for cs in cand_skills
        ) or any(
            primary_skill_required in (exp.get("description", "") or "").lower() or 
            primary_skill_required in (exp.get("title", "") or "").lower()
            for exp in (candidate_experience or [])
        )
        if not has_primary_skill:
            skills_score = 0.0
            title_score = 10.0

    # Calculate technology-specific experience for primary core skill
    if primary_skill_required and req_years > 0 and has_primary_skill:
        primary_years = get_experience_years_for_skill(primary_skill_required, candidate_experience)
        if primary_years > 0.0 and primary_years < req_years:
            diff = req_years - primary_years
            experience_score = min(experience_score, max(0.0, round(100.0 - (diff * 20.0), 1)))

    final_score = round(
        (skills_score * 0.50) +
        (title_score * 0.20) +
        (experience_score * 0.20) +
        (education_score * 0.10),
        1
    )

    if primary_skill_required and not has_primary_skill:
        final_score = min(40.0, final_score)

    shortlisted = final_score >= match_threshold
    
    reasoning_str = (
        f"OVERALL ALIGNMENT: Candidate matched {len(matched_skills)} of {len(req_skills)} required skills ({skills_score}% skills match).\n"
        f"STRENGTHS: Skills matched: {', '.join(matched_skills) if matched_skills else 'None'}. Experience: {cand_years} yrs vs required {req_years} yrs.\n"
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
    if not job:
        return None, {
            "final_score": None,
            "skills_score": None,
            "title_score": None,
            "experience_score": None,
            "education_score": None,
            "matched_skills": [],
            "missing_skills": [],
            "shortlisted": False,
            "reasoning": "No Job Description associated for scoring."
        }

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

    # Format experience entries
    exp_list = candidate_data.get("experience", [])
    exp_formatted = []
    for exp in exp_list:
        if hasattr(exp, 'model_dump'):
            exp = exp.model_dump()
        elif hasattr(exp, 'dict'):
            exp = exp.dict()
        title = exp.get("title", "")
        company = exp.get("company", "")
        duration = exp.get("duration", "")
        desc = exp.get("description", "")
        exp_formatted.append(f"- Role: {title} at {company} ({duration})\n  Description: {desc}")
    exp_str = "\n".join(exp_formatted) if exp_formatted else "None specified"

    # Format projects
    proj_list = candidate_data.get("projects", [])
    proj_formatted = []
    for proj in proj_list:
        name = proj.get("name", "")
        desc = proj.get("description", "")
        tech = ", ".join(proj.get("technologies", []))
        proj_formatted.append(f"- Project: {name}\n  Technologies: {tech}\n  Description: {desc}")
    proj_str = "\n".join(proj_formatted) if proj_formatted else "None specified"

    # Format certifications
    cert_list = candidate_data.get("certifications", [])
    cert_str = ", ".join(cert_list) if cert_list else "None specified"

    prompt = USER_PROMPT_TEMPLATE.format(
        job_title=getattr(job, "title", "Role"),
        required_years=getattr(job, "min_experience_years", 0) or 0,
        required_skills=req_skills_str,
        required_education="Not specified",
        
        candidate_name=candidate_data.get("full_name", "Candidate"),
        candidate_title=candidate_data.get("current_title", "None"),
        candidate_years=years_experience if years_experience is not None else "Not specified",
        candidate_skills=", ".join(candidate_skills) if candidate_skills else "None",
        candidate_experience_details=exp_str,
        candidate_projects=proj_str,
        candidate_certifications=cert_str,
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
                model=get_best_groq_model(groq_client),
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
        note="(Evaluated via deterministic heuristic fallback engine).",
        candidate_experience=exp_list if isinstance(exp_list, list) else [],
        candidate_projects=proj_list if isinstance(proj_list, list) else [],
        candidate_certifications=cert_list if isinstance(cert_list, list) else []
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
