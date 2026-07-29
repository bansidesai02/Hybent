from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Question structure stored in JSONB ────────────────────────────────────────

class ScreeningQuestion(BaseModel):
    id: int
    text: str
    category: str  # job_description | resume | role_awareness


# ── Request schemas ────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    candidate_id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    application_id: Optional[uuid.UUID] = None


class UpdateStatusRequest(BaseModel):
    status: str  # in_progress | completed


class SetLanguageRequest(BaseModel):
    language: str  # english | hindi | gujarati


# ── Response schemas ───────────────────────────────────────────────────────────

class PreScreeningResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    question_index: int
    audio_file_path: Optional[str] = None
    transcript: Optional[str] = None
    duration_seconds: Optional[float] = None
    recorded_at: datetime

    @property
    def has_audio(self) -> bool:
        return bool(self.audio_file_path)


class PreScreeningSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    candidate_id: uuid.UUID
    application_id: Optional[uuid.UUID] = None
    job_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    questions: list[ScreeningQuestion]
    status: str
    invite_token: str
    expires_at: datetime
    overall_ai_summary: Optional[str] = None
    completed_at: Optional[datetime] = None
    language: str = "english"
    created_at: datetime
    updated_at: datetime
    responses: list[PreScreeningResponseOut] = []

    # Enriched fields (populated by router)
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    job_title: Optional[str] = None


class PreScreeningSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: Optional[uuid.UUID] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    response_count: int = 0

    # Enriched fields
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    job_title: Optional[str] = None


class PublicSessionOut(BaseModel):
    """Returned to candidate via invite token — no sensitive org data."""
    id: uuid.UUID
    candidate_name: str
    job_title: Optional[str] = None
    questions: list[ScreeningQuestion]
    status: str
    expires_at: datetime
    response_count: int = 0
    language: str = "english"
    translated_questions: list[ScreeningQuestion] = []
