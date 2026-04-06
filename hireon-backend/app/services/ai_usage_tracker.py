import logging
import uuid
from datetime import datetime, timezone
from app.database import AsyncSessionLocal
from app.models.ai_usage import AIUsage

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
    Log AI usage metrics to the database.
    This is intended to be run as a background task.
    """
    try:
        async with AsyncSessionLocal() as session:
            usage = AIUsage(
                provider=provider,
                model=model,
                feature=feature,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                duration_ms=duration_ms,
                status=status,
                error_detail=error_detail,
                user_id=user_id,
                organization_id=organization_id,
                created_at=datetime.now(timezone.utc)
            )
            session.add(usage)
            await session.commit()
            logger.info(f"AI Usage logged: {provider} - {model} - {feature} ({total_tokens} tokens)")
    except Exception as e:
        # Crucial: tracker failure must not disrupt the main flow
        logger.error(f"Failed to log AI usage: {e}")
