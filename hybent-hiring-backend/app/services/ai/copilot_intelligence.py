"""
Copilot Intelligence Layer
==========================
Provides NLP pre-processing for the Recruiter Copilot:
  1. Abbreviation expansion   — BDE → Business Development Executive
  2. Role normalization        — synonym groups for similar job titles
  3. Fuzzy typo correction     — Laraval → Laravel, Pyhton → Python
  4. Intent extraction         — experience range, location, notice, salary
  5. Query pre-processing      — returns structured SearchIntent from raw user text

Uses only Python standard library (difflib) — no extra dependencies required.
"""

import re
import difflib
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ── 1. Abbreviation Expansion Map ────────────────────────────────────────────
# Maps lowercase abbreviation → expanded full form used in search
# Add new entries as needed — lookup is O(1)

ABBREVIATION_MAP: dict[str, str] = {
    # Business roles
    "bde": "Business Development Executive",
    "bdm": "Business Development Manager",
    "bd": "Business Development",
    "bd executive": "Business Development Executive",
    "bd manager": "Business Development Manager",
    # Engineering
    "sde": "Software Development Engineer",
    "sde1": "Software Development Engineer",
    "sde2": "Software Development Engineer",
    "sde3": "Software Development Engineer",
    "sr sde": "Senior Software Development Engineer",
    "jr sde": "Junior Software Development Engineer",
    "sde i": "Software Development Engineer",
    "sde ii": "Software Development Engineer",
    "sde iii": "Software Development Engineer",
    # QA / Testing
    "qa": "Quality Assurance",
    "qae": "Quality Assurance Engineer",
    "sqa": "Senior Quality Assurance",
    "sqe": "Senior Quality Engineer",
    "qat": "Quality Assurance Tester",
    "qam": "Quality Assurance Manager",
    # HR
    "hr": "Human Resources",
    "hrbp": "HR Business Partner",
    "hrm": "HR Manager",
    "hro": "HR Officer",
    "ta": "Talent Acquisition",
    "tam": "Talent Acquisition Manager",
    "tae": "Talent Acquisition Executive",
    # Management
    "pm": "Product Manager",
    "po": "Product Owner",
    "ba": "Business Analyst",
    "bsa": "Business Systems Analyst",
    "tl": "Team Lead",
    "em": "Engineering Manager",
    "dm": "Delivery Manager",
    "am": "Account Manager",
    "csm": "Customer Success Manager",
    # C-Suite
    "cto": "Chief Technology Officer",
    "ceo": "Chief Executive Officer",
    "cfo": "Chief Financial Officer",
    "coo": "Chief Operating Officer",
    "cpo": "Chief Product Officer",
    "cmo": "Chief Marketing Officer",
    "cso": "Chief Security Officer",
    "ciso": "Chief Information Security Officer",
    # Design
    "ui": "UI Designer",
    "ux": "UX Designer",
    "ui/ux": "UI UX Designer",
    "ux/ui": "UI UX Designer",
    "uiux": "UI UX Designer",
    "vd": "Visual Designer",
    "gd": "Graphic Designer",
    # Tech stacks (used as search synonyms)
    "mern": "MongoDB Express React Node",
    "mean": "MongoDB Express Angular Node",
    "lamp": "Linux Apache MySQL PHP",
    "rn": "React Native",
    # Languages (keep short — used as search terms)
    "js": "JavaScript",
    "ts": "TypeScript",
    "py": "Python",
    # AI / ML
    "ml": "Machine Learning",
    "ai": "Artificial Intelligence",
    "dl": "Deep Learning",
    "nlp": "Natural Language Processing",
    "cv": "Computer Vision",
    "genai": "Generative AI",
    "llm": "Large Language Model",
    # Data roles
    "ds": "Data Science",
    "da": "Data Analyst",
    "de": "Data Engineer",
    "bi": "Business Intelligence",
    "dw": "Data Warehouse",
    # Cloud / Infra
    "aws": "Amazon Web Services",
    "gcp": "Google Cloud Platform",
    "devops": "DevOps",
    "sre": "Site Reliability Engineer",
    # DB
    "dba": "Database Administrator",
    "sql": "SQL Database",
    # Frameworks / Tech
    "ror": "Ruby on Rails",
    "sb": "Spring Boot",
    "ff": "FastAPI",
    # Mobile
    "rn dev": "React Native Developer",
    "ios dev": "iOS Developer",
    "android dev": "Android Developer",
}

# ── 2. Fuzzy Correction Dictionary ────────────────────────────────────────────
# All known skills/tech/role words for fuzzy matching.
# Typos are matched against this list using difflib.

