import uuid
import zoneinfo
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.models.interview import Interview, InterviewPanelist
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.interview import InterviewCreate, InterviewUpdate, InterviewOut, PanelistOut
from app.services.calendar_service import create_calendar_event, cancel_calendar_event
from app.services.email_service import (
    send_interview_invite, 
    send_interviewer_invite,
    send_interview_cancellation,
    send_interview_reschedule
)
from app.utils.permissions import InterviewStatus, NotificationType
from app.tasks.notifications import notify_interview_team
from app.services.activity_service import log_activity
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/interviews", tags=["interviews"])


def _interview_out(interview: Interview, panelists: list) -> dict:
    d = InterviewOut.model_validate(interview).model_dump()
    d["panelists"] = panelists
    return d


@router.get("")
async def list_interviews(current_user: CurrentUser, db: DB):
    if current_user.role == "interviewer":
        result = await db.execute(
            select(Interview)
            .join(InterviewPanelist, InterviewPanelist.interview_id == Interview.id)
            .where(InterviewPanelist.user_id == current_user.id)
        )
    elif current_user.role == "recruiter":
        # Recruiter sees what they scheduled OR interviews for their own candidates
        result = await db.execute(
            select(Interview).outerjoin(Candidate, Interview.candidate_id == Candidate.id).where(
                Interview.organization_id == current_user.organization_id,
                (Interview.scheduled_by_id == current_user.id) | (Candidate.created_by_id == current_user.id)
            )
        )
    else:
        # Admin sees everything in the org
        result = await db.execute(
            select(Interview).where(Interview.organization_id == current_user.organization_id)
        )
    interviews = result.scalars().all()
    out = []
    for iv in interviews:
        # Enrich with candidate name and skills
        d = InterviewOut.model_validate(iv).model_dump()
        cand = (await db.execute(select(Candidate).where(Candidate.id == iv.candidate_id))).scalar_one_or_none()
        if cand:
            d["candidate_name"] = cand.full_name
            d["candidate_email"] = cand.email
            d["candidate_skills"] = cand.skills or []
        panelists_result = await db.execute(
            select(InterviewPanelist).where(InterviewPanelist.interview_id == iv.id)
        )
        panelist_out = []
        for p in panelists_result.scalars().all():
            u = (await db.execute(select(User).where(User.id == p.user_id))).scalar_one_or_none()
            panelist_out.append({
                "id": str(p.id), "user_id": str(p.user_id), "role": p.role,
                "user_name": u.full_name if u else None,
                "user_email": u.email if u else None,
            })
        d["panelists"] = panelist_out
        out.append(d)
    return APIResponse.success(message="Interviews retrieved successfully.", data=out)


