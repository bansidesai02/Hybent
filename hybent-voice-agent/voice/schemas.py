"""
Request/response models of the engine API (Plan §4).
"""
import re
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator

from voice.enums import TaskType

E164 = re.compile(r"^\+[1-9]\d{7,14}$")
LANGUAGES = {"en", "hi"}
# Call types with a script today (Plan §12: demo calls come in phase 3).
AVAILABLE_TYPES = {TaskType.PRESCREEN, TaskType.AVAILABILITY, TaskType.REMINDER}


def check_e164(v: str) -> str:
    v = v.strip()
    if not E164.match(v):
        raise ValueError("phone must be E.164, e.g. +919812345678")
    return v


class Callee(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone_e164: str
    timezone: str = "Asia/Kolkata"
    language_pref: str = "en"

    @field_validator("phone_e164")
    @classmethod
    def _e164(cls, v: str) -> str:
        return check_e164(v)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"unknown time zone: {v}")
        return v

    @field_validator("language_pref")
    @classmethod
    def _lang(cls, v: str) -> str:
        if v not in LANGUAGES:
            raise ValueError(f"language must be one of {sorted(LANGUAGES)}")
        return v


class Consent(BaseModel):
    """Proof the callee agreed to AI calls. Without it the engine won't dial."""
    type: str = Field(min_length=1, max_length=50)    # APPLICATION_FORM, EMAIL_REPLY, HR_RECORDED…
    captured_at: datetime
    source_ref: str | None = Field(default=None, max_length=500)


class TaskCreate(BaseModel):
    client_ref: str = Field(min_length=1, max_length=200)
    type: TaskType
    scope_id: str = Field(default="", max_length=100)
    callee: Callee
    context: dict = Field(default_factory=dict)
    consent: Consent
    schedule_at: datetime | None = None
    expires_at: datetime | None = None
    config: dict = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def _available(cls, v: TaskType) -> TaskType:
        if v not in AVAILABLE_TYPES:
            raise ValueError(f"{v} calls are not available yet")
        return v

    @field_validator("schedule_at", "expires_at")
    @classmethod
    def _aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError("timestamps must include a time zone offset")
        return v

    @field_validator("config")
    @classmethod
    def _config_keys(cls, v: dict) -> dict:
        allowed = {"window_start", "window_end", "max_attempts", "retry_gap_minutes"}
        unknown = set(v) - allowed
        if unknown:
            raise ValueError(f"unknown config keys: {sorted(unknown)}")
        return v


class OptOutCreate(BaseModel):
    scope_id: str = Field(default="", max_length=100)
    phone_e164: str
    reason: str = Field(default="client_request", max_length=200)

    @field_validator("phone_e164")
    @classmethod
    def _e164(cls, v: str) -> str:
        return check_e164(v)


class ResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    structured_data: dict
    summary_text: str
    communication: dict | None
    recommendation: dict | None
    flags: list


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    attempt_no: int
    status: str
    outcome: str | None
    started_at: datetime | None
    ended_at: datetime | None
    duration_sec: int | None
    language_detected: str | None
    audio_quality: str | None
    transcript: list
    callback_at: datetime | None
    recording_url: str | None
    result: ResultOut | None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_ref: str
    scope_id: str
    type: str
    status: str
    outcome: str | None
    attempt_count: int
    next_attempt_at: datetime | None
    expires_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime | None
    records: list[RecordOut] = []
