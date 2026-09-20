"""
Resume RAG layer.
=================
Chunking, embedding, and retrieval for candidate resumes.

Design notes (see plan for full rationale):
  - No pgvector — not available on this deployment's Postgres image.
    Embeddings are stored as a plain float array (CandidateResumeChunk.embedding)
    and compared with cosine similarity in Python (numpy). This is safe because
    every query here is pre-scoped by organization_id and (almost always) a
    specific candidate_id or a caller-supplied candidate_id prefilter — the
    similarity math never runs over an entire organization's candidate table.
  - Embedding provider is Gemini (`google-generativeai`, already a dependency,
    already configured for match_scorer.py's failover tier). If no Gemini key
    is configured, or a call fails, embedding functions return None and
    retrieval falls back to keyword overlap — RAG degrades gracefully, it
    never hard-fails the chat turn.
"""
import asyncio
import logging
import re
import uuid
from typing import Optional

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    if settings.gemini_api_key:
        genai.configure(api_key=settings.gemini_api_key)
except Exception as exc:
    logger.warning(f"[RAG] Gemini configuration error: {exc}")
    genai = None

EMBEDDING_MODEL = "models/gemini-embedding-001"

# Below this cosine-similarity score, a retrieved chunk is treated as not
# actually relevant — callers use this to say "I couldn't find enough
# information..." instead of answering off a weak/irrelevant match.
# Calibrated empirically against gemini-embedding-001: same-domain resume
# text (all professional/CV vocabulary) has a similarity "floor" around
# 0.60-0.61 even for genuinely unrelated chunks (e.g. a salary question vs
# an experience chunk), while a real match lands ~0.70+. This is a
# defense-in-depth guard, not the only check — the answer-synthesis prompt
# is separately instructed to say "not found" if the retrieved content
# doesn't actually answer the question.
MIN_RELEVANCE_SCORE = 0.62

SECTION_OVERVIEW = "overview"
SECTION_SUMMARY = "summary"
SECTION_SKILLS = "skills"
SECTION_EXPERIENCE = "experience"
SECTION_PROJECT = "project"
SECTION_EDUCATION = "education"
SECTION_CERTIFICATIONS = "certifications"


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_parsed_resume(full_name: str, parsed_data: Optional[dict]) -> list[dict]:
    """
    Turn a candidate's parsed_data (the dict produced by
    app.services.ai.resume_parser.parse_resume / ParsedResume) into
    retrievable sections. Pure function — no DB/network — so chunking
    quality is unit-testable against representative fixtures.
    """
    parsed_data = parsed_data or {}
    chunks: list[dict] = []

    overview_parts = [f"Candidate: {full_name}"]
    if parsed_data.get("current_title"):
        overview_parts.append(f"Current Title: {parsed_data['current_title']}")
    if parsed_data.get("current_company"):
        overview_parts.append(f"Current Company: {parsed_data['current_company']}")
    if parsed_data.get("location"):
        overview_parts.append(f"Location: {parsed_data['location']}")
    exp_label = parsed_data.get("experience_years") or (
        f"{parsed_data['years_experience']} years" if parsed_data.get("years_experience") is not None else None
    )
    if exp_label:
        overview_parts.append(f"Total Experience: {exp_label}")
    if len(overview_parts) > 1:
        chunks.append({"section": SECTION_OVERVIEW, "content": "\n".join(overview_parts)})

    summary = (parsed_data.get("summary") or "").strip()
    if summary:
        chunks.append({"section": SECTION_SUMMARY, "content": f"Summary: {summary}"})

    skills = [s for s in (parsed_data.get("skills") or []) if isinstance(s, str) and s.strip()]
    if skills:
        chunks.append({"section": SECTION_SKILLS, "content": "Skills: " + ", ".join(skills)})

    for exp in parsed_data.get("experience") or []:
        if not isinstance(exp, dict):
            continue
        title = (exp.get("title") or "").strip()
        company = (exp.get("company") or "").strip()
        duration = (exp.get("duration") or "").strip()
        desc = (exp.get("description") or "").strip()
        header = " at ".join([p for p in [title, company] if p])
        if duration:
            header = f"{header} ({duration})" if header else duration
        if not header and not desc:
            continue
        content = f"Experience: {header}".strip() if header else "Experience:"
        if desc:
            content += f"\n{desc}"
        chunks.append({"section": SECTION_EXPERIENCE, "content": content})

    for proj in parsed_data.get("projects") or []:
        if not isinstance(proj, dict):
            continue
        name = (proj.get("name") or "").strip()
        desc = (proj.get("description") or "").strip()
        tech = [t for t in (proj.get("technologies") or []) if isinstance(t, str) and t.strip()]
        if not name and not desc and not tech:
            continue
        content_parts = [f"Project: {name}" if name else "Project"]
        if tech:
            content_parts.append("Technologies: " + ", ".join(tech))
        if desc:
            content_parts.append(desc)
        chunks.append({"section": SECTION_PROJECT, "content": "\n".join(content_parts)})

    education = parsed_data.get("education") or []
    edu_lines = []
    for e in education:
        if not isinstance(e, dict):
            continue
        degree = (e.get("degree") or "").strip()
        inst = (e.get("institution") or "").strip()
        year = e.get("year")
        line = " at ".join([p for p in [degree, inst] if p])
        if year:
            line = f"{line} ({year})" if line else str(year)
        if line:
            edu_lines.append(line)
    if edu_lines:
        chunks.append({"section": SECTION_EDUCATION, "content": "Education:\n" + "\n".join(edu_lines)})

    certs = [c for c in (parsed_data.get("certifications") or []) if isinstance(c, str) and c.strip()]
    if certs:
        chunks.append({"section": SECTION_CERTIFICATIONS, "content": "Certifications: " + ", ".join(certs)})

    return chunks


