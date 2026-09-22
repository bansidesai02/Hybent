from datetime import datetime
from pydantic import BaseModel
from app.utils.permissions import JobStatus
from app.schemas.base import OrmSchema

class JobCreate(BaseModel):
    title: str
    location: str | None = None
    job_type: str = "full_time"
    experience_level: str | None = None
    min_experience_years: int | None = 0
    description: str
    requirements: str | None = None
    responsibilities: str | None = None
    benefits: str | None = None
    skills_required: list[str] = []
    is_remote: bool = False
    application_deadline: datetime | None = None
    openings: int = 1
    display_order: int | None = None
    status: JobStatus = JobStatus.ACTIVE
    jd_url: str | None = None
    jd_filename: str | None = None


class JobUpdate(BaseModel):
    title: str | None = None
    location: str | None = None
    job_type: str | None = None
    experience_level: str | None = None
    min_experience_years: int | None = None
    description: str | None = None
    requirements: str | None = None
    responsibilities: str | None = None
    benefits: str | None = None
    skills_required: list[str] | None = None
    is_remote: bool | None = None
    application_deadline: datetime | None = None
    openings: int | None = None
    display_order: int | None = None
    status: JobStatus | None = None
    jd_url: str | None = None
    jd_filename: str | None = None


class PublicOrganizationOut(OrmSchema):
    name: str
    slug: str
    logo_url: str | None = None


class JobPublicOut(OrmSchema):
    """Trimmed, safe-for-anonymous-viewers job schema for the public apply page."""
    id: str
    title: str
    location: str | None = None
    job_type: str
    experience_level: str | None = None
    min_experience_years: int | None = 0
    description: str
    requirements: str | None = None
    responsibilities: str | None = None
    benefits: str | None = None
    skills_required: list[str]
    is_remote: bool
    application_deadline: datetime | None = None
    organization: PublicOrganizationOut


class JobOut(OrmSchema):
    id: str
    organization_id: str
    title: str
    location: str | None = None
    job_type: str
    experience_level: str | None = None
    min_experience_years: int | None = 0
    description: str
    requirements: str | None = None
    responsibilities: str | None = None
    benefits: str | None = None
    skills_required: list[str]
    status: JobStatus
    is_remote: bool
    application_deadline: datetime | None = None
    openings: int
    display_order: int = 0
    created_at: datetime
    updated_at: datetime
    jd_url: str | None = None
    jd_filename: str | None = None
    application_count: int = 0
    re_engage_count: int = 0