KNOWN_WORDS: list[str] = [
    # Languages
    "python", "javascript", "typescript", "java", "kotlin", "swift", "go", "rust",
    "ruby", "php", "scala", "perl", "dart", "r", "matlab", "c", "c++", "c#",
    # Frontend
    "react", "angular", "vue", "nextjs", "nuxtjs", "svelte", "jquery",
    # Backend
    "node", "nodejs", "express", "fastapi", "django", "flask", "spring",
    "laravel", "rails", "aspnet", "nestjs", "hapi",
    # Mobile
    "flutter", "reactnative", "android", "ios", "swift", "kotlin",
    # Database
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "dynamodb", "oracle", "mssql", "sqlite", "neo4j", "firebase",
    # Cloud / Infra
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "cicd", "devops", "linux", "nginx",
    # AI / ML
    "tensorflow", "pytorch", "sklearn", "pandas", "numpy", "opencv", "keras",
    "langchain", "openai", "huggingface",
    # Job roles
    "developer", "engineer", "analyst", "manager", "executive", "designer",
    "architect", "lead", "senior", "junior", "fresher", "intern",
    "recruiter", "consultant", "specialist", "coordinator",
    # HR roles
    "recruitment", "talent", "acquisition", "onboarding", "payroll",
    # Business
    "sales", "marketing", "business", "development", "operations",
    "finance", "accounting", "legal", "compliance",
    # Common attributes
    "remote", "hybrid", "fulltime", "parttime", "contract", "freelance",
    "immediate", "notice", "fresher", "experienced", "experience", "years", "year", "skills", "skill",
    # Company types
    "startup", "mnc", "product", "service",
]

# ── 3. Role Synonym Groups ────────────────────────────────────────────────────
# Each entry: canonical_name → list of synonyms (all lowercase)
# During search, we expand the query to include all synonyms.

ROLE_SYNONYMS: dict[str, list[str]] = {
    "software engineer": [
        "software developer", "backend developer", "backend engineer",
        "programmer", "developer", "sde", "engineer", "coder",
        "application developer", "application engineer",
    ],
    "frontend developer": [
        "frontend engineer", "ui developer", "react developer",
        "angular developer", "vue developer", "javascript developer",
        "web developer", "ui engineer", "client side developer",
    ],
    "fullstack developer": [
        "full stack developer", "full-stack developer",
        "fullstack engineer", "full stack engineer", "mern developer",
        "mean developer", "web developer",
    ],
    "business development executive": [
        "sales executive", "bd executive", "business executive",
        "bde", "sales representative", "sales rep", "account executive",
        "business development representative", "bdr",
    ],
    "business development manager": [
        "sales manager", "bd manager", "bdm", "regional manager",
        "territory manager", "area sales manager",
    ],
    "data scientist": [
        "data science engineer", "ml engineer", "machine learning engineer",
        "ai engineer", "data analyst", "research scientist",
    ],
    "product manager": [
        "product owner", "pm", "po", "product lead", "product head",
        "group product manager", "senior product manager",
    ],
    "quality assurance engineer": [
        "qa engineer", "test engineer", "sqa engineer", "tester",
        "automation tester", "manual tester", "qa analyst",
        "software tester", "quality engineer",
    ],
    "devops engineer": [
        "sre", "site reliability engineer", "platform engineer",
        "infrastructure engineer", "cloud engineer", "build engineer",
        "release engineer", "ci/cd engineer",
    ],
    "hr manager": [
        "human resources manager", "hr head", "hr business partner",
        "people operations manager", "talent manager",
    ],
    "talent acquisition": [
        "recruiter", "technical recruiter", "hr recruiter",
        "recruitment specialist", "talent scout", "sourcer",
    ],
    "ui ux designer": [
        "ux designer", "ui designer", "product designer",
        "interaction designer", "visual designer", "web designer",
        "graphic designer", "ui/ux designer",
    ],
    "android developer": [
        "android engineer", "kotlin developer", "java android developer",
        "mobile developer", "mobile engineer",
    ],
    "ios developer": [
        "ios engineer", "swift developer", "objective-c developer",
        "mobile developer", "apple developer",
    ],
    "react native developer": [
        "rn developer", "cross platform developer", "mobile developer",
        "hybrid app developer",
    ],
    "data engineer": [
        "etl developer", "data pipeline engineer", "big data engineer",
        "spark developer", "hadoop developer",
    ],
    "business analyst": [
        "ba", "systems analyst", "business systems analyst",
        "functional analyst", "requirements analyst",
    ],
    "project manager": [
        "scrum master", "agile coach", "delivery manager",
        "program manager", "engagement manager",
    ],
    "technical lead": [
        "tech lead", "team lead", "tl", "engineering lead",
        "development lead", "architect", "principal engineer",
    ],
    "cloud architect": [
        "aws architect", "azure architect", "gcp architect",
        "solutions architect", "cloud engineer",
    ],
    "database administrator": [
        "dba", "database admin", "sql dba", "oracle dba",
        "mysql dba", "postgresql admin",
    ],
    "cybersecurity engineer": [
        "security engineer", "information security", "infosec",
        "penetration tester", "pen tester", "ethical hacker",
        "security analyst", "ciso",
    ],
    "erp consultant": [
        "sap consultant", "oracle consultant", "salesforce developer",
        "salesforce consultant", "dynamics consultant",
    ],
}

# Build reverse lookup: synonym → canonical
_SYNONYM_REVERSE: dict[str, str] = {}
for canonical, synonyms in ROLE_SYNONYMS.items():
    for syn in synonyms:
        _SYNONYM_REVERSE[syn.lower()] = canonical


# ── 4. Intent Extraction Patterns ─────────────────────────────────────────────

