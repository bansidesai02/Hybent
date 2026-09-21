"""
Candidate portal endpoints — for candidates to self-register, view their own applications,
respond to offers, and view interview schedules.
"""
import logging
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from app.dependencies import DB, CurrentUser
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.offer import Offer
from app.models.job import Job
from app.models.other_offer import OtherOffer
from app.models.job_referral import JobReferral
from app.models.candidate_document import CandidateDocument
from app.schemas.application import ApplicationOut
from app.schemas.interview import InterviewOut
from app.schemas.offer import OfferOut, OfferRespondRequest
from app.schemas.candidate import CandidateOut, CandidateUpdate
from app.schemas.job import JobOut
from app.schemas.job_referral import JobReferralOut
from app.schemas.other_offer import OtherOfferCreate, OtherOfferOut
from app.schemas.candidate_document import CandidateDocumentCreate, CandidateDocumentOut
from app.utils.permissions import UserRole, OfferStatus, NotificationType
from app.services.ai.ai_evaluator import generate_prep_materials
from datetime import datetime, timezone
from app.services.storage_service import save_resume
from app.services import supabase_storage_service
from app.services.ai.resume_parser import parse_resume, apply_experience_fields
from app.services.ai.resume_rag import stage_candidate_resume_chunks
from app.schemas.response import APIResponse
from app.tasks.notifications import notify_organization_roles
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/portal", tags=["portal"])


class PortalRegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    organization_slug: str


@router.post("/register", status_code=201)
async def portal_register(data: PortalRegisterRequest, db: DB):
    """Self-registration for candidates through the portal."""
    from app.models.organization import Organization
    from app.models.user import User
    from app.utils.security import hash_password, create_access_token, create_refresh_token
    from datetime import timedelta
    from app.models.user import RefreshToken

    org = (await db.execute(select(Organization).where(Organization.slug == data.organization_slug))).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing_user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        organization_id=org.id,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole.CANDIDATE,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    # A Candidate row with this email may already exist in this org (e.g. a
    # recruiter uploaded their resume before they ever registered) — link the
    # new account to it instead of creating a duplicate.
    candidate = (await db.execute(
        select(Candidate).where(Candidate.organization_id == org.id, Candidate.email == data.email)
    )).scalar_one_or_none()
    if candidate:
        candidate.user_id = user.id
    else:
        candidate = Candidate(
            organization_id=org.id,
            user_id=user.id,
            email=data.email,
            full_name=data.full_name,
        )
        db.add(candidate)

    access_token = create_access_token({"sub": str(user.id), "org": str(org.id), "role": user.role})
    refresh_tok = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_tok,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))

    return APIResponse.success(message="Registration successful.", data={"access_token": access_token, "refresh_token": refresh_tok, "token_type": "bearer"})


@router.get("/my-applications")
async def my_applications(current_user: CurrentUser, db: DB):
    """Candidate views their own applications."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    from sqlalchemy.orm import selectinload
    # 1. Fetch candidate ID first (indexed search)
    cand_query = select(Candidate.id).where(Candidate.user_id == current_user.id)
    cand_id = (await db.execute(cand_query)).scalar()
    
    if not cand_id:
        return APIResponse.success(message="Applications retrieved.", data=[])

    # 2. Fetch applications with all required nested data in one go
    result = await db.execute(
        select(Application)
        .where(Application.candidate_id == cand_id)
        .options(
            selectinload(Application.job),
            selectinload(Application.candidate).selectinload(Candidate.invitations),
            selectinload(Application.candidate).selectinload(Candidate.other_offers),
            selectinload(Application.candidate).selectinload(Candidate.documents)
        )
        .order_by(Application.created_at.desc())
    )
    apps = result.scalars().all()
    return APIResponse.success(message="Applications retrieved.", data=[ApplicationOut.model_validate(a).model_dump() for a in apps])


@router.get("/my-applications-summary")
async def my_applications_summary(current_user: CurrentUser, db: DB):
    """Small payload used by the portal shell to decide which nav items to show."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")

    cand_id = (await db.execute(select(Candidate.id).where(Candidate.user_id == current_user.id))).scalar()
    if not cand_id:
        return APIResponse.success(message="Application summary retrieved.", data=[])

    result = await db.execute(
        select(
            Application.id,
            Application.stage,
            Candidate.pipeline_stage,
        )
        .join(Candidate, Candidate.id == Application.candidate_id)
        .where(Application.candidate_id == cand_id)
        .order_by(Application.created_at.desc())
    )
    return APIResponse.success(
        message="Application summary retrieved.",
        data=[
            {
                "id": str(row.id),
                "stage": row.stage,
                "candidate_pipeline_stage": row.pipeline_stage,
            }
            for row in result
        ],
    )


