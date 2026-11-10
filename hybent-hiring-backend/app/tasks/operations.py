"""Records for the super admin Operations page: every email attempt and every
crashed request or job. Written through the worker so a request never waits on
them; `queue_*` never raise, because logging must not break what it observes."""
import json
import logging
import re
from datetime import datetime, timezone

from celery.signals import task_failure
from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal, run_async

logger = logging.getLogger(__name__)

# Mail holding a one-time link or code must not be stored or sent twice.
_ONE_TIME_CONTENT = re.compile(r"token=|trial-setup|sign-in code|verification code|one-time", re.IGNORECASE)


async def _record_email(to: str, subject: str, provider: str | None, status: str, error: str | None, html_body: str | None):
    from app.models.operations import EmailLog

    async with AsyncSessionLocal() as db:
        db.add(EmailLog(
            to_address=to[:320], subject=subject[:500], provider=provider, status=status,
            error=error[:2000] if error else None, html_body=html_body,
        ))
        await db.commit()


@celery_app.task(ignore_result=True)
def record_email(to: str, subject: str, provider: str | None, status: str, error: str | None = None, html_body: str | None = None):
    run_async(_record_email(to, subject, provider, status, error, html_body))


def queue_email_log(to: str, subject: str, provider: str | None, sent: bool, error: str | None, html_body: str) -> None:
    try:
        keep_body = not sent and not _ONE_TIME_CONTENT.search(html_body)
        record_email.delay(to, subject, provider, "sent" if sent else "failed", error, html_body if keep_body else None)
    except Exception as e:
        logger.warning(f"Could not queue the email log for '{subject}': {e}")


async def _record_error(kind: str, source: str, error: str, task_args: dict | None):
    from app.models.operations import PlatformError

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(PlatformError).where(
            PlatformError.kind == kind, PlatformError.source == source,
            PlatformError.error == error, PlatformError.status == "open",
        ).limit(1))
        if existing:
            existing.count += 1
            existing.last_seen_at = now
            existing.task_args = task_args or existing.task_args
        else:
            db.add(PlatformError(kind=kind, source=source, error=error, task_args=task_args, created_at=now, last_seen_at=now))
        await db.commit()


@celery_app.task(ignore_result=True)
def record_error(kind: str, source: str, error: str, task_args: dict | None = None):
    run_async(_record_error(kind, source, error, task_args))


def queue_error(kind: str, source: str, exc: BaseException, task_args: dict | None = None) -> None:
    try:
        record_error.delay(kind, source[:300], f"{type(exc).__name__}: {exc}"[:2000], task_args)
    except Exception as e:
        logger.warning(f"Could not queue the error record for {source}: {e}")


@task_failure.connect
def _on_task_failure(sender=None, args=None, kwargs=None, exception=None, **_):
    name = getattr(sender, "name", "unknown")
    # A broken recorder must not record its own failure forever.
    if name.startswith("app.tasks.operations.") or exception is None:
        return
    try:
        task_args = json.loads(json.dumps({"args": list(args or []), "kwargs": dict(kwargs or {})}))
    except (TypeError, ValueError):
        task_args = None
    queue_error("task", name, exception, task_args)
