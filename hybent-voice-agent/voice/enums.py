"""
Task types, lifecycle states and call outcomes. Outcome names follow the
requirements spec (§4.2, §6.6, §7.5) so clients can show them as-is.
"""
from enum import StrEnum


class TaskType(StrEnum):
    PRESCREEN = "PRESCREEN"
    AVAILABILITY = "AVAILABILITY"
    REMINDER = "REMINDER"
    DEMO_BOOKING = "DEMO_BOOKING"
    DEMO_REMINDER = "DEMO_REMINDER"


class TaskStatus(StrEnum):
    SCHEDULED = "SCHEDULED"      # waiting for its next attempt
    IN_CALL = "IN_CALL"          # an attempt is dialing or talking
    ANALYZING = "ANALYZING"      # call ended, post-call analysis pending
    DONE = "DONE"                # no further attempts
    CANCELLED = "CANCELLED"


class RecordStatus(StrEnum):
    DIALING = "DIALING"
    IN_CALL = "IN_CALL"
    ENDED = "ENDED"


class Outcome(StrEnum):
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    NO_ANSWER = "NO_ANSWER"
    BUSY = "BUSY"
    UNREACHABLE = "UNREACHABLE"
    VOICEMAIL = "VOICEMAIL"
    WRONG_PERSON = "WRONG_PERSON"
    CALLBACK_REQUESTED = "CALLBACK_REQUESTED"
    DECLINED = "DECLINED"
    HUMAN_REQUESTED = "HUMAN_REQUESTED"
    OPTED_OUT = "OPTED_OUT"
    INVALID_NUMBER = "INVALID_NUMBER"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


class AnalysisStatus(StrEnum):
    NOT_NEEDED = "NOT_NEEDED"
    PENDING = "PENDING"
    DONE = "DONE"
    FAILED = "FAILED"


# Attempts where nobody (or no human) talked — retried per the policy.
UNANSWERED = {Outcome.NO_ANSWER, Outcome.BUSY, Outcome.UNREACHABLE, Outcome.VOICEMAIL}

# Attempts with a conversation worth analysing.
CONVERSED = {
    Outcome.COMPLETED,
    Outcome.PARTIAL,
    Outcome.DECLINED,
    Outcome.HUMAN_REQUESTED,
    Outcome.CALLBACK_REQUESTED,
}
