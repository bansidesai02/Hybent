import uuid
import logging
import re
from dataclasses import dataclass, field
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from app.dependencies import DB, RecruiterUser
from app.models.candidate import Candidate
from app.schemas.candidate import CandidateOut
from app.services.storage_service import save_resume
from app.services import supabase_storage_service
from app.services.ai.resume_parser import parse_resume
from app.services.activity_service import log_activity
from app.schemas.response import APIResponse
from app.core.config import settings



@dataclass
class _JobReq:
    """Lightweight wrapper so upload-and-create can use the real ML scorer."""
    title: str
    description: str = ""
    requirements: str = ""
    skills_required: list = field(default_factory=list)
    min_experience_years: float = 0
    experience_level: str = ""

router = APIRouter(prefix="/v1/resumes", tags=["resumes"])
logger = logging.getLogger(__name__)


@router.post("/upload/{candidate_id}")
async def upload_resume(
    candidate_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: RecruiterUser,
    db: DB,
    file: UploadFile = File(...),
):
    """Upload a resume for an existing candidate. Triggers AI parsing."""
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.organization_id == current_user.organization_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    file_content = await file.read()
    await file.seek(0)

    # ── Upload to Supabase Storage (if configured) or fall back to Cloudinary/local ──
    if settings.supabase_url and settings.supabase_service_role_key:
        storage_path = await supabase_storage_service.upload_resume(
            file_content=file_content,
            organization_id=str(current_user.organization_id),
            candidate_id=str(candidate_id),
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

    parsed = await parse_resume(
        file_content,
        file.content_type or "",
        file.filename or "",
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    candidate.parsed_data = parsed

    if parsed.get("skills"):
        candidate.skills = parsed["skills"][:30]
    if parsed.get("years_experience"):
        candidate.years_experience = parsed["years_experience"]
    if parsed.get("experience_years"):
        candidate.experience_years = parsed["experience_years"]
    if parsed.get("current_title"):
        candidate.current_title = parsed["current_title"]
    if parsed.get("current_company"):
        candidate.current_company = parsed["current_company"]
    if parsed.get("summary"):
        candidate.summary = parsed["summary"]
    if parsed.get("full_name") and not candidate.full_name:
        candidate.full_name = parsed["full_name"]
    if parsed.get("phone") and not candidate.phone:
        candidate.phone = parsed["phone"]
    if parsed.get("location") and not candidate.location:
        candidate.location = parsed["location"]
    if parsed.get("linkedin_url") and not candidate.linkedin_url:
        candidate.linkedin_url = parsed["linkedin_url"]
    if parsed.get("github_url") and not candidate.github_url:
        candidate.github_url = parsed["github_url"]
    if parsed.get("portfolio_url") and not candidate.portfolio_url:
        candidate.portfolio_url = parsed["portfolio_url"]

    return APIResponse.success(message="Resume uploaded successfully.", data=CandidateOut.model_validate(candidate))


@router.post("/upload-and-create", status_code=201)
async def upload_and_create(
    background_tasks: BackgroundTasks,
    current_user: RecruiterUser,
    db: DB,
    file: UploadFile = File(...),
    job_id: str | None = Form(None),
    role_title: str = Form(""),
    required_skills: str = Form(""),   # comma-separated
    min_experience: float = Form(0.0),
    match_threshold: float = Form(70.0),
):
    """Upload a resume, parse with AI, score against job requirements, create/update candidate."""
    file_content = await file.read()
    await file.seek(0)

    parsed = await parse_resume(
        file_content, 
        file.content_type or "", 
        file.filename or "",
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    logger.info(f"Upload-and-create parsed resume: {parsed}")

    full_name = parsed.get("full_name") or "Unknown Candidate"
    email = parsed.get("email")
    if not email:
        clean_name = re.sub(r'[^a-zA-Z0-9]', '', full_name.lower()) or "applicant"
        email = f"{clean_name}.{uuid.uuid4().hex[:6]}@hybent.temp"
        parsed["email"] = email
        logger.info(f"No email found in resume text. Generated fallback email: {email}")

    # Check for duplicate
    from sqlalchemy.orm import selectinload
    existing = await db.execute(
        select(Candidate)
        .where(
            Candidate.email == email,
            Candidate.organization_id == current_user.organization_id,
        )
        .options(selectinload(Candidate.created_by))
    )
    candidate = existing.scalar_one_or_none()
    if candidate:
        logger.info(f"Duplicate email match found: {email} for existing candidate {candidate.full_name} (ID: {candidate.id})")
        creator_name = "Admin"
        try:
            cb = candidate.created_by
            if cb is not None:
                creator_name = getattr(cb, "full_name", None) or "Admin"
        except Exception:
            pass
        raise HTTPException(
            status_code=409, 
            detail={
                "message": f"Candidate with this email was already added by {creator_name}",
                "candidate_id": str(candidate.id)
            }
        )

    # Resolve target job/designation
    from app.models.job import Job
    job = None
    if job_id and job_id.lower() not in ("null", "undefined", ""):
        try:
            job_res = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
            job = job_res.scalar_one_or_none()
        except ValueError:
            pass

    target_title = job.title if job else role_title
            
    from app.utils.category import extract_core_category, extract_all_categories, detect_category_from_skills, get_missing_skills_hint, get_tech_keywords
    target_categories = extract_all_categories(target_title)
    
    # Skill-based detection is more accurate than title (e.g. "Software Engineer" with MEAN skills → MEAN Stack)
    candidate_skills_list = parsed.get("skills", [])
    candidate_skills_str = " ".join(candidate_skills_list).lower()
    parsed_category = detect_category_from_skills(candidate_skills_list) or extract_core_category(parsed.get("current_title", ""))
    
    def is_mismatch(cat1: str, cat2: str) -> bool:
        if not cat1 or not cat2: return False
        c1, c2 = cat1.lower(), cat2.lower()
        if c1 in c2 or c2 in c1: return False
        
        generics = ["software", "engineer", "developer", "backend", "frontend", "full stack", "programmer", "coder", "tech lead", "it", "web"]
        any(g in c1 for g in generics)
        is_c2_generic = any(g in c2 for g in generics)
        
        # If target category is generic, it's not a mismatch
        if is_c2_generic:
            return False
            
        # Target is specific tech category (e.g. "Angular", ".Net")
        # Check if the candidate has the required technology keywords in their skills
        target_kws = get_tech_keywords(cat2)
        if any(kw in candidate_skills_str for kw in target_kws):
            return False
            
        return True

    mismatch_detected = False
    if target_title:
        mismatch_detected = True
        for target_cat in target_categories:
            if not is_mismatch(parsed_category, target_cat):
                mismatch_detected = False
                break

        if mismatch_detected:
            primary_target_cat = target_categories[0] if target_categories else target_title
            missing_skills = get_missing_skills_hint(candidate_skills_list, primary_target_cat)
            
            suggested_roles = []
            if parsed.get("current_title"):
                suggested_roles.append(parsed["current_title"])
            if parsed_category and parsed_category not in suggested_roles:
                suggested_roles.append(parsed_category)
                
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "role_mismatch",
                    "candidate_category": parsed_category or "Unknown",
                    "target_category": primary_target_cat,
                    "missing_skills": missing_skills,
                    "suggested_roles": suggested_roles,
                    "message": f"Upload Rejected: Mismatch detected. Uploaded resume is for a '{parsed_category or 'Unknown'}' role (current title: '{parsed.get('current_title', 'N/A')}'), but the target job requires '{target_title}'."
                }
            )
    else:
        # No job explicitly chosen — find/create a designation pool by title,
        # via the same helper the email-ingestion pipeline uses.
        from app.utils.job_matching import resolve_or_create_pool_job
        job = await resolve_or_create_pool_job(
            db,
            current_user.organization_id,
            title_hint=parsed.get("current_title"),
            category_hint=parsed_category,
        )
        target_title = job.title

    # Priority 1: compute score using the real ML scorer
    req_skills_list = [s.strip() for s in required_skills.split(",") if s.strip()]
    score: float | None = None
    breakdown: dict | None = None

    
    is_real_job = job and getattr(job, "status", None) != "pool"
    has_custom_requirements = bool(req_skills_list) or min_experience > 0 or bool(role_title)

    if is_real_job or has_custom_requirements:
        if not job or getattr(job, "status", None) == "pool":
            job = _JobReq(
                title=role_title or (job.title if job else "Role"),
                skills_required=req_skills_list,
                min_experience_years=min_experience,
            )
        
        list(job.skills_required or []) if not isinstance(job, _JobReq) else req_skills_list
        job.title
        
        from app.services.ai.match_scorer import evaluate_candidate_match
        score, breakdown = await evaluate_candidate_match(
            candidate_data=parsed,
            candidate_skills=parsed.get("skills", []),
            years_experience=parsed.get("years_experience"),
            job=job,
            match_threshold=match_threshold,
            background_tasks=background_tasks,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )

    # Priority 2: never auto-reject — low score → needs_review, not rejected
    # User Request: Don't automatically add to pipeline. Allow recruiter to click "Add to Pipeline".
    initial_stage = None
    if score is not None and match_threshold is not None and score < float(match_threshold):
        initial_stage = "needs_review"

    if not candidate:
        candidate = Candidate(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            email=email,
            full_name=full_name,
            pipeline_stage=initial_stage,
        )
        db.add(candidate)
        await db.flush()
    # If candidate exists, we don't automatically overwrite their current pipeline stage during a simple resume update/re-score
    # unless it was previously None or needs_review and we want to keep it that way.
    # Actually, if they are already in the pipeline (e.g. 'interview'), we definitely don't want to reset them to None.
    elif candidate.pipeline_stage is None or candidate.pipeline_stage == "needs_review":
        candidate.pipeline_stage = initial_stage

    # ── Upload to Supabase Storage (if configured) or fall back to Cloudinary/local ──
    uploaded_to_supabase = False
    if settings.supabase_url and settings.supabase_service_role_key:
        try:
            storage_path = await supabase_storage_service.upload_resume(
                file_content=file_content,
                organization_id=str(current_user.organization_id),
                candidate_id=str(candidate.id),
                original_filename=file.filename or "resume",
                content_type=file.content_type or "application/octet-stream",
            )
            candidate.resume_storage_path = storage_path
            candidate.resume_url = None  # Signed URLs are generated on-demand
            candidate.resume_filename = file.filename or original_name
            uploaded_to_supabase = True
        except Exception as e:
            logger.warning(f"Supabase resume upload failed ({e}), falling back to local/Cloudinary storage.")

    if not uploaded_to_supabase:
        # Legacy fallback: Cloudinary or local disk
        url, original_name = await save_resume(file, str(current_user.organization_id))
        candidate.resume_url = url
        candidate.resume_filename = original_name
    candidate.full_name = full_name or candidate.full_name
    candidate.skills = parsed.get("skills", [])[:30]
    candidate.years_experience = parsed.get("years_experience")
    candidate.experience_years = parsed.get("experience_years")
    cand_title = parsed.get("current_title")
    cand_company = parsed.get("current_company")
    if parsed.get("experience") and isinstance(parsed["experience"], list) and len(parsed["experience"]) > 0:
        first_exp = parsed["experience"][0]
        if isinstance(first_exp, dict):
            if not cand_title and first_exp.get("title"):
                cand_title = first_exp.get("title")
            if not cand_company and first_exp.get("company"):
                cand_company = first_exp.get("company")

    candidate.current_title = cand_title or role_title or candidate.current_title
    candidate.current_company = cand_company or candidate.current_company
    candidate.summary = parsed.get("summary")
    candidate.phone = candidate.phone or parsed.get("phone")
    candidate.location = candidate.location or parsed.get("location")
    candidate.linkedin_url = candidate.linkedin_url or parsed.get("linkedin_url")
    candidate.github_url = candidate.github_url or parsed.get("github_url")
    candidate.portfolio_url = candidate.portfolio_url or parsed.get("portfolio_url")
    candidate.match_score = score
    if job:
        candidate.applied_job_title = job.title
    else:
        from app.utils.category import extract_core_category
        actual_title = parsed.get("current_title") or role_title or ""
        candidate.applied_job_title = extract_core_category(actual_title) if actual_title else candidate.applied_job_title

    # Priority 6: score breakdown is a separate field, not buried in parsed_data
    candidate.score_breakdown = breakdown
    candidate.parsed_data = parsed

    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="CREATE",
        resource_type="candidate",
        resource_id=str(candidate.id),
        details={"name": candidate.full_name}
    )

    return APIResponse.success(message="Candidate created successfully.", data=CandidateOut.model_validate(candidate), status_code=201)
