import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Decision = Literal["RECOMMEND_NEXT_ROUND", "HOLD", "NOT_RECOMMENDED"]
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_FIELD = re.compile(r"^[a-z][a-z0-9_]{1,49}$")


class StartPrescreenRequest(BaseModel):
    job_id: uuid.UUID
    candidate_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)


class StartResultOut(BaseModel):
    candidate_id: uuid.UUID
    voice_call_id: uuid.UUID | None = None
    error: str | None = None


class OverrideRequest(BaseModel):
    decision: Decision
    note: str | None = Field(default=None, max_length=1000)


class ConsentRequest(BaseModel):
    # How HR obtained it, e.g. a call or an email the candidate replied to.
    source: Literal["HR_RECORDED_VERBAL", "HR_RECORDED_EMAIL", "HR_RECORDED_OTHER"] = "HR_RECORDED_OTHER"


class VoiceSettingsUpdate(BaseModel):
    window_start: str | None = None
    window_end: str | None = None
    max_attempts: int | None = Field(default=None, ge=1, le=5)
    retry_gap_minutes: int | None = Field(default=None, ge=15, le=1440)
    default_language: Literal["en", "hi"] | None = None
    communication_threshold_client_facing: float | None = Field(default=None, ge=1, le=5)
    communication_threshold_other: float | None = Field(default=None, ge=1, le=5)
    auto_update_profile: bool | None = None
    recording_retention_days: int | None = Field(default=None, ge=7, le=365)
    reminder_calls: bool | None = None

    @field_validator("window_start", "window_end")
    @classmethod
    def _hhmm(cls, v: str | None) -> str | None:
        if v is not None and not _HHMM.match(v):
            raise ValueError("use HH:MM, 24-hour")
        return v

    @model_validator(mode="after")
    def _window_order(self):
        if self.window_start and self.window_end and self.window_start >= self.window_end:
            raise ValueError("calling window must end after it starts")
        return self


class QuestionIn(BaseModel):
    field: str
    question: str = Field(min_length=5, max_length=300)
    required: bool = True

    @field_validator("field")
    @classmethod
    def _field(cls, v: str) -> str:
        if not _FIELD.match(v):
            raise ValueError("field must be snake_case, e.g. night_shift_ok")
        return v


class BudgetIn(BaseModel):
    value: int = Field(gt=0)
    currency: Literal["INR", "USD", "AED", "SGD", "AUD", "EUR"] = "INR"


class CriteriaIn(BaseModel):
    min_experience_years: float | None = Field(default=None, ge=0, le=50)
    max_experience_years: float | None = Field(default=None, ge=0, le=50)
    budget_max: BudgetIn | None = None
    max_notice_days: int | None = Field(default=None, ge=0, le=365)
    communication_threshold: float | None = Field(default=None, ge=1, le=5)


class JobVoiceConfig(BaseModel):
    """Empty questions = the default pre-screen set (Spec §5.5)."""
    questions: list[QuestionIn] = Field(default_factory=list, max_length=15)
    criteria: CriteriaIn = Field(default_factory=CriteriaIn)
    client_facing: bool = False
    currency: Literal["INR", "USD", "AED", "SGD", "AUD", "EUR"] = "INR"

    @field_validator("questions")
    @classmethod
    def _unique(cls, v: list[QuestionIn]) -> list[QuestionIn]:
        fields = [q.field for q in v]
        if len(fields) != len(set(fields)):
            raise ValueError("question fields must be unique")
        return v


class VoiceCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID | None
    interview_id: uuid.UUID | None
    type: str
    reminder_number: int | None
    use_case_outcome: str | None
    task_status: str
    outcome: str | None
    attempt_no: int
    final: bool
    next_attempt_at: datetime | None
    error: str | None
    started_at: datetime | None
    duration_sec: int | None
    language: str
    language_detected: str | None
    audio_quality: str | None
    callback_at: datetime | None
    decision: str | None
    hr_override: dict | None
    resolved_at: datetime | None
    profile_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class VoiceCallDetailOut(VoiceCallOut):
    request: dict | None
    transcript: list
    recording_url: str | None
    result: dict | None
    summary_text: str | None


# ── Phase 2: availability calls ──────────────────────────────────────────────

class AvailabilityWindow(BaseModel):
    """HR's interview window, in the org's time zone (Plan §7: HR-defined slots in v1)."""
    from_date: str          # YYYY-MM-DD
    to_date: str
    day_start: str = "10:00"
    day_end: str = "18:00"
    weekdays_only: bool = True

    @field_validator("from_date", "to_date")
    @classmethod
    def _date(cls, v: str) -> str:
        from datetime import date
        date.fromisoformat(v)
        return v

    @field_validator("day_start", "day_end")
    @classmethod
    def _hhmm(cls, v: str) -> str:
        if not _HHMM.match(v):
            raise ValueError("use HH:MM, 24-hour")
        return v

    @model_validator(mode="after")
    def _order(self):
        if self.from_date > self.to_date:
            raise ValueError("the window must end on or after its start date")
        if self.day_start >= self.day_end:
            raise ValueError("the day must end after it starts")
        from datetime import date
        if (date.fromisoformat(self.to_date) - date.fromisoformat(self.from_date)).days > 21:
            raise ValueError("pick a window of at most three weeks")
        return self


class PanelistRef(BaseModel):
    user_id: uuid.UUID
    role: str | None = Field(default=None, max_length=100)


class AvailabilityRequest(BaseModel):
    candidate_id: uuid.UUID
    round: str = Field(min_length=2, max_length=120)            # e.g. "Technical Round 1"
    mode: Literal["VIDEO", "PHONE", "IN_PERSON"] = "VIDEO"
    duration_min: int = Field(default=45, ge=15, le=240)
    location: str | None = Field(default=None, max_length=255)
    job_id: uuid.UUID | None = None
    application_id: uuid.UUID | None = None
    panelists: list[PanelistRef] = Field(default_factory=list, max_length=6)
    window: AvailabilityWindow
