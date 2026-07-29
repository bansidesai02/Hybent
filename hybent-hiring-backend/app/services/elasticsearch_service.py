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

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Index names ────────────────────────────────────────────────────────────────
IDX_UNIFIED = "hybent_hiring_unified"

# ── Index mapping definitions ─────────────────────────────────────────────────
_MAPPINGS: dict[str, dict] = {
    IDX_UNIFIED: {
        "mappings": {
            "properties": {
                "doc_type":         {"type": "keyword"},  # "candidate", "job", "interview", "user"
                "organization_id":  {"type": "keyword"},
                
                # Common & Candidate fields
                "full_name":        {"type": "text",    "fields": {"keyword": {"type": "keyword"}}},
                "email":            {"type": "keyword"},
                "current_title":    {"type": "text"},
                "current_company":  {"type": "text"},
                "skills":           {"type": "text"},
                "summary":          {"type": "text"},
                "pipeline_stage":   {"type": "keyword"},
                "avatar_url":       {"type": "keyword", "index": False},
                
                # Job fields
                "title":            {"type": "text",    "fields": {"keyword": {"type": "keyword"}}},
                "description":      {"type": "text"},
                "location":         {"type": "text",    "fields": {"keyword": {"type": "keyword"}}},
                "skills_required":  {"type": "text"},
                "status":           {"type": "keyword"},
                "job_type":         {"type": "keyword"},
                "is_remote":        {"type": "boolean"},
                
                # Interview fields
                "notes":             {"type": "text"},
                "scheduled_at":      {"type": "date"},
                "candidate_name":    {"type": "text"},
                "candidate_id":      {"type": "keyword"},
                
                # User fields
                "role":              {"type": "keyword"},
            }
        }
    }
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
        await es.index(index=IDX_UNIFIED, id=doc_id, document=doc)
    except Exception as exc:
        logger.warning(f"[ES] Upsert failed for {IDX_UNIFIED}/{doc_id}: {exc}")


async def delete_from_index(index: str, doc_id: str) -> None:
    """Delete a document from the given index (no-op if not found)."""
    es = get_es_client()
    if es is None:
        return
        
    # Map old index parameter values to their unified document prefix
    prefix = ""
    if "candidate" in index:
        prefix = "candidate_"
    elif "job" in index:
        prefix = "job_"
    elif "interview" in index:
        prefix = "interview_"
    elif "user" in index:
        prefix = "user_"

    unified_doc_id = f"{prefix}{doc_id}" if prefix else doc_id
    try:
        await es.delete(index=IDX_UNIFIED, id=unified_doc_id, ignore=[404])
    except Exception as exc:
        logger.warning(f"[ES] Delete failed for {index}/{doc_id} (unified ID {unified_doc_id}): {exc}")


# ── Per-entity indexers ────────────────────────────────────────────────────────

async def index_candidate(candidate: Any) -> None:
    skills = candidate.skills or []
    if not isinstance(skills, list):
        skills = list(skills)

    doc = {
        "doc_type":         "candidate",
        "organization_id":  str(candidate.organization_id),
        "full_name":        candidate.full_name,
        "email":            candidate.email,
        "current_title":    candidate.current_title or "",
        "current_company":  candidate.current_company or "",
        "skills":           " ".join(skills),
        "summary":          candidate.summary or "",
        "pipeline_stage":   candidate.pipeline_stage or "",
        "avatar_url":       None,
    }
    await _upsert(IDX_UNIFIED, f"candidate_{candidate.id}", doc)
    logger.debug(f"[ES] Indexed candidate {candidate.id}")


async def index_job(job: Any) -> None:
    skills = job.skills_required or []
    if not isinstance(skills, list):
        skills = list(skills)

    doc = {
        "doc_type":         "job",
        "organization_id":  str(job.organization_id),
        "title":            job.title,
        "description":      job.description or "",
        "location":         job.location or "",
        "skills_required":  " ".join(skills),
        "status":           job.status,
        "job_type":         job.job_type or "",
        "is_remote":        bool(job.is_remote),
    }
    await _upsert(IDX_UNIFIED, f"job_{job.id}", doc)
    logger.debug(f"[ES] Indexed job {job.id}")


async def index_interview(interview: Any, candidate_name: str = "") -> None:
    doc = {
        "doc_type":         "interview",
        "organization_id":  str(interview.organization_id),
        "title":            interview.title,
        "notes":            interview.notes or "",
        "status":           interview.status,
        "candidate_id":     str(interview.candidate_id),
        "candidate_name":   candidate_name,
        "scheduled_at":     interview.scheduled_at.isoformat() if interview.scheduled_at else None,
    }
    await _upsert(IDX_UNIFIED, f"interview_{interview.id}", doc)
    logger.debug(f"[ES] Indexed interview {interview.id}")


async def index_user(user: Any) -> None:
    doc = {
        "doc_type":         "user",
        "organization_id":  str(user.organization_id),
        "full_name":        user.full_name,
        "email":            user.email,
        "role":             str(user.role),
        "avatar_url":       user.avatar_url or None,
    }
    await _upsert(IDX_UNIFIED, f"user_{user.id}", doc)
    logger.debug(f"[ES] Indexed user {user.id}")


# ── Unified single-index search ───────────────────────────────────────────────

async def search_all(
    organization_id: str,
    query: str,
    limit: int = 5,
) -> dict | None:
    """
    Search across a single unified index, scoped to the given organization_id,
    and return grouped results.
    """
    es = get_es_client()
    if es is None:
        return None

    search_query = {
        "bool": {
            "must": [
                {
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "full_name^3",
                            "title^3",
                            "candidate_name^2",
                            "email^2",
                            "current_title^2",
                            "location^2",
                            "skills_required^2",
                            "current_company",
                            "skills",
                            "summary",
                            "description",
                            "notes"
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                        "minimum_should_match": "75%",
                    }
                }
            ],
            "filter": [
                {"term": {"organization_id": organization_id}}
            ]
        }
    }

    try:
        resp = await es.search(
            index=IDX_UNIFIED,
            body={"query": search_query, "size": limit * 4}
        )
    except Exception as exc:
        logger.warning(f"[ES] Unified search failed: {exc}")
        return None

    hits = resp.get("hits", {}).get("hits", [])
    
    candidates = []
    jobs = []
    interviews = []
    users = []

    for h in hits:
        src = h["_source"]
        doc_type = src.get("doc_type")
        
        # Clean ID by removing doc_type prefix
        raw_id = h["_id"]
        clean_id = raw_id
        if doc_type and raw_id.startswith(f"{doc_type}_"):
            clean_id = raw_id[len(doc_type) + 1:]

        if doc_type == "candidate" and len(candidates) < limit:
            candidates.append({
                "id":             clean_id,
                "type":           "candidate",
                "title":          src.get("full_name", ""),
                "subtitle":       src.get("current_title") or src.get("email", ""),
                "meta":           src.get("current_company"),
                "avatar_url":     src.get("avatar_url"),
                "pipeline_stage": src.get("pipeline_stage"),
                "email":          src.get("email"),
            })
        elif doc_type == "job" and len(jobs) < limit:
            jobs.append({
                "id":        clean_id,
                "type":      "job",
                "title":     src.get("title", ""),
                "subtitle":  src.get("location") or src.get("job_type", ""),
                "meta":      src.get("status"),
                "is_remote": src.get("is_remote", False),
            })
        elif doc_type == "interview" and len(interviews) < limit:
            interviews.append({
                "id":           clean_id,
                "type":         "interview",
                "title":        src.get("title", ""),
                "subtitle":     src.get("candidate_name") or "Unknown Candidate",
                "meta":         src.get("status"),
                "scheduled_at": src.get("scheduled_at"),
            })
        elif doc_type == "user" and len(users) < limit:
            role = src.get("role", "")
            if role == "candidate":
                continue
            users.append({
                "id":         clean_id,
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