@router.get("/my-interviews")
async def my_interviews(current_user: CurrentUser, db: DB):
    """Candidate views their scheduled interviews."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    cand_query = select(Candidate.id).where(Candidate.user_id == current_user.id)
    cand_id = (await db.execute(cand_query)).scalar()
    
    if not cand_id:
        return APIResponse.success(message="Interviews retrieved.", data=[])

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == cand_id)
        .options(
            selectinload(Interview.application).selectinload(Application.job),
            selectinload(Interview.scorecards)
        )
        .order_by(Interview.scheduled_at.desc())
    )
    return APIResponse.success(message="Interviews retrieved.", data=[InterviewOut.model_validate(i).model_dump() for i in result.scalars().all()])


@router.get("/my-offers")
async def my_offers(current_user: CurrentUser, db: DB):
    """Candidate views their offers."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    cand_query = select(Candidate.id).where(Candidate.user_id == current_user.id)
    cand_id = (await db.execute(cand_query)).scalar()
    
    if not cand_id:
        return APIResponse.success(message="Offers retrieved.", data=[])

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Offer)
        .join(Application, Offer.application_id == Application.id)
        .where(Application.candidate_id == cand_id)
        .options(
            selectinload(Offer.application).selectinload(Application.job),
            selectinload(Offer.application).selectinload(Application.candidate)
        )
    )
    return APIResponse.success(message="Offers retrieved.", data=[OfferOut.model_validate(o).model_dump() for o in result.scalars().all()])


@router.post("/offers/{offer_id}/respond")
async def portal_respond_offer(offer_id: uuid.UUID, data: OfferRespondRequest, current_user: CurrentUser, db: DB):
    """Candidate accepts or declines their offer via portal."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")

    cand_query = select(Candidate.id).where(Candidate.user_id == current_user.id)
    cand_id = (await db.execute(cand_query)).scalar()
    if not cand_id:
        raise HTTPException(status_code=404, detail="Offer not found")

    result = await db.execute(
        select(Offer)
        .join(Application, Offer.application_id == Application.id)
        .where(Offer.id == offer_id, Application.candidate_id == cand_id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer.status = OfferStatus.ACCEPTED if data.accept else OfferStatus.DECLINED
    offer.responded_at = datetime.now(timezone.utc)
    if not data.accept:
        offer.decline_reason = data.decline_reason
    await db.commit()
    await db.refresh(offer)

    # Notify the hiring team about the candidate's response
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    candidate_name = candidate.full_name if candidate else "The candidate"
    action_word = "accepted" if data.accept else "declined"
    notif_type = NotificationType.OFFER_ACCEPTED if data.accept else NotificationType.OFFER_DECLINED
    notify_organization_roles.delay(
        str(current_user.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        notif_type,
        f"Offer {action_word.capitalize()}",
        f"{candidate_name} has {action_word} the offer for '{offer.position_title}'.",
        {"offer_id": str(offer.id), "candidate": candidate_name, "action": action_word},
    )

    return APIResponse.success(message="Offer response recorded.", data=OfferOut.model_validate(offer))


@router.get("/profile")
async def portal_profile(current_user: CurrentUser, db: DB):
    """Candidate views their own profile."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    from sqlalchemy.orm import selectinload
    from app.schemas.candidate import CandidateOut
    query = (
        select(Candidate)
        .where(Candidate.user_id == current_user.id)
        .options(
            selectinload(Candidate.invitations),
            selectinload(Candidate.other_offers),
            selectinload(Candidate.documents)
        )
    )
    result = await db.execute(query)
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return APIResponse.success(message="Profile retrieved.", data=CandidateOut.model_validate(candidate))


