"""
Elasticsearch service — async client, index management, and search.

Provides:
  - setup_indices()           → create/update index mappings on startup
  - index_candidate(c)        → upsert a candidate document
  - index_job(j)              → upsert a job document
  - index_interview(iv)       → upsert an interview document
  - index_user(u)             → upsert a user document
  - delete_from_index(idx, id)→ remove a document
  - search_all(org_id, q, n)  → multi-index search → grouped SearchResults dict

All ES calls are wrapped in try/except so the application never crashes
if Elasticsearch is unavailable — callers receive None / empty results.
"""

import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# ── Index names ────────────────────────────────────────────────────────────────
IDX_CANDIDATES  = "hireon_candidates"
IDX_JOBS        = "hireon_jobs"
IDX_INTERVIEWS  = "hireon_interviews"
IDX_USERS       = "hireon_users"

# ── Index mapping definitions ─────────────────────────────────────────────────
_MAPPINGS: dict[str, dict] = {
    IDX_CANDIDATES: {
        "mappings": {
            "properties": {
                "organization_id":  {"type": "keyword"},
                "full_name":        {"type": "text",    "fields": {"keyword": {"type": "keyword"}}},
                "email":            {"type": "keyword"},
                "current_title":    {"type": "text"},
                "current_company":  {"type": "text"},
                "skills":           {"type": "text"},
                "summary":          {"type": "text"},
                "pipeline_stage":   {"type": "keyword"},
                "avatar_url":       {"type": "keyword", "index": False},
            }
        }
    },
    IDX_JOBS: {
        "mappings": {
            "properties": {
                "organization_id":  {"type": "keyword"},
                "title":            {"type": "text",    "fields": {"keyword": {"type": "keyword"}}},
                "description":      {"type": "text"},
                "location":         {"type": "text",    "fields": {"keyword": {"type": "keyword"}}},
                "skills_required":  {"type": "text"},
                "status":           {"type": "keyword"},
                "job_type":         {"type": "keyword"},
                "is_remote":        {"type": "boolean"},
            }
        }
    },
    IDX_INTERVIEWS: {
        "mappings": {
            "properties": {
                "organization_id":   {"type": "keyword"},
                "title":             {"type": "text"},
                "notes":             {"type": "text"},
                "status":            {"type": "keyword"},
                "scheduled_at":      {"type": "date"},
                "candidate_name":    {"type": "text"},
                "candidate_id":      {"type": "keyword"},
            }
        }
    },
    IDX_USERS: {
        "mappings": {
            "properties": {
                "organization_id": {"type": "keyword"},
                "full_name":       {"type": "text",  "fields": {"keyword": {"type": "keyword"}}},
                "email":           {"type": "keyword"},
                "role":            {"type": "keyword"},
                "avatar_url":      {"type": "keyword", "index": False},
            }
        }
    },
}


def _get_client():
    """Return a lazily-created AsyncElasticsearch client, or None if ES is disabled."""
    try:
        from elasticsearch import AsyncElasticsearch
        client = AsyncElasticsearch(
            hosts=[settings.elasticsearch_url],
            retry_on_timeout=True,
            max_retries=2,
            request_timeout=5,
        )
        return client
    except Exception as exc:
        logger.warning(f"[ES] Could not create AsyncElasticsearch client: {exc}")
        return None


# Module-level singleton client — created once, reused across requests.
_client = None


def get_es_client():
    global _client
    if _client is None:
        _client = _get_client()
    return _client


async def close():
    """Close the ES client on application shutdown."""
    global _client
    if _client is not None:
        try:
            await _client.close()
            logger.info("[ES] Client closed.")
        except Exception:
            pass
        _client = None


# ── Startup: create indices ────────────────────────────────────────────────────

