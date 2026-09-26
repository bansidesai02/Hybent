import logging
import uuid

logger = logging.getLogger(__name__)

# Charged centrally by ai_metering (SafeGroq / google.generativeai).
METERED_PROVIDERS = {"groq", "gemini", "google"}

# Flat provider cost for calls that don't report tokens.
UNMETERED_PROVIDER_COST_USD = {
    "image_generation": 0.003,  # one FLUX.1-schnell image on HF inference
    "speech_to_text": 0.001,    # HF / OpenAI Whisper fallbacks, ~1 min of audio
}

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
    Log an AI call from a feature's own code. Groq and Gemini calls are
    already charged centrally by app/services/ai_metering.py from their real
    token usage, so for those this only records failures. Other providers
    (HuggingFace, OpenAI Whisper over HTTP) are charged here.
    """
    try:
        from app.services.ai_credit_service import AICreditsService
        from app.services.ai_metering import current_scope
        scope = current_scope()
        if scope and not organization_id:
            organization_id, user_id = scope.organization_id, user_id or scope.user_id
        if status == "success":
            if (provider or "").lower() in METERED_PROVIDERS:
                return
            await AICreditsService.charge(
                None,
                organization_id=organization_id,
                user_id=user_id,
                feature=feature,
                provider=provider,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_usd=UNMETERED_PROVIDER_COST_USD.get(feature),
                duration_ms=duration_ms,
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