@router.put("/profile")
async def update_portal_profile(data: CandidateUpdate, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    result = await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = data.model_dump(exclude_unset=True)
    
    if "email" in update_data and update_data["email"] != candidate.email:
        from app.models.user import User
        existing_user = (await db.execute(select(User).where(User.email == update_data["email"]))).scalar_one_or_none()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email already in use")
        
        user = (await db.execute(select(User).where(User.id == current_user.id))).scalar_one_or_none()
        if user:
            user.email = update_data["email"]

    for field, value in update_data.items():
        setattr(candidate, field, value)

    await db.commit()
    await db.refresh(candidate)
    return APIResponse.success(message="Profile updated successfully.", data=CandidateOut.model_validate(candidate))


@router.post("/profile/resume", response_model=CandidateOut)
async def upload_portal_resume(
    current_user: CurrentUser,
    db: DB,
    file: UploadFile = File(...),
):
    """Candidate self-uploads their resume; AI-parses and updates their profile."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")

    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    file_content = await file.read()
    await file.seek(0)

    # ── Upload to Supabase Storage (if configured) or fall back to Cloudinary/local ──
    if settings.supabase_url and settings.supabase_service_role_key:
        storage_path = await supabase_storage_service.upload_resume(
            file_content=file_content,
            organization_id=str(current_user.organization_id),
            candidate_id=str(candidate.id),
            original_filename=file.filename or "resume",
            content_type=file.content_type or "application/octet-stream",
        )
        candidate.resume_storage_path = storage_path
        candidate.resume_url = None  # Signed URLs are generated on-demand
        candidate.resume_filename = file.filename
    else:
        # Legacy fallback: Cloudinary or local disk
        url, original_name = await save_resume(file, str(current_user.organization_id))
        candidate.resume_url = url
        candidate.resume_filename = original_name

    parsed = await parse_resume(file_content, file.content_type or "", file.filename or "")
    candidate.parsed_data = parsed

    if parsed.get("skills"):
        candidate.skills = parsed["skills"][:30]
    apply_experience_fields(candidate, parsed)
    if parsed.get("current_title"):
        candidate.current_title = parsed["current_title"]
        from app.utils.category import extract_core_category
        core_cat = extract_core_category(parsed["current_title"])
        if core_cat and not candidate.applied_job_title:
            candidate.applied_job_title = core_cat
    if parsed.get("summary"):
        candidate.summary = parsed["summary"]

    # If the candidate was stuck in 'needs_review' (set by AI scoring before
    # they completed their profile), clear it so the recruiter sees them as
    # "In Review" and can evaluate them properly.
    if candidate.pipeline_stage in (None, "needs_review"):
        candidate.pipeline_stage = None

    try:
        await stage_candidate_resume_chunks(db, candidate)
    except Exception as exc:
        logger.warning(f"[RAG] Failed to stage resume chunks for candidate {candidate.id}: {exc}")

    await db.commit()
    await db.refresh(candidate)
    return APIResponse.success(message="Resume uploaded successfully.", data=CandidateOut.model_validate(candidate))


@router.get("/profile/resume")
async def get_portal_resume_url(current_user: CurrentUser, db: DB):
    """
    Candidate fetches a fresh signed URL for their own resume.
    Returns a time-limited URL for viewing/downloading the resume securely.
    """
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")

    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    if not candidate.resume_storage_path:
        if candidate.resume_url:
            # Legacy Cloudinary/local URL — return directly
            return APIResponse.success(
                message="Resume URL retrieved.",
                data={
                    "url": candidate.resume_url,
                    "expires_in": None,
                    "filename": candidate.resume_filename,
                    "is_legacy": True,
                },
            )
        raise HTTPException(status_code=404, detail="No resume uploaded yet.")

    signed_url = await supabase_storage_service.get_signed_resume_url(
        storage_path=candidate.resume_storage_path,
        expiry_seconds=settings.resume_signed_url_expiry,
    )

    return APIResponse.success(
        message="Resume URL generated successfully.",
        data={
            "url": signed_url,
            "expires_in": settings.resume_signed_url_expiry,
            "filename": candidate.resume_filename,
            "is_legacy": False,
        },
    )


@router.post("/profile/other-offers")
async def add_other_offer(data: OtherOfferCreate, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    offer = OtherOffer(
        candidate_id=candidate.id,
        company_name=data.company_name,
        role=data.role,
        ctc=data.ctc,
        validity_date=data.validity_date
    )
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    return APIResponse.success(message="Other offer added successfully.", data=OtherOfferOut.model_validate(offer))


@router.delete("/profile/other-offers/{offer_id}")
async def remove_other_offer(offer_id: uuid.UUID, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    offer = (await db.execute(select(OtherOffer).where(OtherOffer.id == offer_id, OtherOffer.candidate_id == candidate.id))).scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    await db.delete(offer)
    await db.commit()
    return APIResponse.success(message="Other offer removed successfully.")


@router.get("/jobs")
async def portal_get_jobs(current_user: CurrentUser, db: DB):
    """Candidate views open jobs within the organization."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    result = await db.execute(
        select(Job).where(Job.organization_id == current_user.organization_id, Job.status == "active")
    )
    return APIResponse.success(message="Jobs retrieved.", data=[JobOut.model_validate(j).model_dump() for j in result.scalars().all()])