@router.post("/{interview_id}/confirm", response_model=dict)
async def confirm_interview(interview_id: uuid.UUID, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    interview.is_confirmed = True
    await db.commit()
    return APIResponse.success(message="Interview confirmed successfully.", data={"is_confirmed": True})


@router.post("", response_model=dict, status_code=201)
async def create_interview(data: InterviewCreate, current_user: RecruiterUser, db: DB):
    # Validate candidate belongs to org
    try:
        cand_id = uuid.UUID(data.candidate_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid candidate ID format")

    cand_result = await db.execute(
        select(Candidate).where(
            Candidate.id == cand_id,
            Candidate.organization_id == current_user.organization_id,
        )
    )
    candidate = cand_result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Backend validation: Cannot schedule in the past
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    if data.scheduled_at < (now - timedelta(minutes=5)):
        raise HTTPException(status_code=400, detail="Cannot schedule an interview in the past")

    # Org info for emails etc.
    from app.models.organization import Organization
    org_result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = org_result.scalar_one_or_none()

    # Collect attendee emails
    attendee_emails = [candidate.email]
    for p in data.panelist_ids:
        u_result = await db.execute(select(User).where(User.id == uuid.UUID(p.user_id)))
        u = u_result.scalar_one_or_none()
        if u:
            attendee_emails.append(u.email)

    # Create calendar event / get Meet link
    cal = await create_calendar_event(
        title=data.title,
        description=f"Interview with {candidate.full_name}",
        start_time=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        attendee_emails=attendee_emails,
        organizer_refresh_token=current_user.google_refresh_token,
    )

    interview = Interview(
        organization_id=current_user.organization_id,
        candidate_id=candidate.id,
        application_id=uuid.UUID(data.application_id) if data.application_id else None,
        scheduled_by_id=current_user.id,
        title=data.title,
        interview_type=data.interview_type,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        location=data.location,
        notes=data.notes,
        meeting_link=cal["meeting_link"],
        calendar_event_id=cal.get("event_id"),
    )
    db.add(interview)
    await db.flush()

    # Add panelists
    panelist_out = []
    for p_data in data.panelist_ids:
        u_result = await db.execute(select(User).where(User.id == uuid.UUID(p_data.user_id)))
        u = u_result.scalar_one_or_none()
        if u:
            panelist = InterviewPanelist(
                interview_id=interview.id,
                user_id=u.id,
                role=p_data.role,
            )
            db.add(panelist)
            panelist_out.append({
                "id": str(panelist.id),
                "user_id": str(u.id),
                "role": p_data.role,
                "user_name": u.full_name,
                "user_email": u.email,
            })

    # Send invite email to candidate and panelists
    if org:
        tz = zoneinfo.ZoneInfo(org.timezone or "Asia/Kolkata")
        local_time = data.scheduled_at.astimezone(tz)
        time_str = local_time.strftime("%B %d, %Y at %I:%M %p")

        send_interview_invite(
            candidate_email=candidate.email,
            candidate_name=candidate.full_name,
            job_title=data.title,
            company_name=org.name,
            scheduled_at=time_str,
            meeting_link=cal["meeting_link"],
            duration_minutes=data.duration_minutes,
            interview_type=data.interview_type,
        )
        
        for p_out in panelist_out:
            send_interviewer_invite(
                interviewer_email=p_out["user_email"],
                interviewer_name=p_out["user_name"],
                candidate_name=candidate.full_name,
                job_title=data.title,
                company_name=org.name,
                scheduled_at=time_str,
                meeting_link=cal["meeting_link"],
                duration_minutes=data.duration_minutes,
                interview_type=data.interview_type,
            )

    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="SCHEDULE",
        resource_type="interview",
        resource_id=str(interview.id),
        details={"candidate": candidate.full_name, "title": data.title, "scheduled_at": data.scheduled_at.isoformat()}
    )

    # Trigger system notification for Admin, HR, and Panelists
    notify_interview_team.delay(
        str(interview.id),
        NotificationType.INTERVIEW_SCHEDULED,
        "Interview Scheduled",
        f"A new interview '{data.title}' has been scheduled for {candidate.full_name} on {time_str}.",
        {"interview_id": str(interview.id), "candidate": candidate.full_name, "scheduled_at": time_str}
    )

    d = _interview_out(interview, panelist_out)
    d["candidate_name"] = candidate.full_name
    d["candidate_email"] = candidate.email
    return APIResponse.success(message="Interview scheduled successfully.", data=d)


@router.get("/{interview_id}")
async def get_interview(interview_id: uuid.UUID, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.organization_id == current_user.organization_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    cand = (await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))).scalar_one_or_none()

    panelists_result = await db.execute(
        select(InterviewPanelist).where(InterviewPanelist.interview_id == interview_id)
    )
    panelist_out = []
    for p in panelists_result.scalars().all():
        u = (await db.execute(select(User).where(User.id == p.user_id))).scalar_one_or_none()
        panelist_out.append({
            "id": str(p.id), "user_id": str(p.user_id), "role": p.role,
            "user_name": u.full_name if u else None,
            "user_email": u.email if u else None,
        })

    d = _interview_out(interview, panelist_out)
    if cand:
        d["candidate_name"] = cand.full_name
        d["candidate_email"] = cand.email
    return APIResponse.success(message="Interview retrieved successfully.", data=d)


