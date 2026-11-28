"""
Global Search: find candidates from a plain-English query, both in the
organization's own database and outside it (People Data Labs).

Flow:
  1. parse_query()   - AI turns "react dev ahmedabad 3-5 yrs" into filters
                       (role, skills, location, experience). Falls back to a
                       keyword-only filter when no AI provider answers.
  2. search_own()    - same filters over the org's own candidates (free).
  3. search_outside()- PDL person search. Results are cached in Redis for
                       7 days per filter set, and each org has a daily cap,
                       because every PDL result costs a credit.

Outside results carry no contact details here: the free PDL plan only says
whether an email / LinkedIn exists. Contact reveal comes later (paid plan).
"""
import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.candidate import Candidate
from app.services.ai.copilot_service import _generate_text_with_fallback

logger = logging.getLogger(__name__)

PDL_SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search"
CACHE_TTL_SECONDS = 30 * 24 * 3600  # matches the PDL monthly credit cycle
OUTSIDE_PAGE_SIZE = 5  # each result costs 1 PDL credit; free plan = 100/month

PARSE_PROMPT = """You turn a recruiter's search into JSON filters for finding job candidates.
Return ONLY a JSON object with these keys:
  "job_titles": list of job titles (include close variants, max 4), e.g. ["react developer", "frontend developer"]
  "skills": list of lowercase skills, max 6
  "city": city name in lowercase or null
  "country": country name in lowercase or null (if a known Indian city is given, use "india")
  "min_years": integer or null
  "max_years": integer or null
Do not invent anything the search does not say or clearly imply."""


def _redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _clean_list(v, limit: int) -> list[str]:
    if not isinstance(v, list):
        return []
    out = []
    for x in v:
        if isinstance(x, str) and x.strip():
            s = x.strip().lower()[:60]
            if s not in out:
                out.append(s)
    return out[:limit]


def _clean_int(v):
    try:
        n = int(v)
        return n if 0 <= n <= 50 else None
    except (TypeError, ValueError):
        return None


def _clean_str(v):
    return v.strip().lower()[:60] if isinstance(v, str) and v.strip() else None


def normalize_filters(raw: dict) -> dict:
    """Validate AI (or user-edited) filters into a fixed, safe shape."""
    raw = raw if isinstance(raw, dict) else {}
    f = {
        "job_titles": _clean_list(raw.get("job_titles"), 4),
        "skills": _clean_list(raw.get("skills"), 6),
        "city": _clean_str(raw.get("city")),
        "country": _clean_str(raw.get("country")),
        "min_years": _clean_int(raw.get("min_years")),
        "max_years": _clean_int(raw.get("max_years")),
    }
    if f["min_years"] is not None and f["max_years"] is not None and f["min_years"] > f["max_years"]:
        f["min_years"], f["max_years"] = f["max_years"], f["min_years"]
    return f


def _keyword_filters(query: str) -> dict:
    """No-AI fallback: the whole query is one job title."""
    return normalize_filters({"job_titles": [query]})


async def parse_query(query: str) -> dict:
    """Query -> filters. Cached for 30 days per normalized query, so the same
    search always gives the same filters (and so hits the same cached
    outside results) and the AI is asked only once."""
    norm = " ".join(query.lower().split())[:300]
    key = "gsearch:parse:" + hashlib.sha256(norm.encode()).hexdigest()
    r = _redis()
    try:
        try:
            cached = await r.get(key)
            if cached:
                return normalize_filters(json.loads(cached))
        except Exception:
            pass

        text = await _generate_text_with_fallback(PARSE_PROMPT, f"Search: {norm}", temperature=0.0)
        if text:
            m = re.search(r"\{.*\}", text, re.S)
            if m:
                try:
                    f = normalize_filters(json.loads(m.group(0)))
                    if f["job_titles"] or f["skills"]:
                        try:
                            await r.set(key, json.dumps(f), ex=30 * 24 * 3600)
                        except Exception:
                            pass
                        return f
                except json.JSONDecodeError:
                    pass
            logger.warning("[GlobalSearch] AI filter parse failed, using keyword fallback")
        return _keyword_filters(query)
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


# ── Own database ────────────────────────────────────────────────────────────

