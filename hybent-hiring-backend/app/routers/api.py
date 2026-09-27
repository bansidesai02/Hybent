from fastapi import APIRouter

from app.routers import (
    auth, organizations, users, jobs, candidates,
    resumes, ai, applications, pipeline,
    interviews, scorecards, offers,
    analytics, notifications, talent_pool, portal, admin, calendar, invitations,
    activities, reports, messages, search, public, copilot, bulk_import, linkedin, designations, api_compat,
    super_admin, candidate_files, pre_screening, email_accounts, inbox, billing, payments
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(organizations.router)
api_router.include_router(users.router)
api_router.include_router(jobs.router)
api_router.include_router(designations.router)
api_router.include_router(candidates.router)
api_router.include_router(resumes.router)
api_router.include_router(ai.router)
api_router.include_router(applications.router)
api_router.include_router(pipeline.router)
api_router.include_router(interviews.router)
api_router.include_router(scorecards.router)
api_router.include_router(scorecards.interview_router)
api_router.include_router(offers.router)
api_router.include_router(analytics.router)
api_router.include_router(notifications.router)
api_router.include_router(talent_pool.router)
api_router.include_router(portal.router)
api_router.include_router(admin.router)
api_router.include_router(calendar.router)
api_router.include_router(invitations.router)
api_router.include_router(activities.router)
api_router.include_router(reports.router)
api_router.include_router(messages.router)
api_router.include_router(search.router)
api_router.include_router(copilot.router)
api_router.include_router(bulk_import.router)
api_router.include_router(linkedin.router)
api_router.include_router(public.router, prefix="/api")
api_router.include_router(api_compat.router)
api_router.include_router(super_admin.router)
api_router.include_router(billing.router)
api_router.include_router(payments.router)
api_router.include_router(candidate_files.router)
api_router.include_router(pre_screening.router)
api_router.include_router(email_accounts.router)
api_router.include_router(inbox.router)
