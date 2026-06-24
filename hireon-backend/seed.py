"""
HireOn — Full Demo Seed (v2)
Run: python seed.py

Covers:
  - Recent Activity feed (audit_logs with HR events)
  - Audit Logs admin page (login/admin events too)
  - AI Insights Top Skills (candidates with rich skills)
  - Recent DB Matches (active jobs + scored candidates)
  - Team page — Internal team + 2 hired/joined candidates
  - Scorecards (criteria_scores as plain list, not dict)
  - Open Positions with mixed statuses (active/draft/paused)
  - Interviews today + upcoming for dashboard
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.organization import Organization
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.application import Application
from app.models.interview import Interview, InterviewPanelist
from app.models.scorecard import Scorecard
from app.models.offer import Offer
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.models.super_admin import (
    SubscriptionPlan, CompanySubscription, CompanyFeatureFlag,
    CompanyUsage, PlatformSetting
)
from app.utils.permissions import (
    UserRole, JobStatus, ApplicationStage,
    InterviewType, InterviewStatus, OfferStatus,
)
from app.utils.security import hash_password
import app.models  # noqa — register all models

engine = create_async_engine(settings.database_url)
Session = async_sessionmaker(engine, expire_on_commit=False)

NOW = datetime.now(timezone.utc)


def ago(**kwargs):
    return NOW - timedelta(**kwargs)


def future(**kwargs):
    return NOW + timedelta(**kwargs)


async def clear_all(db: AsyncSession):
    tables = [
        "candidate_invitations", "password_reset_tokens",
        "audit_logs", "notifications", "scorecards", "offers",
        "interview_panelists", "interviews",
        "applications", "candidates",
        "refresh_tokens", "jobs", "users", "organizations",
        "billing_transactions", "impersonation_logs", "super_admin_audit_logs",
        "company_subscriptions", "subscription_plans", "company_feature_flags",
        "company_usage", "platform_settings"
    ]
    for t in tables:
        await db.execute(text(
            f"DO $$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE tablename = '{t}') "
            f"THEN TRUNCATE TABLE \"{t}\" CASCADE; END IF; END $$;"
        ))
    await db.commit()
    print("--  Cleared all tables")


async def seed():
    async with Session() as db:
        # Check if we should force seed
        force_seed = os.getenv("FORCE_SEED", "false").lower() == "true"
        
        # Check if admin already exists
        result = await db.execute(select(User).where(User.email == "admin@brainerhub.com"))
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin and not force_seed:
            print("\n⏩  Database already seeded. Skipping truncation and seeding. (Set FORCE_SEED=true to override)\n")
            return

        print("\n🌱 HireOn — Seeding full demo data...\n")
        await clear_all(db)

        # ── Organization ──────────────────────────────────────────────────────
        org = Organization(
            name="Brainerhub",
            slug="brainerhub",
            industry="Technology",
            size="51-200",
            website="https://brainerhub.com",
            description="Brainerhub builds next-generation developer tooling used by 10,000+ engineers worldwide.",
            is_active=True,
        )
        db.add(org)
        await db.flush()
        print(f"  ✓ Organization: {org.name}")

        # ── Users ─────────────────────────────────────────────────────────────
        admin = User(
            organization_id=org.id,
            email="admin@brainerhub.com",
            full_name="Admin",
            hashed_password=hash_password("password123"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            last_login=ago(hours=2),
        )
        recruiter = User(
            organization_id=org.id,
            email="recruiter@brainerhub.com",
            full_name="Bob Recruiter",
            hashed_password=hash_password("password123"),
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
            last_login=ago(minutes=30),
        )
        recruiter2 = User(
            organization_id=org.id,
            email="recruiter2@brainerhub.com",
            full_name="Sneha HR",
            hashed_password=hash_password("password123"),
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
            last_login=ago(hours=1),
        )
        interviewer = User(
            organization_id=org.id,
            email="interviewer@brainerhub.com",
            full_name="Carol Interviewer",
            hashed_password=hash_password("password123"),
            role=UserRole.INTERVIEWER,
            is_active=True,
            is_verified=True,
            last_login=ago(days=1),
        )
        interviewer2 = User(
            organization_id=org.id,
            email="interviewer2@brainerhub.com",
            full_name="Dan Techie",
            hashed_password=hash_password("password123"),
            role=UserRole.INTERVIEWER,
            is_active=True,
            is_verified=True,
            last_login=ago(days=2),
        )
        candidate_user = User(
            organization_id=org.id,
            email="sarah.chen@gmail.com",
            full_name="Sarah Chen",
            hashed_password=hash_password("password123"),
            role=UserRole.CANDIDATE,
            is_active=True,
            is_verified=True,
            last_login=ago(days=1),
        )
        super_admin = User(
            organization_id=org.id,
            email="admin@hirreon.com",
            full_name="Super Admin",
            hashed_password=hash_password("admin"),
            role=UserRole.SUPER_ADMIN.value,
            is_active=True,
            is_verified=True,
            last_login=ago(hours=1),
        )

        for u in [admin, recruiter, recruiter2, interviewer, interviewer2, candidate_user, super_admin]:
            db.add(u)
        await db.flush()

        # ── Candidate profile for the portal candidate user ───────────────────
        # IMPORTANT: The users table alone is not enough — the portal endpoints
        # look up the `candidates` table by user_id. Without this row, every
        # call to GET/PUT /v1/portal/profile or POST /v1/portal/profile/resume
        # returns 404 "Candidate profile not found".
        candidate_profile = Candidate(
            organization_id=org.id,
            user_id=candidate_user.id,
            email=candidate_user.email,
            full_name=candidate_user.full_name,
            source="portal",
            skills=[],
        )
        db.add(candidate_profile)

        # ── Seed Subscription Plans ───────────────────────────────────────────
        starter_plan = SubscriptionPlan(
            name="Starter",
            price_monthly=8000.0,
            price_yearly=80000.0,
            max_users=20,
            max_jobs=10,
            features={"ai": False, "video": False, "bulk": True, "domain": False, "analytics": False}
        )
        pro_plan = SubscriptionPlan(
            name="Pro",
            price_monthly=24000.0,
            price_yearly=240000.0,
            max_users=50,
            max_jobs=20,
            features={"ai": True, "video": True, "bulk": True, "domain": False, "analytics": False}
        )
        ent_plan = SubscriptionPlan(
            name="Enterprise",
            price_monthly=60000.0,
            price_yearly=600000.0,
            max_users=999,
            max_jobs=999,
            features={"ai": True, "video": True, "bulk": True, "domain": True, "analytics": True}
        )
        db.add_all([starter_plan, pro_plan, ent_plan])
        await db.flush()

        # ── Company Subscription for Brainerhub ──────────────────────────────
        sub = CompanySubscription(
            organization_id=org.id,
            plan_id=pro_plan.id,
            status="active",
            billing_cycle="monthly",
            current_period_start=ago(days=15),
            current_period_end=future(days=15)
        )
        db.add(sub)

        # ── Company Feature Flags for Brainerhub ─────────────────────────────
        for key, val in pro_plan.features.items():
            db.add(CompanyFeatureFlag(
                organization_id=org.id,
                flag_key=key,
                is_enabled=val
            ))

        # ── Company Usage for Brainerhub ─────────────────────────────────────
        db.add_all([
            CompanyUsage(organization_id=org.id, metric_key="users_count", metric_value=42),
            CompanyUsage(organization_id=org.id, metric_key="jobs_count", metric_value=18),
            CompanyUsage(organization_id=org.id, metric_key="candidates_count", metric_value=130),
            CompanyUsage(organization_id=org.id, metric_key="interviews_count", metric_value=134)
        ])

        # ── Global Default Feature Flags ─────────────────────────────────────
        global_flags = PlatformSetting(
            setting_key="global_feature_flags",
            setting_value={"ai": True, "video": True, "bulk": True, "domain": False, "analytics": False}
        )
        db.add(global_flags)

        await db.commit()
        print(f"  ✓ Users: 7 created (admin, 2 recruiters, 2 interviewers, 1 candidate, 1 super admin)")
        print(f"  ✓ Candidate profile created for: {candidate_user.email}")
        print(f"  ✓ Subscription plans & Brainerhub Pro subscription seeded")

        print("\n" + "=" * 55)
        print("✅  Seed complete! Users loaded.")
        print("=" * 55)
        print("\n🔐 Login Credentials:")
        print("  Super Admin:  admin@hirreon.com       / admin")
        print("  Admin:        admin@brainerhub.com    / password123")
        print("  HR Recruiter: recruiter@brainerhub.com   / password123")
        print("  HR Recruiter: recruiter2@brainerhub.com     / password123")
        print("  Interviewer:  interviewer@brainerhub.com  / password123")
        print("  Interviewer2: interviewer2@brainerhub.com   / password123")
        print("  Candidate:    sarah.chen@gmail.com    / password123")
        print("=" * 55 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())