async def search_own(db: AsyncSession, organization_id: uuid.UUID, f: dict, limit: int = 20) -> list[dict]:
    conds = [Candidate.organization_id == organization_id, Candidate.is_deleted.is_(False)]
    text_or = []
    for t in f["job_titles"]:
        text_or.append(Candidate.current_title.ilike(f"%{t}%"))
        text_or.append(Candidate.applied_job_title.ilike(f"%{t}%"))
    if f["skills"]:
        lowered = func.array_to_string(Candidate.skills, "|")
        for s in f["skills"]:
            text_or.append(func.lower(lowered).like(f"%{s}%"))
    if text_or:
        conds.append(or_(*text_or))
    if f["city"]:
        conds.append(Candidate.location.ilike(f"%{f['city']}%"))
    if f["min_years"] is not None:
        conds.append(Candidate.years_experience >= f["min_years"])
    if f["max_years"] is not None:
        conds.append(Candidate.years_experience <= f["max_years"])

    rows = (await db.execute(
        select(Candidate).where(*conds).order_by(Candidate.created_at.desc()).limit(limit)
    )).scalars().all()

    wanted = set(f["skills"])
    return [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "job_title": c.current_title or c.applied_job_title,
            "company": c.current_company,
            "location": c.location,
            "years_experience": c.years_experience,
            "skills": list(c.skills or [])[:12],
            "matched_skills": [s for s in (c.skills or []) if s.lower() in wanted],
            "pipeline_stage": c.pipeline_stage,
            "email": c.email,
        }
        for c in rows
    ]


# ── Outside (People Data Labs) ─────────────────────────────────────────────

# Indian cities with two common spellings. PDL isn't consistent (it uses
# "bangalore", not "bengaluru"), so both spellings are always searched.
_CITY_PAIRS = [("bangalore", "bengaluru"), ("bombay", "mumbai"), ("gurgaon", "gurugram"),
               ("calcutta", "kolkata"), ("madras", "chennai"), ("baroda", "vadodara"),
               ("poona", "pune"), ("trivandrum", "thiruvananthapuram"), ("cochin", "kochi"),
               ("mysore", "mysuru"), ("benares", "varanasi"), ("allahabad", "prayagraj")]
CITY_ALIASES: dict[str, list[str]] = {}
for _a, _b in _CITY_PAIRS:
    CITY_ALIASES[_a] = CITY_ALIASES[_b] = [_a, _b]


def build_pdl_query(f: dict) -> dict:
    must, should = [], []
    if f["country"]:
        must.append({"term": {"location_country": f["country"]}})
    if f["city"]:
        must.append({"terms": {"location_locality": CITY_ALIASES.get(f["city"], [f["city"]])}})
    if f["job_titles"]:
        must.append({"bool": {"should": [{"match": {"job_title": t}} for t in f["job_titles"]]}})
    for s in f["skills"]:
        (should if f["job_titles"] else must).append({"term": {"skills": s}})
    years = {}
    if f["min_years"] is not None:
        years["gte"] = f["min_years"]
    if f["max_years"] is not None:
        years["lte"] = f["max_years"]
    if years:
        must.append({"range": {"inferred_years_experience": years}})
    q = {"bool": {"must": must}}
    if should:
        q["bool"]["should"] = should
    return q


def _pdl_person(p: dict, wanted: set[str]) -> dict:
    def text(v):
        # Free plan masks some fields as True/False instead of the value.
        return v if isinstance(v, str) else None

    skills = [s for s in (p.get("skills") or []) if isinstance(s, str)]
    return {
        "external_id": p.get("id"),
        "full_name": (p.get("full_name") or "").title(),
        "job_title": (text(p.get("job_title")) or "").title() or None,
        "company": (text(p.get("job_company_name")) or "").title() or None,
        "location": text(p.get("location_name")),
        "years_experience": p.get("inferred_years_experience"),
        "skills": skills[:12],
        "matched_skills": [s for s in skills if s.lower() in wanted],
        "has_email": bool(p.get("work_email") or p.get("personal_emails") or p.get("emails")),
        "has_phone": bool(p.get("mobile_phone") or p.get("phone_numbers")),
        "has_linkedin": bool(p.get("linkedin_url")),
        "linkedin_url": text(p.get("linkedin_url")),
        "source": "pdl",
    }


class GlobalSearchLimit(Exception):
    pass


class GlobalSearchUnavailable(Exception):
    pass


