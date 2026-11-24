"""Bulk import of resume files: many PDFs / Word files, or ZIPs of them.

The upload is checked and unpacked at once (`collect`), the accepted files are
kept on the ImportBatch as one ZIP, and a worker parses them one by one
(`process_batch`), committing after each so the recruiter sees live progress
and a crash keeps everything done so far. Each file ends as one of:

  created    — a new candidate (rejected, with the reason, when a chosen job's
               experience range rules them out; the score is kept)
  duplicate  — the resume's email is already a candidate here
  not_resume — the parser read it and it isn't a resume (or is locked)
  skipped    — never parsed: wrong type, too large, inside a nested ZIP …
  failed     — couldn't be processed (AI outage, out of credits)

Rollback is the Excel import's: candidates carry `import_batch_id`.
"""
from __future__ import annotations

import asyncio
import io
import logging
import re
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import PurePosixPath

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.import_batch import ImportBatch
from app.models.job import Job

logger = logging.getLogger(__name__)

KIND = "resumes"
RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}
MIME = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILES = 500
MAX_UPLOAD_BYTES = 100 * 1024 * 1024     # everything sent in one import
MAX_UNPACKED_BYTES = 300 * 1024 * 1024   # everything a ZIP may unpack to (zip bombs)
SOURCE = "bulk_import"
# Resumes read by AI at the same time. Parsing is the slow part (an AI call
# per file); saving stays one at a time so duplicate checks stay exact.
PARSE_CONCURRENCY = 6


def _skip(name: str, reason: str) -> dict:
    return {"file": name, "status": "skipped", "reason": reason}


def collect(uploads: list[tuple[str, bytes]]) -> tuple[list[tuple[str, bytes]], list[dict]]:
    """Split the upload into resume files to parse and items skipped with a reason.
    ZIPs are opened here; anything inside that isn't a PDF/DOC/DOCX is skipped."""
    accepted: list[tuple[str, bytes]] = []
    skipped: list[dict] = []
    per_file = settings.max_file_size_bytes
    unpacked = 0

    def take(name: str, data: bytes) -> None:
        ext = PurePosixPath(name).suffix.lower()
        if ext not in RESUME_EXTENSIONS:
            skipped.append(_skip(name, "Not a PDF or Word file"))
        elif not data:
            skipped.append(_skip(name, "The file is empty"))
        elif len(data) > per_file:
            skipped.append(_skip(name, f"Larger than {settings.max_file_size_mb} MB"))
        elif len(accepted) >= MAX_FILES:
            skipped.append(_skip(name, f"Over the {MAX_FILES}-resume limit for one import"))
        else:
            accepted.append((name, data))

    for name, data in uploads:
        name = PurePosixPath((name or "file").replace("\\", "/")).name or "file"
        if not name.lower().endswith(".zip"):
            take(name, data)
            continue
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
        except (zipfile.BadZipFile, ValueError):
            skipped.append(_skip(name, "Couldn't open this ZIP file"))
            continue
        with archive:
            for info in archive.infolist():
                inner = info.filename.replace("\\", "/")
                base = PurePosixPath(inner).name
                if info.is_dir() or not base or inner.startswith("__MACOSX/") or base.startswith((".", "~$")):
                    continue  # folders and OS clutter, not worth listing
                label = f"{name} › {base}"
                if base.lower().endswith(".zip"):
                    skipped.append(_skip(label, "A ZIP inside a ZIP isn't opened"))
                    continue
                if info.flag_bits & 0x1:
                    skipped.append(_skip(label, "Password-protected inside the ZIP"))
                    continue
                if PurePosixPath(base).suffix.lower() not in RESUME_EXTENSIONS:
                    skipped.append(_skip(label, "Not a PDF or Word file"))
                    continue
                if info.file_size > per_file:
                    skipped.append(_skip(label, f"Larger than {settings.max_file_size_mb} MB"))
                    continue
                unpacked += info.file_size
                if unpacked > MAX_UNPACKED_BYTES:
                    skipped.append(_skip(label, "The ZIP unpacks to more than 300 MB"))
                    continue
                try:
                    take(base, archive.read(info))
                except Exception:
                    skipped.append(_skip(label, "Couldn't read this file from the ZIP"))

    # Unique names, so the stored ZIP keeps every file.
    seen: dict[str, int] = {}
    unique = []
    for name, data in accepted:
        n = seen.get(name.lower(), 0)
        seen[name.lower()] = n + 1
        if n:
            stem, ext = PurePosixPath(name).stem, PurePosixPath(name).suffix
            name = f"{stem} ({n + 1}){ext}"
        unique.append((name, data))
    return unique, skipped


