import uuid
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from sqlalchemy import select, func
from app.dependencies import DB, get_current_user, require_recruiter, require_admin
from app.models.user import User
from typing import Annotated
from app.models.candidate import Candidate
from app.schemas.candidate import CandidateOut, CandidateUpdate, CandidateCreate, CandidateInvite, CandidateStageUpdate
from app.services.email_service import send_candidate_invite
from app.utils.pagination import paginate
from app.utils.permissions import UserRole, NotificationType
from app.tasks.notifications import notify_organization_roles, send_system_notification, notify_candidate_stage_change
from app.services.activity_service import log_activity
from app.models.application import Application
from app.models.job import Job
from app.services.match_scorer import evaluate_candidate_match
from app.schemas.response import APIResponse
from app.services import elasticsearch_service as es_service

router = APIRouter(prefix="/v1/candidates", tags=["candidates"])

from sqlalchemy.orm import selectinload

REJECTION_STAGES = [
    "rejected",
    "pre_screening_rejected",
    "technical_round_rejected",
    "technical_round_back_out",
    "practical_round_rejected",
    "practical_round_back_out",
    "techno_functional_rejected",
    "management_round_rejected",
    "hr_round_rejected",
    "offered_back_out",
    "offer_withdrawn"
]

@router.get("")
async def list_candidates(
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    tag: str | None = None,
    stage: str | None = None,
    status: str | None = None,
    created_by_id: str | None = None,
    job_id: uuid.UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    status = (status or "").strip().lower() or None
    # Status → multiple pipeline_stage values
    STATUS_STAGE_MAP = {
        "in_review":   [
            "applied", None, "screening", "", "needs_review"
        ],
        "shortlisted": ["pre_screening_selected"],
        "scheduled":   [
            "pre_screening", "technical_round", "practical_round",
            "techno_functional_round", "management_round", "hr_round",
            "technical_round_selected", "practical_round_selected",
            "techno_functional_selected", "management_round_selected",
            "hr_round_selected", "offered", "hired", "hired_joined",
            "interview", "interviewed",
        ],
        "rejected": REJECTION_STAGES,
        "inactive": ["inactive"]
    }

    query = (
        select(Candidate)
        .where(Candidate.organization_id == current_user.organization_id)
        .options(
            selectinload(Candidate.invitations),
            selectinload(Candidate.created_by),
            selectinload(Candidate.other_offers),
            selectinload(Candidate.documents)
        )
    )
    
    # Filter by job_id (join with Application)
    if job_id:
        query = query.join(Application, Application.candidate_id == Candidate.id).where(Application.job_id == job_id)

    # Filter by date range
    if date_from:
        try:
            from datetime import datetime, timezone
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            query = query.where(Candidate.created_at >= dt_from)
        except (ValueError, TypeError):
            pass
    if date_to:
        try:
            from datetime import datetime, timezone, timedelta
            dt_to = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
            # If it's just a date (no time), include the whole day
            if dt_to.hour == 0 and dt_to.minute == 0:
                dt_to = dt_to + timedelta(days=1)
            query = query.where(Candidate.created_at < dt_to)
        except (ValueError, TypeError):
            pass

    # Isolation removed: Recruiter & Admin can see all candidates in the organization
    if created_by_id:
        query = query.where(Candidate.created_by_id == created_by_id)

    if search:
        from sqlalchemy import cast, String as SAString
        query = query.where(
            Candidate.full_name.ilike(f"%{search}%")
            | Candidate.email.ilike(f"%{search}%")
            | Candidate.current_title.ilike(f"%{search}%")
            | Candidate.current_company.ilike(f"%{search}%")
            | cast(Candidate.skills, SAString).ilike(f"%{search}%")
        )
    if tag:
        query = query.where(Candidate.tags.contains([tag]))
        
    if status and status in STATUS_STAGE_MAP:
        target_stages = STATUS_STAGE_MAP[status]
        if None in target_stages:
            # Handle NULL and empty string specifically for 'in_review'
            remaining_stages = [s for s in target_stages if s is not None]
            query = query.where(
                (Candidate.pipeline_stage.in_(remaining_stages)) | 
                (Candidate.pipeline_stage.is_(None)) |
                (Candidate.pipeline_stage == "")
            )
        else:
            query = query.where(Candidate.pipeline_stage.in_(target_stages))
    elif stage:
        query = query.where(Candidate.pipeline_stage == stage)

    total_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_query)).scalar()

    # Apply order by created_at desc
    query = query.order_by(Candidate.created_at.desc())
    items_result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    items = items_result.scalars().all()
    
    def transform_candidate(c: Candidate):
        d = CandidateOut.model_validate(c).model_dump()
        if c.created_by:
            d["created_by_name"] = c.created_by.full_name
            d["created_by_id"] = str(c.created_by.id)
        return d

    return APIResponse.success(message="Candidates retrieved successfully.", data=paginate([transform_candidate(c) for c in items], total, page, limit))


