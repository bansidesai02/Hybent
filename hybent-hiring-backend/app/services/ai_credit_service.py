import math
import uuid
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.organization_ai_credits import OrganizationAICredits
from app.models.user_ai_credits import UserAICredits
from app.models.ai_usage import AIUsage
from app.models.super_admin import CompanySubscription
from app.models.user import User
from app.services import ai_pricing, billing_service
from app.utils.exceptions import InsufficientCreditsException
from app.tasks.notifications import notify_organization_roles

logger = logging.getLogger(__name__)

# 1 credit = $0.001 of provider cost (see ai_pricing). Every plan includes
# this many credits a month unless the plan or a super admin says otherwise.
DEFAULT_ORG_MONTHLY_CREDITS = 10_000

# Each included seat's default share of the pool: the plan's 1 admin + 2
# recruiters come to 4,000 + 2 x 3,000 = the 10,000 monthly credits. Members
# in extra seats get that seat's credits instead (billing_service.EXTRA_SEATS).
# Only admins and recruiters use AI
# (see ai_metering.NO_AI_ROLES); super admins are Hybent staff with no
# personal limit.
ROLE_DEFAULT_LIMITS = {"admin": 4_000, "recruiter": 3_000}
UNLIMITED_ROLES = {"super_admin"}

# A user can spend at most this share of their monthly limit in one day.
DAILY_LIMIT_FRACTION = 0.2

# Top-up packs (credits, USD). Priced at CREDIT_PRICE_USD, the 2x markup.
TOPUP_PACKS = [(5_000, 10.0), (20_000, 40.0), (50_000, 100.0)]
TOPUP_REQUEST_EMAIL = "info@hybent.com"


def daily_limit_for(monthly_limit: int) -> int:
    return max(1, math.ceil(monthly_limit * DAILY_LIMIT_FRACTION))


def _take_whole(remainder: float | None, exact: float) -> tuple[int, float]:
    """Add a call's exact credits to a carried fraction; return the whole
    credits now due and the fraction left over."""
    total = (remainder or 0.0) + exact
    # Tolerance so float noise (0.9999999) doesn't hold back a whole credit.
    whole = math.floor(total + 1e-9)
    return whole, max(0.0, total - whole)


