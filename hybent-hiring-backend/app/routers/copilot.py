"""
Recruiter AI Copilot Router
POST /v1/copilot/chat          — send a message (Admin & Recruiter only)
GET  /v1/copilot/conversations — list past conversations
GET  /v1/copilot/conversations/{id} — load a conversation with messages
DELETE /v1/copilot/conversations/{id} — delete a conversation
"""
import uuid
import logging
from typing import Optional, Annotated
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.dependencies import DB, get_current_user
from app.models.user import User
from app.utils.permissions import RECRUITER_ROLES
from app.services.ai.copilot_service import stream_copilot_chat
from app.services.ai.ai_evaluator import transcribe_audio, clean_speech_transcript

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/copilot", tags=["copilot"])

ALLOWED_ROLES = {r.value for r in RECRUITER_ROLES}  # ADMIN + RECRUITER

# Stop reverse proxies (nginx, Caddy, CDNs) from buffering the event stream.
_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class CopilotChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    page_context: Optional[dict] = None
    conversation_id: Optional[str] = None  # ← link message to existing conversation
    approved_tool_call: Optional[dict] = None
    # Agent v2: answer to a paused approval — {"action_id", "approved", "edits"?}
    resume: Optional[dict] = None


class CopilotChatResponse(BaseModel):
    reply: str
    error: bool = False
    conversation_id: Optional[str] = None  # ← always returned so frontend can track
    requires_approval: bool = False
    pending_tool_call: Optional[dict] = None


class CleanTranscriptRequest(BaseModel):
    text: str



class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class ConversationMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationDetail(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[ConversationMessageOut]
    pending_tool_call: Optional[dict] = None  # restored from last_context.pending_action


# ── Chat Endpoint ─────────────────────────────────────────────────────────────

@router.post("/chat")
async def copilot_chat(
    body: CopilotChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
    background_tasks: BackgroundTasks,
):
    """
    AI Copilot chat endpoint.
    - Only accessible by ADMIN and RECRUITER roles.
    - All DB queries inside are scoped to current_user.organization_id.
    - Streams response via Server-Sent Events (SSE).
    """
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This feature is available to Admins and Recruiters only.",
        )

    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    use_agent = settings.copilot_agent_v2_enabled_for(current_user.organization_id)
    resume = body.resume
    if use_agent:
        from app.services.agents.copilot.service import resume_from_approved_tool_call, stream_copilot_agent

        if body.approved_tool_call and resume is None:
            resume = await resume_from_approved_tool_call(
                db, current_user.organization_id, current_user.id, body.conversation_id, body.approved_tool_call,
            )
            # None: an approval staged by the legacy path — it runs there.
            use_agent = resume is not None
        if resume is not None and not body.conversation_id:
            raise HTTPException(status_code=400, detail="conversation_id is required to resume.")

    if use_agent:
        generator = stream_copilot_agent(
            user_message=body.message.strip(),
            history=[m.model_dump() for m in body.history],
            organization_id=current_user.organization_id,
            db=db,
            page_context=body.page_context,
            background_tasks=background_tasks,
            user_id=current_user.id,
            conversation_id=body.conversation_id,
            user_role=current_user.role,
            resume=resume,
        )
        return StreamingResponse(generator, media_type="text/event-stream", headers=_SSE_HEADERS)

    generator = stream_copilot_chat(
        user_message=body.message.strip(),
        history=[m.model_dump() for m in body.history],
        organization_id=current_user.organization_id,
        db=db,
        page_context=body.page_context,
        background_tasks=background_tasks,
        user_id=current_user.id,
        conversation_id=body.conversation_id,
        approved_tool_call=body.approved_tool_call,
        user_role=current_user.role,
    )

    return StreamingResponse(generator, media_type="text/event-stream", headers=_SSE_HEADERS)