# Experience
_EXP_PATTERNS = [
    (r"\bfresher\b|\bfresh\b|\bentry level\b|\b0\s*year", "fresher", 0, 1),
    (r"\bjunior\b|\bjr\.?\b", "junior", 0, 3),
    (r"\bsenior\b|\bsr\.?\b", "senior", 5, None),
    (r"\b(\d+)\s*\+?\s*years?\s*(?:of\s*)?(?:exp|experience)?\b", None, None, None),
    (r"\bmin(?:imum)?\s*(\d+)\s*years?", None, None, None),
    (r"\b(\d+)\s*-\s*(\d+)\s*years?", None, None, None),  # range
    (r"\babove\s*(\d+)\s*years?", None, None, None),
    (r"\bover\s*(\d+)\s*years?", None, None, None),
    (r"\bunder\s*(\d+)\s*years?", None, None, None),
    (r"\bless\s*than\s*(\d+)\s*years?", None, None, None),
    (r"\bupto?\s*(\d+)\s*years?", None, None, None),
    (r"\bat\s*least\s*(\d+)\s*years?", None, None, None),
]

# Notice period
_NOTICE_PATTERNS = [
    (r"\bimmediate\b|\bimmediately\b|\b0\s*day\b|\bno\s*notice\b|\bjoining\s*immediately\b", 0),
    (r"\b15\s*days?\b|\btwo\s*weeks?\b", 15),
    (r"\b30\s*days?\b|\bone\s*month\b", 30),
    (r"\b45\s*days?\b", 45),
    (r"\b60\s*days?\b|\btwo\s*months?\b", 60),
    (r"\b90\s*days?\b|\bthree\s*months?\b", 90),
    (r"\bserving\s*notice\b|\bserving notice\b|\bin\s*notice\b", -1),  # -1 = serving
]

# Location normalization
_LOCATION_ALIASES: dict[str, str] = {
    "wfh": "remote",
    "work from home": "remote",
    "work-from-home": "remote",
    "home": "remote",
    "anywhere": "remote",
    "mumbai": "Mumbai",
    "bombay": "Mumbai",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "ncr": "Delhi",
    "bangalore": "Bangalore",
    "bengaluru": "Bangalore",
    "blr": "Bangalore",
    "pune": "Pune",
    "hyderabad": "Hyderabad",
    "hyd": "Hyderabad",
    "ahmedabad": "Ahmedabad",
    "amd": "Ahmedabad",
    "chennai": "Chennai",
    "madras": "Chennai",
    "kolkata": "Kolkata",
    "calcutta": "Kolkata",
    "noida": "Noida",
    "gurgaon": "Gurgaon",
    "gurugram": "Gurgaon",
}

# Salary patterns (LPA extraction)
_SALARY_PATTERNS = [
    r"\bbudget\s*(?:is\s*)?(\d+(?:\.\d+)?)\s*lpa\b",
    r"\bunder\s*(\d+(?:\.\d+)?)\s*lpa\b",
    r"\bbelow\s*(\d+(?:\.\d+)?)\s*lpa\b",
    r"\bupto?\s*(\d+(?:\.\d+)?)\s*lpa\b",
    r"\b(\d+(?:\.\d+)?)\s*lpa\s*(?:max|maximum|budget|budget|or\s*less)?\b",
    r"\bexpected\s*(?:salary|ctc)\s*(?:is\s*)?(\d+(?:\.\d+)?)\s*lpa\b",
    r"\bcurrent\s*(?:salary|ctc)\s*(?:is\s*)?(\d+(?:\.\d+)?)\s*lpa\b",
]


# ── 5. Dataclass for structured search intent ──────────────────────────────────

@dataclass
class SearchIntent:
    """Structured output from query pre-processing."""
    # Cleaned query terms for full-text search (after expansion)
    query_terms: list[str] = field(default_factory=list)

    # Original expanded query string (for LLM context)
    expanded_query: str = ""

    # Synonym groups to OR together in SQL
    synonym_terms: list[str] = field(default_factory=list)

    # Structured filters
    location: Optional[str] = None
    experience_min: Optional[float] = None
    experience_max: Optional[float] = None
    notice_period_max: Optional[int] = None
    salary_max_lpa: Optional[float] = None
    is_fresher: bool = False
    is_senior: bool = False
    is_junior: bool = False
    is_immediate: bool = False
    work_mode: Optional[str] = None  # "remote", "hybrid", "onsite"

    # Was any abbreviation expanded?
    had_abbreviation: bool = False
    # Were any typos corrected?
    had_typo_correction: bool = False
    # Original raw text
    raw_query: str = ""


# ── 6. Core Processing Functions ───────────────────────────────────────────────

def expand_abbreviations(text: str) -> tuple[str, bool]:
    """
    Expand known abbreviations in the text.
    Returns (expanded_text, had_expansion).
    Handles multi-word abbreviations (e.g., "sr sde") before single-word ones.
    """
    lower = text.lower().strip()
    had_expansion = False

    # Sort by length descending to match longer abbreviations first
    sorted_abbrevs = sorted(ABBREVIATION_MAP.keys(), key=len, reverse=True)

    result = lower
    for abbr in sorted_abbrevs:
        # Use word boundary matching (not inside other words)
        pattern = r'(?<![a-zA-Z/])' + re.escape(abbr) + r'(?![a-zA-Z/])'
        if re.search(pattern, result, re.IGNORECASE):
            expansion = ABBREVIATION_MAP[abbr]
            result = re.sub(pattern, expansion, result, flags=re.IGNORECASE)
            had_expansion = True
            logger.debug(f"Expanded abbreviation: '{abbr}' → '{expansion}'")

    return result, had_expansion


