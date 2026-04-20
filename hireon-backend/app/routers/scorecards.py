import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import select
from app.dependencies import DB, CurrentUser, InterviewerUser
from app.models.scorecard import Scorecard
from app.models.interview import Interview
from app.schemas.scorecard import ScorecardCreate, ScorecardOut
from app.schemas.response import APIResponse
from app.tasks.notifications import notify_candidate_stage_change, send_system_notification
from sqlalchemy.orm import selectinload
from app.models.candidate import Candidate

router = APIRouter(prefix="/v1/scorecards", tags=["scorecards"])
interview_router = APIRouter(prefix="/v1/interviews", tags=["interviews"])


@router.post("", response_model=ScorecardOut, status_code=201)
async def submit_scorecard(data: ScorecardCreate, current_user: InterviewerUser, db: DB):
    # Validate interview belongs to org
    result = await db.execute(
        select(Interview)
        .options(selectinload(Interview.candidate))
        .where(
            Interview.id == uuid.UUID(data.interview_id),
            Interview.organization_id == current_user.organization_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Prevent duplicate
    dup = await db.execute(
        select(Scorecard).where(
            Scorecard.interview_id == uuid.UUID(data.interview_id),
            Scorecard.submitted_by_id == current_user.id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Scorecard already submitted for this interview")

    scorecard = Scorecard(
        organization_id=current_user.organization_id,
        interview_id=uuid.UUID(data.interview_id),
        application_id=uuid.UUID(data.application_id) if data.application_id else None,
        submitted_by_id=current_user.id,
        overall_rating=data.overall_rating,
        recommendation=data.recommendation,
        criteria_scores=[c.model_dump() for c in data.criteria_scores] if data.criteria_scores else None,
        strengths=data.strengths,
        weaknesses=data.weaknesses,
        summary=data.summary,
    )
    db.add(scorecard)
    
    # Custom submission side-effects REMOVED so that multiple interviewers
    # can submit scorecards independently without auto-advancing the pipeline
    # or overwriting the centralized HR notes.
    
    await db.commit()

    # Notify HR / Scheduler
    if interview.scheduled_by_id:
        candidate_name = interview.candidate.full_name if interview.candidate else "Candidate"
        send_system_notification.delay(
            user_id=str(interview.scheduled_by_id),
            org_id=str(interview.organization_id),
            type="scorecard_submitted",
            title=f"Feedback Received: {candidate_name}",
            message=f"{current_user.full_name} has submitted feedback for the '{interview.title}' round.",
            data={
                "interview_id": str(interview.id),
                "scorecard_id": str(scorecard.id),
                "candidate_id": str(interview.candidate_id),
                "application_id": str(interview.application_id) if interview.application_id else None
            }
        )

    out = ScorecardOut.model_validate(scorecard).model_dump()
    out["submitted_by_name"] = current_user.full_name
    out["interview_title"] = interview.title
    return APIResponse.success(message="Scorecard submitted.", data=out, status_code=201)


@router.get("/interview/{interview_id}/my")
async def get_my_scorecard_for_interview(interview_id: uuid.UUID, current_user: InterviewerUser, db: DB):
    result = await db.execute(
        select(Scorecard).where(
            Scorecard.interview_id == interview_id,
            Scorecard.submitted_by_id == current_user.id,
        )
    )
    sc = result.scalar_one_or_none()
    if not sc:
        return APIResponse.success(message="Scorecard retrieved.", data=None)
        
    d = ScorecardOut.model_validate(sc).model_dump()
    d["submitted_by_name"] = current_user.full_name
    # Fetch interview title
    res = await db.execute(select(Interview.title).where(Interview.id == sc.interview_id))
    d["interview_title"] = res.scalar_one_or_none()
    return APIResponse.success(message="Scorecard retrieved.", data=d)


@router.get("/application/{application_id}")
async def list_scorecards_for_application(application_id: uuid.UUID, current_user: CurrentUser, db: DB):
    from app.models.user import User
    if current_user.role == "recruiter":
        from app.models.application import Application
        from app.models.job import Job
        from app.models.candidate import Candidate
        app_check = await db.execute(
            select(Application)
            .join(Job)
            .outerjoin(Candidate, Application.candidate_id == Candidate.id)
            .where(
                Application.id == application_id,
                (Job.created_by_id == current_user.id) | (Candidate.created_by_id == current_user.id)
            )
        )
        if not app_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to view scorecards for this application")

    result = await db.execute(
        select(Scorecard).where(
            Scorecard.application_id == application_id,
            Scorecard.organization_id == current_user.organization_id,
        )
    )
    scorecards = result.scalars().all()
    out = []
    for sc in scorecards:
        d = ScorecardOut.model_validate(sc).model_dump()
        user = (await db.execute(select(User).where(User.id == sc.submitted_by_id))).scalar_one_or_none()
        d["submitted_by_name"] = user.full_name if user else None
        # Fetch interview title
        res = await db.execute(select(Interview.title).where(Interview.id == sc.interview_id))
        d["interview_title"] = res.scalar_one_or_none()
        out.append(d)
    return APIResponse.success(message="Scorecards retrieved.", data=out)
    
    
@router.get("/candidate/{candidate_id}")
async def list_scorecards_for_candidate(candidate_id: uuid.UUID, current_user: CurrentUser, db: DB):
    from app.models.user import User
    from app.models.interview import Interview
    
    # Check org access
    result = await db.execute(
        select(Scorecard)
        .join(Interview, Scorecard.interview_id == Interview.id)
        .where(
            Interview.candidate_id == candidate_id,
            Scorecard.organization_id == current_user.organization_id,
        )
    )
    scorecards = result.scalars().all()
    
    out = []
    for sc in scorecards:
        d = ScorecardOut.model_validate(sc).model_dump()
        user = (await db.execute(select(User).where(User.id == sc.submitted_by_id))).scalar_one_or_none()
        d["submitted_by_name"] = user.full_name if user else None
        # Fetch interview title
        res = await db.execute(select(Interview.title).where(Interview.id == sc.interview_id))
        d["interview_title"] = res.scalar_one_or_none()
        out.append(d)
        
    return APIResponse.success(message="Scorecards retrieved.", data=out)


@router.get("/{scorecard_id}", response_model=ScorecardOut)
async def get_scorecard(scorecard_id: uuid.UUID, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Scorecard).where(
            Scorecard.id == scorecard_id,
            Scorecard.organization_id == current_user.organization_id,
        )
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail="Scorecard not found")
    from app.models.user import User
    user = (await db.execute(select(User).where(User.id == sc.submitted_by_id))).scalar_one_or_none()
    d = ScorecardOut.model_validate(sc).model_dump()
    d["submitted_by_name"] = user.full_name if user else None
    # Fetch interview title
    res = await db.execute(select(Interview.title).where(Interview.id == sc.interview_id))
    d["interview_title"] = res.scalar_one_or_none()
    return APIResponse.success(message="Scorecard retrieved.", data=d)


# ── AI summary endpoint — lives on /v1/interviews/{interview_id}/ai-summary ──

@interview_router.get("/{interview_id}/ai-summary")
async def get_or_generate_ai_summary(
    interview_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    background_tasks: BackgroundTasks,
    regenerate: bool = False,
):
    """
    Return the cached AI summary for an interview round.
    If it hasn't been generated yet (or `?regenerate=true`), call the AI
    to synthesize all interviewers' scorecards and persist the result.
    """
    from app.models.user import User
    from app.services.ai_evaluator import generate_combined_feedback_summary

    # Fetch the interview
    result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.organization_id == current_user.organization_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Return cached summary if available and regeneration not requested
    if interview.ai_summary and not regenerate:
        return APIResponse.success(
            message="AI summary retrieved.",
            data={"interview_id": str(interview_id), "ai_summary": interview.ai_summary, "cached": True}
        )

    # Fetch all scorecards for this interview
    sc_result = await db.execute(
        select(Scorecard).where(Scorecard.interview_id == interview_id)
    )
    scorecards = sc_result.scalars().all()

    if not scorecards:
        return APIResponse.success(
            message="No scorecards found to summarize.",
            data={"interview_id": str(interview_id), "ai_summary": None, "cached": False}
        )

    # Build enriched scorecard dicts with submitted_by_name
    cards_data = []
    for sc in scorecards:
        d = ScorecardOut.model_validate(sc).model_dump()
        user = (await db.execute(select(User).where(User.id == sc.submitted_by_id))).scalar_one_or_none()
        d["submitted_by_name"] = user.full_name if user else "Unknown"
        cards_data.append(d)

    # Call AI
    summary = await generate_combined_feedback_summary(
        scorecards=cards_data,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id,
    )

    # Persist to DB for caching
    if summary:
        interview.ai_summary = summary
        await db.commit()

    return APIResponse.success(
        message="AI summary generated.",
        data={"interview_id": str(interview_id), "ai_summary": summary, "cached": False}
    )