async def setup_indices() -> None:
    """
    Create all four indices with correct mappings if they do not already exist.
    Called once during FastAPI lifespan startup.
    """
    es = get_es_client()
    if es is None:
        logger.warning("[ES] setup_indices skipped — no ES client.")
        return

    for index_name, body in _MAPPINGS.items():
        try:
            exists = await es.indices.exists(index=index_name)
            if not exists:
                await es.indices.create(index=index_name, body=body)
                logger.info(f"[ES] Created index '{index_name}'.")
            else:
                logger.debug(f"[ES] Index '{index_name}' already exists.")
        except Exception as exc:
            logger.warning(f"[ES] Failed to set up index '{index_name}': {exc}")


# ── Index helpers ──────────────────────────────────────────────────────────────

async def _upsert(index: str, doc_id: str, doc: dict) -> None:
    """Upsert a single document into the given index."""
    es = get_es_client()
    if es is None:
        return
    try:
        await es.index(index=index, id=doc_id, document=doc)
    except Exception as exc:
        logger.warning(f"[ES] Upsert failed for {index}/{doc_id}: {exc}")


async def delete_from_index(index: str, doc_id: str) -> None:
    """Delete a document from the given index (no-op if not found)."""
    es = get_es_client()
    if es is None:
        return
    try:
        await es.delete(index=index, id=doc_id, ignore=[404])
    except Exception as exc:
        logger.warning(f"[ES] Delete failed for {index}/{doc_id}: {exc}")


# ── Per-entity indexers ────────────────────────────────────────────────────────

async def index_candidate(candidate: Any) -> None:
    skills = candidate.skills or []
    if not isinstance(skills, list):
        skills = list(skills)

    doc = {
        "organization_id": str(candidate.organization_id),
        "full_name":        candidate.full_name,
        "email":            candidate.email,
        "current_title":    candidate.current_title or "",
        "current_company":  candidate.current_company or "",
        "skills":           " ".join(skills),
        "summary":          candidate.summary or "",
        "pipeline_stage":   candidate.pipeline_stage or "",
        "avatar_url":       None,  # Candidates don't have avatar_url in this model
    }
    await _upsert(IDX_CANDIDATES, str(candidate.id), doc)
    logger.debug(f"[ES] Indexed candidate {candidate.id}")


async def index_job(job: Any) -> None:
    skills = job.skills_required or []
    if not isinstance(skills, list):
        skills = list(skills)

    doc = {
        "organization_id": str(job.organization_id),
        "title":           job.title,
        "description":     job.description or "",
        "location":        job.location or "",
        "skills_required": " ".join(skills),
        "status":          job.status,
        "job_type":        job.job_type or "",
        "is_remote":       bool(job.is_remote),
    }
    await _upsert(IDX_JOBS, str(job.id), doc)
    logger.debug(f"[ES] Indexed job {job.id}")


async def index_interview(interview: Any, candidate_name: str = "") -> None:
    doc = {
        "organization_id": str(interview.organization_id),
        "title":           interview.title,
        "notes":           interview.notes or "",
        "status":          interview.status,
        "candidate_id":    str(interview.candidate_id),
        "candidate_name":  candidate_name,
        "scheduled_at":    interview.scheduled_at.isoformat() if interview.scheduled_at else None,
    }
    await _upsert(IDX_INTERVIEWS, str(interview.id), doc)
    logger.debug(f"[ES] Indexed interview {interview.id}")


async def index_user(user: Any) -> None:
    doc = {
        "organization_id": str(user.organization_id),
        "full_name":       user.full_name,
        "email":           user.email,
        "role":            str(user.role),
        "avatar_url":      user.avatar_url or None,
    }
    await _upsert(IDX_USERS, str(user.id), doc)
    logger.debug(f"[ES] Indexed user {user.id}")


# ── Multi-index search ─────────────────────────────────────────────────────────