def fuzzy_correct(word: str, cutoff: float = 0.75) -> Optional[str]:
    """
    Find the closest match for a word in KNOWN_WORDS using difflib.
    Returns corrected word or None if no good match found.
    Only corrects words of length >= 4 to avoid correcting short intentional abbreviations.
    """
    if len(word) < 4:
        return None
    if word.lower() in KNOWN_WORDS:
        return word  # already correct
    # Skip pure numbers
    if word.isdigit():
        return None

    matches = difflib.get_close_matches(word.lower(), KNOWN_WORDS, n=1, cutoff=cutoff)
    if matches:
        return matches[0]
    return None


def apply_fuzzy_correction(text: str) -> tuple[str, bool]:
    """
    Apply fuzzy correction to each word in text.
    Returns (corrected_text, had_correction).
    """
    words = text.split()
    corrected = []
    had_correction = False

    for word in words:
        # Strip common punctuation for matching but preserve it
        clean = re.sub(r'[^a-zA-Z0-9]', '', word)
        if not clean:
            corrected.append(word)
            continue

        correction = fuzzy_correct(clean)
        if correction and correction != clean.lower():
            corrected.append(correction)
            had_correction = True
            logger.debug(f"Typo corrected: '{word}' → '{correction}'")
        else:
            corrected.append(word)

    return ' '.join(corrected), had_correction


def get_role_synonyms(text: str) -> list[str]:
    """
    Get all synonym variants for role terms found in the text.
    Returns a list of alternative search terms to OR into SQL.
    """
    text_lower = text.lower()
    synonyms = set()

    # Check if text matches any canonical role or synonym
    for canonical, syns in ROLE_SYNONYMS.items():
        if canonical in text_lower:
            synonyms.update(syns)
            synonyms.add(canonical)
        for syn in syns:
            if syn in text_lower:
                synonyms.add(canonical)
                synonyms.update(syns)

    return list(synonyms)


def extract_experience(text: str) -> tuple[Optional[float], Optional[float], bool, bool, bool]:
    """
    Extract experience range from text.
    Returns (min_years, max_years, is_fresher, is_senior, is_junior).
    """
    lower = text.lower()
    exp_min: Optional[float] = None
    exp_max: Optional[float] = None
    is_fresher = bool(re.search(r'\bfresher\b|\bfresh\b|\bentry.?level\b|\b0\s*year', lower))
    is_senior = bool(re.search(r'\bsenior\b|\bsr\.?\b|\b5\+?\s*year', lower))
    is_junior = bool(re.search(r'\bjunior\b|\bjr\.?\b', lower))

    if is_fresher:
        exp_min, exp_max = 0.0, 1.0

    # "X+ years" or "X years"
    m = re.search(r'\b(\d+)\s*\+\s*years?\b', lower)
    if m:
        exp_min = float(m.group(1))

    # "X years" without plus
    m = re.search(r'\b(\d+)\s*years?\s*(?:of\s*)?(?:exp|experience)?\b', lower)
    if m and exp_min is None:
        n = float(m.group(1))
        exp_min = max(0.0, n - 1)  # slight tolerance: "5 years" → 4+
        exp_max = n + 1

    # "X-Y years"
    m = re.search(r'\b(\d+)\s*-\s*(\d+)\s*years?\b', lower)
    if m:
        exp_min = float(m.group(1))
        exp_max = float(m.group(2))

    # "above X years"
    m = re.search(r'\babove\s*(\d+)\s*years?\b', lower)
    if m:
        exp_min = float(m.group(1))

    # "over X years"
    m = re.search(r'\bover\s*(\d+)\s*years?\b', lower)
    if m:
        exp_min = float(m.group(1))

    # "under X years" / "less than X"
    m = re.search(r'\b(?:under|less\s*than|upto?|below)\s*(\d+)\s*years?\b', lower)
    if m:
        exp_max = float(m.group(1))
        if exp_min is None:
            exp_min = 0.0

    # "at least X years"
    m = re.search(r'\bat\s*least\s*(\d+)\s*years?\b', lower)
    if m:
        exp_min = float(m.group(1))

    # Senior heuristic
    if is_senior and exp_min is None:
        exp_min = 5.0

    # Junior heuristic
    if is_junior and exp_max is None:
        exp_max = 3.0
        if exp_min is None:
            exp_min = 0.0

    return exp_min, exp_max, is_fresher, is_senior, is_junior


def extract_notice_period(text: str) -> Optional[int]:
    """
    Extract maximum notice period (days) from text.
    Returns None if not mentioned.
    Returns 0 for immediate joiners.
    """
    lower = text.lower()
    for pattern, days in _NOTICE_PATTERNS:
        if re.search(pattern, lower):
            return days
    return None


