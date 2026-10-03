"""
Provider prices and the credit conversion.

One credit is $0.001 of provider cost (what Groq/Gemini/etc. charge us).
Clients buy credits at $0.002 each, so every credit carries a 2x markup.
Charges are computed from the tokens (or audio seconds) a call actually
consumed, so the markup holds whichever model a fallback chain lands on.

Prices are USD per 1M tokens (text) or per hour (audio), from the providers'
public pricing pages as of 2026-10 (Groq: console.groq.com/docs/models).
Update this table when they change.
"""
import logging

logger = logging.getLogger(__name__)

CREDIT_COST_USD = 0.001   # what one credit costs us
CREDIT_PRICE_USD = 0.002  # what a client pays for one credit

# (input $/1M tokens, output $/1M tokens)
TEXT_PRICES: dict[str, tuple[float, float]] = {
    # Groq. The Llama models moved to enterprise-only pricing on 2026-08-26
    # with no published rate; their last public rates are kept as the charge.
    "llama-3.3-70b-versatile": (0.59, 0.79),
    "llama3-70b-8192": (0.59, 0.79),
    "llama-3.1-8b-instant": (0.05, 0.08),
    "llama3-8b-8192": (0.05, 0.08),
    "openai/gpt-oss-120b": (0.15, 0.60),
    "openai/gpt-oss-20b": (0.075, 0.30),
    "qwen/qwen3.6-27b": (0.60, 3.00),
    "qwen/qwen3.8-27b": (0.80, 4.00),
    "groq/compound": (0.59, 0.79),
    "groq/compound-mini": (0.15, 0.60),
    # Gemini (paid tier)
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-1.5-flash-latest": (0.075, 0.30),
    "gemini-1.5-pro": (1.25, 5.00),
    "gemini-embedding-001": (0.15, 0.0),
}

# Anything not listed is charged at this rate (Gemini 2.5 Flash, the most
# expensive model on the regular fallback paths) so an unknown model can't
# be under-charged.
DEFAULT_TEXT_PRICE = (0.30, 2.50)

# $ per hour of audio. Groq bills a minimum of 10 seconds per request.
AUDIO_PRICES: dict[str, float] = {
    "whisper-large-v3-turbo": 0.04,
    "whisper-large-v3": 0.111,
    "whisper-1": 0.36,  # OpenAI
}
DEFAULT_AUDIO_PRICE = 0.111
MIN_AUDIO_SECONDS = 10.0


def _normalize(model: str | None) -> str:
    name = (model or "").strip()
    if name.startswith("models/"):
        name = name[len("models/"):]
    return name


def text_cost_usd(model: str | None, prompt_tokens: int, completion_tokens: int) -> float:
    name = _normalize(model)
    price = TEXT_PRICES.get(name)
    if price is None:
        logger.warning(f"No price for model '{name}'; charging the default rate.")
        price = DEFAULT_TEXT_PRICE
    return (max(0, prompt_tokens) * price[0] + max(0, completion_tokens) * price[1]) / 1_000_000


def audio_cost_usd(model: str | None, audio_seconds: float) -> float:
    rate = AUDIO_PRICES.get(_normalize(model), DEFAULT_AUDIO_PRICE)
    return max(MIN_AUDIO_SECONDS, audio_seconds or 0.0) / 3600 * rate


def exact_credits(cost_usd: float) -> float:
    """Credits for a call that cost us `cost_usd`, not rounded: tiny calls
    (embeddings, ~$0.00001) are a fraction of a credit. AICreditsService
    carries the fractions and deducts whole credits as they add up, so the
    2x markup holds for every call size."""
    return max(0.0, cost_usd) / CREDIT_COST_USD
