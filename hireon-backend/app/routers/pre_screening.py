"""
AI Pre-Screening Router
POST   /v1/pre-screening/sessions                    — create session, generate questions, send invite
GET    /v1/pre-screening/sessions                    — list sessions for org
GET    /v1/pre-screening/sessions/{id}               — session detail with responses
GET    /v1/pre-screening/take/{token}                — public: candidate fetches session by token
PATCH  /v1/pre-screening/sessions/{id}/status        — update status (in_progress / completed)
PATCH  /v1/pre-screening/sessions/{id}/language      — public: set language + get translated questions
POST   /v1/pre-screening/sessions/{id}/responses     — upload audio answer
GET    /v1/pre-screening/audio/{response_id}         — stream audio file (protected)
POST   /v1/pre-screening/sessions/{id}/summarise     — generate AI summary
"""
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import DB, RecruiterUser
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.pre_screening import PreScreeningResponse, PreScreeningSession
from app.schemas.pre_screening import (
    CreateSessionRequest,
    PreScreeningResponseOut,
    PreScreeningSessionOut,
    PublicSessionOut,
    ScreeningQuestion,
    SetLanguageRequest,
    UpdateStatusRequest,
)
from app.services import pre_screening_service as svc
from app.services.ai_evaluator import transcribe_audio
from app.services.email_service import send_pre_screening_invite
from app.services.storage_service import save_audio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/pre-screening", tags=["pre-screening"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_session_or_404(
    session_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: AsyncSession,
) -> PreScreeningSession:
    res = await db.execute(
        select(PreScreeningSession).where(
            PreScreeningSession.id == session_id,
            PreScreeningSession.organization_id == organization_id,
        )
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Pre-screening session not found")
    return session


async def _load_responses(session_id: uuid.UUID, db: AsyncSession) -> list[PreScreeningResponse]:
    res = await db.execute(
        select(PreScreeningResponse)
        .where(PreScreeningResponse.session_id == session_id)
        .order_by(PreScreeningResponse.question_index)
    )
    return list(res.scalars().all())


def _enrich_session(session: PreScreeningSession, candidate: Optional[Candidate], job: Optional[Job]) -> dict:
    responses_out = [
        PreScreeningResponseOut.model_validate(r).model_dump()
        for r in (session.responses or [])
    ]
    return {
        **PreScreeningSessionOut.model_validate(session).model_dump(),
        "candidate_name": candidate.full_name if candidate else None,
        "candidate_email": candidate.email if candidate else None,
        "job_title": job.title if job else None,
        "responses": responses_out,
    }


# ── Create session ─────────────────────────────────────────────────────────────

@router.post("/sessions", status_code=201)
async def create_session(
    body: CreateSessionRequest,
    current_user: RecruiterUser,
    db: DB,
    background_tasks: BackgroundTasks,
):
    """Create a pre-screening session, AI-generate 10 questions, send email invite."""
    # Load candidate
    cand_res = await db.execute(
        select(Candidate).where(
            Candidate.id == body.candidate_id,
            Candidate.organization_id == current_user.organization_id,
        )
    )
    candidate = cand_res.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Block duplicate: prevent creating a new session if a completed one already exists
    # for this candidate + job combination (job_id=None requires .is_(None) in SQLAlchemy)
    dup_filter = (
        PreScreeningSession.job_id == body.job_id
        if body.job_id
        else PreScreeningSession.job_id.is_(None)
    )
    dup_res = await db.execute(
        select(PreScreeningSession).where(
            PreScreeningSession.organization_id == current_user.organization_id,
            PreScreeningSession.candidate_id == body.candidate_id,
            PreScreeningSession.status == "completed",
            dup_filter,
        )
    )
    existing_completed = dup_res.scalar_one_or_none()
    if existing_completed:
        raise HTTPException(
            status_code=409,
            detail=f"completed_session:{existing_completed.id}",
        )

    # Load job (optional)
    job: Optional[Job] = None
    if body.job_id:
        job_res = await db.execute(
            select(Job).where(
                Job.id == body.job_id,
                Job.organization_id == current_user.organization_id,
            )
        )
        job = job_res.scalar_one_or_none()

    # Generate questions via AI
    parsed = candidate.parsed_data or {}
    questions = await svc.generate_questions(
        job_title=job.title if job else (candidate.applied_job_title or "the role"),
        job_description=job.description if job else "",
        required_skills=job.skills_required if job else [],
        required_experience=job.min_experience_years if job else None,
        candidate_name=candidate.full_name,
        candidate_title=candidate.current_title,
        candidate_skills=candidate.skills or [],
        candidate_experience=candidate.years_experience,
        candidate_summary=candidate.summary or parsed.get("summary"),
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id,
    )

    token = svc.make_invite_token()
    expires_at = svc.token_expires_at()

    session = PreScreeningSession(
        organization_id=current_user.organization_id,
        candidate_id=candidate.id,
        application_id=body.application_id,
        job_id=body.job_id,
        created_by_id=current_user.id,
        questions=questions,
        status="pending",
        invite_token=token,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()

    # Send email invite
    screening_url = f"{settings.frontend_url}/pre-screening/{token}"
    from app.models.organization import Organization
    org_res = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_res.scalar_one_or_none()
    company_name = org.name if org else "HireOn"
    org_logo = org.logo_url if org else None

    background_tasks.add_task(
        send_pre_screening_invite,
        candidate_email=candidate.email,
        candidate_name=candidate.full_name,
        company_name=company_name,
        job_title=job.title if job else (candidate.applied_job_title or "the role"),
        screening_url=screening_url,
        org_logo_url=org_logo,
    )

    return {
        "id": str(session.id),
        "invite_token": token,
        "status": "pending",
        "questions_count": len(questions),
        "expires_at": expires_at.isoformat(),
        "screening_url": screening_url,
        "candidate_name": candidate.full_name,
        "candidate_email": candidate.email,
    }


# ── List sessions ──────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    current_user: RecruiterUser,
    db: DB,
    candidate_id: Optional[uuid.UUID] = Query(None),
    job_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List pre-screening sessions for the organisation."""
    q = select(PreScreeningSession).where(
        PreScreeningSession.organization_id == current_user.organization_id
    )
    if candidate_id:
        q = q.where(PreScreeningSession.candidate_id == candidate_id)
    if job_id:
        q = q.where(PreScreeningSession.job_id == job_id)
    if status_filter:
        q = q.where(PreScreeningSession.status == status_filter)

    q = q.order_by(PreScreeningSession.created_at.desc()).offset((page - 1) * limit).limit(limit)
    res = await db.execute(q)
    sessions = res.scalars().all()

    results = []
    for s in sessions:
        # Count responses
        cnt_res = await db.execute(
            select(func.count()).where(PreScreeningResponse.session_id == s.id)
        )
        resp_count = cnt_res.scalar() or 0

        # Load candidate
        cand_res = await db.execute(select(Candidate).where(Candidate.id == s.candidate_id))
        cand = cand_res.scalar_one_or_none()

        # Load job
        job_title = None
        if s.job_id:
            job_res = await db.execute(select(Job).where(Job.id == s.job_id))
            j = job_res.scalar_one_or_none()
            job_title = j.title if j else None

        results.append({
            "id": str(s.id),
            "candidate_id": str(s.candidate_id),
            "job_id": str(s.job_id) if s.job_id else None,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "response_count": resp_count,
            "candidate_name": cand.full_name if cand else None,
            "candidate_email": cand.email if cand else None,
            "job_title": job_title,
        })

    return results


# ── Get session detail ─────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}")
async def get_session(
    session_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
):
    """Get full session detail including all responses and transcripts."""
    session = await _get_session_or_404(session_id, current_user.organization_id, db)
    responses = await _load_responses(session_id, db)
    session.responses = responses

    cand_res = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
    candidate = cand_res.scalar_one_or_none()

    job: Optional[Job] = None
    if session.job_id:
        job_res = await db.execute(select(Job).where(Job.id == session.job_id))
        job = job_res.scalar_one_or_none()

    return _enrich_session(session, candidate, job)


# ── Public: candidate takes session via token ─────────────────────────────────

@router.get("/take/{token}")
async def take_session(token: str, db: DB):
    """Public endpoint — candidate fetches session by invite token."""
    res = await db.execute(
        select(PreScreeningSession).where(PreScreeningSession.invite_token == token)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    if session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This invite link has expired")

    cand_res = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
    candidate = cand_res.scalar_one_or_none()

    job_title = None
    if session.job_id:
        job_res = await db.execute(select(Job).where(Job.id == session.job_id))
        j = job_res.scalar_one_or_none()
        job_title = j.title if j else None

    cnt_res = await db.execute(
        select(func.count()).where(PreScreeningResponse.session_id == session.id)
    )
    resp_count = cnt_res.scalar() or 0

    questions = [ScreeningQuestion(**q) for q in (session.questions or [])]

    # If language is non-English, translate questions (cached re-translation on re-fetch)
    translated: list[ScreeningQuestion] = []
    if session.language and session.language != "english":
        raw_translated = await svc.translate_questions(
            questions=[q.model_dump() for q in questions],
            language=session.language,
        )
        translated = [ScreeningQuestion(**q) for q in raw_translated]

    return PublicSessionOut(
        id=session.id,
        candidate_name=candidate.full_name if candidate else "Candidate",
        job_title=job_title,
        questions=questions,
        status=session.status,
        expires_at=session.expires_at,
        response_count=resp_count,
        language=session.language or "english",
        translated_questions=translated,
    )


# ── Update status ──────────────────────────────────────────────────────────────

@router.patch("/sessions/{session_id}/status")
async def update_session_status(
    session_id: uuid.UUID,
    body: UpdateStatusRequest,
    db: DB,
):
    """Public — candidate updates session status (in_progress or completed)."""
    res = await db.execute(
        select(PreScreeningSession).where(PreScreeningSession.id == session_id)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    allowed = {"in_progress", "completed"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {allowed}")

    session.status = body.status
    if body.status == "completed" and not session.completed_at:
        session.completed_at = datetime.now(timezone.utc)

    return {"id": str(session.id), "status": session.status}


# ── Set language ───────────────────────────────────────────────────────────────

@router.patch("/sessions/{session_id}/language")
async def set_language(
    session_id: uuid.UUID,
    body: SetLanguageRequest,
    db: DB,
    background_tasks: BackgroundTasks,
):
    """
    Public — candidate sets language preference.
    If non-English, translates questions and returns them.
    """
    allowed_languages = {"english", "hindi", "gujarati"}
    if body.language not in allowed_languages:
        raise HTTPException(status_code=400, detail=f"Language must be one of: {allowed_languages}")

    res = await db.execute(
        select(PreScreeningSession).where(PreScreeningSession.id == session_id)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.language = body.language
    await db.flush()

    questions = session.questions or []
    translated: list[dict] = []

    if body.language != "english":
        translated = await svc.translate_questions(
            questions=questions,
            language=body.language,
            background_tasks=background_tasks,
            organization_id=session.organization_id,
        )

    return {
        "session_id": str(session_id),
        "language": session.language,
        "translated_questions": translated,
    }


# ── Upload audio response ──────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/responses", status_code=201)
async def upload_response(
    session_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: DB,
    audio: UploadFile = File(...),
    question_index: int = Query(..., ge=0, le=9),
    duration_seconds: Optional[float] = Query(None),
):
    """
    Public endpoint — candidate uploads audio for one question.
    Saves the file and triggers async transcription.
    """
    # This endpoint is intentionally unauthenticated (token-based session auth)
    res = await db.execute(
        select(PreScreeningSession).where(PreScreeningSession.id == session_id)
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    audio_data = await audio.read()
    if not audio_data:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Determine file extension
    content_type = audio.content_type or "audio/webm"
    ext = "webm"
    if "ogg" in content_type:
        ext = "ogg"
    elif "mp4" in content_type or "mpeg" in content_type:
        ext = "mp4"
    elif "wav" in content_type:
        ext = "wav"

    # Save audio — Cloudinary when configured, local disk otherwise
    rel_path = await save_audio(audio_data, str(session_id), question_index, ext)

    # Check if response already exists (re-record case)
    existing_res = await db.execute(
        select(PreScreeningResponse).where(
            PreScreeningResponse.session_id == session_id,
            PreScreeningResponse.question_index == question_index,
        )
    )
    existing = existing_res.scalar_one_or_none()

    if existing:
        existing.audio_file_path = rel_path
        existing.transcript = None
        existing.duration_seconds = duration_seconds
        existing.recorded_at = datetime.now(timezone.utc)
        response_obj = existing
    else:
        response_obj = PreScreeningResponse(
            session_id=session_id,
            question_index=question_index,
            audio_file_path=rel_path,
            duration_seconds=duration_seconds,
        )
        db.add(response_obj)

    await db.flush()

    session_language = session.language or "english"
    whisper_lang = svc.WHISPER_LANGUAGE_MAP.get(session_language, "en")

    # Async transcription — run in background after response is sent
    async def _transcribe(
        response_id: uuid.UUID,
        data: bytes,
        filename: str,
        ctype: str,
        lang: str,
    ):
        from app.database import get_session_factory
        try:
            result = await transcribe_audio(
                audio_data=data,
                filename=filename,
                content_type=ctype,
                language=lang,
            )
            transcript_text = result.get("text", "")
            async with get_session_factory()() as async_db:
                r_res = await async_db.execute(
                    select(PreScreeningResponse).where(PreScreeningResponse.id == response_id)
                )
                r = r_res.scalar_one_or_none()
                if r:
                    r.transcript = transcript_text
                    await async_db.commit()
        except Exception as exc:
            logger.error(f"Async transcription failed for response {response_id}: {exc}")

    background_tasks.add_task(
        _transcribe,
        response_obj.id,
        audio_data,
        audio.filename or f"q{question_index}.{ext}",
        content_type,
        whisper_lang,
    )

    return {
        "id": str(response_obj.id),
        "session_id": str(session_id),
        "question_index": question_index,
        "audio_saved": True,
        "transcription": "processing",
    }


# ── Stream audio file ──────────────────────────────────────────────────────────

@router.get("/audio/{response_id}")
async def stream_audio(
    response_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
):
    """Protected — recruiter/admin streams audio for a specific response."""
    res = await db.execute(
        select(PreScreeningResponse).where(PreScreeningResponse.id == response_id)
    )
    response_obj = res.scalar_one_or_none()
    if not response_obj:
        raise HTTPException(status_code=404, detail="Response not found")

    # Verify org access via session
    sess_res = await db.execute(
        select(PreScreeningSession).where(
            PreScreeningSession.id == response_obj.session_id,
            PreScreeningSession.organization_id == current_user.organization_id,
        )
    )
    if not sess_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied")

    if not response_obj.audio_file_path:
        raise HTTPException(status_code=404, detail="No audio file for this response")

    # Cloudinary URL — redirect directly (auth guard is at this endpoint entry)
    if response_obj.audio_file_path.startswith("https://"):
        return RedirectResponse(url=response_obj.audio_file_path, status_code=307)

    # Local disk fallback
    file_path = Path(settings.upload_dir) / response_obj.audio_file_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    ext = file_path.suffix.lower().lstrip(".")
    media_type_map = {
        "webm": "audio/webm",
        "ogg": "audio/ogg",
        "mp4": "audio/mp4",
        "wav": "audio/wav",
        "mpeg": "audio/mpeg",
        "mp3": "audio/mpeg",
    }
    media_type = media_type_map.get(ext, "audio/webm")

    return FileResponse(path=str(file_path), media_type=media_type)


# ── Generate AI summary ────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/summarise")
async def summarise_session(
    session_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
    background_tasks: BackgroundTasks,
):
    """Generate or regenerate an AI summary for a completed session."""
    session = await _get_session_or_404(session_id, current_user.organization_id, db)

    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session is not yet completed")

    responses = await _load_responses(session_id, db)

    cand_res = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
    candidate = cand_res.scalar_one_or_none()

    job_title = None
    if session.job_id:
        job_res = await db.execute(select(Job).where(Job.id == session.job_id))
        j = job_res.scalar_one_or_none()
        job_title = j.title if j else None

    summary_data = await svc.generate_session_summary(
        candidate_name=candidate.full_name if candidate else "Candidate",
        job_title=job_title or "the role",
        questions=session.questions or [],
        responses=responses,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id,
    )

    import json as _json
    session.overall_ai_summary = _json.dumps(summary_data)
    await db.flush()

    return {"summary": summary_data}
