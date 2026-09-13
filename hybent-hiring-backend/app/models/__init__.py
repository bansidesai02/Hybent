# Import all models so Alembic can detect them for migrations
from app.models.organization import Organization
from app.models.user import User, RefreshToken
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.application import Application
from app.models.interview import Interview, InterviewPanelist
from app.models.scorecard import Scorecard
from app.models.offer import Offer
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.invitation import CandidateInvitation
from app.models.password_reset import PasswordResetToken
from app.models.other_offer import OtherOffer
from app.models.job_referral import JobReferral
from app.models.candidate_document import CandidateDocument
from app.models.message import Message
from app.models.email_account import EmailAccount
from app.models.email_message import EmailMessage
from app.models.ai_usage import AIUsage
from app.models.organization_ai_credits import OrganizationAICredits
from app.models.ai_credit_rule import AICreditRule
from app.models.copilot_conversation import CopilotConversation, CopilotMessage
from app.models.import_batch import ImportBatch
from app.models.user_preference import UserPreference
from app.models.designation_change_log import DesignationChangeLog
from app.models.pre_screening import PreScreeningSession, PreScreeningResponse
from app.models.super_admin import (
    SubscriptionPlan, CompanySubscription, CompanyFeatureFlag,
    CompanyUsage, SuperAdminAuditLog, ImpersonationLog,
    PlatformSetting, BillingTransaction
)

__all__ = [
    "Organization", "User", "RefreshToken", "Job", "Candidate",
    "Application", "Interview", "InterviewPanelist", "Scorecard",
    "Offer", "Notification", "AuditLog", "CandidateInvitation", "PasswordResetToken",
    "OtherOffer", "JobReferral", "CandidateDocument", "Message", "EmailAccount", "EmailMessage",
    "AIUsage", "OrganizationAICredits", "AICreditRule", "CopilotConversation", "CopilotMessage", "ImportBatch",
    "UserPreference", "DesignationChangeLog",
    "PreScreeningSession", "PreScreeningResponse",
    "SubscriptionPlan", "CompanySubscription", "CompanyFeatureFlag",
    "CompanyUsage", "SuperAdminAuditLog", "ImpersonationLog",
    "PlatformSetting", "BillingTransaction"
]
