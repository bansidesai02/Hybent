from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

# Initialize Celery app
celery_app = Celery(
    "hybent_hiring_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.notifications"]
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
}
