"""
Recruiter AI Copilot Router
POST /v1/copilot/chat          — send a message (Admin & Recruiter only)
GET  /v1/copilot/conversations — list past conversations
GET  /v1/copilot/conversations/{id} — load a conversation with messages
DELETE /v1/copilot/conversations/{id} — delete a conversation
"""
import uuid
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status, UploadFile, File
from pydantic import BaseModel

from app.dependencies import DB, CurrentUser
from app.utils.permissions import RECRUITER_ROLES
from app.services.copilot_service import run_copilot_chat
from app.services.ai_evaluator import transcribe_audio

router = APIRouter(prefix="/v1/copilot", tags=["copilot"])

ALLOWED_ROLES = {r.value for r in RECRUITER_ROLES}  # ADMIN + RECRUITER


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


class CopilotChatResponse(BaseModel):
    reply: str
    error: bool = False
    conversation_id: Optional[str] = None  # ← always returned so frontend can track
    requires_approval: bool = False
    pending_tool_call: Optional[dict] = None



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


# ── Chat Endpoint ─────────────────────────────────────────────────────────────

@router.post("/chat", response_model=CopilotChatResponse)
async def copilot_chat(
    body: CopilotChatRequest,
    current_user: CurrentUser,
    db: DB,
    background_tasks: BackgroundTasks,
):
    """
    AI Copilot chat endpoint.
    - Only accessible by ADMIN and RECRUITER roles.
    - All DB queries inside are scoped to current_user.organization_id.
    - Saves every successful exchange to copilot_messages for persistent history.
    """
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This feature is available to Admins and Recruiters only.",
        )

    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    result = await run_copilot_chat(
        user_message=body.message.strip(),
        history=[m.model_dump() for m in body.history],
        organization_id=current_user.organization_id,
        db=db,
        page_context=body.page_context,
        background_tasks=background_tasks,
        user_id=current_user.id,
        conversation_id=body.conversation_id,
        approved_tool_call=body.approved_tool_call,
    )

    return CopilotChatResponse(**result)


@router.post("/transcribe")
async def copilot_transcribe(
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Transcribe audio file for the Copilot.
    """
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    audio_data = await file.read()
    result = await transcribe_audio(
        audio_data=audio_data,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result.get("detail", "Transcription failed"))
        
    return result


# ── Conversation History Endpoints ────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: CurrentUser,
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
    current_user: CurrentUser,
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

    return ConversationDetail(
        id=str(conv.id),
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
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


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    current_user: CurrentUser,
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
