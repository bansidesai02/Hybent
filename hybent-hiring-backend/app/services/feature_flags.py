"""
Per-client feature switches from the super admin portal, enforced.

A client's own setting (company_feature_flags) wins; without one, the
platform default from Super Admin → Feature flags (platform_settings
"global_feature_flags") applies; without that, BUILT_IN_DEFAULTS.

Only the keys in ENFORCED are switched on and off here. AI Calls has its own
check (services/voice_calls.ai_calls_enabled) because it also needs the call
engine configured. "video" and "domain" have no product feature behind them
yet, so they are not offered as working switches.
"""
import uuid

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# What each enforced flag gates, for error messages.
ENFORCED = {
    "ai": "AI scoring",
    "bulk": "Bulk candidate import",
    "analytics": "Report export",
    "copilot": "Hybent Copilot",
}
# Before these were enforced every client had all four, so a client with no
# saved setting keeps them: switching them on by default changes nothing.
BUILT_IN_DEFAULTS = {"ai": True, "bulk": True, "analytics": True, "copilot": True}


async def _global_defaults(db: AsyncSession) -> dict:
    from app.models.super_admin import PlatformSetting
    value = await db.scalar(
        select(PlatformSetting.setting_value).where(PlatformSetting.setting_key == "global_feature_flags")
    )
    return value or {}


async def _plan_features(db: AsyncSession, organization_id: uuid.UUID) -> dict:
    from app.models.super_admin import CompanySubscription, SubscriptionPlan
    value = await db.scalar(
        select(SubscriptionPlan.features)
        .join(CompanySubscription, CompanySubscription.plan_id == SubscriptionPlan.id)
        .where(CompanySubscription.organization_id == organization_id)
    )
    return value or {}


async def effective_flags(db: AsyncSession, organization_id: uuid.UUID | None) -> dict[str, bool]:
    from app.models.super_admin import CompanyFeatureFlag

    flags = {**BUILT_IN_DEFAULTS}
    flags.update({k: bool(v) for k, v in (await _global_defaults(db)).items() if k in ENFORCED})
    if organization_id:
        # The plan sets what it includes (Standard has no Copilot, Pro does);
        # a client's own switch from the super admin still wins.
        flags.update({k: bool(v) for k, v in (await _plan_features(db, organization_id)).items() if k in ENFORCED})
        rows = (await db.execute(
            select(CompanyFeatureFlag.flag_key, CompanyFeatureFlag.is_enabled)
            .where(CompanyFeatureFlag.organization_id == organization_id)
        )).all()
        flags.update({k: bool(v) for k, v in rows if k in ENFORCED})
    return flags


async def is_enabled(db: AsyncSession, organization_id: uuid.UUID | None, key: str) -> bool:
    return (await effective_flags(db, organization_id)).get(key, True)


def require_feature(key: str):
    """Router/endpoint dependency: 403 when the caller's organization has `key` off."""
    from app.core.database import get_db
    from app.dependencies import get_current_user

    async def _check(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        if not await is_enabled(db, user.organization_id, key):
            raise HTTPException(
                status_code=403,
                detail=f"{ENFORCED[key]} is turned off for your organization. Contact Hybent to enable it.",
            )
    return _check