def pack(files: list[tuple[str, bytes]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for name, data in files:
            z.writestr(name, data)
    return buf.getvalue()


def new_batch(organization_id, user_id, files, skipped, job: Job | None) -> ImportBatch:
    names = [n for n, _ in files]
    label = names[0] if len(names) == 1 else f"{len(names)} resumes"
    items = [{"file": n, "status": "pending"} for n in names] + skipped
    batch = ImportBatch(
        organization_id=organization_id,
        imported_by_id=user_id,
        file_name=f"{label}.zip" if len(names) != 1 else label,
        selected_panels=[],
        total_rows=len(items),
        failed_count=len(skipped),
        status="processing",
        file_content=pack(files),
        failure_details={
            "kind": KIND,
            "job_id": str(job.id) if job else None,
            "job_title": job.title if job else None,
            "items": items,
        },
    )
    batch.created_at = datetime.now(timezone.utc)
    return batch


def summary(batch: ImportBatch) -> dict:
    d = batch.failure_details or {}
    items = d.get("items") or []
    counts: dict[str, int] = {}
    for it in items:
        counts[it["status"]] = counts.get(it["status"], 0) + 1
    return {
        "id": str(batch.id),
        "status": batch.status,
        "file_name": batch.file_name,
        "job_title": d.get("job_title"),
        "total": len(items),
        "done": len(items) - counts.get("pending", 0),
        "created": counts.get("created", 0),
        "rejected": sum(1 for it in items if it["status"] == "created" and it.get("rejected")),
        "duplicate": counts.get("duplicate", 0),
        "not_resume": counts.get("not_resume", 0),
        "skipped": counts.get("skipped", 0),
        "failed": counts.get("failed", 0),
        "items": items,
    }


def _save(batch: ImportBatch, items: list[dict]) -> None:
    batch.failure_details = {**(batch.failure_details or {}), "items": items}
    flag_modified(batch, "failure_details")
    s = summary(batch)
    batch.success_count = s["created"]
    batch.duplicate_count = s["duplicate"]
    batch.failed_count = s["not_resume"] + s["skipped"] + s["failed"]


async def _store_file(candidate: Candidate, name: str, data: bytes, mime: str) -> None:
    from app.services import supabase_storage_service
    from app.services.storage_service import save_resume_bytes

    if settings.use_supabase_resume_storage:
        try:
            candidate.resume_storage_path = await supabase_storage_service.upload_resume(
                file_content=data, organization_id=str(candidate.organization_id),
                candidate_id=str(candidate.id), original_filename=name, content_type=mime,
            )
            candidate.resume_filename = name
            return
        except Exception as exc:
            logger.warning("Bulk resume import: Supabase upload failed (%s); using fallback storage", exc)
    candidate.resume_url, candidate.resume_filename = await save_resume_bytes(
        data, name, mime, str(candidate.organization_id)
    )


class _OutOfCredits(Exception):
    pass


async def parse_one(batch: ImportBatch, name: str, data: bytes) -> dict:
    """AI-read one resume (no database work, so many run at once). Returns
    {"parsed": {...}} or a finished item result. Raises _OutOfCredits."""
    from app.services.ai.resume_parser import NotAResumeError, parse_resume
    from app.services.ai_metering import ai_scope
    from app.utils.exceptions import InsufficientCreditsException

    org_id = batch.organization_id
    mime = MIME.get(PurePosixPath(name).suffix.lower(), "application/octet-stream")
    result = {"file": name}
    try:
        async with ai_scope(org_id):
            parsed = await parse_resume(data, mime, name, background_tasks=None,
                                        user_id=batch.imported_by_id, organization_id=org_id)
    except InsufficientCreditsException as exc:
        raise _OutOfCredits(getattr(exc, "message", None) or "Out of AI credits") from exc
    except NotAResumeError as exc:
        return {**result, "status": "not_resume", "reason": str(exc.detail)}
    except HTTPException as exc:
        if exc.status_code == 400:
            return {**result, "status": "not_resume", "reason": str(exc.detail)}
        return {**result, "status": "failed", "reason": "Couldn't read this resume right now. Try it again later."}
    except Exception as exc:
        logger.warning("Bulk resume import: parse failed for %r: %s", name, exc)
        return {**result, "status": "failed", "reason": "Couldn't read this resume right now. Try it again later."}
    return {"parsed": parsed}


async def save_one(db: AsyncSession, batch: ImportBatch, job: Job | None, name: str, data: bytes, parsed: dict) -> dict:
    """Create the candidate for a parsed resume. Returns the item's result."""
    from app.services.ai.resume_rag import stage_candidate_resume_chunks
    from app.services.resume_intake import apply_parsed_resume, score_application
    from app.utils.category import detect_category_from_skills, extract_core_category
    from app.utils.job_matching import resolve_or_create_pool_job

    org_id = batch.organization_id
    mime = MIME.get(PurePosixPath(name).suffix.lower(), "application/octet-stream")
    result = {"file": name}
    full_name = parsed.get("full_name") or PurePosixPath(name).stem or "Unknown Candidate"
    email = (parsed.get("email") or "").strip().lower() or None
    if email:
        existing = (await db.execute(select(Candidate).where(
            Candidate.organization_id == org_id, Candidate.email == email))).scalar_one_or_none()
        if existing:
            return {**result, "status": "duplicate", "name": existing.full_name,
                    "candidate_id": str(existing.id), "reason": f"Already in Hybent as {existing.full_name}"}
    else:
        clean = re.sub(r"[^a-z0-9]", "", full_name.lower()) or "applicant"
        email = f"{clean}.{uuid.uuid4().hex[:6]}@hybent.temp"
    parsed["email"] = email

    title_job = job
    if title_job is None:
        category = detect_category_from_skills(parsed.get("skills") or []) or extract_core_category(
            parsed.get("current_title") or "")
        title_job = await resolve_or_create_pool_job(db, org_id, title_hint=parsed.get("current_title"),
                                                     category_hint=category)

    candidate = Candidate(
        organization_id=org_id,
        created_by_id=batch.imported_by_id,
        email=email,
        full_name=full_name,
        source=SOURCE,
        import_batch_id=batch.id,
        imported_at=datetime.now(timezone.utc),
        applied_job_title=title_job.title if title_job else None,
        pipeline_stage="applied" if job else None,
    )
    apply_parsed_resume(candidate, parsed)
    db.add(candidate)
    await db.flush()
    await _store_file(candidate, name, data, mime)

    score = None
    if job is not None:
        application = Application(organization_id=org_id, job_id=job.id, candidate_id=candidate.id, source="import")
        db.add(application)
        await db.flush()
        score = await score_application(candidate, application, job, user_id=batch.imported_by_id)
    try:
        async with db.begin_nested():
            await stage_candidate_resume_chunks(db, candidate)
    except Exception as exc:
        logger.warning("[RAG] Failed to stage resume chunks for candidate %s: %s", candidate.id, exc)

    out = {**result, "status": "created", "name": full_name, "candidate_id": str(candidate.id)}
    if score is not None:
        out["score"] = round(float(score))
    failed = (candidate.score_breakdown or {}).get("criteria_failed") or []
    if failed and candidate.pipeline_stage == "screening_rejected":
        out["rejected"] = True
        out["reason"] = failed[0]
    return out


async def import_one(db: AsyncSession, batch: ImportBatch, job: Job | None, name: str, data: bytes) -> dict:
    """Parse and save one resume."""
    got = await parse_one(batch, name, data)
    if "parsed" not in got:
        return got
    return await save_one(db, batch, job, name, data, got["parsed"])


async def process_batch(db: AsyncSession, batch_id) -> None:
    """Work through the batch's pending files, committing after each."""
    from app.services.ai.resume_rag import index_candidate_resume_by_id

    batch = await db.get(ImportBatch, uuid.UUID(str(batch_id)))
    if batch is None or (batch.failure_details or {}).get("kind") != KIND or batch.status != "processing":
        return
    details = batch.failure_details or {}
    job = None
    if details.get("job_id"):
        job = (await db.execute(select(Job).where(
            Job.id == uuid.UUID(details["job_id"]), Job.organization_id == batch.organization_id))).scalar_one_or_none()

    files = {}
    with zipfile.ZipFile(io.BytesIO(batch.file_content or b"")) as z:
        for info in z.infolist():
            files[info.filename] = z.read(info)

    items = [dict(i) for i in details.get("items") or []]
    created_ids = []
    out_of_credits = None
    sem = asyncio.Semaphore(PARSE_CONCURRENCY)

    async def parse(idx):
        async with sem:
            name = items[idx]["file"]
            try:
                return await parse_one(batch, name, files.get(name, b""))
            except _OutOfCredits as exc:
                return {"out_of_credits": str(exc)}
            except Exception:
                logger.exception("Bulk resume import: %r failed to parse", name)
                return {"file": name, "status": "failed", "reason": "Something went wrong with this file. Try it again."}

    pending = [i for i, it in enumerate(items) if it.get("status") == "pending"]
    # Chunks: a chunk is parsed in parallel, then saved and committed, so the
    # progress bar moves every few seconds.
    for start in range(0, len(pending), PARSE_CONCURRENCY):
        chunk = pending[start:start + PARSE_CONCURRENCY]
        if out_of_credits:
            for idx in chunk:
                items[idx] = {"file": items[idx]["file"], "status": "failed", "reason": out_of_credits}
        else:
            parsed_list = await asyncio.gather(*(parse(i) for i in chunk))
            for idx, got in zip(chunk, parsed_list):
                name = items[idx]["file"]
                if "out_of_credits" in got or out_of_credits:
                    out_of_credits = out_of_credits or f"{got['out_of_credits']} — add credits and import this file again."
                    items[idx] = {"file": name, "status": "failed", "reason": out_of_credits}
                    continue
                if "parsed" not in got:
                    items[idx] = got
                    continue
                try:
                    async with db.begin_nested():
                        items[idx] = await save_one(db, batch, job, name, files.get(name, b""), got["parsed"])
                except Exception:
                    logger.exception("Bulk resume import: %r failed to save", name)
                    items[idx] = {"file": name, "status": "failed",
                                  "reason": "Something went wrong with this file. Try it again."}
                if items[idx].get("status") == "created":
                    created_ids.append(items[idx]["candidate_id"])
        _save(batch, items)
        await db.commit()

    batch.status = "completed"
    await db.commit()

    for cid in created_ids:
        try:
            await index_candidate_resume_by_id(uuid.UUID(cid), batch.organization_id)
        except Exception as exc:
            logger.warning("Bulk resume import: indexing %s failed: %s", cid, exc)
    try:
        from app.tasks.screening import enqueue_screening
        enqueue_screening(created_ids, batch.organization_id)
    except Exception:
        pass