async def search_outside(organization_id: uuid.UUID, f: dict) -> dict:
    if not settings.pdl_api_key:
        raise GlobalSearchUnavailable("Outside search is not set up yet.")

    key_src = json.dumps(f, sort_keys=True)
    cache_key = "gsearch:pdl:" + hashlib.sha256(key_src.encode()).hexdigest()
    r = _redis()
    try:
        try:
            cached = await r.get(cache_key)
        except Exception:
            cached = None
        if cached:
            data = json.loads(cached)
            if data.get("results"):  # empty answers aren't reused (they cost nothing to redo)
                data["cached"] = True
                return data

        day = datetime.now(timezone.utc).strftime("%Y%m%d")
        quota_key = f"gsearch:quota:{organization_id}:{day}"
        try:
            used = int(await r.get(quota_key) or 0)
        except Exception:
            used = 0
        if used >= settings.global_search_daily_limit:
            raise GlobalSearchLimit(
                f"Daily limit of {settings.global_search_daily_limit} outside searches reached. Try again tomorrow."
            )

        body = {"query": build_pdl_query(f), "size": OUTSIDE_PAGE_SIZE}
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                PDL_SEARCH_URL,
                headers={"X-Api-Key": settings.pdl_api_key, "Content-Type": "application/json"},
                json=body,
            )
        if resp.status_code == 404:  # PDL: no matches
            payload = {"total": 0, "data": []}
        elif resp.status_code == 402:
            raise GlobalSearchUnavailable("Outside search credits are used up for this month.")
        elif resp.status_code != 200:
            logger.warning(f"[GlobalSearch] PDL {resp.status_code}: {resp.text[:300]}")
            raise GlobalSearchUnavailable("Outside search is not responding. Please try again.")
        else:
            payload = resp.json()

        wanted = set(f["skills"])
        data = {
            "total": payload.get("total") or 0,
            "results": [_pdl_person(p, wanted) for p in payload.get("data") or []],
            "cached": False,
        }
        try:
            await r.incr(quota_key)
            await r.expire(quota_key, 2 * 24 * 3600)
            if data["results"]:
                await r.set(cache_key, json.dumps(data), ex=CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning(f"[GlobalSearch] redis write failed: {e}")
        return data
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


# ── Match score (free, deterministic) ──────────────────────────────────────

def _reason(matched: list[str], missing: list[str], title_hit: bool) -> str:
    parts = []
    if matched:
        parts.append(f"Has {', '.join(matched[:4])}")
    if title_hit:
        parts.append("role title fits")
    if missing:
        parts.append(f"missing {', '.join(missing[:3])}")
    text = "; ".join(parts)
    return (text[0].upper() + text[1:]) if text else "Little overlap with the requirements"


def _norm_skill(s: str) -> str:
    # "React.js", "ReactJS", "react js" -> "react"
    s = re.sub(r"[^a-z0-9+#]", "", s.lower())
    return re.sub(r"js$", "", s) if len(s) > 4 else s


def has_skill(skills: list[str], wanted: str) -> bool:
    w = _norm_skill(wanted)
    return any(_norm_skill(s) == w for s in skills if isinstance(s, str))


def score_hit(hit: dict, f: dict, job=None) -> None:
    """Adds match_score (0-100), matched/missing skills and match_reason to a result.

    With a job: the app's heuristic scorer against that job's requirements.
    Without one: skills from the search (70%) plus a role-title match (30%).
    No AI call either way, so ranking costs nothing.
    """
    skills = hit.get("skills") or []
    title = (hit.get("job_title") or "").lower()
    if job is not None:
        from app.services.ai.match_scorer import compute_heuristic_match_score
        score, b = compute_heuristic_match_score(
            candidate_skills=skills, candidate_title=hit.get("job_title"),
            years_experience=hit.get("years_experience"), candidate_education=[], job=job,
        )
        matched, missing = b.get("matched_skills") or [], b.get("missing_skills") or []
        title_hit = (b.get("title_score") or 0) >= 50
    else:
        matched = [s for s in f["skills"] if has_skill(skills, s)]
        missing = [s for s in f["skills"] if s not in matched]
        t_score = title_similarity(title, f["job_titles"])
        title_hit = t_score >= 0.6
        years_part = _years_fit(hit.get("years_experience"), f)
        if f["skills"]:
            score = 55 * len(matched) / len(f["skills"]) + 30 * t_score + 15 * years_part
        else:
            # Only a role to go on: the title can't make anyone a perfect
            # match, so this tops out at 70 and HR is told how to sharpen it.
            score = 55 * t_score + 15 * years_part
        hit["_needs_more"] = not f["skills"]
    hit["match_score"] = int(round(score or 0))
    hit["matched_skills"] = matched
    hit["missing_skills"] = missing
    reason = _reason(matched, missing, title_hit)
    if hit.pop("_needs_more", False):
        reason += ". Add skills or pick a job for a sharper score"
    hit["match_reason"] = reason


_STOP = {"and", "of", "the", "in", "for", "&", "-", "/"}


def _words(s: str) -> set[str]:
    return {w for w in re.split(r"[^a-z0-9+#]+", s.lower()) if w and w not in _STOP}


def title_similarity(title: str, wanted: list[str]) -> float:
    """0..1: exact title = 1, otherwise word overlap (so "senior software
    engineer" vs "software engineer" scores below an exact match)."""
    if not title or not wanted:
        return 0.0
    tw = _words(title)
    low = f" {' '.join(re.split(r'[^a-z0-9+#]+', title.lower()))} "
    best = 0.0
    for w in wanted:
        if title.strip().lower() == w.strip().lower():
            return 1.0
        # The whole role inside a longer headline ("React Developer who loves
        # React Native", a GitHub bio) is a strong fit, if not an exact one.
        phrase = " ".join(re.split(r"[^a-z0-9+#]+", w.lower())).strip()
        if phrase and f" {phrase} " in low:
            best = max(best, 0.85)
        ww = _words(w)
        if tw and ww:
            best = max(best, len(tw & ww) / len(tw | ww))
    return best


def _years_fit(years, f: dict) -> float:
    """1 if inside the asked range, 0.5 when unknown or no range asked, 0 if outside."""
    lo, hi = f.get("min_years"), f.get("max_years")
    if lo is None and hi is None:
        return 0.5
    if not isinstance(years, (int, float)):
        return 0.5
    if (lo is not None and years < lo) or (hi is not None and years > hi):
        return 0.0
    return 1.0


def rank(hits: list[dict], f: dict, job=None) -> list[dict]:
    for h in hits:
        score_hit(h, f, job)
    return sorted(hits, key=lambda h: h["match_score"], reverse=True)


# ── Add an outside profile to the org ──────────────────────────────────────

SOURCE = "global_search"


def placeholder_email(external_id: str, source: str = "pdl") -> str:
    # Candidate.email is required; outside profiles come without one (PDL's free
    # plan hides it; GitHub emails are never copied). ".invalid" is a reserved
    # TLD, so nothing is ever delivered to it.
    safe = re.sub(r"[^a-zA-Z0-9]", "", external_id)[:40] or uuid.uuid4().hex
    prefix = re.sub(r"[^a-z]", "", source.lower())[:10] or "ext"
    return f"{prefix}-{safe}@no-email.invalid"


async def import_outside(db: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID,
                         person: dict, job=None) -> tuple[Candidate, bool]:
    """Creates (or finds) the candidate for an outside profile, and adds them to
    the job's pipeline when a job is given. Returns (candidate, created)."""
    from app.models.application import Application

    ext_id = str(person.get("external_id") or "")
    if not ext_id:
        raise ValueError("Profile id missing.")

    def s(key, n=255):
        v = person.get(key)
        return v.strip()[:n] if isinstance(v, str) and v.strip() else None

    existing = (await db.execute(
        select(Candidate).where(
            Candidate.organization_id == organization_id,
            Candidate.is_deleted.is_(False),
            Candidate.parsed_data["external_id"].astext == ext_id,
        ).limit(1)
    )).scalar_one_or_none()

    created = existing is None
    if created:
        skills = [x[:80] for x in (person.get("skills") or []) if isinstance(x, str)][:30]
        years = person.get("years_experience")
        source = person.get("source") if person.get("source") in ("pdl", "github") else "pdl"
        cand = Candidate(
            organization_id=organization_id,
            created_by_id=user_id,
            email=placeholder_email(ext_id, source),
            full_name=s("full_name") or "Unknown",
            current_title=s("job_title"),
            current_company=s("company"),
            location=s("location"),
            linkedin_url=s("linkedin_url", 500),
            github_url=s("github_url", 500),
            years_experience=float(years) if isinstance(years, (int, float)) else None,
            skills=skills,
            source=SOURCE,
            parsed_data={
                "external_id": ext_id,
                "external_source": source,
                "skills": skills,
                "current_title": s("job_title"),
                "has_email": bool(person.get("has_email")),
                "imported_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        db.add(cand)
        await db.flush()
    else:
        cand = existing

    if job is not None:
        dup = (await db.execute(
            select(Application).where(Application.candidate_id == cand.id, Application.job_id == job.id)
        )).scalar_one_or_none()
        if not dup:
            hit = {"skills": cand.skills or [], "job_title": cand.current_title,
                   "years_experience": cand.years_experience}
            score_hit(hit, normalize_filters({}), job)
            db.add(Application(organization_id=organization_id, job_id=job.id, candidate_id=cand.id,
                               source=SOURCE, match_score=hit["match_score"]))
            if not cand.pipeline_stage:
                cand.pipeline_stage = "applied"
            await db.flush()
    return cand, created
