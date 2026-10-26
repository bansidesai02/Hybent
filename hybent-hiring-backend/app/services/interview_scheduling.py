"""
Scheduling an interview: calendar event / Meet link, the interview row,
panelists, invite emails, audit log and team notification.

Shared by the Schedule screen (routers/interviews.py) and AI Calls, which
books the slot a candidate confirmed on an availability call — so both
produce exactly the same interview, emails and notifications.
"""
import uuid
import zoneinfo
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview, InterviewPanelist
from app.models.job import Job
from app.models.organization import Organization
from app.models.user import User
from app.services.activity_service import log_activity
from app.services.calendar_service import create_calendar_event
from app.services.email_accounts_service import resolve_sender_for_user
from app.services.email_service import send_interview_invite, send_interviewer_invite
from app.tasks.notifications import notify_interview_team
from app.utils.permissions import INTERVIEWER_ROLES, NotificationType


async def get_job_role(db: AsyncSession, application_id: uuid.UUID | None, candidate_id: uuid.UUID) -> str:
    """Robustly resolve the job title for an interview context."""
    # 1. Try via application_id
    if application_id:
        job_result = await db.execute(
            select(Job.title)
            .join(Application, Application.job_id == Job.id)
            .where(Application.id == application_id)
        )
        job_title = job_result.scalar_one_or_none()
        if job_title:
            return job_title

    # 2. Try via Candidate.applied_job_title
    cand_result = await db.execute(select(Candidate.applied_job_title).where(Candidate.id == candidate_id))
    job_title = cand_result.scalar_one_or_none()
    if job_title:
        return job_title

    # 3. Fallback: Most recent application for this candidate
    fallback_result = await db.execute(
        select(Job.title)
        .join(Application, Application.job_id == Job.id)
        .where(Application.candidate_id == candidate_id)
        .order_by(Application.created_at.desc())
        .limit(1)
    )
    job_title = fallback_result.scalar_one_or_none()
    return job_title or "Position"


async def resolve_panelists(
    db: AsyncSession, organization_id: uuid.UUID, panelists: list[tuple[str, str | None]]
) -> list[tuple[User, str | None]]:
    """[(user_id, role)] → [(User, role)], keeping only active hiring-team
    members of `organization_id`. A user ID from another organization (or a
    candidate account) is dropped, never invited to this org's interview."""
    ids = []
    for user_id, _role in panelists:
        try:
            ids.append(uuid.UUID(str(user_id)))
        except ValueError:
            continue
    if not ids:
        return []
    users = {
        u.id: u for u in (await db.execute(
            select(User).where(
                User.id.in_(ids),
                User.organization_id == organization_id,
                User.is_active.is_(True),
                User.role.in_([r.value for r in INTERVIEWER_ROLES]),
            )
        )).scalars()
    }
    out = []
    for user_id, role in panelists:
        try:
            u = users.get(uuid.UUID(str(user_id)))
        except ValueError:
            u = None
        if u:
            out.append((u, role))
    return out


async def schedule_interview(
    db: AsyncSession,
    *,
    scheduler: User,
    candidate: Candidate,
    title: str,
    interview_type: str,
    scheduled_at: datetime,
    duration_minutes: int,
    location: str | None = None,
    notes: str | None = None,
    meeting_link: str | None = None,
    application_id: uuid.UUID | None = None,
    panelists: list[tuple[str, str | None]] = (),
) -> tuple[Interview, list[dict]]:
    """Create the interview and send its invites. `panelists` is
    [(user_id, role)]. Returns the interview and the panelists as dicts."""
    org = (await db.execute(select(Organization).where(Organization.id == scheduler.organization_id))).scalar_one_or_none()

    panel = await resolve_panelists(db, scheduler.organization_id, panelists)

    # Collect attendee emails
    attendee_emails = [candidate.email] + [u.email for u, _role in panel]

    # Create calendar event / get Meet link
    cal = await create_calendar_event(
        title=title,
        description=f"Interview with {candidate.full_name}",
        start_time=scheduled_at,
        duration_minutes=duration_minutes,
        attendee_emails=attendee_emails,
        organizer_refresh_token=scheduler.google_refresh_token,
    )
    # A real Calendar link wins; otherwise keep the one the recruiter typed in.
    meeting_link = cal["meeting_link"] or meeting_link

    interview = Interview(
        organization_id=scheduler.organization_id,
        candidate_id=candidate.id,
        application_id=application_id,
        scheduled_by_id=scheduler.id,
        title=title,
        interview_type=interview_type,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        location=location,
        notes=notes,
        meeting_link=meeting_link,
        calendar_event_id=cal.get("event_id"),
    )
    db.add(interview)
    await db.flush()

    # Add panelists
    panelist_out = []
    for u, role in panel:
        panelist = InterviewPanelist(interview_id=interview.id, user_id=u.id, role=role)
        db.add(panelist)
        panelist_out.append({
            "id": str(panelist.id),
            "user_id": str(u.id),
            "role": role,
            "user_name": u.full_name,
            "user_email": u.email,
        })

    # Send invite email to candidate and panelists — from the scheduler's
    # own mailbox when they've connected one.
    sender = await resolve_sender_for_user(db, scheduler)
    job_role = await get_job_role(db, interview.application_id, candidate.id)
    time_str = scheduled_at.isoformat()
    if org:
        tz = zoneinfo.ZoneInfo(org.timezone or "Asia/Kolkata")
        time_str = scheduled_at.astimezone(tz).strftime("%B %d, %Y at %I:%M %p")
        send_interview_invite(
            candidate_email=candidate.email,
            candidate_name=candidate.full_name,
            round_name=title,
            job_role=job_role,
            company_name=org.name,
            scheduled_at=time_str,
            meeting_link=meeting_link,
            duration_minutes=duration_minutes,
            interview_type=interview_type,
            org_logo_url=org.logo_url,
            email_account=sender,
        )
        for p_out in panelist_out:
            send_interviewer_invite(
                interviewer_email=p_out["user_email"],
                interviewer_name=p_out["user_name"],
                candidate_name=candidate.full_name,
                round_name=title,
                job_role=job_role,
                company_name=org.name,
                scheduled_at=time_str,
                meeting_link=meeting_link,
                duration_minutes=duration_minutes,
                interview_type=interview_type,
                org_logo_url=org.logo_url,
                email_account=sender,
            )

    await log_activity(
        db,
        organization_id=scheduler.organization_id,
        user_id=scheduler.id,
        action="SCHEDULE",
        resource_type="interview",
        resource_id=str(interview.id),
        details={"candidate": candidate.full_name, "title": title, "scheduled_at": scheduled_at.isoformat()},
    )

    # Trigger system notification for Admin, HR, and Panelists
    notify_interview_team.delay(
        str(interview.id),
        NotificationType.INTERVIEW_SCHEDULED,
        "Interview Scheduled",
        f"A new interview '{title}' for {job_role} has been scheduled for {candidate.full_name} on {time_str}.",
        {"interview_id": str(interview.id), "candidate": candidate.full_name, "scheduled_at": time_str},
    )
    return interview, panelist_out
