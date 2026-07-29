import uuid
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.organization_ai_credits import OrganizationAICredits
from app.models.ai_credit_rule import AICreditRule
from app.models.ai_usage import AIUsage
from app.models.super_admin import CompanySubscription
from app.utils.exceptions import InsufficientCreditsException
from app.tasks.notifications import notify_organization_roles

logger = logging.getLogger(__name__)

class AICreditsService:
    @staticmethod
    async def get_or_create_org_credits(db: AsyncSession, organization_id: uuid.UUID) -> OrganizationAICredits:
        """
        Retrieve organization credits. If they don't exist, create default balance 
        based on their subscription plan.
        """
        query = select(OrganizationAICredits).where(OrganizationAICredits.organization_id == organization_id)
        result = await db.execute(query)
        org_credits = result.scalar_one_or_none()

        if org_credits:
            return org_credits

        # Initialize credits based on subscription plan
        sub_query = (
            select(CompanySubscription)
            .where(CompanySubscription.organization_id == organization_id)
        )
        sub_result = await db.execute(sub_query)
        sub = sub_result.scalar_one_or_none()

        allowed_credits = 50000  # Default Starter
        if sub and sub.plan:
            plan_name = sub.plan.name.lower()
            if "pro" in plan_name or "professional" in plan_name:
                allowed_credits = 100000
            elif "enterprise" in plan_name:
                allowed_credits = 250000

        reset_at = datetime.now(timezone.utc) + timedelta(days=30)
        if sub and sub.current_period_end:
            reset_at = sub.current_period_end

        org_credits = OrganizationAICredits(
            organization_id=organization_id,
            allowed_credits=allowed_credits,
            used_credits=0,
            reset_at=reset_at
        )
        db.add(org_credits)
        await db.flush()
        logger.info(f"Initialized AI credits for organization {organization_id}: {allowed_credits} credits.")
        return org_credits

    @staticmethod
    async def get_rule(db: AsyncSession, feature: str) -> AICreditRule:
        """
        Get credit rule for the feature. If not found, return a default fixed rule (10 credits).
        """
        query = select(AICreditRule).where(AICreditRule.feature == feature)
        result = await db.execute(query)
        rule = result.scalar_one_or_none()
        
        if not rule:
            logger.warning(f"Credit rule not found for feature: {feature}. Using fallback rule.")
            # Fallback rule
            rule = AICreditRule(
                feature=feature,
                cost_type="fixed",
                fixed_cost=10
            )
        return rule

    @classmethod
    async def check_credits_available(cls, db: AsyncSession | None, organization_id: uuid.UUID, feature: str):
        """
        Verify if organization has enough credits.
        Raises InsufficientCreditsException if credits are exhausted or insufficient.
        """
        if not organization_id:
            return

        if db is None:
            async with AsyncSessionLocal() as session:
                return await cls.check_credits_available(session, organization_id, feature)

        org_credits = await cls.get_or_create_org_credits(db, organization_id)
        rule = await cls.get_rule(db, feature)

        remaining = org_credits.allowed_credits - org_credits.used_credits

        # If remaining is 0 or less, reject all AI features
        if remaining <= 0:
            raise InsufficientCreditsException(
                "Your organization has exhausted its AI Credits. Please purchase additional credits or upgrade your subscription."
            )

        # For fixed cost features, check if we have enough for the action
        if rule.cost_type == "fixed" and remaining < rule.fixed_cost:
            raise InsufficientCreditsException(
                f"Insufficient AI credits to perform this action. Required: {rule.fixed_cost}, Remaining: {remaining}."
            )

    @classmethod
    async def deduct_credits(
        cls,
        db: AsyncSession | None,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        feature: str,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        audio_duration_sec: float = 0.0,
        duration_ms: float = 0.0
    ) -> int:
        """
        Calculate and deduct credits, log the usage, check warning levels, and send notifications.
        Returns the credits deducted.
        """
        if not organization_id:
            return 0

        if db is None:
            async with AsyncSessionLocal() as session:
                return await cls.deduct_credits(
                    session, organization_id, user_id, feature, provider, model,
                    prompt_tokens, completion_tokens, audio_duration_sec, duration_ms
                )

        org_credits = await cls.get_or_create_org_credits(db, organization_id)
        rule = await cls.get_rule(db, feature)

        # Calculate cost
        credits_used = 0
        if rule.cost_type == "fixed":
            credits_used = rule.fixed_cost
        elif rule.cost_type == "dynamic":
            if feature == "speech_to_text":
                if audio_duration_sec <= 0:
                    audio_duration_sec = max(5.0, duration_ms / 1000.0)
                credits_used = int(audio_duration_sec * rule.audio_cost_per_second)
            else:
                # Token-based dynamic cost
                input_cost = (prompt_tokens / 1000.0) * rule.token_input_cost_per_1k
                output_cost = (completion_tokens / 1000.0) * rule.token_output_cost_per_1k
                credits_used = int(input_cost + output_cost)

        # Ensure we always deduct at least 1 credit for successful calls
        credits_used = max(1, credits_used)

        total_tokens = prompt_tokens + completion_tokens
        # Estimated cost in USD
        estimated_cost = round((total_tokens / 1000.0) * 0.0015, 4) if total_tokens > 0 else 0.0

        # Update balance
        used_before = org_credits.used_credits
        org_credits.used_credits += credits_used
        used_after = org_credits.used_credits
        allowed = org_credits.allowed_credits

        # Save usage log
        usage = AIUsage(
            organization_id=organization_id,
            user_id=user_id,
            provider=provider,
            model=model,
            feature=feature,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            credits_used=credits_used,
            cost=estimated_cost,
            duration_ms=duration_ms,
            status="success"
        )
        db.add(usage)
        await db.flush()

        logger.info(f"Deducted {credits_used} credits for {feature} (Org: {organization_id})")

        # Check and trigger alerts
        await cls._check_and_trigger_alerts(db, org_credits, used_before, used_after, allowed)

        await db.commit()
        return credits_used

    @classmethod
    async def log_failed_request(
        cls,
        db: AsyncSession | None,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        feature: str,
        provider: str,
        model: str,
        error_detail: str,
        duration_ms: float = 0.0
    ):
        """
        Log failed request to AIUsage with 0 credits deducted.
        """
        if not organization_id:
            return

        if db is None:
            async with AsyncSessionLocal() as session:
                return await cls.log_failed_request(
                    session, organization_id, user_id, feature, provider, model, error_detail, duration_ms
                )

        usage = AIUsage(
            organization_id=organization_id,
            user_id=user_id,
            provider=provider,
            model=model,
            feature=feature,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            credits_used=0,
            cost=0.0,
            duration_ms=duration_ms,
            status="failure",
            error_detail=error_detail[:500] if error_detail else "Unknown Error"
        )
        db.add(usage)
        await db.commit()
        logger.info(f"Logged failed AI request for {feature} (Org: {organization_id})")

    @staticmethod
    async def _check_and_trigger_alerts(
        db: AsyncSession,
        org_credits: OrganizationAICredits,
        used_before: int,
        used_after: int,
        allowed: int
    ):
        if allowed <= 0:
            return

        pct_remaining_before = ((allowed - used_before) / allowed) * 100
        pct_remaining_after = ((allowed - used_after) / allowed) * 100
        org_id_str = str(org_credits.organization_id)

        # Trigger conditions
        alerts = [
            (0, "warning_0_sent", "Critical: AI Credits Exhausted", "Your organization has exhausted its AI Credits. Please purchase additional credits or upgrade your subscription."),
            (5, "warning_5_sent", "Credits Almost Finished", "AI Credits Almost Finished! Only 5% credits remaining."),
            (10, "warning_10_sent", "Low AI Credits", "Low AI Credits: Only 10% remaining."),
            (25, "warning_25_sent", "Low Credits Warning", "Only 25% AI Credits Remaining."),
            (50, "warning_50_sent", "AI Quota Consumed", "50% of your monthly AI credits have been consumed.")
        ]

        roles_to_notify = ["admin", "recruiter"]

        for threshold, flag_name, title, message in alerts:
            sent_flag = getattr(org_credits, flag_name)
            if not sent_flag and pct_remaining_after <= threshold and pct_remaining_before > threshold:
                setattr(org_credits, flag_name, True)
                
                # Enqueue background task to notify all admins/recruiters in organization
                notify_organization_roles.delay(
                    org_id_str,
                    roles_to_notify,
                    "ai_credits_warning",
                    title,
                    message,
                    {"remaining_pct": pct_remaining_after, "remaining_credits": max(0, allowed - used_after)}
                )
                logger.info(f"Triggered alert for threshold {threshold}% remaining for Org {org_id_str}")
