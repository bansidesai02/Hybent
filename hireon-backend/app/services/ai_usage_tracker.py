import logging
import uuid

logger = logging.getLogger(__name__)

async def log_ai_usage(
    provider: str,
    model: str,
    feature: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    duration_ms: float = 0.0,
    status: str = "success",
    error_detail: str | None = None,
    user_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None
):
    """
    Log AI usage metrics to the database and deduct credits.
    This is intended to be run as a background task.
    """
    try:
        from app.services.ai_credit_service import AICreditsService
        if status == "success":
            await AICreditsService.deduct_credits(
                db=None,
                organization_id=organization_id,
                user_id=user_id,
                feature=feature,
                provider=provider,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                duration_ms=duration_ms
            )
        else:
            await AICreditsService.log_failed_request(
                db=None,
                organization_id=organization_id,
                user_id=user_id,
                feature=feature,
                provider=provider,
                model=model,
                error_detail=error_detail or "Unknown Error",
                duration_ms=duration_ms
            )
    except Exception as e:
        # Crucial: tracker failure must not disrupt the main flow
        logger.error(f"Failed to log AI usage and deduct credits: {e}")
