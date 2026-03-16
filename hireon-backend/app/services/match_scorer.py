"""
AI match scoring: compare candidate skills/experience against job requirements.
Uses Google Gemini text-embedding-004 for semantic similarity + rule-based boosters.
"""
import logging
import numpy as np
from typing import Optional

import google.generativeai as genai
from mistralai import Mistral

from app.config import settings

logger = logging.getLogger(__name__)

# Initialize clients
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)

mistral_client = Mistral(api_key=settings.mistral_api_key) if settings.mistral_api_key else None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    a_arr = np.array(a)
    b_arr = np.array(b)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


def build_candidate_text(parsed_data: dict, skills: list[str], years_experience: Optional[int]) -> str:
    """Build a text representation of the candidate for embedding."""
    parts = []
    if parsed_data.get("summary"):
        parts.append(parsed_data["summary"])
    if skills:
        parts.append("Skills: " + ", ".join(skills))
    if years_experience:
        parts.append(f"Experience: {years_experience} years")
    if parsed_data.get("current_title"):
        parts.append(f"Current role: {parsed_data['current_title']}")
    for exp in parsed_data.get("experience", [])[:3]:
        parts.append(f"{exp.get('title', '')} at {exp.get('company', '')}: {exp.get('description', '')[:200]}")
    return " | ".join(parts)


def build_job_text(job) -> str:
    """Build a text representation of the job for embedding."""
    parts = [
        job.title,
        job.description[:1000] if job.description else "",
    ]
    if job.requirements:
        parts.append(job.requirements[:500])
    if job.skills_required:
        parts.append("Required skills: " + ", ".join(job.skills_required))
    if job.experience_level:
        parts.append(f"Level: {job.experience_level}")
    return " | ".join(p for p in parts if p)


import re

# ─── Canonical skills dictionary ─────────────────────────────────────────────────
# Maps common aliases/variants → canonical name for accurate overlap matching

_SKILL_ALIASES: dict[str, list[str]] = {
    "react": ["reactjs", "react.js", "react js", "react hooks", "react (hooks)", "react/redux"],
    "vue": ["vuejs", "vue.js", "vue js", "vue 3", "vue3"],
    "angular": ["angularjs", "angular.js", "angular 2", "angular2"],
    "node": ["nodejs", "node.js", "node js"],
    "express": ["expressjs", "express.js", "express js"],
    "next": ["nextjs", "next.js", "next js"],
    "nuxt": ["nuxtjs", "nuxt.js"],
    "typescript": ["ts", "type script"],
    "javascript": ["js", "es6", "es2015", "es2016", "es2017", "ecmascript", "vanilla js", "vanilla javascript"],
    "python": ["python3", "python 3", "python2", "python 2", "python programming", "python language"],
    "postgresql": ["postgres", "psql", "pg", "postgre"],
    "mongodb": ["mongo", "mongo db"],
    "mysql": ["my sql"],
    "redis": ["redis cache"],
    "elasticsearch": ["elastic search", "elastic"],
    "kubernetes": ["k8s", "kube"],
    "docker": ["dockerfile", "docker compose", "dockercompose"],
    "aws": ["amazon web services", "amazon aws", "aws cloud", "aws services", "amazon cloud", "amazon sagemaker", "aws ec2", "aws s3", "aws lambda", "ec2", "s3", "lambda", "sagemaker"],
    "gcp": ["google cloud", "google cloud platform", "google cloud services"],
    "azure": ["microsoft azure", "azure cloud"],
    "graphql": ["gql", "graph ql"],
    "rest": ["restful", "rest api", "restful api", "rest apis", "restful apis", "restful api development", "rest-api", "rest framework", "django rest framework", "drf"],
    "machine learning": ["ml", "machine-learning", "machine learning algorithms", "ml models", "ai/ml", "ai ml", "ai & ml"],
    "deep learning": ["dl", "deep-learning"],
    "natural language processing": ["nlp"],
    "computer vision": ["cv"],
    "tensorflow": ["tf", "tensor flow"],
    "pytorch": ["torch"],
    "scikit-learn": ["sklearn", "scikit learn", "scikit"],
    "tailwind": ["tailwindcss", "tailwind css"],
    "fastapi": ["fast api", "fast-api"],
    "spring": ["spring boot", "springboot", "spring framework"],
    "go": ["golang"],
    "rust": ["rust lang"],
    "c++": ["cpp", "c plus plus", "cplusplus"],
    "c#": ["csharp", "c sharp", "dotnet c#"],
    "dotnet": [".net", "dot net", "asp.net", "aspnet"],
    "ruby": ["ruby on rails", "rails", "ror"],
    "php": [],
    "swift": [],
    "kotlin": [],
    "scala": [],
    "r": ["r language", "r programming"],
    "flutter": [],
    "react native": ["reactnative", "react-native"],
    "redux": [],
    "graphql": ["apollo", "apollo client"],
    "git": ["github", "gitlab", "bitbucket", "version control", "git/github", "git & github", "source control"],
    "ci/cd": ["cicd", "ci cd", "continuous integration", "continuous deployment", "github actions", "jenkins"],
    "terraform": ["infrastructure as code", "iac"],
    "linux": ["unix", "ubuntu", "debian", "centos"],
    # AI/ML
    "llm": ["large language models", "large language model", "llms"],
    "genai": ["generative ai", "gen ai", "generative-ai"],
    "langchain": ["lang chain"],
    "openai": ["open ai", "chatgpt", "gpt-4", "gpt4"],
    "nlp": ["natural language processing", "text processing"],
    "computer vision": ["cv", "image recognition", "object detection"],
    # Sales / BDE
    "sales": ["sales & lead generation", "b2b sales", "b2c sales", "inside sales", "outbound sales"],
    "lead generation": ["lead gen", "lead-generation", "leads generation"],
    "crm": ["customer relationship management", "zoho crm", "salesforce crm", "hubspot crm", "hubspot"],
    "linkedin outreach": ["linkedin", "linkedin sales navigator", "linkedin outreach", "linkedin prospecting"],
    "linkedin": ["linkedin sales navigator", "linkedin outreach", "linkedin prospecting"],
    "email outreach": ["cold email", "email marketing"],
    "business development": ["biz dev", "bd", "business development executive", "bde", "business growth", "b2b business development"],
    "market research": ["market analysis"],
    "negotiation": ["negotiation skills"],
    "communication": ["communication skills", "verbal communication", "written communication"],
    "excel": ["ms excel", "microsoft excel", "spreadsheets"],
    "word": ["ms word", "microsoft word"],
    "powerpoint": ["ms powerpoint", "microsoft powerpoint", "presentations"],
}