def extract_location(text: str) -> Optional[str]:
    """
    Extract location mention from text.
    Normalizes common aliases.
    """
    lower = text.lower()

    # Work mode keywords
    if re.search(r'\bremote\b|\bwork from home\b|\bwfh\b', lower):
        return "remote"
    if re.search(r'\bhybrid\b', lower):
        return "hybrid"
    if re.search(r'\bonsite\b|\bon.site\b|\bon premise\b', lower):
        return "onsite"

    # Check location aliases
    for alias, canonical in _LOCATION_ALIASES.items():
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            return canonical

    # Common Indian cities not in alias map
    city_pattern = r'\b(Surat|Jaipur|Lucknow|Kanpur|Nagpur|Indore|Thane|Bhopal|Coimbatore|Kochi|'
    city_pattern += r'Vadodara|Visakhapatnam|Patna|Agra|Nashik|Faridabad|Meerut|Rajkot|Varanasi|'
    city_pattern += r'Ludhiana|Chandigarh|Mysore|Ranchi|Jodhpur|Guwahati)\b'
    m = re.search(city_pattern, text, re.IGNORECASE)
    if m:
        return m.group(1).title()

    return None


def extract_salary(text: str) -> Optional[float]:
    """
    Extract maximum salary (LPA) from text.
    Returns None if not mentioned.
    """
    lower = text.lower()
    for pattern in _SALARY_PATTERNS:
        m = re.search(pattern, lower)
        if m:
            try:
                return float(m.group(1))
            except (ValueError, IndexError):
                pass
    return None


# ── 7. Main Pre-Processing Entry Point ────────────────────────────────────────

# Stopwords to strip from query terms (tech skills are NOT stopwords)
_QUERY_STOPWORDS = {
    "show", "find", "list", "search", "get", "give", "tell", "fetch", "need",
    "want", "looking", "for", "candidate", "candidates", "profile", "profiles",
    "resume", "resumes", "this", "week", "today", "month", "year",
    "with", "from", "in", "at", "who", "all", "any", "me", "please",
    "we", "our", "us", "them", "their", "those",
    # Hinglish filler
    "mein", "hai", "ke", "ka", "ki", "ko", "se", "aur", "bhi", "toh",
    "hi", "ho", "tha", "thi", "the", "karo", "dikhao", "nikalo", "dhundo", "db",
    "kuch", "hoga", "hogi", "honge", "wala", "wali", "chahiye", "do", "dena",
    # Generic adjectives (handled separately)
    "good", "best", "top", "strong", "great", "excellent",
    # Articles
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "i", "guy", "guys", "person", "people", "someone",
}


def preprocess_query(raw_query: str) -> SearchIntent:
    """
    Main entry point: given a raw recruiter query, return a structured SearchIntent.

    Pipeline:
    1. Expand abbreviations
    2. Apply fuzzy typo correction
    3. Extract structured filters (location, exp, notice, salary)
    4. Get synonym expansions
    5. Build clean search terms

    Example:
      "need BDE fresher from Ahmedabad" →
        SearchIntent(
          query_terms=["Business Development Executive"],
          synonym_terms=["sales executive", "bd executive", ...],
          location="Ahmedabad",
          experience_min=0, experience_max=1, is_fresher=True
        )
    """
    intent = SearchIntent(raw_query=raw_query)

    # Step 1: Abbreviation expansion
    expanded, had_abbr = expand_abbreviations(raw_query)
    intent.had_abbreviation = had_abbr

    # Step 2: Fuzzy typo correction (on non-abbreviation-expanded words)
    corrected, had_typo = apply_fuzzy_correction(expanded)
    intent.had_typo_correction = had_typo

    intent.expanded_query = corrected

    # Step 3: Extract structured filters from ORIGINAL text (before expansion)
    # Use combined text for best coverage
    combined = f"{raw_query} {corrected}"

    intent.location = extract_location(combined)
    (
        intent.experience_min,
        intent.experience_max,
        intent.is_fresher,
        intent.is_senior,
        intent.is_junior,
    ) = extract_experience(combined)
    notice = extract_notice_period(combined)
    if notice is not None:
        intent.notice_period_max = notice
        if notice == 0:
            intent.is_immediate = True
    intent.salary_max_lpa = extract_salary(combined)

    # Work mode
    lower_combined = combined.lower()
    if "remote" in lower_combined or "wfh" in lower_combined or "work from home" in lower_combined:
        intent.work_mode = "remote"
    elif "hybrid" in lower_combined:
        intent.work_mode = "hybrid"

    # Step 4: Get synonyms for expanded role terms
    intent.synonym_terms = get_role_synonyms(corrected)

    # Step 5: Build clean search terms (remove stopwords + structural words)
    words = re.sub(r'[^\w\s\-\.]', ' ', corrected.lower()).split()
    # Also remove experience/location words that are now handled as structured filters
    extra_stop = {
        "year", "years", "exp", "experience", "fresher", "senior", "junior",
        "notice", "period", "days", "immediate", "joiner", "salary", "ctc",
        "lpa", "lakh", "lakhs", "budget", "expected", "current", "remote",
        "hybrid", "wfh", "from", "only", "based",
    }
    stop_combined = _QUERY_STOPWORDS | extra_stop
    clean_words = [
        w for w in words
        if w not in stop_combined and not w.isdigit() and len(w) >= 2
    ]
    intent.query_terms = list(dict.fromkeys(clean_words))  # deduplicate preserving order

    logger.info(
        f"SearchIntent: terms={intent.query_terms}, loc={intent.location}, "
        f"exp={intent.experience_min}-{intent.experience_max}, "
        f"notice={intent.notice_period_max}, salary={intent.salary_max_lpa}, "
        f"abbr={intent.had_abbreviation}, typo={intent.had_typo_correction}"
    )

    return intent