@router.put("/{interview_id}", response_model=dict)
async def update_interview(interview_id: uuid.UUID, data: InterviewUpdate, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Access control
    if current_user.role == "interviewer":
        # Interviewers can ONLY update status to 'completed' for interviews they are part of
        if "status" in data.model_dump(exclude_none=True) and data.status == "completed":
            panelist_check = await db.execute(
                select(InterviewPanelist).where(
                    InterviewPanelist.interview_id == interview_id,
                    InterviewPanelist.user_id == current_user.id
                )
            )
            if not panelist_check.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="You can only complete interviews you are assigned to")
            # Clear everything else from data to prevent malicious updates
            data = InterviewUpdate(status="completed")
        else:
            raise HTTPException(status_code=403, detail="Interviewers can only mark interviews as completed")
    elif current_user.role != "admin" and interview.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this interview")
    
    # Backend validation: Cannot reschedule to the past
    if data.scheduled_at:
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        if data.scheduled_at < (now - timedelta(minutes=5)):
            raise HTTPException(status_code=400, detail="Cannot reschedule an interview to the past")

    old_time = interview.scheduled_at
    data_dict = data.model_dump(exclude_none=True)
    
    old_status = interview.status
    for field, value in data_dict.items():
        setattr(interview, field, value)
    
    await db.commit()
    await db.refresh(interview)

    # Trigger immediate feedback reminders if status changed to completed
    if "status" in data_dict and data_dict["status"] == "completed" and old_status != "completed":
        from app.tasks.notifications import send_feedback_reminder
        panelists_result = await db.execute(select(InterviewPanelist).where(InterviewPanelist.interview_id == interview.id))
        for p in panelists_result.scalars().all():
            # Trigger reminder for each panelist
            send_feedback_reminder.delay(
                str(interview.id),
                str(p.user_id),
                str(interview.organization_id),
                interview.title
            )
    
    # Send reschedule email if time changed
    if "scheduled_at" in data_dict and data_dict["scheduled_at"] != old_time:
        # Org info for timezone
        from app.models.organization import Organization
        org = (await db.execute(select(Organization).where(Organization.id == current_user.organization_id))).scalar_one_or_none()
        tz = zoneinfo.ZoneInfo(org.timezone or "Asia/Kolkata") if org else zoneinfo.ZoneInfo("Asia/Kolkata")
        
        old_time_str = old_time.astimezone(tz).strftime("%B %d, %Y at %I:%M %p")
        new_time_str = interview.scheduled_at.astimezone(tz).strftime("%B %d, %Y at %I:%M %p")
        
        # Trigger system notification
        notify_interview_team.delay(
            str(interview.id),
            NotificationType.INTERVIEW_UPDATED,
            "Interview Rescheduled",
            f"The interview '{interview.title}' has been rescheduled from {old_time_str} to {new_time_str}.",
            {"interview_id": str(interview.id), "old_time": old_time_str, "new_time": new_time_str}
        )

        cand = (await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))).scalar_one_or_none()
        if cand:
            send_interview_reschedule(
                to_email=cand.email, to_name=cand.full_name,
                candidate_name=cand.full_name, job_title=interview.title,
                company_name=org.name if org else "the team",
                old_time=old_time_str, new_time=new_time_str,
                meeting_link=interview.meeting_link
            )
        
        panelists_result = await db.execute(select(InterviewPanelist).where(InterviewPanelist.interview_id == interview.id))
        for p in panelists_result.scalars().all():
            u = (await db.execute(select(User).where(User.id == p.user_id))).scalar_one_or_none()
            if u:
                 send_interview_reschedule(
                    to_email=u.email, to_name=u.full_name,
                    candidate_name=cand.full_name if cand else "Candidate", job_title=interview.title,
                    company_name=org.name if org else "the team",
                    old_time=old_time_str, new_time=new_time_str,
                    meeting_link=interview.meeting_link
                )

    return APIResponse.success(message="Interview updated successfully.", data=InterviewOut.model_validate(interview).model_dump())


@router.delete("/{interview_id}")
async def cancel_interview(interview_id: uuid.UUID, current_user: RecruiterUser, db: DB, reason: str | None = None):
    result = await db.execute(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.organization_id == current_user.organization_id,
        )
    )
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    interview.status = InterviewStatus.CANCELLED
    
    # Org info for timezone and emails
    from app.models.organization import Organization
    org = (await db.execute(select(Organization).where(Organization.id == current_user.organization_id))).scalar_one_or_none()
    tz = zoneinfo.ZoneInfo(org.timezone or "Asia/Kolkata") if org else zoneinfo.ZoneInfo("Asia/Kolkata")
    time_str = interview.scheduled_at.astimezone(tz).strftime("%B %d, %Y at %I:%M %p")

    # Send cancellation emails
    cand = (await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))).scalar_one_or_none()
    if cand:
        send_interview_cancellation(
            to_email=cand.email, to_name=cand.full_name,
            candidate_name=cand.full_name, job_title=interview.title,
            company_name=org.name if org else "the team",
            scheduled_at=time_str, reason=reason
        )
    
    panelists_result = await db.execute(select(InterviewPanelist).where(InterviewPanelist.interview_id == interview.id))
    for p in panelists_result.scalars().all():
        u = (await db.execute(select(User).where(User.id == p.user_id))).scalar_one_or_none()
        if u:
            send_interview_cancellation(
                to_email=u.email, to_name=u.full_name,
                candidate_name=cand.full_name if cand else "Candidate", job_title=interview.title,
                company_name=org.name if org else "the team",
                scheduled_at=time_str, reason=reason
            )

    # Trigger system notification
    notify_interview_team.delay(
        str(interview.id),
        NotificationType.INTERVIEW_CANCELLED,
        "Interview Cancelled",
        f"The interview '{interview.title}' scheduled for {time_str} has been cancelled.",
        {"interview_id": str(interview.id), "reason": reason}
    )

    if interview.calendar_event_id:
        await cancel_calendar_event(interview.calendar_event_id, current_user.google_refresh_token)
    return APIResponse.success(message="Interview cancelled successfully.")
