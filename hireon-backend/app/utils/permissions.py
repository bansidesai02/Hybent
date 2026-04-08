"""
Role definitions and permission checks.
"""
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    RECRUITER = "recruiter"
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"


class ApplicationStage(str, Enum):
    APPLIED = "applied"
    SCREENING = "screening"
    PRE_SCREENING = "pre_screening"
    TECHNICAL_ROUND = "technical_round"
    PRACTICAL_ROUND = "practical_round"
    TECHNO_FUNCTIONAL_ROUND = "techno_functional_round"
    MANAGEMENT_ROUND = "management_round"
    HR_ROUND = "hr_round"
    INTERVIEW = "interview"
    INTERVIEWED = "interviewed"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"

REJECTION_STAGES = [
    "rejected",
    "screening_rejected",
    "pre_screening_rejected",
    "technical_round_rejected",
    "technical_round_back_out",
    "practical_rejected",
    "practical_round_rejected",
    "practical_round_back_out",
    "techno_functional_rejected",
    "management_round_rejected",
    "hr_round_rejected",
    "offered_back_out",
    "offer_withdrawn"
]


class JobStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"


class InterviewType(str, Enum):
    PHONE = "phone"
    VIDEO = "video"
    ONSITE = "onsite"
    TECHNICAL = "technical"
    HR = "hr"
    FINAL = "final"


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class OfferStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


class NotificationType(str, Enum):
    APPLICATION_RECEIVED = "application_received"
    STAGE_CHANGED = "stage_changed"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_REMINDER = "interview_reminder"
    SCORECARD_SUBMITTED = "scorecard_submitted"
    OFFER_SENT = "offer_sent"
    OFFER_ACCEPTED = "offer_accepted"
    OFFER_DECLINED = "offer_declined"
    INTERVIEW_UPDATED = "interview_updated"
    INTERVIEW_CANCELLED = "interview_cancelled"
    CANDIDATE_ADDED = "candidate_added"
    CANDIDATE_UPDATED = "candidate_updated"
    CANDIDATE_DELETED = "candidate_deleted"
    COMMENT_ADDED = "comment_added"
    SYSTEM = "system"
    # ── Candidate-facing types ────────────────────────────────────────────────
    SHORTLISTED = "shortlisted"
    PROFILE_VIEWED = "profile_viewed"
    STAGE_UPDATED = "stage_updated"
    MESSAGE_RECEIVED = "message_received"
    OFFER_RECEIVED = "offer_received"
    FEEDBACK_REMINDER = "feedback_reminder"


# Role hierarchy: which roles can access which resources
RECRUITER_ROLES = {UserRole.ADMIN, UserRole.RECRUITER}
INTERVIEWER_ROLES = {UserRole.ADMIN, UserRole.RECRUITER, UserRole.INTERVIEWER}
ADMIN_ONLY = {UserRole.ADMIN}