# Mapping of detailed stages to high-level buckets
STAGE_TO_BUCKET = {
    "applied": "applied",
    "pre_screening": "screening",
    "pre_screening_selected": "interview", # Moved forward after pre-screening
    "technical_round": "interview",
    "technical_round_selected": "interviewed", # Automatically move to interviewed once selected
    "practical_round": "interview",
    "practical_round_selected": "interviewed",
    "techno_functional_round": "interview",
    "techno_functional_selected": "interviewed",
    "management_round": "interview",
    "management_round_selected": "interviewed",
    "hr_round": "interview",
    "hr_round_selected": "interviewed",
    "interviewed": "interviewed",
    "offered": "offer",
    "hired": "offer",
    "hired_joined": "offer",
    "screening": "screening", # Legacy/Fallback
    "interview": "interview"  # Legacy/Fallback
}

@router.get("/pipeline")
async def get_candidates_pipeline(current_user: Annotated[User, Depends(get_current_user)], db: DB):
    from app.models.application import Application
    from app.models.job import Job
    from app.utils.permissions import JobStatus

    # Fetch candidates who have at least one application for an active job
    query = (
        select(Candidate)
        .join(Application, Candidate.id == Application.candidate_id)
        .join(Job, Application.job_id == Job.id)
        .where(
            Candidate.organization_id == current_user.organization_id,
            Job.status == JobStatus.ACTIVE
        )
    )

    # Isolation removed: Recruiters & All can see the full pipeline
    query = query.distinct().options(selectinload(Candidate.created_by)).order_by(Candidate.updated_at.desc())
    items = (await db.execute(query)).scalars().all()
    
    def transform_candidate(c: Candidate):
        d = CandidateOut.model_validate(c).model_dump()
        if c.created_by:
            d["created_by_name"] = c.created_by.full_name
            d["created_by_id"] = str(c.created_by.id)
        else:
            d["created_by_name"] = "Admin"
        return d
    
    stages = {
        "applied": [],
        "screening": [],
        "interview": [],
        "interviewed": [],
        "offer": [],
        "rejected": []
    }
    
    for c in items:
        # Map to bucket or use original if it matches one of the top-level stages
        stage = c.pipeline_stage
        bucket = STAGE_TO_BUCKET.get(stage)
        
        if not bucket and stage in REJECTION_STAGES:
            bucket = "rejected"
        
        if not bucket:
            # New candidates or those needing review go to 'applied' bucket by default in pipeline
            if stage is None or stage == "needs_review":
                bucket = "applied"
            elif stage in stages:
                bucket = stage
            else:
                continue # Skip unknown stages that don't map to pipeline

        stages[bucket].append(transform_candidate(c))
        
    return APIResponse.success(message="Pipeline stages retrieved successfully.", data=stages)


