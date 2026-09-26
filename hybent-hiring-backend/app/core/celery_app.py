from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

from app.services.ai_metering import install_gemini_metering

# Charge every Gemini call made by workers (app/services/ai_metering.py).
install_gemini_metering()

# Initialize Celery app
celery_app = Celery(
    "hybent_hiring_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.notifications", "app.tasks.email_accounts", "app.tasks.email_inbox", "app.tasks.email_ingestion"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Worker configuration
    worker_concurrency=2,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)

# Configure periodic tasks (Beat Schedule)
celery_app.conf.beat_schedule = {
    # Check for missing interview feedback every 5 minutes
    "check-missing-feedback": {
        "task": "app.tasks.notifications.check_pending_feedback",
        "schedule": crontab(minute="*/5"),
    },
    # Check and reset expired organization credits daily at midnight
    "reset-organization-credits": {
        "task": "app.tasks.notifications.reset_expired_organization_credits",
        "schedule": crontab(minute=0, hour=0),
    },
    # Proactively refresh Gmail tokens / re-verify SMTP logins before a real
    # send would otherwise be the first thing to discover a broken connection.
    "check-email-accounts-health": {
        "task": "app.tasks.email_accounts.check_email_accounts_health",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    # Keep each user's inbox reasonably fresh without syncing live on page load.
    "sync-all-inboxes": {
        "task": "app.tasks.email_inbox.sync_all_inboxes",
        "schedule": crontab(minute="*/5"),
    },
    # Turn inbound resume attachments on every connected mailbox into
    # candidates awaiting review. Syncs its own message metadata per account
    # (broader account coverage than sync-all-inboxes), so no ordering
    # dependency on that task.
    "process-email-ingestion": {
        "task": "app.tasks.email_ingestion.process_email_ingestion",
        "schedule": crontab(minute="*/5"),
    },
}