async def search_all(
    organization_id: str,
    query: str,
    limit: int = 5,
) -> dict | None:
    """
    Search across all four indices, scoped to the given organization_id.

    Returns a dict matching {candidates, jobs, interviews, users, total}
    or None if Elasticsearch is unavailable (caller should fall back to PG).
    """
    es = get_es_client()
    if es is None:
        return None

    org_filter = {"term": {"organization_id": organization_id}}

    # Build multi_match query for each entity type with their relevant fields
    candidate_query = {
        "bool": {
            "must": [
                {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "full_name^3",
                            "email^2",
                            "current_title^2",
                            "current_company",
                            "skills",
                            "summary",
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                        "minimum_should_match": "75%",
                    }
                }
            ],
            "filter": [org_filter],
        }
    }

    job_query = {
        "bool": {
            "must": [
                {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "title^3",
                            "location^2",
                            "description",
                            "skills_required^2",
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                        "minimum_should_match": "75%",
                    }
                }
            ],
            "filter": [org_filter],
        }
    }

    interview_query = {
        "bool": {
            "must": [
                {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "candidate_name^2", "notes"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                        "minimum_should_match": "75%",
                    }
                }
            ],
            "filter": [org_filter],
        }
    }

    user_query = {
        "bool": {
            "must": [
                {
                    "multi_match": {
                        "query": query,
                        "fields": ["full_name^3", "email^2"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                        "minimum_should_match": "75%",
                    }
                }
            ],
            "filter": [
                org_filter,
                {"bool": {"must_not": {"term": {"role": "candidate"}}}}
            ],
        }
    }

    # Run four searches concurrently via msearch (single round-trip)
    msearch_body = [
        {"index": IDX_CANDIDATES},
        {"query": candidate_query, "size": limit},
        {"index": IDX_JOBS},
        {"query": job_query, "size": limit},
        {"index": IDX_INTERVIEWS},
        {"query": interview_query, "size": limit},
        {"index": IDX_USERS},
        {"query": user_query, "size": limit},
    ]

    try:
        resp = await es.msearch(body=msearch_body)
    except Exception as exc:
        logger.warning(f"[ES] msearch failed: {exc}")
        return None

    responses = resp.get("responses", [])
    if len(responses) < 4:
        return None

    cand_resp, job_resp, ivw_resp, user_resp = responses

    # Safely extract hits
    def hits(r: dict) -> list[dict]:
        return r.get("hits", {}).get("hits", [])

    candidates = []
    for h in hits(cand_resp):
        src = h["_source"]
        candidates.append({
            "id":             h["_id"],
            "type":           "candidate",
            "title":          src.get("full_name", ""),
            "subtitle":       src.get("current_title") or src.get("email", ""),
            "meta":           src.get("current_company"),
            "avatar_url":     src.get("avatar_url"),
            "pipeline_stage": src.get("pipeline_stage"),
            "email":          src.get("email"),
        })

    jobs = []
    for h in hits(job_resp):
        src = h["_source"]
        jobs.append({
            "id":        h["_id"],
            "type":      "job",
            "title":     src.get("title", ""),
            "subtitle":  src.get("location") or src.get("job_type", ""),
            "meta":      src.get("status"),
            "is_remote": src.get("is_remote", False),
        })

    interviews = []
    for h in hits(ivw_resp):
        src = h["_source"]
        interviews.append({
            "id":           h["_id"],
            "type":         "interview",
            "title":        src.get("title", ""),
            "subtitle":     src.get("candidate_name") or "Unknown Candidate",
            "meta":         src.get("status"),
            "scheduled_at": src.get("scheduled_at"),
        })

    users = []
    for h in hits(user_resp):
        src = h["_source"]
        role = src.get("role", "")
        users.append({
            "id":         h["_id"],
            "type":       "user",
            "title":      src.get("full_name", ""),
            "subtitle":   role.title() if role else "",
            "meta":       src.get("email"),
            "avatar_url": src.get("avatar_url"),
        })

    return {
        "candidates": candidates,
        "jobs":       jobs,
        "interviews": interviews,
        "users":      users,
        "total":      len(candidates) + len(jobs) + len(interviews) + len(users),
    }
