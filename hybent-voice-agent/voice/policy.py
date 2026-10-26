"""
Pure scheduling rules: calling hours (Spec §4.4) and retries (Spec §4.3,
§7.5). No I/O here, so every rule is unit-tested directly.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from voice.config import settings
from voice.enums import Outcome, TaskType, UNANSWERED

# A technical failure is retried sooner than an unanswered call.
FAILED_RETRY_MINUTES = 10
# Callbacks the candidate asked for don't use up attempts, but are capped.
MAX_CALLBACKS = 2

_REMINDER_TYPES = {TaskType.REMINDER, TaskType.DEMO_REMINDER}


def default_config(task_type: str) -> dict:
    """Per-type defaults; a client may override any key when creating a task."""
    if task_type in _REMINDER_TYPES:
        # A reminder is retried once, 15 minutes later (Spec §7.5).
        return {
            "window_start": settings.default_window_start,
            "window_end": settings.default_window_end,
            "max_attempts": 2,
            "retry_gap_minutes": 15,
        }
    return {
        "window_start": settings.default_window_start,
        "window_end": settings.default_window_end,
        "max_attempts": settings.default_max_attempts,
        "retry_gap_minutes": settings.default_retry_gap_minutes,
    }


def _parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def next_allowed_time(when: datetime, tz_name: str, window_start: str, window_end: str) -> datetime:
    """The earliest moment at or after `when` inside the callee's calling window."""
    tz = ZoneInfo(tz_name)
    local = when.astimezone(tz)
    start, end = _parse_hhmm(window_start), _parse_hhmm(window_end)
    if local.time() < start:
        local = local.replace(hour=start.hour, minute=start.minute, second=0, microsecond=0)
    elif local.time() >= end:
        nxt = (local + timedelta(days=1)).date()
        local = datetime.combine(nxt, start, tzinfo=tz)
    return local.astimezone(when.tzinfo)


def retry_time(
    *,
    outcome: str,
    attempt_count: int,
    callbacks_so_far: int,
    callback_at: datetime | None,
    config: dict,
    now: datetime,
) -> datetime | None:
    """When to try again after an attempt ended with `outcome`, or None to stop.

    The result is not yet moved into the calling window; the caller does that.
    """
    if outcome == Outcome.CALLBACK_REQUESTED:
        if callback_at is None or callbacks_so_far > MAX_CALLBACKS:
            return None
        return max(callback_at, now)

    if attempt_count >= int(config["max_attempts"]):
        return None
    if outcome in UNANSWERED:
        return now + timedelta(minutes=int(config["retry_gap_minutes"]))
    if outcome == Outcome.FAILED:
        return now + timedelta(minutes=FAILED_RETRY_MINUTES)
    # COMPLETED, PARTIAL, DECLINED, WRONG_PERSON, HUMAN_REQUESTED, OPTED_OUT,
    # INVALID_NUMBER, EXPIRED: a person (or HR) has to act; never redial.
    return None