class AICreditsService:
    # ── Pools ────────────────────────────────────────────────────────────────

    @staticmethod
    async def plan_monthly_credits(db: AsyncSession, organization_id: uuid.UUID) -> tuple[int, CompanySubscription | None]:
        sub = (await db.execute(
            select(CompanySubscription).where(CompanySubscription.organization_id == organization_id)
        )).scalar_one_or_none()
        monthly = DEFAULT_ORG_MONTHLY_CREDITS
        if sub and sub.plan and sub.plan.ai_credits_monthly is not None:
            monthly = sub.plan.ai_credits_monthly
        # Extra admin seats add 1,500 credits each, recruiter seats 1,000.
        monthly += billing_service.extra_seat_credits(sub)
        return monthly, sub

    @classmethod
    async def get_or_create_org_credits(
        cls, db: AsyncSession, organization_id: uuid.UUID, for_update: bool = False
    ) -> OrganizationAICredits:
        """The organization's credit pool, created on first use with the
        plan's monthly allowance."""
        query = select(OrganizationAICredits).where(OrganizationAICredits.organization_id == organization_id)
        if for_update:
            query = query.with_for_update()
        org_credits = (await db.execute(query)).scalar_one_or_none()
        if org_credits:
            return org_credits

        monthly, sub = await cls.plan_monthly_credits(db, organization_id)
        reset_at = datetime.now(timezone.utc) + timedelta(days=30)
        if sub and sub.current_period_end and sub.current_period_end > datetime.now(timezone.utc):
            reset_at = sub.current_period_end

        org_credits = OrganizationAICredits(
            organization_id=organization_id,
            allowed_credits=monthly,
            used_credits=0,
            purchased_credits=0,
            reset_at=reset_at,
        )
        db.add(org_credits)
        await db.flush()
        logger.info(f"Initialized AI credits for organization {organization_id}: {monthly} credits/month.")
        return org_credits

    @staticmethod
    def org_remaining(org_credits: OrganizationAICredits) -> int:
        monthly_left = max(0, org_credits.allowed_credits - org_credits.used_credits)
        return monthly_left + max(0, org_credits.purchased_credits or 0)

    @staticmethod
    async def user_role(db: AsyncSession, user_id: uuid.UUID) -> str | None:
        role = (await db.execute(select(User.role).where(User.id == user_id))).scalar_one_or_none()
        return getattr(role, "value", role)

    @classmethod
    async def get_or_create_user_credits(
        cls, db: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID, for_update: bool = False
    ) -> UserAICredits | None:
        """The user's share of the pool, created on first use. Members in the
        plan's included seats get their role's default; anyone beyond them is
        in an extra seat and gets that seat's credits (admin 1,500, recruiter
        1,000). Either way it's capped at what's still unallocated. None for
        roles without a limit."""
        query = select(UserAICredits).where(UserAICredits.user_id == user_id)
        if for_update:
            query = query.with_for_update()
        row = (await db.execute(query)).scalar_one_or_none()
        if row:
            return row

        role = await cls.user_role(db, user_id)
        if role not in ROLE_DEFAULT_LIMITS:
            return None

        org_credits = await cls.get_or_create_org_credits(db, organization_id)
        allocated = (await db.execute(
            select(func.coalesce(func.sum(UserAICredits.monthly_limit), 0))
            .join(User, User.id == UserAICredits.user_id)
            .where(UserAICredits.organization_id == organization_id, User.is_active.is_(True))
            .where(User.role.in_(tuple(ROLE_DEFAULT_LIMITS)))
        )).scalar() or 0
        unallocated = max(0, org_credits.allowed_credits - allocated)

        default = ROLE_DEFAULT_LIMITS[role]
        sub = (await db.execute(
            select(CompanySubscription).where(CompanySubscription.organization_id == organization_id)
        )).scalar_one_or_none()
        if sub and sub.plan:
            included = sub.plan.included_admins if role == "admin" else sub.plan.included_recruiters
            same_role_with_limits = (await db.execute(
                select(func.count())
                .select_from(UserAICredits)
                .join(User, User.id == UserAICredits.user_id)
                .where(UserAICredits.organization_id == organization_id, User.is_active.is_(True))
                .where(User.role == role)
            )).scalar() or 0
            if same_role_with_limits >= included:
                default = billing_service.EXTRA_SEATS[role][1]

        row = UserAICredits(
            organization_id=organization_id,
            user_id=user_id,
            monthly_limit=min(default, unallocated),
            used_credits=0,
            daily_used=0,
            daily_date=None,
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    def user_daily_used(row: UserAICredits) -> int:
        today = datetime.now(timezone.utc).date()
        return row.daily_used if row.daily_date == today else 0

    # ── Checks ───────────────────────────────────────────────────────────────

    @classmethod
    async def check_credits_available(
        cls,
        db: AsyncSession | None,
        organization_id: uuid.UUID | None,
        feature: str | None = None,
        user_id: uuid.UUID | None = None,
    ):
        """Raise InsufficientCreditsException before an AI call if the
        organization's pool, or the user's monthly or daily limit, is spent.
        The user defaults to the current AI scope's user."""
        if not organization_id:
            return
        if user_id is None:
            from app.services.ai_metering import current_scope
            scope = current_scope()
            if scope and scope.organization_id == organization_id:
                user_id = scope.user_id

        if db is None:
            async with AsyncSessionLocal() as session:
                await cls.check_credits_available(session, organization_id, feature, user_id)
                await session.commit()
                return

        org_credits = await cls.get_or_create_org_credits(db, organization_id)
        if cls.org_remaining(org_credits) <= 0:
            raise InsufficientCreditsException(
                "Your organization has used all of its AI credits for this month. "
                "Ask your admin to buy a top-up, or wait for the monthly reset."
            )

        if user_id:
            from app.services.ai_metering import NO_AI_MESSAGE, NO_AI_ROLES
            if await cls.user_role(db, user_id) in NO_AI_ROLES:
                raise InsufficientCreditsException(NO_AI_MESSAGE)
            row = await cls.get_or_create_user_credits(db, organization_id, user_id)
            if row is not None:
                if row.used_credits >= row.monthly_limit:
                    raise InsufficientCreditsException(
                        f"You've used your monthly AI credit limit ({row.monthly_limit:,} credits). "
                        "Ask your admin to raise your limit."
                    )
                if cls.user_daily_used(row) >= daily_limit_for(row.monthly_limit):
                    raise InsufficientCreditsException(
                        f"You've reached today's AI credit limit ({daily_limit_for(row.monthly_limit):,} credits). "
                        "It resets at midnight UTC."
                    )

        # The database is the source of truth: a pool that passed here isn't
        # spent any more (top-up, raised limit, reset), so drop any stale
        # "spent" flag this process remembered for it.
        from app.services.ai_metering import clear_blocked
        clear_blocked(organization_id=organization_id, user_id=user_id)

    # ── Charging ─────────────────────────────────────────────────────────────

    @classmethod
    async def charge(
        cls,
        db: AsyncSession | None,
        *,
        organization_id: uuid.UUID | None,
        user_id: uuid.UUID | None,
        feature: str,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        audio_seconds: float | None = None,
        cost_usd: float | None = None,
        duration_ms: float = 0.0,
    ) -> float:
        """Charge one completed AI call for exactly what it consumed and log
        it to AIUsage.

        A call costs cost / $0.001 credits, usually a fraction (an embedding
        is ~0.01). Fractions carry on the org's and user's balances and only
        whole credits come off, so a hundred tiny calls cost one credit rather
        than a hundred. Monthly credits are spent first, then purchased ones.
        Returns the exact (fractional) credits for the call."""
        if not organization_id:
            return 0.0

        if db is None:
            async with AsyncSessionLocal() as session:
                return await cls.charge(
                    session, organization_id=organization_id, user_id=user_id, feature=feature,
                    provider=provider, model=model, prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens, audio_seconds=audio_seconds,
                    cost_usd=cost_usd, duration_ms=duration_ms,
                )

        if cost_usd is None:
            if audio_seconds is not None:
                cost_usd = ai_pricing.audio_cost_usd(model, audio_seconds)
            else:
                cost_usd = ai_pricing.text_cost_usd(model, prompt_tokens, completion_tokens)
        exact = ai_pricing.exact_credits(cost_usd)

        org_credits = await cls.get_or_create_org_credits(db, organization_id, for_update=True)
        credits, org_credits.credit_remainder = _take_whole(org_credits.credit_remainder, exact)
        used_before = org_credits.used_credits
        monthly_left = max(0, org_credits.allowed_credits - org_credits.used_credits)
        from_monthly = min(credits, monthly_left)
        from_purchased = min(credits - from_monthly, max(0, org_credits.purchased_credits or 0))
        # A call that started with credits left can overshoot; the overshoot
        # is recorded against the monthly allowance.
        overdraft = credits - from_monthly - from_purchased
        org_credits.used_credits += from_monthly + overdraft
        org_credits.purchased_credits = (org_credits.purchased_credits or 0) - from_purchased

        if user_id:
            row = await cls.get_or_create_user_credits(db, organization_id, user_id, for_update=True)
            if row is not None:
                user_credits, row.credit_remainder = _take_whole(row.credit_remainder, exact)
                today = datetime.now(timezone.utc).date()
                row.used_credits += user_credits
                if row.daily_date == today:
                    row.daily_used += user_credits
                else:
                    row.daily_date = today
                    row.daily_used = user_credits

        db.add(AIUsage(
            organization_id=organization_id,
            user_id=user_id,
            provider=provider,
            model=model,
            feature=feature,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            credits_used=round(exact, 6),
            cost=round(cost_usd, 6),
            duration_ms=duration_ms,
            status="success",
        ))
        await db.flush()
        logger.info(
            f"Charged {exact:.4f} credits (${cost_usd:.5f}) for {feature} via {model} "
            f"({credits} whole credit(s) deducted; Org: {organization_id})"
        )

        await cls._check_and_trigger_alerts(
            db, org_credits, used_before, org_credits.used_credits, org_credits.allowed_credits
        )
        await db.commit()
        return exact

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
        """Backward-compatible entry point; prices the call like charge()."""
        return await cls.charge(
            db, organization_id=organization_id, user_id=user_id, feature=feature,
            provider=provider, model=model, prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            audio_seconds=audio_duration_sec or None, duration_ms=duration_ms,
        )

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
        """Log a failed request to AIUsage with 0 credits deducted."""
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

    # ── Admin operations ─────────────────────────────────────────────────────

    @classmethod
    async def resync_monthly_allowance(cls, db: AsyncSession, org_credits: OrganizationAICredits) -> int:
        """Set the monthly allowance from the super-admin override or the plan."""
        if org_credits.custom_monthly_credits is not None:
            monthly = org_credits.custom_monthly_credits
        else:
            monthly, _ = await cls.plan_monthly_credits(db, org_credits.organization_id)
        org_credits.allowed_credits = monthly
        return monthly

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
        purchased = max(0, org_credits.purchased_credits or 0)

        exhausted_msg = (
            f"Your monthly AI credits are used up. {purchased:,} purchased credits remain."
            if purchased > 0 else
            "Your organization has used all of its AI credits for this month. Buy a top-up or wait for the monthly reset."
        )
        alerts = [
            (0, "warning_0_sent", "Monthly AI credits used up", exhausted_msg),
            (5, "warning_5_sent", "AI credits almost used up", "Only 5% of this month's AI credits remain."),
            (10, "warning_10_sent", "Low AI credits", "Only 10% of this month's AI credits remain."),
            (25, "warning_25_sent", "AI credits running low", "Only 25% of this month's AI credits remain."),
            (50, "warning_50_sent", "Half of monthly AI credits used", "50% of this month's AI credits have been used."),
        ]

        roles_to_notify = ["admin", "recruiter"]

        for threshold, flag_name, title, message in alerts:
            sent_flag = getattr(org_credits, flag_name)
            if not sent_flag and pct_remaining_after <= threshold and pct_remaining_before > threshold:
                setattr(org_credits, flag_name, True)
                notify_organization_roles.delay(
                    org_id_str,
                    roles_to_notify,
                    "ai_credits_warning",
                    title,
                    message,
                    {"remaining_pct": pct_remaining_after, "remaining_credits": max(0, allowed - used_after) + purchased}
                )
                logger.info(f"Triggered alert for threshold {threshold}% remaining for Org {org_id_str}")
