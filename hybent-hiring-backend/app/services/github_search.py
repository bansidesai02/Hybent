"""
GitHub developer search: a free outside source for tech roles.

Turns the Global Search filters into a GitHub user search
(language:<lang> location:<city>, ranked by followers), then reads each
profile for name, bio, company and location. Results use the same shape as
the PDL results so the page, scoring and "Add to pipeline" work unchanged.

Only public profile data is read. Emails are never copied: a GitHub address
is not consent to recruiting email (GitHub's terms forbid using it that way).

Costs nothing. Rate limits: without GITHUB_TOKEN, 10 searches a minute and 60
profile reads an hour; with one, 30 a minute and 5,000 an hour. Results are
cached 30 days, so a repeated search makes no calls.
"""
import asyncio
import hashlib
import json
import logging

import httpx

from app.core.config import settings
from app.services.global_search_service import CITY_ALIASES, _redis

logger = logging.getLogger(__name__)

API = "https://api.github.com"
PAGE_SIZE = 8
CACHE_TTL_SECONDS = 30 * 24 * 3600

# Skill / title words -> GitHub's language names.
LANGUAGES = {
    "javascript": "JavaScript", "js": "JavaScript", "react": "JavaScript", "node": "JavaScript",
    "nodejs": "JavaScript", "vue": "JavaScript", "angular": "TypeScript", "nextjs": "TypeScript",
    "typescript": "TypeScript", "python": "Python", "django": "Python", "flask": "Python",
    "fastapi": "Python", "java": "Java", "spring": "Java", "kotlin": "Kotlin", "android": "Kotlin",
    "swift": "Swift", "ios": "Swift", "go": "Go", "golang": "Go", "rust": "Rust", "ruby": "Ruby",
    "rails": "Ruby", "php": "PHP", "laravel": "PHP", "c#": "C#", ".net": "C#", "dotnet": "C#",
    "c++": "C++", "c": "C", "dart": "Dart", "flutter": "Dart", "scala": "Scala",
    "elixir": "Elixir", "r": "R",
}

# Titles that mean "this is a developer search", so GitHub is worth asking.
TECH_WORDS = ("developer", "engineer", "programmer", "devops", "sre", "architect", "full stack",
              "fullstack", "frontend", "front end", "backend", "back end", "data scientist",
              "ml ", "machine learning", "android", "ios", "mobile")


class GitHubUnavailable(Exception):
    pass


def language_for(f: dict) -> str | None:
    words = list(f["skills"]) + [w for t in f["job_titles"] for w in t.split()]
    for w in words:
        w = w.lower().strip()
        for key in (w, w.replace(".js", ""), w.replace("js", "")):
            if key in LANGUAGES:
                return LANGUAGES[key]
    return None


def is_tech_search(f: dict) -> bool:
    if language_for(f):
        return True
    return any(word in f" {t} " for t in f["job_titles"] for word in TECH_WORDS)


def build_query(f: dict) -> str | None:
    lang = language_for(f)
    if not lang:
        return None
    q = [f'language:"{lang}"', "repos:>3", "type:user"]
    if f["city"]:
        # GitHub location is free text: search the spelling people use most.
        q.append(f'location:"{CITY_ALIASES.get(f["city"], [f["city"]])[0]}"')
    elif f["country"]:
        q.append(f'location:"{f["country"]}"')
    return " ".join(q)


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
         "User-Agent": "hybent-hiring"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


def _person(u: dict, lang: str, f: dict) -> dict:
    bio = (u.get("bio") or "").strip()
    company = (u.get("company") or "").strip().lstrip("@") or None
    skills = [lang.lower()] + [s for s in f["skills"] if s != lang.lower() and s.lower() in bio.lower()]
    blog = (u.get("blog") or "").strip()
    return {
        "external_id": f"gh-{u['id']}",
        "full_name": (u.get("name") or u.get("login") or "").strip(),
        # A bio is the closest GitHub has to a headline.
        "job_title": (bio.split("\n")[0][:120] or None),
        "company": company,
        "location": (u.get("location") or None),
        "years_experience": None,
        "skills": skills,
        "matched_skills": [],
        "has_email": False,
        "has_phone": False,
        "has_linkedin": "linkedin.com" in blog.lower(),
        "linkedin_url": blog if "linkedin.com" in blog.lower() else None,
        "github_url": u.get("html_url"),
        "github_login": u.get("login"),
        "followers": u.get("followers") or 0,
        "public_repos": u.get("public_repos") or 0,
        "source": "github",
    }


async def search_github(f: dict) -> dict:
    """Returns {"total", "results", "cached"}; results empty for non-tech searches."""
    query = build_query(f)
    if not query:
        return {"total": 0, "results": [], "cached": False, "skipped": True}

    cache_key = "gsearch:gh:" + hashlib.sha256(query.encode()).hexdigest()
    r = _redis()
    try:
        try:
            cached = await r.get(cache_key)
            if cached:
                data = json.loads(cached)
                data["cached"] = True
                return data
        except Exception:
            pass

        async with httpx.AsyncClient(timeout=15, headers=_headers()) as client:
            resp = await client.get(f"{API}/search/users",
                                    params={"q": query, "sort": "followers", "per_page": PAGE_SIZE})
            if resp.status_code in (403, 429):
                raise GitHubUnavailable("GitHub search is busy. Try again in a minute.")
            if resp.status_code != 200:
                logger.warning(f"[GitHubSearch] {resp.status_code}: {resp.text[:200]}")
                raise GitHubUnavailable("GitHub search is not responding.")
            payload = resp.json()

            async def detail(login: str):
                d = await client.get(f"{API}/users/{login}")
                return d.json() if d.status_code == 200 else None

            users = await asyncio.gather(*(detail(i["login"]) for i in payload.get("items") or []))

        lang = language_for(f) or ""
        data = {
            "total": payload.get("total_count") or 0,
            "results": [_person(u, lang, f) for u in users if u],
            "cached": False,
        }
        if data["results"]:
            try:
                await r.set(cache_key, json.dumps(data), ex=CACHE_TTL_SECONDS)
            except Exception as e:
                logger.warning(f"[GitHubSearch] redis write failed: {e}")
        return data
    finally:
        try:
            await r.aclose()
        except Exception:
            pass