# ── Embedding ─────────────────────────────────────────────────────────────────

async def embed_text(text_content: str, task_type: str = "RETRIEVAL_DOCUMENT") -> Optional[list[float]]:
    """
    Embed text via Gemini. Returns None on any failure or missing
    configuration — never raises — so callers fall back to keyword
    matching instead of breaking the chat turn.
    """
    if not settings.gemini_api_key or genai is None or not text_content or not text_content.strip():
        return None
    try:
        result = await asyncio.to_thread(
            genai.embed_content,
            model=EMBEDDING_MODEL,
            content=text_content[:8000],
            task_type=task_type,
        )
        embedding = result.get("embedding") if isinstance(result, dict) else getattr(result, "embedding", None)
        if embedding:
            return list(embedding)
    except Exception as exc:
        logger.warning(f"[RAG] Embedding failed: {exc}")
    return None


# ── Similarity ────────────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a, dtype=float), np.array(b, dtype=float)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


_WORD_RE = re.compile(r"[a-zA-Z0-9+.#]+")


def keyword_score(query: str, content: str) -> float:
    """
    Crude fallback ranking used when embeddings are unavailable (no Gemini
    key, or a specific embed call failed) — fraction of significant query
    words found in the chunk content. Keeps retrieval usable, just less
    precise, instead of returning nothing.
    """
    q_words = {w.lower() for w in _WORD_RE.findall(query) if len(w) >= 2}
    if not q_words:
        return 0.0
    c_lower = content.lower()
    hits = sum(1 for w in q_words if w in c_lower)
    return hits / len(q_words)


def _score_chunk(query: str, query_embedding: Optional[list[float]], content: str, embedding: Optional[list[float]]) -> float:
    if query_embedding and embedding:
        return cosine_similarity(query_embedding, embedding)
    return keyword_score(query, content)


# ── Indexing ──────────────────────────────────────────────────────────────────

async def stage_candidate_resume_chunks(db: AsyncSession, candidate) -> int:
    """
    Delete+insert a candidate's resume chunks on the given session WITHOUT
    committing — the caller controls the transaction boundary. Use this
    (instead of index_candidate_resume) when indexing happens inline as
    part of a larger existing unit of work (e.g. email ingestion creating
    the candidate row itself), so a RAG-indexing failure can't leave chunks
    committed for a candidate whose creation later rolled back, and so it
    doesn't prematurely commit unrelated pending changes on that session.
    Raises on failure — the caller decides whether that's fatal to its
    surrounding transaction or just worth logging and continuing past.
    """
    from app.models.candidate_resume_chunk import CandidateResumeChunk

    raw_chunks = chunk_parsed_resume(candidate.full_name, candidate.parsed_data)
    await db.execute(delete(CandidateResumeChunk).where(CandidateResumeChunk.candidate_id == candidate.id))

    for chunk in raw_chunks:
        embedding = await embed_text(chunk["content"])
        db.add(CandidateResumeChunk(
            organization_id=candidate.organization_id,
            candidate_id=candidate.id,
            section=chunk["section"],
            content=chunk["content"],
            embedding=embedding,
        ))
    return len(raw_chunks)


