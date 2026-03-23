import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.interview import Interview, InterviewPanelist
from app.models.scorecard import Scorecard
from app.models.notification import Notification

logger = logging.getLogger(__name__)

async def _check_pending_feedback_async():
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        
        # We find all interviews that were scheduled in the past 24 hours 
        # (this prevents checking very old interviews forever)
        cutoff = now - timedelta(hours=24)
        
        query = (
            select(Interview)
            .options(selectinload(Interview.panelists))
            .where(
                Interview.status.in_(["scheduled", "completed", "interviewed"]),
                Interview.scheduled_at >= cutoff,
            )
        )
        
        result = await db.execute(query)
        interviews = result.scalars().all()
        
        count = 0
        for interview in interviews:
            # Check if the interview has actually ended
            # If status is 'completed' or 'interviewed', we treat it as ended immediately
            end_time = interview.scheduled_at + timedelta(minutes=interview.duration_minutes)
            is_physically_over = end_time <= now
            is_manually_completed = interview.status in ["completed", "interviewed"]
            
            if not (is_physically_over or is_manually_completed):
                continue
                
            for panelist in interview.panelists:
                # Check if this panelist submitted a scorecard
                scorecard_query = select(Scorecard).where(
                    Scorecard.interview_id == interview.id,
                    Scorecard.submitted_by_id == panelist.user_id
                )
                scorecard_result = await db.execute(scorecard_query)
                if not scorecard_result.scalars().first():
                    # Send reminder via message broker
                    send_feedback_reminder.delay(
                        str(interview.id), 
                        str(panelist.user_id), 
                        str(interview.organization_id), 
                        interview.title
                    )
                    count += 1
        
        if count > 0:
            logger.info(f"Queued {count} feedback reminder tasks.")

@celery_app.task
def check_pending_feedback():
    """Periodic task executed by Celery Beat every 5 minutes."""
    logger.info("Running periodic check for missing interview feedback...")
    asyncio.run(_check_pending_feedback_async())

async def _send_feedback_reminder_async(interview_id: str, user_id: str, org_id: str, interview_title: str):
    async with AsyncSessionLocal() as db:
        # Prevent duplicate notifications (don't spam if already sent recently)
        # We check if a feedback reminder for this interview was created in the last 12 hours
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=12)
        
        # Searching inside the JSONB data column using astext
        existing_query = select(Notification).where(
            Notification.user_id == uuid.UUID(user_id),
            Notification.type == "feedback_reminder",
            Notification.created_at >= cutoff,
            Notification.data["interview_id"].astext == interview_id
        )
        existing = await db.execute(existing_query)
        if existing.scalars().first():
            logger.info(f"Reminder already sent recently for interview {interview_id} to user {user_id}")
            return
            
        notification = Notification(
            organization_id=uuid.UUID(org_id),
            user_id=uuid.UUID(user_id),
            type="feedback_reminder",
            title="Interview Feedback Required",
            message=f"The interview for '{interview_title}' has concluded. Please submit your scorecard feedback to move the candidate forward.",
            data={"interview_id": interview_id},
        )
        db.add(notification)
        await db.commit()
        logger.info(f"Feedback reminder notification saved to DB for user {user_id} (Interview: {interview_id})")

@celery_app.task
def send_feedback_reminder(interview_id: str, user_id: str, organization_id: str, interview_title: str):
    """Worker task to insert the notification into the database asynchronously."""
    asyncio.run(_send_feedback_reminder_async(interview_id, user_id, organization_id, interview_title))
