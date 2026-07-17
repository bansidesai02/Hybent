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
from app.models.organization_ai_credits import OrganizationAICredits
from app.models.ai_credit_rule import AICreditRule
from app.models.ai_usage import AIUsage
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
        "company_usage", "platform_settings", "organization_ai_credits", "ai_credit_rules"
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
        result = await db.execute(select(User).where(User.email == "yashdesai494@gmail.com"))
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
            email="yashdesai494@gmail.com",
            full_name="Yash Desai",
            hashed_password=hash_password("password123"),
            role=UserRole.SUPER_ADMIN.value,
            is_active=True,
            is_verified=True,
            last_login=ago(hours=1),
        )

        for u in [admin]:
            db.add(u)
        await db.flush()



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

        # ── Seed AICreditRules ────────────────────────────────────────────────
        rules = [
            AICreditRule(feature="resume_parsing", cost_type="fixed", fixed_cost=30),
            AICreditRule(feature="jd_generation", cost_type="fixed", fixed_cost=25),
            AICreditRule(feature="candidate_summary", cost_type="fixed", fixed_cost=25),
            AICreditRule(feature="ai_copilot", cost_type="dynamic", token_input_cost_per_1k=15.0, token_output_cost_per_1k=30.0),
            AICreditRule(feature="speech_to_text", cost_type="dynamic", audio_cost_per_second=1.0000), # 60 per minute (Whisper pricing equivalent)
            AICreditRule(feature="interview_evaluation", cost_type="fixed", fixed_cost=40),
            AICreditRule(feature="linkedin_post_generation", cost_type="fixed", fixed_cost=15),
            AICreditRule(feature="image_prompt_generation", cost_type="fixed", fixed_cost=10),
            AICreditRule(feature="image_generation", cost_type="fixed", fixed_cost=150), # Cover Dall-E 3 pricing
            AICreditRule(feature="candidate_matching", cost_type="fixed", fixed_cost=30),
            AICreditRule(feature="pre_screening_grading", cost_type="fixed", fixed_cost=20),
            AICreditRule(feature="interview_question_generation", cost_type="fixed", fixed_cost=25),
            AICreditRule(feature="email_generation", cost_type="fixed", fixed_cost=10),
            AICreditRule(feature="translation", cost_type="fixed", fixed_cost=10),
        ]
        db.add_all(rules)

        # ── Seed OrganizationAICredits ────────────────────────────────────────
        # 1 August 2026 as reset date matching example request
        reset_date = datetime(2026, 8, 1, 0, 0, tzinfo=timezone.utc)
        org_credits = OrganizationAICredits(
            organization_id=org.id,
            allowed_credits=100000,
            used_credits=32450,
            reset_at=reset_date
        )
        db.add(org_credits)

        # ── Seed AIUsage History logs (sample data) ───────────────────────────
        # Seed several logs spread over the last 30 days to build charts.
        import random
        features_list = [
            ("resume_parsing", 20, "success"),
            ("jd_generation", 35, "success"),
            ("interview_evaluation", 20, "success"),
            ("candidate_summary", 25, "success"),
            ("ai_copilot", 50, "success"), # dynamic
            ("speech_to_text", 120, "success"), # dynamic
            ("image_generation", 50, "success"),
            ("candidate_matching", 15, "success"),
            ("email_generation", 10, "success")
        ]
        
        users_list = [admin.id, recruiter.id, recruiter2.id, interviewer.id]
        
        # 50 records spread over 30 days
        for i in range(50):
            feat, cr_cost, status = random.choice(features_list)
            if i % 12 == 0:
                status = "failure"
                cr_cost = 0
                error_detail = "API Timeout"
            else:
                error_detail = None
                
            day_offset = random.randint(0, 30)
            created_time = NOW - timedelta(days=day_offset, hours=random.randint(0, 23))
            
            p_tok = random.randint(100, 1000) if feat in ["ai_copilot", "jd_generation", "candidate_summary"] else 0
            c_tok = random.randint(100, 800) if feat in ["ai_copilot", "jd_generation", "candidate_summary"] else 0
            t_tok = p_tok + c_tok
            
            usage = AIUsage(
                organization_id=org.id,
                user_id=random.choice(users_list),
                provider="Gemini" if feat != "resume_parsing" else "Groq",
                model="gemini-1.5-flash-latest" if feat != "resume_parsing" else "llama-3.3-70b-versatile",
                feature=feat,
                prompt_tokens=p_tok,
                completion_tokens=c_tok,
                total_tokens=t_tok,
                credits_used=cr_cost,
                cost=round((t_tok / 1000.0) * 0.0015, 4) if t_tok > 0 else 0.0,
                duration_ms=random.randint(500, 3500),
                status=status,
                error_detail=error_detail,
                created_at=created_time
            )
            db.add(usage)

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