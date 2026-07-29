"""
Category utilities for mapping job/candidate titles and skills to core tech categories.
"""

# Ordered from most specific to least to avoid false matches
TECH_SKILL_MAP = [
    ("MEAN Stack",   ["angular", "node.js", "mongodb", "express"],   ["mean"]),
    ("MERN Stack",   ["react", "node.js", "mongodb", "express"],     ["mern"]),
    ("React",        ["react", "reactjs", "react.js"],               ["react"]),
    ("Angular",      ["angular", "angularjs", "angular.js"],         ["angular"]),
    ("Vue",          ["vue", "vuejs", "vue.js"],                     ["vue"]),
    ("Node.js",      ["node.js", "nodejs", "express", "nestjs"],     ["node"]),
    ("Python",       ["python", "django", "fastapi", "flask"],       ["python"]),
    ("Java",         ["java", "spring", "springboot", "hibernate"],  ["java"]),
    ("PHP",          ["php", "laravel", "symfony", "codeigniter"],   ["php"]),
    (".Net",         [".net", "c#", "asp.net", "dotnet"],            ["c#", ".net"]),
    ("Flutter",      ["flutter", "dart"],                            ["flutter"]),
    ("Android",      ["android", "kotlin"],                          ["android"]),
    ("iOS",          ["ios", "swift", "objective-c"],                ["ios"]),
    ("Golang",       ["golang", "go lang"],                          ["golang"]),
    ("Ruby",         ["ruby", "rails", "ruby on rails"],             ["ruby"]),
    ("C++",          ["c++", "cpp"],                                 ["c++"]),
    ("Data Science", ["machine learning", "deep learning", "tensorflow", "pytorch", "data science", "nlp"], []),
    ("DevOps",       ["kubernetes", "docker", "jenkins", "ci/cd", "terraform", "aws devops"], []),
    ("BDE",          ["business development", "bde", "b2b sales", "lead generation", "crm"], []),
    ("HR",           ["human resources", "hr", "recruitment", "talent acquisition", "payroll"], []),
    ("Marketing",    ["digital marketing", "seo", "content marketing", "google ads", "social media marketing"], []),
]


def detect_category_from_skills(skills: list[str]) -> str | None:
    """
    Detect core tech category from a list of skills.
    Returns the best match or None if no strong signal.
    """
    if not skills:
        return None
    skills_lower = {s.lower().strip() for s in skills}

    best_match = None
    best_score = 0

    for category, skill_keywords, _ in TECH_SKILL_MAP:
        score = sum(1 for kw in skill_keywords if kw.lower() in skills_lower)
        if score > best_score:
            best_score = score
            best_match = category

    # Require at least 2 matching keywords for stacks, 1 for single techs
    if best_score >= 1:
        return best_match
    return None


def get_tech_keywords(category_name: str) -> list[str]:
    """
    Get all valid skill keywords/aliases associated with a technology category.
    """
    cat_lower = category_name.lower()
    for category, skill_keywords, aliases in TECH_SKILL_MAP:
        if category.lower() == cat_lower or any(a.lower() == cat_lower for a in aliases):
            return skill_keywords + aliases
    return [cat_lower]


def extract_core_category(title: str) -> str:
    if not title:
        return ""
    title_lower = title.lower()
    core_cat = title.title()
    for tech in ['python', 'react', 'node', 'angular', 'java', 'php', 'flutter', 'mern', 'mean', 'android', 'ios', 'golang', 'ruby', 'c++', 'c#', '.net']:
        if tech in title_lower:
            core_cat = tech.title()
            if tech == 'node': core_cat = 'Node.js'
            if tech == 'mern': core_cat = 'MERN Stack'
            if tech == 'mean': core_cat = 'MEAN Stack'
            if tech == 'ios': core_cat = 'iOS'
            if tech == 'c#': core_cat = '.Net'
            if tech == '.net': core_cat = '.Net'
            return core_cat
            
    if core_cat == title.title():
        words_to_remove = {'senior', 'junior', 'lead', 'principal', 'staff', 'developer', 'engineer', 'manager', 'director', 'intern', 'fresher', 'executive', 'specialist', 'associate'}
        core_words = [w for w in title.split() if w.lower() not in words_to_remove]
        if core_words:
            core_cat = " ".join(core_words).title()
    return core_cat


def get_missing_skills_hint(candidate_skills: list[str], target_category: str) -> list[str]:
    """Return top skills that the candidate is missing for the target category."""
    target_lower = target_category.lower()
    candidate_skills_lower = [s.lower() for s in candidate_skills]
    
    for category, skill_keywords, _ in TECH_SKILL_MAP:
        if category.lower() in target_lower or target_lower in category.lower():
            return [kw.title() for kw in skill_keywords if kw not in " ".join(candidate_skills_lower)][:4]
    return []


def extract_all_categories(title: str) -> list[str]:
    """
    Extract all matching tech categories from a job or candidate title.
    E.g. ".Net + Angular Developer" -> [".Net", "Angular"]
    """
    if not title:
        return []
    title_lower = title.lower()
    categories = []
    
    # We loop through tech categories to find all matching ones
    for tech in ['python', 'react', 'node', 'angular', 'java', 'php', 'flutter', 'mern', 'mean', 'android', 'ios', 'golang', 'ruby', 'c++', 'c#', '.net']:
        if tech in title_lower:
            core_cat = tech.title()
            if tech == 'node': core_cat = 'Node.js'
            if tech == 'mern': core_cat = 'MERN Stack'
            if tech == 'mean': core_cat = 'MEAN Stack'
            if tech == 'ios': core_cat = 'iOS'
            if tech == 'c#': core_cat = '.Net'
            if tech == '.net': core_cat = '.Net'
            if core_cat not in categories:
                categories.append(core_cat)
                
    # If no tech is explicitly in the title, fallback to the title-based parsing
    if not categories:
        core_cat = title.title()
        words_to_remove = {'senior', 'junior', 'lead', 'principal', 'staff', 'developer', 'engineer', 'manager', 'director', 'intern', 'fresher', 'executive', 'specialist', 'associate'}
        core_words = [w for w in title.split() if w.lower() not in words_to_remove]
        if core_words:
            core_cat = " ".join(core_words).title()
        if core_cat:
            categories.append(core_cat)
            
    return categories

