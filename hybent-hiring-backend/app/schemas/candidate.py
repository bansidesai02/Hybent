from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.schemas.base import OrmSchema


from app.schemas.invitation import InvitationOut
from app.schemas.other_offer import OtherOfferOut
from app.schemas.candidate_document import CandidateDocumentOut

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
    # Supabase Storage path — present when resume was uploaded to Supabase.
    # Frontend must call GET /v1/candidates/{id}/resume to get a signed URL.
    resume_storage_path: str | None = None
    parsed_data: dict | None = None
    skills: list[str]
    years_experience: float | None = None
    experience_years: str | None = None
    notice_period_days: str | None = None
    current_ctc: str | None = None
    expected_ctc: str | None = None
    work_mode_preference: str | None = None
    availability_status: str | None = None
    interview_availability_days: str | None = None
    interview_time_slot: str | None = None
    blackout_dates: str | None = None
    weekend_interviews: bool = False
    current_title: str | None = None
    current_company: str | None = None
    summary: str | None = None
    match_score: float | None = None
    score_breakdown: dict | None = None
    pipeline_stage: str | None = None
    applied_job_title: str | None = None
    tags: list[str]
    hr_notes: str | None = None
    talent_pool_comment: str | None = None
    source: str | None = None
    # Bulk import fields
    sr_no: str | None = None
    import_row_date: str | None = None
    hr_name: str | None = None
    technical_panel: str | None = None
    reference: str | None = None
    relevant_experience: str | None = None
    current_salary: str | None = None
    expected_salary: str | None = None
    import_status: str = "active"
    remarks_hr: str | None = None
    remarks_technical: str | None = None
    remarks_practical: str | None = None
    techno_functional_hr_interview: str | None = None
    import_panel_name: str | None = None
    import_date: datetime | None = None
    created_at: datetime
    updated_at: datetime
    created_by_id: str | None = None
    import_batch_id: str | None = None
    imported_by_id: str | None = None
    imported_at: datetime | None = None
    created_by_name: str | None = None
    invitations: list[InvitationOut] = []
    other_offers: list[OtherOfferOut] = []
    documents: list[CandidateDocumentOut] = []



class CandidateUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    phone: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    github_url: str | None = None
    tags: list[str] | None = None
    summary: str | None = None
    pipeline_stage: str | None = None
    years_experience: float | None = None
    experience_years: str | None = None
    notice_period_days: str | None = None
    current_ctc: str | None = None
    expected_ctc: str | None = None
    work_mode_preference: str | None = None
    availability_status: str | None = None
    interview_availability_days: str | None = None
    interview_time_slot: str | None = None
    blackout_dates: str | None = None
    weekend_interviews: bool | None = None
    hr_notes: str | None = None
    talent_pool_comment: str | None = None
    # Bulk import / Extended fields
    current_company: str | None = None
    current_title: str | None = None
    applied_job_title: str | None = None
    relevant_experience: str | None = None
    current_salary: str | None = None
    expected_salary: str | None = None
    remarks_hr: str | None = None
    remarks_technical: str | None = None
    remarks_practical: str | None = None
    techno_functional_hr_interview: str | None = None
    technical_panel: str | None = None
    reference: str | None = None
    import_status: str | None = None
    hr_name: str | None = None
    sr_no: str | None = None
    source: str | None = None

class CandidateStageUpdate(BaseModel):
    pipeline_stage: str
    send_rejection_email: bool = False
    job_id: str | None = None


class CandidateDesignationUpdate(BaseModel):
    designation_id: str | None = None
    designationId: str | None = None


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