def build_search_context_from_history(
    current_query: str,
    history: list[dict],
) -> SearchIntent:
    """
    Build a cumulative SearchIntent by merging the current query with recent
    conversation history. This enables multi-turn refinement:

    Turn 1: "Python developer"      → query_terms=["python"], ...
    Turn 2: "Only Ahmedabad"        → merge → also location="Ahmedabad"
    Turn 3: "5 years experience"    → merge → also experience_min=4.0

    Only looks back at the last 6 user messages to avoid context drift.
    """
    # Gather last N user messages
    user_msgs = []
    for msg in history:
        if msg.get("role") == "user":
            user_msgs.append(msg.get("content", ""))
    recent_user_msgs = user_msgs[-6:]  # last 6 user turns

    # Check if current message is a "refinement" (short, no role/skill words)
    current_lower = current_query.lower().strip()
    refinement_starters = [
        "only", "from", "in", "with", "and", "also", "but",
        "ahmedabad", "mumbai", "pune", "delhi", "bangalore",
        "immediate", "fresher", "senior", "junior",
        "5 year", "3 year", "2 year", "1 year",
        "30 day", "60 day", "15 day",
    ]
    is_refinement = (
        len(current_query.split()) <= 5 and
        any(current_lower.startswith(s) or current_lower == s for s in refinement_starters)
    )

    if is_refinement and recent_user_msgs:
        # Combine with the most recent full search
        # Find the last message that looked like a full search query
        full_context = ""
        for msg in reversed(recent_user_msgs[:-1]):  # skip current
            if len(msg.split()) >= 2:
                full_context = msg
                break

        combined_query = f"{full_context} {current_query}".strip()
        logger.info(f"Refinement detected. Combined context: '{combined_query}'")
        return preprocess_query(combined_query)

    return preprocess_query(current_query)


def is_jd_creation_intent(text: str) -> bool:
    """
    Detect if the user wants to create/generate/write/draft a Job Description (JD).
    Supports spelling mistakes, synonyms, Hinglish, and variations of 'Job Description' or 'JD'.
    """
    text_lower = text.lower().strip()
    
    # 1. Broad variations of JD/Job Description
    jd_patterns = [
        r"\bjd\b",
        r"\bjob\s+description\b",
        r"\bjob\s+posting\b",
        r"\bjob\s+post\b",
        r"\bjob\s+specification\b",
        r"\bjob\s+spec\b",
        r"\bjob\s+requirements\b",
        r"\bhiring\s+requirements\b",
        r"\bhiring\s+description\b",
        r"\bhiring\s+post\b",
        r"\bhiring\s+posting\b",
        r"\brecruitment\s+jd\b",
        r"\brecruitment\s+description\b"
    ]
    
    # 2. Action verbs indicating creation (English & Hinglish)
    create_patterns = [
        r"\bcreate\b",
        r"\bgenerate\b",
        r"\bwrite\b",
        r"\bprepare\b",
        r"\bdraft\b",
        r"\bmake\b",
        r"\bneed\b",
        r"\bwant\b",
        r"\bpost\b",
        r"\bpublish\b",
        r"\bcan\s+you\b",
        r"\blooking\s+to\b",
        r"\bbuild\b",
        r"\bdesign\b",
        r"\bbana\s*do\b",
        r"\bbanado\b",
        r"\bbanao\b",
        r"\bbana\s*de\b",
        r"\bbana\s*dena\b",
        r"\bbanani\s*hai\b",
        r"\bbanana\s*hai\b",
        r"\bchahiye\b",
        r"\bchahie\b",
        r"\bkaro\b",
        r"\bkardo\b",
        r"\bkar\s*do\b",
        r"\blikh\s*do\b",
        r"\blikho\b",
        r"\btayyar\s*karo\b",
    ]
    
    # Check direct patterns like "jd for Python" or "job description of SDE"
    direct_patterns = [
        r"\b(?:jd|job\s+description|job\s+posting)\s+(?:for|of|on|to)\b",
        r"\b(?:create|generate|write|prepare|draft|make)\s+(?:a|an)?\s*(?:jd|job\s+description|job\s+posting|job\s+post)\b",
        r"\b(?:bde|sde|qa|developer|engineer|manager)\s+jd\b",
        r"\bjd\s+(?:bana|banao|banado|chahiye|karo|kardo|likho)\b"
    ]
    
    for dp in direct_patterns:
        if re.search(dp, text_lower):
            return True
            
    # Check combination of create verb AND jd noun
    has_jd = any(re.search(pat, text_lower) for pat in jd_patterns)
    has_create = any(re.search(pat, text_lower) for pat in create_patterns)
    
    if has_jd and has_create:
        return True

    return False


# ── JD follow-ups: edit the JD already in the chat vs. write a new one ───────