# Build reverse lookup: alias → canonical
_SKILL_CANONICAL: dict[str, str] = {}
for _canonical, _aliases in _SKILL_ALIASES.items():
    _SKILL_CANONICAL[_canonical] = _canonical
    for _alias in _aliases:
        _SKILL_CANONICAL[_alias] = _canonical


def normalize_skill(skill: str) -> str:
    """Normalize skill name using canonical dictionary + cleanup rules."""
    s = skill.lower().strip()
    # Remove text in parentheses
    s = re.sub(r'\(.*?\)', '', s).strip()
    # Remove trailing dot
    s = s.rstrip('.')

    # Check canonical map first (before any stripping)
    if s in _SKILL_CANONICAL:
        return _SKILL_CANONICAL[s]

    # Cleanup suffixes
    s = s.replace(".js", "").replace(" js", "").replace("-", "").replace(".", "")
    s = s.replace("language", "").replace("tech", "")
    if s.endswith("js") and len(s) > 2:
        s = s[:-2]
    s = re.sub(r'(js|ts|css|html)(\d+)$', r'\1', s)
    s = re.sub(r'(\D+)(\d+\.?\d*)$', r'\1', s)
    s = s.strip()

    # Check canonical map again after cleanup
    if s in _SKILL_CANONICAL:
        return _SKILL_CANONICAL[s]

    return s


def title_match_bonus(candidate_title: Optional[str], job_title: str) -> float:
    """Bonus for title similarity (0-10)."""
    if not candidate_title or not job_title:
        return 0.0
    c_lower = candidate_title.lower()
    j_lower = job_title.lower()
    
    # Direct match or containment
    if c_lower == j_lower:
        return 10.0
    if c_lower in j_lower or j_lower in c_lower:
        return 8.0
        
    # Keyword overlap (Developer, Engineer, etc.)
    significant_keywords = {"developer", "engineer", "designer", "manager", "lead", "architect", "analyst"}
    c_words = set(re.findall(r'\w+', c_lower))
    j_words = set(re.findall(r'\w+', j_lower))
    overlap = c_words & j_words
    
    if overlap:
        bonus = len(overlap) * 4.0
        # Boost if they share a significant professional keyword
        if overlap & significant_keywords:
            bonus += 2.0
        return min(7.0, bonus)
        
    return 0.0


