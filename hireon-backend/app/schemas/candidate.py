from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.schemas.base import OrmSchema


from app.schemas.invitation import InvitationOut

class CandidateOut(OrmSchema):
    id: str
    organization_id: str
    email: str
    full_name: str
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    github_url: str | None = None
    resume_url: str | None = None
    resume_filename: str | None = None
    parsed_data: dict | None = None
    skills: list[str]
    years_experience: int | None = None
    current_title: str | None = None
    current_company: str | None = None
    summary: str | None = None
    match_score: float | None = None
    score_breakdown: dict | None = None
    pipeline_stage: str | None = None
    tags: list[str]
    source: str | None = None
    created_at: datetime
    updated_at: datetime
    invitations: list[InvitationOut] = []



class CandidateUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    github_url: str | None = None
    tags: list[str] | None = None
    summary: str | None = None
    pipeline_stage: str | None = None

class CandidateStageUpdate(BaseModel):
    pipeline_stage: str
    send_rejection_email: bool = False
    job_id: str | None = None


class CandidateCreate(BaseModel):
    email: EmailStr
    full_name: str
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    source: str | None = None

class CandidateInvite(BaseModel):
    email: EmailStr
    full_name: str
    job_id: str | None = None