_JD_NOUN_RE = re.compile(r"\b(?:jd|job\s+(?:description|posting|post|spec(?:ification)?|requirements))\b")
# "jd for Data Analyst", "another jd", "new job description": a different JD.
_NEW_JD_RE = re.compile(
    r"\b(?:jd|job\s+description|job\s+posting|job\s+post)\s+(?:for|of)\b"
    r"|\b(?:new|another|second|one\s+more)\s+(?:jd|job\s+description|job\s+posting|job\s+post)\b"
)
_JD_EDIT_VERB_RE = re.compile(
    r"\b(?:change|update|edit|modify|revise|rewrite|rephrase|adjust|tweak|add|include|mention|"
    r"remove|delete|drop|replace|instead|make|increase|decrease|reduce|raise|lower|shorten|expand|"
    r"badal\w*|badlo|hata\w*|jod\w*|daal\w*|dal\s*do|kar\s*do|kardo|karo|likh\s*do)\b"
)
_JD_ATTR_RE = re.compile(
    r"\b(?:years?|yrs|saal|experience|remote|hybrid|on-?site|office|salary|ctc|pay|package|"
    r"incentives?|performance|location|skills?|tone|formal|senior|junior|shorter|longer|more|less|"
    r"fewer|kam|zyada|jyada)\b"
)
# Clearly about candidates or the pipeline, not the JD on screen.
_NOT_JD_RE = re.compile(
    r"\b(?:candidates?|interviews?|schedule|meeting|pipeline|stage|shortlist|offer|resumes?|cv|"
    r"applicants?|move)\b"
)
_QUESTION_RE = re.compile(r"^\s*(?:what|who|which|how|show|list|find|search|when|where|why)\b")


def is_jd_edit_request(text: str, jd_is_last_reply: bool) -> bool:
    """True when a message asks to change a JD already written in this chat.

    jd_is_last_reply: the previous assistant reply was that JD, so a bare
    "make it remote" / "add AWS" refers to it without saying "JD".
    """
    t = (text or "").lower().strip()
    if not t or _NEW_JD_RE.search(t) or _QUESTION_RE.match(t):
        return False
    if not (_JD_EDIT_VERB_RE.search(t) or _JD_ATTR_RE.search(t)):
        return False
    if _JD_NOUN_RE.search(t):
        return True
    return jd_is_last_reply and not _NOT_JD_RE.search(t)


def extract_role_from_jd_query(text: str) -> Optional[str]:
    """
    Extract the candidate/job role from a JD creation query.
    Expands abbreviations, applies fuzzy spelling correction, and applies clean casing.
    """
    text_clean = text.lower()
    
    # Phrases and words to remove to isolate the job title/role
    patterns_to_remove = [
        r"\bcreate\b", r"\bgenerate\b", r"\bwrite\b", r"\bprepare\b",
        r"\bdraft\b", r"\bmake\b", r"\bneed\b", r"\bwant\b", r"\bpost\b", r"\bpublish\b",
        r"\bcan\s+you\b", r"\blooking\s+to\b", r"\bplease\b", r"\bpls\b", r"\bplz\b",
        r"\bfor\b", r"\ba\b", r"\ban\b", r"\bthe\b", r"\bof\b", r"\bon\b", r"\bto\b",
        r"\bjd\b", r"\bjob\s+description\b", r"\bjob\s+posting\b", r"\bjob\s+post\b",
        r"\bjob\s+specification\b", r"\bjob\s+spec\b", r"\bjob\s+requirements\b",
        r"\bhiring\s+requirements\b", r"\bhiring\s+description\b", r"\bhiring\s+post\b",
        r"\bhiring\s+posting\b", r"\brecruitment\s+jd\b", r"\brecruitment\s+description\b",
        # Hinglish filler & action words
        r"\bbana\s+do\b", r"\bbanado\b", r"\bbanao\b", r"\bbana\s+de\b", r"\bbana\s+dena\b",
        r"\bbanani\s+hai\b", r"\bbanana\s+hai\b", r"\bchahiye\b", r"\bchahie\b",
        r"\bkaro\b", r"\bkardo\b", r"\bkar\s+do\b", r"\bkar\s+dena\b",
        r"\blikh\s+do\b", r"\blikho\b", r"\blikhna\b", r"\btayyar\s+karo\b",
        r"\bek\b", r"\bki\b", r"\bka\b", r"\bke\b", r"\bko\b", r"\bse\b",
        r"\bwali\b", r"\bwala\b", r"\bmujhe\b", r"\bhume\b", r"\bhumko\b", r"\bdedo\b", r"\bdo\b"
    ]
    
    for pat in patterns_to_remove:
        text_clean = re.sub(pat, " ", text_clean)
        
    # Strip non-alphanumeric except spaces, hyphens, and slashes
    text_clean = re.sub(r'[^a-zA-Z0-9\s\-/]', ' ', text_clean)
    text_clean = re.sub(r'\s+', ' ', text_clean).strip()
    
    if not text_clean:
        return None
        
    # Step 1: Expand abbreviations (e.g. "bde" -> "Business Development Executive")
    expanded, _ = expand_abbreviations(text_clean)
    
    # Step 2: Fuzzy correct misspelled words
    corrected, _ = apply_fuzzy_correction(expanded)
    
    # Step 3: Capitalize properly
    words = corrected.split()
    capitalized = []
    
    for w in words:
        if w.lower() in ("for", "and", "in", "of", "with", "a", "an", "the", "to", "at", "by", "on"):
            capitalized.append(w.lower())
        elif w.lower() in ("uiux", "ui/ux", "ux/ui"):
            capitalized.append("UI/UX")
        elif w.lower() in ("sde", "bde", "ta", "hr", "qa", "ml", "ai", "ds", "da", "bi", "dba", "it"):
            capitalized.append(w.upper())
        else:
            capitalized.append(w.capitalize())
            
    return " ".join(capitalized)