# Skills that imply other skills — if candidate has key, also credit values
_IMPLIED_SKILLS: dict[str, list[str]] = {
    "react":         ["javascript"],
    "angular":       ["javascript", "typescript"],
    "vue":           ["javascript"],
    "next":          ["javascript", "react"],
    "node":          ["javascript"],
    "express":       ["javascript", "node"],
    "nestjs":        ["javascript", "typescript", "node"],
    "react native":  ["javascript", "react"],
    "django":        ["python"],
    "fastapi":       ["python"],
    "flask":         ["python"],
    "spring":        ["java"],
    "laravel":       ["php"],
    "rails":         ["ruby"],
    "mean stack":    ["mongodb", "express", "angular", "node", "javascript"],
    "mern stack":    ["mongodb", "express", "react", "node", "javascript"],
    "aws":           ["cloud"],
    "gcp":           ["cloud"],
    "azure":         ["cloud"],
}


def _expand_compound_skills(skills: list[str]) -> list[str]:
    """Split compound skills like 'Sales & Lead Generation', 'Django/Flask', 'AI/ML'."""
    expanded = []
    for skill in skills:
        if skill and re.search(r'\s*[&/]\s*|\s+and\s+', skill, re.IGNORECASE):
            parts = re.split(r'\s*[&/]\s*|\s+and\s+', skill, flags=re.IGNORECASE)
            expanded.extend(p.strip() for p in parts if p.strip())
        else:
            expanded.append(skill)
    return expanded


def _add_implied_skills(candidate_norm: set[str]) -> set[str]:
    """Expand candidate skill set with implied skills (e.g. Angular → JavaScript)."""
    implied = set()
    for skill in list(candidate_norm):
        for implied_skill in _IMPLIED_SKILLS.get(skill, []):
            implied.add(implied_skill)
    return candidate_norm | implied


def skill_overlap_boost(candidate_skills: list[str], job_skills: list[str]) -> float:
    """Bonus score (0-25) based on fuzzy skill overlap."""
    if not job_skills:
        return 0.0

    candidate_expanded = _expand_compound_skills(candidate_skills)
    job_expanded = _expand_compound_skills(job_skills)

    candidate_norm = {normalize_skill(s) for s in candidate_expanded if s}
    job_norm = {normalize_skill(s) for s in job_expanded if s}
    candidate_norm.discard("")
    job_norm.discard("")

    # Credit implied skills (e.g. Angular → JavaScript inferred)
    candidate_norm = _add_implied_skills(candidate_norm)

    if not job_norm:
        return 0.0

    overlap = len(candidate_norm & job_norm)
    ratio = overlap / len(job_norm)
    return min(25.0, ratio * 25.0)


def compute_score_breakdown(
    candidate_skills: list[str],
    parsed_data: dict,
    years_experience: Optional[int],
    job_skills: list[str],
    job_title: str,
    score: float,
    match_threshold: float,
) -> dict:
    """
    Returns rich scoring breakdown dict to store alongside a match score.
    Uses the same canonical normalization as the ML scorer for consistency.
    """
    candidate_expanded = _expand_compound_skills(candidate_skills)
    job_expanded = _expand_compound_skills(job_skills)
    candidate_norm = {normalize_skill(s) for s in candidate_expanded if s}
    candidate_norm.discard("")
    candidate_norm = _add_implied_skills(candidate_norm)

    # Match each job skill, keeping the original display name
    seen_norm = set()
    matched_display = []
    for orig in job_expanded:
        norm = normalize_skill(orig)
        if norm and norm not in seen_norm and norm in candidate_norm:
            seen_norm.add(norm)
            matched_display.append(orig.title())

    # Inferred: candidate skills not in required skills
    req_norm = {normalize_skill(s) for s in job_skills if s}
    inferred = [
        s for s in candidate_skills
        if normalize_skill(s) not in req_norm
    ][:6]

    years = float(years_experience or 0)
    if years < 2:
        level = "Junior"
    elif years < 5:
        level = "Mid"
    elif years < 10:
        level = "Senior"
    else:
        level = "Lead"

    shortlisted = score >= match_threshold
    match_confidence = min(99, max(10, int(score * 0.85 + (3 if shortlisted else -10))))

    return {
        "matched_skills": matched_display,
        "inferred_skills": inferred,
        "level": level,
        "shortlisted": shortlisted,
        "match_confidence": match_confidence,
    }


