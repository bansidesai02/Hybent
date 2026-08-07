from pydantic import BaseModel, Field
from typing import Optional, List
import uuid

class EvaluateNotesRequest(BaseModel):
    raw_notes: str = Field(..., min_length=10, max_length=20000, description="Raw interview notes text")

class GenerateJDRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=5000, description="Prompt for JD generation")

class AICreditRuleCreate(BaseModel):
    feature_name: str = Field(..., min_length=2, max_length=100)
    credits_per_use: int = Field(..., gt=0, le=1000, description="Credits used per invocation must be positive")
    description: Optional[str] = Field(None, max_length=500)

class AICreditTopupRequest(BaseModel):
    organization_id: uuid.UUID
    credits_to_add: int = Field(..., gt=0, le=1000000, description="Credits to topup must be positive")
    reason: Optional[str] = Field(None, max_length=255)

class AIUsageRecord(BaseModel):
    provider: str = Field(..., max_length=50)
    model: str = Field(..., max_length=100)
    feature: str = Field(..., max_length=100)
    prompt_tokens: int = Field(0, ge=0)
    completion_tokens: int = Field(0, ge=0)
    total_tokens: int = Field(0, ge=0)
    credits_used: int = Field(0, ge=0)
    duration_ms: float = Field(0.0, ge=0.0)