def validate_job_role(role_text: Optional[str]) -> tuple[str, str, str]:
    """
    Validate an extracted job role from user prompt.
    Returns (status, cleaned_role, message) where status is one of:
      - 'EMPTY': No role provided
      - 'INVALID': Gibberish / numbers / special chars / invalid text
      - 'INCOMPLETE': Vague or partial role (e.g., just 'Senior', 'Developer', 'Manager')
      - 'VALID': Recognizable job title
    """
    if not role_text or not role_text.strip():
        return (
            "EMPTY",
            "",
            (
                "### 📝 Create a Job Description\n\n"
                "Please specify the job role or title you'd like to create a Job Description for.\n\n"
                "**Examples:**\n"
                "- *'Generate a JD for Business Development Executive (BDE)'*\n"
                "- *'Create JD for Senior React Developer with 3+ years experience'*\n"
                "- *'Make a JD for Product Manager in Pune'*\n\n"
                "Tell me the role and any specific requirements you have in mind!"
            ),
        )

    clean = role_text.strip()
    clean_lower = clean.lower()

    # 1. Non-alphabetic / mostly symbols/numbers check
    letters_only = re.findall(r'[a-zA-Z]', clean)
    if len(letters_only) < 2:
        return (
            "INVALID",
            clean,
            (
                f"⚠️ **Invalid Job Role**: **'{clean}'** does not appear to be a valid job title or role.\n\n"
                "Please provide a recognized job title (e.g. *Frontend Developer*, *Business Development Executive*, *HR Manager*) to generate a Job Description."
            ),
        )

    # 2. Known gibberish / nonsense patterns
    # Substrings from keyboard mash
    mash_patterns = [
        r'asdf', r'qwer', r'zxcv', r'hjkl', r'dfgh', r'ghjk',
        r'([a-zA-Z])\1{2,}',  # 3+ repeated characters e.g. 'aaaa', 'zzzz'
    ]
    for pat in mash_patterns:
        if re.search(pat, clean_lower):
            return (
                "INVALID",
                clean,
                (
                    f"⚠️ **Invalid Job Role**: **'{clean}'** does not appear to be a valid job title or role.\n\n"
                    "Please provide a valid job title (e.g. *BDE*, *React Developer*, *DevOps Engineer*, *Talent Acquisition Specialist*)."
                ),
            )

    # Known common non-role filler words
    nonsense_words = {
        "something", "nothing", "anything", "whatever", "random", "test", "testing",
        "abc", "xyz", "asdf", "foo", "bar", "baz", "kuch", "kuchbhi", "bla", "blabla",
        "none", "na", "job", "post", "hiring", "applicant", "candidate"
    }
    if clean_lower in nonsense_words:
        return (
            "INVALID",
            clean,
            (
                f"⚠️ **Invalid Job Role**: **'{clean}'** is not a specific job role.\n\n"
                "Please specify an actual job title such as *Software Engineer*, *Sales Manager*, *HR Specialist*, etc."
            ),
        )

    # Consonant cluster test for single-word roles (no vowels at all in words >= 4 chars)
    known_consonant_acronyms = {
        "html", "css", "sql", "grpc", "rxjs", "ciso", "cto", "cfo", "coo", "sqa", "dba", "scrum", "sdn", "pmp"
    }
    words = clean_lower.split()
    for w in words:
        w_letters = re.sub(r'[^a-z]', '', w)
        if len(w_letters) >= 4 and w_letters not in known_consonant_acronyms:
            vowels = set("aeiouy")
            if not any(char in vowels for char in w_letters):
                return (
                    "INVALID",
                    clean,
                    (
                        f"⚠️ **Invalid Job Role**: **'{clean}'** does not look like a recognizable job title.\n\n"
                        "Please provide a valid job title (e.g., *Fullstack Developer*, *BDE*, *Marketing Lead*)."
                    ),
                )

    # 3. Incomplete / Vague checks
    seniority_only = {
        "senior", "sr", "junior", "jr", "lead", "head", "chief", "principal",
        "intern", "trainee", "associate", "entry level", "fresher", "experienced",
        "mid level", "staff", "vp", "director"
    }
    if clean_lower in seniority_only:
        return (
            "INCOMPLETE",
            clean,
            (
                f"🔍 **Role Incomplete**: You mentioned **'{clean}'**, but the domain or profession is missing.\n\n"
                f"Could you specify the full role? For example:\n"
                f"- *'{clean.title()} Software Engineer'*\n"
                f"- *'{clean.title()} Product Manager'*\n"
                f"- *'{clean.title()} Business Development Executive'*"
            ),
        )

    generic_only = {
        "developer", "engineer", "manager", "executive", "consultant",
        "specialist", "analyst", "designer", "architect", "officer",
        "coordinator", "assistant", "representative"
    }
    if clean_lower in generic_only:
        return (
            "INCOMPLETE",
            clean,
            (
                f"🔍 **More Details Needed**: Could you please specify what kind of **{clean.title()}** you're hiring for?\n\n"
                f"*Examples:*\n"
                f"- *'Python Backend {clean.title()}'*\n"
                f"- *'Frontend React {clean.title()}'*\n"
                f"- *'Sales & BD {clean.title()}'*\n"
                f"- *'Data {clean.title()}'*"
            ),
        )

    return ("VALID", clean, "")