async def index_candidate_resume(db: AsyncSession, candidate) -> int:
    """
    (Re)index one candidate's resume chunks and commit. Returns the number
    of chunks written, or 0 on failure. Never raises — indexing failures
    must not break the resume upload/parse flow that triggers this as a
    background task. For inline use within an existing transaction, use
    stage_candidate_resume_chunks instead.
    """
    try:
        count = await stage_candidate_resume_chunks(db, candidate)
        await db.commit()
        return count
    except Exception as exc:
        logger.error(f"[RAG] Failed to index resume for candidate {candidate.id}: {exc}", exc_info=True)
        try:
            await db.rollback()
        except Exception:
            pass
        return 0


async def index_candidate_resume_by_id(candidate_id: uuid.UUID, organization_id: uuid.UUID) -> None:
    """
    BackgroundTasks entrypoint. Opens its own DB session — the request's
    session is gone by the time background tasks run — matching the
    pattern already used by app.services.ai_usage_tracker.log_ai_usage and
    app.tasks.notifications.
    """
    from app.models.candidate import Candidate

    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(Candidate).where(Candidate.id == candidate_id, Candidate.organization_id == organization_id)
        )
        candidate = res.scalar_one_or_none()
        if not candidate:
            logger.warning(f"[RAG] index_candidate_resume_by_id: candidate {candidate_id} not found")
            return
        count = await index_candidate_resume(db, candidate)
        logger.info(f"[RAG] Indexed {count} resume chunks for candidate {candidate_id}")


# ── Retrieval ─────────────────────────────────────────────────────────────────

async def semantic_search_candidate(
    db: AsyncSession,
    organization_id: uuid.UUID,
    candidate_id: uuid.UUID,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Retrieve the most relevant resume chunks for ONE candidate, scoped by
    organization_id + candidate_id (tenant isolation enforced in the WHERE
    clause, same pattern as every other Copilot DB tool). Falls back to
    keyword overlap ranking when embeddings are unavailable.
    """
    from app.models.candidate_resume_chunk import CandidateResumeChunk

    res = await db.execute(
        select(CandidateResumeChunk).where(
            CandidateResumeChunk.organization_id == organization_id,
            CandidateResumeChunk.candidate_id == candidate_id,
        )
    )
    rows = res.scalars().all()
    if not rows:
        return []

    query_embedding = await embed_text(query, task_type="RETRIEVAL_QUERY")

    scored = [
        {
            "section": row.section,
            "content": row.content,
            "score": _score_chunk(query, query_embedding, row.content, row.embedding),
        }
        for row in rows
    ]
    scored.sort(key=lambda c: c["score"], reverse=True)
    return scored[:top_k]


async def semantic_search_candidates(
    db: AsyncSession,
    organization_id: uuid.UUID,
    query: str,
    candidate_ids: list[uuid.UUID],
    top_k: int = 10,
) -> list[dict]:
    """
    Rank a pre-filtered set of candidates by semantic similarity of their
    resume chunks to `query`. Never runs over the whole organization — the
    caller must supply candidate_ids from a cheap structured pre-filter
    (e.g. skill overlap via SQL), per the hybrid-retrieval design:
    structured filter first, semantic rerank second.
    """
    from app.models.candidate_resume_chunk import CandidateResumeChunk

    if not candidate_ids:
        return []

    res = await db.execute(
        select(CandidateResumeChunk).where(
            CandidateResumeChunk.organization_id == organization_id,
            CandidateResumeChunk.candidate_id.in_(candidate_ids),
        )
    )
    rows = res.scalars().all()
    if not rows:
        return []

    query_embedding = await embed_text(query, task_type="RETRIEVAL_QUERY")

    best_per_candidate: dict[uuid.UUID, dict] = {}
    for row in rows:
        score = _score_chunk(query, query_embedding, row.content, row.embedding)
        current = best_per_candidate.get(row.candidate_id)
        if not current or score > current["score"]:
            best_per_candidate[row.candidate_id] = {
                "candidate_id": row.candidate_id,
                "score": score,
                "section": row.section,
                "content": row.content,
            }

    ranked = sorted(best_per_candidate.values(), key=lambda c: c["score"], reverse=True)
    return ranked[:top_k]


def best_score(chunks: list[dict]) -> float:
    return chunks[0]["score"] if chunks else 0.0