async def compute_match_score(
    candidate_skills: list[str],
    parsed_data: dict,
    years_experience: Optional[int],
    job,
) -> float:
    """
    Compute 0-100 match score between a candidate and a job.
    = semantic similarity (0-85) + skill overlap bonus (0-15)
    """
    # ── Hard filters — eliminate obvious mismatches before any API call ──────────
    # Filter 1: experience too low (< 50% of required)
    if (
        job.min_experience_years
        and job.min_experience_years > 0
        and years_experience is not None
        and years_experience < job.min_experience_years * 0.5
    ):
        boost = skill_overlap_boost(candidate_skills, job.skills_required or [])
        return round(min(30.0, 10.0 + boost), 1)

    # Filter 2: zero skill overlap — candidate has none of the required skills
    if job.skills_required:
        job_norm = {normalize_skill(s) for s in _expand_compound_skills(job.skills_required) if s}
        cand_norm = {normalize_skill(s) for s in _expand_compound_skills(candidate_skills) if s}
        job_norm.discard("")
        cand_norm.discard("")
        cand_norm = _add_implied_skills(cand_norm)
        if job_norm and not (job_norm & cand_norm):
            return round(min(25.0, 10.0 + len(candidate_skills) * 0.5), 1)
    # ─────────────────────────────────────────────────────────────────────────────

    if not mistral_client and not settings.gemini_api_key:
        # Fallback: pure skill overlap scoring
        if not job.skills_required:
            return 50.0
        boost = skill_overlap_boost(candidate_skills, job.skills_required)
        return min(100.0, 30.0 + boost * 4)

    try:
        candidate_text = build_candidate_text(parsed_data or {}, candidate_skills, years_experience)
        job_text = build_job_text(job)

        similarity = 0.0

        # Try Mistral first
        if mistral_client:
            try:
                res = await mistral_client.embeddings.create_async(
                    model="mistral-embed-2312",
                    inputs=[candidate_text, job_text]
                )
                embeddings = [e.embedding for e in res.data]
                similarity = cosine_similarity(embeddings[0], embeddings[1])
            except Exception as me:
                logger.warning(f"Mistral embedding failed, falling back to Gemini: {me}")
                if settings.gemini_api_key:
                    result = genai.embed_content(
                        model="models/text-embedding-004",
                        content=[candidate_text, job_text],
                        task_type="SEMANTIC_SIMILARITY",
                    )
                    embeddings = result["embedding"]
                    similarity = cosine_similarity(embeddings[0], embeddings[1])
                else:
                    raise me
        
        # Fallback to Gemini if Mistral not configured
        elif settings.gemini_api_key:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=[candidate_text, job_text],
                task_type="SEMANTIC_SIMILARITY",
            )
            embeddings = result["embedding"]
            similarity = cosine_similarity(embeddings[0], embeddings[1])

        # semantic_score: (0-1) -> (0-55)
        # Shift similarity to be more generous: anything > 0.4 is "relevant"
        adj_similarity = max(0.0, (similarity - 0.3) / 0.7)
        semantic_score = adj_similarity * 65.0
        
        # Bonuses
        skill_boost = skill_overlap_boost(candidate_skills, job.skills_required or [])
        title_boost = title_match_bonus(parsed_data.get("current_title") if parsed_data else None, job.title)
        
        final_score = min(100.0, semantic_score + skill_boost + title_boost)
        
        # Minimum score for valid candidates
        if final_score < 30.0 and (skill_boost > 5.0 or title_boost > 3.0):
             final_score = 30.0 + (skill_boost / 2.0)

        return round(final_score, 1)

    except Exception as e:
        logger.error(f"Match scoring failed: {e}")
        # Graceful fallback
        boost = skill_overlap_boost(candidate_skills, job.skills_required or [])
        return round(min(100.0, 35.0 + boost * 2), 1)
