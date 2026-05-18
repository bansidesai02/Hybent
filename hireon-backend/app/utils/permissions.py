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
    SCREENING_SELECTED = "screening_selected"
    SCREENING_REJECTED = "screening_rejected"
    PRE_SCREENING = "pre_screening"
    PRE_SCREENING_SELECTED = "pre_screening_selected"
    PRE_SCREENING_REJECTED = "pre_screening_rejected"
    TECHNICAL_ROUND = "technical_round"
    TECHNICAL_ROUND_SELECTED = "technical_round_selected"
    TECHNICAL_ROUND_REJECTED = "technical_round_rejected"
    TECHNICAL_ROUND_BACK_OUT = "technical_round_back_out"
    PRACTICAL_ROUND = "practical_round"
    PRACTICAL_ROUND_SELECTED = "practical_round_selected"
    PRACTICAL_REJECTED = "practical_rejected"
    PRACTICAL_ROUND_REJECTED = "practical_round_rejected"
    PRACTICAL_ROUND_BACK_OUT = "practical_round_back_out"
    TECHNO_FUNCTIONAL_ROUND = "techno_functional_round"
    TECHNO_FUNCTIONAL_SELECTED = "techno_functional_selected"
    TECHNO_FUNCTIONAL_REJECTED = "techno_functional_rejected"
    MANAGEMENT_ROUND = "management_round"
    MANAGEMENT_ROUND_SELECTED = "management_round_selected"
    MANAGEMENT_ROUND_REJECTED = "management_round_rejected"
    HR_ROUND = "hr_round"
    HR_ROUND_SELECTED = "hr_round_selected"
    HR_ROUND_REJECTED = "hr_round_rejected"
    INTERVIEW = "interview"
    INTERVIEWED = "interviewed"
    OFFER = "offer"
    OFFERED = "offered"
    OFFERED_BACK_OUT = "offered_back_out"
    OFFER_WITHDRAWN = "offer_withdrawn"
    HIRED = "hired"
    HIRED_JOINED = "hired_joined"
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
    POOL = "pool"


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