@router.post("/jobs/{job_id}/apply", response_model=ApplicationOut, status_code=201)
async def portal_apply_to_job(job_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Candidate self-applies to an active job within the organization."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")

    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    # Check for resume — supports both Supabase path and legacy URL
    if not candidate.resume_storage_path and not candidate.resume_url:
        raise HTTPException(status_code=400, detail="Please upload a resume before applying")

    # Verify the job exists and belongs to the same org
    job = (await db.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == current_user.organization_id, Job.status == "active")
    )).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or no longer active")

    # Prevent duplicate applications
    existing = (await db.execute(
        select(Application).where(
            Application.candidate_id == candidate.id,
            Application.job_id == job.id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied to this job")

    application = Application(
        candidate_id=candidate.id,
        job_id=job.id,
        stage="applied",
        organization_id=current_user.organization_id,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    from sqlalchemy.orm import selectinload
    app_with_job = (await db.execute(
        select(Application).where(Application.id == application.id).options(selectinload(Application.job))
    )).scalar_one()

    # Notify the recruiting team about the new self-application
    notify_organization_roles.delay(
        str(current_user.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.APPLICATION_RECEIVED,
        "New Job Application",
        f"{candidate.full_name} has applied to '{job.title}' via the candidate portal.",
        {"candidate_id": str(candidate.id), "job_id": str(job.id)},
    )

    return APIResponse.success(message="Applied to job successfully.", data=ApplicationOut.model_validate(app_with_job))


@router.post("/jobs/{job_id}/refer")
async def portal_refer_job(
    job_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    referee_first_name: str = Form(...),
    referee_last_name: str = Form(...),
    referee_email: EmailStr = Form(...),
    referee_phone: str | None = Form(None),
    relationship: str | None = Form(None),
    reason: str | None = Form(None),
    resume: UploadFile | None = File(None)
):
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    job = (await db.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == current_user.organization_id)
    )).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resume_url = None
    resume_filename = None
    if resume and resume.filename:
        resume_url, resume_filename = await save_resume(resume, str(current_user.organization_id))

    referral = JobReferral(
        job_id=job.id,
        referrer_id=candidate.id,
        referee_first_name=referee_first_name,
        referee_last_name=referee_last_name,
        referee_email=referee_email,
        referee_phone=referee_phone,
        relation_to_referrer=relationship,
        reason=reason,
        resume_url=resume_url,
        resume_filename=resume_filename
    )
    db.add(referral)
    await db.commit()
    await db.refresh(referral)
    return APIResponse.success(message="Job referral submitted successfully.", data=JobReferralOut.model_validate(referral))


@router.get("/documents")
async def portal_get_documents(current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    docs = await db.execute(select(CandidateDocument).where(CandidateDocument.candidate_id == candidate.id))
    return APIResponse.success(message="Documents retrieved.", data=[CandidateDocumentOut.model_validate(d).model_dump() for d in docs.scalars().all()])


@router.post("/documents")
async def portal_add_document(data: CandidateDocumentCreate, current_user: CurrentUser, db: DB):
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    doc = CandidateDocument(
        candidate_id=candidate.id,
        doc_type=data.doc_type,
        file_url=data.file_url,
        status=data.status
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return APIResponse.success(message="Document added successfully.", data=CandidateDocumentOut.model_validate(doc))


@router.get("/applications/{application_id}/prep-hub")
async def portal_prep_hub(application_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """
    Candidates fetch AI-generated prep materials specific to their application's job.
    """
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
        
    candidate = (await db.execute(select(Candidate).where(Candidate.user_id == current_user.id))).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Profile not found")

    app_result = await db.execute(select(Application).where(Application.id == application_id, Application.candidate_id == candidate.id))
    application = app_result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    job_result = await db.execute(select(Job).where(Job.id == application.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Associated Job not found")
        
    # Generate prep materials dynamically
    # Use description or skills required + candidate resume
    desc = job.description or ""
    skills = " ".join(job.skills_required or [])
    
    candidate_summary = candidate.summary or ""
    candidate_skills = " ".join(candidate.skills or [])
    resume_highlights = f"Summary: {candidate_summary}\nSkills: {candidate_skills}"
    
    materials = await generate_prep_materials(job.title, f"{desc} {skills}", resume_highlights)
    return APIResponse.success(message="Prep materials generated successfully.", data=materials)