@router.post("/transcribe")
async def copilot_transcribe(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    """
    Transcribe audio file for the Copilot.
    """
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    audio_data = await file.read()
    try:
        result = await transcribe_audio(
            audio_data=audio_data,
            filename=file.filename or "recording.webm",
            content_type=file.content_type or "audio/webm",
            background_tasks=background_tasks,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription crashed: {type(e).__name__}: {str(e)}")
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result.get("detail", "Transcription failed"))
        
    return result


@router.post("/clean-transcript")
async def copilot_clean_transcript(
    body: CleanTranscriptRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    """
    Clean up speech-to-text transcript using an LLM to refine spelling,
    terminology, grammar, and casing.
    """
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
        
    try:
        cleaned = await clean_speech_transcript(
            text=body.text,
            background_tasks=background_tasks,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        return {"text": cleaned}
    except Exception as e:
        logger.error(f"Transcript cleanup error: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup error: {str(e)}")


# ── Conversation History Endpoints ────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Return paginated list of past conversations for the current user, newest first."""
    from app.models.copilot_conversation import CopilotConversation
    from sqlalchemy import select

    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    offset = (page - 1) * limit
    res = await db.execute(
        select(CopilotConversation)
        .where(
            CopilotConversation.organization_id == current_user.organization_id,
            CopilotConversation.user_id == current_user.id,
        )
        .order_by(CopilotConversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    convs = res.scalars().all()
    return [
        ConversationSummary(
            id=str(c.id),
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in convs
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
):
    """Return a single conversation with all its messages."""
    from app.models.copilot_conversation import CopilotConversation, CopilotMessage
    from sqlalchemy import select

    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")

    res = await db.execute(
        select(CopilotConversation).where(
            CopilotConversation.id == cid,
            CopilotConversation.organization_id == current_user.organization_id,
            CopilotConversation.user_id == current_user.id,
        )
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    msgs_res = await db.execute(
        select(CopilotMessage)
        .where(CopilotMessage.conversation_id == cid)
        .order_by(CopilotMessage.created_at)
    )
    msgs = msgs_res.scalars().all()

    # Restore any pending write-action awaiting approval
    pending_tool_call: Optional[dict] = None
    if conv.last_context and isinstance(conv.last_context.get("pending_action"), dict):
        pa = conv.last_context["pending_action"]
        pending_tool_call = {
            "name": pa.get("tool"),
            "args": pa.get("args"),
            "id": pa.get("id"),
        }

    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        pending_tool_call=pending_tool_call,
        messages=[
            ConversationMessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in msgs
        ],
    )


@router.delete("/conversations", status_code=204)
async def delete_all_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
):
    """Delete all conversations and their messages for the current user."""
    from app.models.copilot_conversation import CopilotConversation
    from sqlalchemy import delete

    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    try:
        stmt = delete(CopilotConversation).where(
            CopilotConversation.organization_id == current_user.organization_id,
            CopilotConversation.user_id == current_user.id,
        )
        await db.execute(stmt)
        # Commit here: get_db() only commits when it sees writes, and a 2.0-style
        # bulk delete doesn't register as one — it was silently rolled back.
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting all conversations: {e}")
        raise HTTPException(status_code=500, detail="Database deletion failed.")


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
):
    """Delete a conversation and all its messages (cascade)."""
    from app.models.copilot_conversation import CopilotConversation
    from sqlalchemy import select

    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")

    res = await db.execute(
        select(CopilotConversation).where(
            CopilotConversation.id == cid,
            CopilotConversation.organization_id == current_user.organization_id,
            CopilotConversation.user_id == current_user.id,
        )
    )
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    await db.delete(conv)
    # Commit handled by get_db() dependency


# ── Create a job from a Copilot JD ────────────────────────────────────────────

JOB_CREATED_RE = r"\[JOB_CREATED:([0-9a-f-]{36})\]"


class JDJobRequest(BaseModel):
    jd_text: str            # the JD as shown in chat (CTA stripped)
    job: dict               # fields parsed from the JD, same shape as POST /v1/jobs


def _norm(text_: str) -> str:
    import re
    from app.services.ai.copilot_service import JD_CTA

    text_ = re.sub(JOB_CREATED_RE, "", text_.replace(JD_CTA, ""))
    return re.sub(r"\s+", " ", text_).strip()


@router.post("/conversations/{conversation_id}/jd-job")
async def create_job_from_jd(
    conversation_id: str,
    body: JDJobRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
    background_tasks: BackgroundTasks,
):
    """Creates the job for a JD in this chat once. The job id is stamped on the
    chat message, so the chat shows "Job created" after a reload and a second
    click returns the same job instead of creating a duplicate."""
    import re
    from sqlalchemy import select
    from app.models.copilot_conversation import CopilotConversation, CopilotMessage
    from app.models.job import Job
    from app.routers.jobs import create_job_record
    from app.schemas.job import JobCreate, JobOut
    from app.schemas.response import APIResponse

    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Access denied.")
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.")

    wanted = _norm(body.jd_text)
    messages = (await db.execute(
        select(CopilotMessage)
        .join(CopilotConversation, CopilotConversation.id == CopilotMessage.conversation_id)
        .where(
            CopilotMessage.conversation_id == cid,
            CopilotMessage.role == "assistant",
            CopilotConversation.organization_id == current_user.organization_id,
            CopilotConversation.user_id == current_user.id,
        )
        .order_by(CopilotMessage.created_at.desc())
        .with_for_update(of=CopilotMessage)
    )).scalars().all()
    message = next((m for m in messages if _norm(m.content or "") == wanted), None)
    if message is None:
        raise HTTPException(status_code=404, detail="That JD is not in this conversation.")

    existing = re.search(JOB_CREATED_RE, message.content or "")
    if existing:
        job = (await db.execute(select(Job).where(
            Job.id == uuid.UUID(existing.group(1)), Job.organization_id == current_user.organization_id,
        ))).scalar_one_or_none()
        if job is not None:
            return APIResponse.success(message="Job already created.", data={"job": JobOut.model_validate(job), "created": False})

    def stamp(job):
        # Same transaction as the job (the message row stays locked until it
        # commits), so a double click can't create two jobs.
        message.content = re.sub(JOB_CREATED_RE, "", message.content or "").rstrip() + f"\n[JOB_CREATED:{job.id}]"

    job = await create_job_record(
        JobCreate(**{**body.job, "status": "active"}), current_user, db, background_tasks, before_commit=stamp,
    )
    return APIResponse.success(message="Job created.", data={"job": JobOut.model_validate(job), "created": True}, status_code=201)