@router.post("", response_model=CandidateOut, status_code=201)
async def create_candidate(data: CandidateCreate, current_user: Annotated[User, Depends(require_recruiter)], db: DB, background_tasks: BackgroundTasks):
    # Check for existing candidate in org
    existing = await db.execute(
        select(Candidate)
        .where(
            Candidate.email == data.email,
            Candidate.organization_id == current_user.organization_id,
        )
        .options(selectinload(Candidate.created_by))
    )
    existing_candidate = existing.scalar_one_or_none()
    if existing_candidate:
        creator_name = "Admin"
        if existing_candidate.created_by:
            creator_name = existing_candidate.created_by.full_name
        raise HTTPException(
            status_code=409, 
            detail=f"Candidate with this email has already been added by {creator_name}"
        )
    candidate = Candidate(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        **data.model_dump()
    )
    db.add(candidate)
    await db.flush()
    
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="CREATE",
        resource_type="candidate",
        resource_id=str(candidate.id),
        details={"name": candidate.full_name}
    )

    # Trigger system notification for Admin/HR
    notify_organization_roles.delay(
        str(current_user.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.CANDIDATE_ADDED,
        "New Candidate Added",
        f"A new candidate '{candidate.full_name}' has been added to the system by {current_user.full_name}.",
        {"candidate_id": str(candidate.id)}
    )
    
    background_tasks.add_task(es_service.index_candidate, candidate)
    return APIResponse.success(message="Candidate created successfully.", data=CandidateOut.model_validate(candidate))


@router.post("/invite", status_code=201)
async def invite_candidate(data: CandidateInvite, current_user: Annotated[User, Depends(require_recruiter)], db: DB):
    # Check if candidate exists, if not create a stub
    existing = await db.execute(
        select(Candidate).where(
            Candidate.email == data.email,
            Candidate.organization_id == current_user.organization_id,
        )
    )
    candidate = existing.scalar_one_or_none()
    
    if not candidate:
        candidate = Candidate(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            email=data.email,
            full_name=data.full_name,
            source="Invited by Recruiter",
            skills=[],
            tags=[],
        )
        db.add(candidate)
        await db.flush()
    
    # Use the new invitation service for secure token-based invite
    from app.services import invitation_service
    invitation = await invitation_service.create_invitation(
        db=db,
        candidate_id=candidate.id,
        organization_id=current_user.organization_id,
        email=candidate.email,
        full_name=candidate.full_name
    )
    
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="INVITE",
        resource_type="candidate",
        resource_id=str(candidate.id),
        details={"name": candidate.full_name, "email": candidate.email}
    )

    # Trigger system notification for Admin/HR
    notify_organization_roles.delay(
        str(current_user.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.CANDIDATE_ADDED,
        "Candidate Invited",
        f"Candidate '{candidate.full_name}' ({candidate.email}) has been invited to apply by {current_user.full_name}.",
        {"candidate_id": str(candidate.id)}
    )
    
    return APIResponse.success(message=f"Secure invite sent successfully to {candidate.email}", data={
        "candidate": CandidateOut.model_validate(candidate),
        "invitation_id": str(invitation.id)
    })



@router.get("/{candidate_id}", response_model=CandidateOut)
async def get_candidate(candidate_id: uuid.UUID, current_user: Annotated[User, Depends(get_current_user)], db: DB):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.organization_id == current_user.organization_id
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return APIResponse.success(message="Candidate fetched successfully.", data=CandidateOut.model_validate(candidate))


from app.utils.permissions import REJECTION_STAGES

@router.put("/{candidate_id}", response_model=CandidateOut)
async def update_candidate(candidate_id: uuid.UUID, data: CandidateUpdate, current_user: Annotated[User, Depends(require_recruiter)], db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.organization_id == current_user.organization_id
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    old_stage = candidate.pipeline_stage
    update_data = data.model_dump(exclude_none=True)
    new_stage = update_data.get("pipeline_stage")

    # Track comment/note changes before applying
    old_hr_notes = candidate.hr_notes
    old_talent_pool_comment = candidate.talent_pool_comment
    
    for field, value in update_data.items():
        setattr(candidate, field, value)
        
    # Automated rejection email
    if new_stage and new_stage in REJECTION_STAGES and old_stage not in REJECTION_STAGES:
        from app.services.email_service import send_rejection_email
        from app.models.organization import Organization
        
        org_res = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
        org = org_res.scalar_one_or_none()
        company_name = org.name if org else "the team"
        
        send_rejection_email(
            candidate_email=candidate.email,
            candidate_name=candidate.full_name,
            job_title=candidate.current_title or "the applied position",
            company_name=company_name,
            org_logo_url=org.logo_url if org else None
        )
        
    await db.flush()

    # Log HR notes change
    if "hr_notes" in update_data and update_data["hr_notes"] != old_hr_notes:
        await log_activity(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action="ADD_COMMENT",
            resource_type="hr_note",
            resource_id=str(candidate_id),
            details={"candidate": candidate.full_name, "note": (update_data["hr_notes"] or "")[:120]}
        )
        # Notify team about the new internal note
        notify_organization_roles.delay(
            str(current_user.organization_id),
            [UserRole.ADMIN, UserRole.RECRUITER],
            NotificationType.COMMENT_ADDED,
            "Internal Note Added",
            f"{current_user.full_name} added an internal note to candidate '{candidate.full_name}'.",
            {"candidate_id": str(candidate_id)}
        )

    # Log talent pool comment change
    if "talent_pool_comment" in update_data and update_data["talent_pool_comment"] != old_talent_pool_comment:
        await log_activity(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action="ADD_COMMENT",
            resource_type="comment",
            resource_id=str(candidate_id),
            details={"candidate": candidate.full_name, "comment": (update_data["talent_pool_comment"] or "")[:120]}
        )
        # Notify team about the new comment
        notify_organization_roles.delay(
            str(current_user.organization_id),
            [UserRole.ADMIN, UserRole.RECRUITER],
            NotificationType.COMMENT_ADDED,
            "Candidate Comment",
            f"{current_user.full_name} commented on candidate '{candidate.full_name}'.",
            {"candidate_id": str(candidate_id)}
        )

    # Log general update (only if non-comment fields changed)
    non_comment_fields = {k for k in update_data if k not in ("hr_notes", "talent_pool_comment")}
    if non_comment_fields:
        await log_activity(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action="UPDATE",
            resource_type="candidate",
            resource_id=str(candidate_id),
            details={"name": candidate.full_name, "fields": list(non_comment_fields)[:5]}
        )
        # Optional: Notify for significant profile changes
        if "pipeline_stage" in non_comment_fields:
             notify_organization_roles.delay(
                str(current_user.organization_id),
                [UserRole.ADMIN, UserRole.RECRUITER],
                NotificationType.CANDIDATE_UPDATED,
                "Candidate Status Changed",
                f"{current_user.full_name} updated '{candidate.full_name}' to {candidate.pipeline_stage}.",
                {"candidate_id": str(candidate_id)}
            )
             notify_candidate_stage_change.delay(
                 str(candidate.user_id) if candidate.user_id else None,
                 str(candidate.id),
                 candidate.pipeline_stage,
                 str(current_user.organization_id)
             )

    background_tasks.add_task(es_service.index_candidate, candidate)
    return APIResponse.success(message="Candidate updated successfully.", data=CandidateOut.model_validate(candidate))


@router.patch("/{candidate_id}/stage", response_model=CandidateOut)
async def update_candidate_stage(candidate_id: uuid.UUID, data: CandidateStageUpdate, current_user: Annotated[User, Depends(require_recruiter)], db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.organization_id == current_user.organization_id
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    old_stage = candidate.pipeline_stage
    
    # Map high-level bucket names (from kanban) to canonical detailed stages
    BUCKET_TO_STAGE = {
        "screening": "pre_screening",
        "interview": "technical_round",
        "interviewed": "interviewed",
        "offer": "offered",
    }
    target_stage = BUCKET_TO_STAGE.get(data.pipeline_stage, data.pipeline_stage)
    
    # ─── PROTECTION: Hired/Offered candidates cannot be rejected ────────────────
    if old_stage:
        old_bucket = STAGE_TO_BUCKET.get(old_stage)
        if old_bucket == "offer" and target_stage in REJECTION_STAGES:
             raise HTTPException(
                status_code=400,
                detail="Candidates in 'Offered' or 'Hired' stage cannot be rejected"
            )

    # ─── RESTRICTIONS ──────────────────────────────────────────────────────────
    # Check if this is a "bucket move" (likely from Kanban drag & drop)
    is_bucket_move = data.pipeline_stage in BUCKET_TO_STAGE
    
    if is_bucket_move:
        # Move to Screening bucket (from Applied/Needs Review)
        if data.pipeline_stage == "screening":
             if old_stage and old_stage not in ["applied", "needs_review", "screening"]:
                 # Prevent moving backward or skipping from unrelated stages easily
                 pass 

        # Move to Interview bucket (from Screening)
        if data.pipeline_stage == "interview":
            if old_stage == "pre_screening":
                 raise HTTPException(
                    status_code=400,
                    detail="Please select 'Pre-screening Selected' before moving to Interview round"
                )
            # If the user is trying to skip Screening entirely
            if not old_stage or old_stage in ["applied", "needs_review"]:
                 # Allow skipping to interview if needed, or enforce screening first?
                 # For now, let's keep it flexible but prevent moving past an active "In Pre-screening"
                 pass

        # Move to Offer bucket
        if data.pipeline_stage == "offer":
            # Must be HR Round Selected or Interviewed
            allowed_for_offer = ["hr_round_selected", "interviewed"]
            if old_stage not in allowed_for_offer:
                 raise HTTPException(
                    status_code=400,
                    detail="Candidate must be in 'HR Round Selected' or 'Interviewed' stage before moving to Offer"
                )

    if target_stage == "interviewed":
        from app.models.scorecard import Scorecard
        # Check if at least one scorecard exists for this candidate's applications
        sc_query = (
            select(func.count(Scorecard.id))
            .join(Application, Scorecard.application_id == Application.id)
            .where(
                Application.candidate_id == candidate_id,
                Application.organization_id == current_user.organization_id
            )
        )
        sc_count = (await db.execute(sc_query)).scalar()
        if sc_count == 0 and not (old_stage and "_selected" in old_stage):
            raise HTTPException(
                status_code=400,
                detail="Unable to move candidate as the interview is still pending"
            )

    # NEW: Restricted moves to Offer or Rejected if currently in Intervew process without feedback
    if target_stage in ["offered", "rejected"]:
        old_bucket = STAGE_TO_BUCKET.get(old_stage)
        if old_bucket == "interview":
            from app.models.scorecard import Scorecard
            sc_query = (
                select(func.count(Scorecard.id))
                .join(Application, Scorecard.application_id == Application.id)
                .where(
                    Application.candidate_id == candidate_id,
                    Application.organization_id == current_user.organization_id
                )
            )
            sc_count = (await db.execute(sc_query)).scalar()
            if sc_count == 0 and not (old_stage and "_selected" in old_stage):
                raise HTTPException(
                    status_code=400,
                    detail="Unable to move candidate as the interview is still pending"
                )

    candidate.pipeline_stage = target_stage
    
    # Synchronize all applications for this candidate to the same stage
    from app.models.application import Application
    app_query = select(Application).where(Application.candidate_id == candidate_id)
    apps_res = await db.execute(app_query)
    for app in apps_res.scalars().all():
        app.stage = data.pipeline_stage
    
    # If adding to pipeline and job_id is provided, create Application
    if data.pipeline_stage == "applied" and data.job_id and data.job_id.lower() not in ("null", "undefined", ""):
        try:
            job_id_uuid = uuid.UUID(data.job_id)
        except ValueError:
            job_id_uuid = None
            
        if job_id_uuid:
            # Check if application already exists
            app_res = await db.execute(
                select(Application).where(
                    Application.candidate_id == candidate_id,
                    Application.job_id == job_id_uuid
                )
            )
            application = app_res.scalar_one_or_none()
            
            if not application:
                application = Application(
                    organization_id=current_user.organization_id,
                    candidate_id=candidate_id,
                    job_id=job_id_uuid,
                    stage="applied",
                    match_score=candidate.match_score
                )
                db.add(application)
                await db.flush()
                
                # Recalculate/Update match score for this specific job context
                job_res = await db.execute(select(Job).where(Job.id == job_id_uuid))
                job = job_res.scalar_one_or_none()
                if job:
                    score, breakdown = await evaluate_candidate_match(
                        candidate_data=candidate.parsed_data or {},
                        candidate_skills=candidate.skills,
                        years_experience=candidate.years_experience,
                        job=job,
                        match_threshold=70.0,
                    )
                    candidate.match_score = score
                    candidate.score_breakdown = breakdown
                    candidate.applied_job_title = job.title
                    application.match_score = score
    
    # Rejection email — only when explicitly requested (not on kanban drag)
    if data.send_rejection_email and data.pipeline_stage in REJECTION_STAGES and old_stage not in REJECTION_STAGES:
        from app.services.email_service import send_rejection_email
        from app.models.organization import Organization

        org_res = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
        org = org_res.scalar_one_or_none()
        company_name = org.name if org else "the team"

        send_rejection_email(
            candidate_email=candidate.email,
            candidate_name=candidate.full_name,
            job_title=candidate.current_title or "the applied position",
            company_name=company_name,
            org_logo_url=org.logo_url if org else None
        )

    await db.flush()

    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="UPDATE_STAGE",
        resource_type="candidate",
        resource_id=str(candidate_id),
        details={"name": candidate.full_name, "from": old_stage, "to": data.pipeline_stage}
    )

    # Notify the team about the stage move
    notify_organization_roles.delay(
        str(current_user.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.CANDIDATE_UPDATED,
        "Candidate Moved Stage",
        f"{current_user.full_name} moved '{candidate.full_name}' from {old_stage or 'Applied'} to {data.pipeline_stage}.",
        {"candidate_id": str(candidate_id), "stage": data.pipeline_stage}
    )

    # Also notify the candidate directly (if they have a portal account)
    notify_candidate_stage_change.delay(
        str(candidate.user_id) if candidate.user_id else None,
        str(candidate.id),
        target_stage,
        str(current_user.organization_id)
    )

    background_tasks.add_task(es_service.index_candidate, candidate)
    return APIResponse.success(message="Candidate stage updated successfully.", data=CandidateOut.model_validate(candidate))


@router.post("/{candidate_id}/reject", response_model=CandidateOut)
async def reject_candidate(candidate_id: uuid.UUID, current_user: Annotated[User, Depends(require_recruiter)], db: DB):
    return await update_candidate_stage(
        candidate_id=candidate_id,
        data=CandidateStageUpdate(pipeline_stage="rejected", send_rejection_email=False),
        current_user=current_user,
        db=db
    )


@router.delete("/{candidate_id}")
async def delete_candidate(candidate_id: uuid.UUID, current_user: Annotated[User, Depends(require_admin)], db: DB, background_tasks: BackgroundTasks):
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.organization_id == current_user.organization_id
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Log deletion before removing the record so we can capture the name
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="DELETE",
        resource_type="candidate",
        resource_id=str(candidate_id),
        details={"name": candidate.full_name, "email": candidate.email}
    )

    await db.delete(candidate)
    await db.commit()

    # Broad notify about candidate deletion
    notify_organization_roles.delay(
        str(current_user.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.CANDIDATE_DELETED if hasattr(NotificationType, "CANDIDATE_DELETED") else NotificationType.CANDIDATE_ADDED,
        "Candidate Removed",
        f"Candidate '{candidate.full_name}' has been deleted from the system by {current_user.full_name}.",
        {"candidate_id": str(candidate_id), "name": candidate.full_name}
    )

    background_tasks.add_task(es_service.delete_from_index, "hireon_candidates", str(candidate_id))
    return APIResponse.success(message="Candidate deleted successfully.")


@router.get("/{candidate_id}/applications")
async def get_candidate_applications(candidate_id: uuid.UUID, current_user: Annotated[User, Depends(get_current_user)], db: DB):
    from app.models.application import Application
    from app.schemas.application import ApplicationOut
    result = await db.execute(
        select(Application).where(
            Application.candidate_id == candidate_id,
            Application.organization_id == current_user.organization_id,
        )
    )
    return APIResponse.success(message="Candidate applications retrieved.", data=[ApplicationOut.model_validate(a).model_dump() for a in result.scalars().all()])


@router.post("/{candidate_id}/view")
async def record_profile_view(candidate_id: uuid.UUID, current_user: Annotated[User, Depends(require_recruiter)], db: DB):
    """
    Record that a recruiter viewed a candidate's profile.
    Sends a real-time notification to the candidate if they have a portal account.
    This is a non-blocking, best-effort endpoint — always returns 200.
    """
    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.organization_id == current_user.organization_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Log the profile view activity
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="VIEW",
        resource_type="candidate",
        resource_id=str(candidate_id),
        details={"name": candidate.full_name}
    )

    # NOTE: Profile view notifications to candidates have been intentionally
    # removed. The activity log above still records the view for recruiter-side
    # audit purposes. Candidates no longer receive a "Someone viewed your
    # profile" notification to avoid noise.

    return APIResponse.success(message="Profile view recorded.")

