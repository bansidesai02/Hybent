import logging
import re
import time
import os
from groq import Groq, RateLimitError, APIStatusError
from app.core.config import settings
from app.services import ai_metering

logger = logging.getLogger(__name__)

ai_metering.install_gemini_metering()


def _load_keys() -> list[str]:
    """
    All configured Groq API keys, in priority order, deduplicated and with
    empty values dropped.

    GROQ_API_KEY is the primary. Any number of additional keys can be added
    as GROQ_FALLBACK_API_KEY, GROQ_FALLBACK_API_KEY_2, GROQ_FALLBACK_API_KEY_3,
    ... (numbering starts at 2 since GROQ_FALLBACK_API_KEY is the first
    fallback) — each is tried in order whenever every key before it has
    failed. There's no fixed limit; just add the next number.
    """
    keys = [settings.groq_api_key, os.getenv("GROQ_FALLBACK_API_KEY", "")]
    i = 2
    while True:
        k = os.getenv(f"GROQ_FALLBACK_API_KEY_{i}", "")
        if not k:
            break
        keys.append(k)
        i += 1

    seen = set()
    return [k for k in keys if k and not (k in seen or seen.add(k))]


ALL_KEYS = _load_keys()

# Kept for any external caller/test referencing the old two-key names.
PRIMARY_KEY = ALL_KEYS[0] if ALL_KEYS else ""
FALLBACK_KEY = ALL_KEYS[1] if len(ALL_KEYS) > 1 else PRIMARY_KEY

# Keys that have failed (rate limit / auth error) at least once this process
# lifetime. Tried last rather than dropped entirely, since a rate limit is
# often time-windowed (e.g. a daily quota) and may have recovered by the
# time every other key is also exhausted.
_failed_keys: set[str] = set()

# Keys Groq rejected outright (401/403: invalid or revoked). Unlike a rate
# limit this never recovers, so they're dropped for the process lifetime —
# an invalid key used to be retried against every model on every call.
_invalid_keys: set[str] = set()

# Models Groq said don't exist (404); skipped from then on.
_missing_models: set[str] = set()

# GPT-OSS first: it has a published self-serve price, so the 2x credit markup
# is exact. The Llama models are Enterprise "Contact Sales" since 2026-08-26
# and are charged at their last public rate, so they're fallbacks only.
# groq/compound is deliberately absent: it bills built-in tool use (web
# search, code execution) on top of tokens, which metering can't see.
PREFERRED_TEXT_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "qwen/qwen3.6-27b",
    "llama-3.1-8b-instant",
]

# GPT-OSS reasons before answering, and the reasoning counts against
# max_tokens. Low effort keeps latency and cost close to a non-reasoning
# model; the headroom stops a small max_tokens (e.g. a 20-token title) from
# being spent entirely on reasoning and returning empty content.
REASONING_DEFAULT_EFFORT = "low"
REASONING_TOKEN_HEADROOM = 1024


def _supports_reasoning_effort(model: str) -> bool:
    return model.startswith("openai/gpt-oss")


def _kwargs_for_model(kwargs: dict, model: str) -> dict:
    """Per-model request arguments: reasoning settings only go to models that
    accept them, since other models reject the request outright."""
    call = dict(kwargs)
    call["model"] = model
    if _supports_reasoning_effort(model):
        call.setdefault("reasoning_effort", REASONING_DEFAULT_EFFORT)
        for key in ("max_tokens", "max_completion_tokens"):
            if call.get(key):
                call[key] = call[key] + REASONING_TOKEN_HEADROOM
    else:
        call.pop("reasoning_effort", None)
    return call


def _is_json_validation_error(e: Exception) -> bool:
    return "json_validate_failed" in str(e) or "failed to validate json" in str(e).lower()

PREFERRED_AUDIO_MODELS = [
    "whisper-large-v3-turbo",
    "whisper-large-v3"
]

def sanitize_error_msg(err_obj) -> str:
    msg = str(err_obj)
    # Mask any Groq API keys matching gsk_ pattern
    return re.sub(r'gsk_[A-Za-z0-9_-]+', '[REDACTED_API_KEY]', msg)


def _ordered_keys() -> list[str]:
    """Not-yet-failed keys first (in configured priority order), then
    previously-failed ones as a last resort — never gives up on a key
    permanently within a single call, just deprioritizes it."""
    usable = [k for k in ALL_KEYS if k not in _invalid_keys]
    healthy = [k for k in usable if k not in _failed_keys]
    failed = [k for k in usable if k in _failed_keys]
    return healthy + failed


def mark_key_invalid(key: str):
    if key and key not in _invalid_keys:
        _invalid_keys.add(key)
        logger.error(
            f"A Groq API key was rejected as invalid (key={key[:12]}…) and won't be used again "
            f"until restart — remove or replace it. {len(ALL_KEYS) - len(_invalid_keys)} of "
            f"{len(ALL_KEYS)} configured key(s) remain."
        )


def get_current_key() -> str:
    ordered = _ordered_keys()
    return ordered[0] if ordered else ""


def mark_key_failed(key: str):
    if key and key not in _failed_keys:
        _failed_keys.add(key)
        remaining = len(ALL_KEYS) - len(_failed_keys)
        logger.warning(
            f"A Groq API key failed (rate limit or auth). "
            f"{remaining} of {len(ALL_KEYS)} configured key(s) still available."
        )


def mark_primary_failed():
    """Backward-compat alias — old two-key code called this specifically
    when the primary key failed; equivalent to marking whichever key was
    actually in use as failed."""
    mark_key_failed(PRIMARY_KEY)


class SafeCompletions:
    def __init__(self, client_factory):
        self.client_factory = client_factory

    def create(self, *args, **kwargs):
        # 1. Determine list of models to try
        requested_model = kwargs.get("model")

        models_to_try = []
        if requested_model:
            models_to_try.append(requested_model)
        for m in PREFERRED_TEXT_MODELS:
            if m not in models_to_try:
                models_to_try.append(m)
        models_to_try = [m for m in models_to_try if m not in _missing_models] or models_to_try

        # 2. Determine keys to try — every configured key, healthy ones first
        keys_to_try = _ordered_keys()

        # Metering: refuse calls for pools known to be spent, then charge the
        # scope's org/user for what the successful call consumed.
        scope = ai_metering.current_scope()
        ai_metering.ensure_not_blocked(scope)
        feature_name = ai_metering.current_feature()
        started = time.perf_counter()

        last_exception = None

        for key in keys_to_try:
            for model in models_to_try:
                try:
                    call_kwargs = _kwargs_for_model(kwargs, model)

                    logger.info(f"Attempting Groq completion with model={model} and key={key[:12] if key else 'None'}...")
                    client = Groq(api_key=key)
                    response = client.chat.completions.create(*args, **call_kwargs)
                    if kwargs.get("stream"):
                        return ai_metering.MeteredGroqStream(
                            response, model, started, scope, feature_name, ai_metering.prompt_chars(kwargs)
                        )
                    ai_metering.record_groq_completion(response, model, started, scope)
                    return response
                except (RateLimitError, APIStatusError) as e:
                    last_exception = e
                    status_code = getattr(e, "status_code", None)

                    # If model not found, try the next model
                    if status_code == 404:
                        logger.warning(f"Groq Model not found: {model} (status=404). Trying next model...")
                        _missing_models.add(model)
                        continue

                    # Invalid / revoked key: it fails for every model, so go
                    # straight to the next key instead of trying all of them.
                    if status_code in (401, 403):
                        mark_key_invalid(key)
                        break

                    # Rate limit: Groq limits per model, so try the next one
                    if status_code == 429 or isinstance(e, RateLimitError):
                        logger.warning(f"Groq API key failed (status={status_code}, error={sanitize_error_msg(e)}). Retrying with fallback options...")
                        mark_key_failed(key)
                        continue

                    # JSON mode rejected this model's output; another model
                    # usually produces valid JSON for the same prompt.
                    if status_code == 400 and _is_json_validation_error(e):
                        logger.warning(f"Groq JSON validation failed on {model}. Trying next model...")
                        continue

                    # For other APIStatusErrors, raise or retry next
                    raise e
                except Exception as e:
                    last_exception = e
                    err_str = str(e).lower()
                    if "rate limit" in err_str or "429" in err_str or "limit exceeded" in err_str or "authentication" in err_str or "api_key" in err_str:
                        logger.warning(f"Groq API key failed (error={sanitize_error_msg(e)}). Retrying with fallback options...")
                        mark_key_failed(key)
                        continue
                    if "model_not_found" in err_str or "does not exist" in err_str or "404" in err_str:
                        logger.warning(f"Groq model error: {sanitize_error_msg(e)}. Trying next model...")
                        continue
                    raise e

        # If we exhausted everything, raise the last exception
        if last_exception:
            raise last_exception
        raise RuntimeError("Groq completion failed: No available key/model succeeded.")

class SafeChat:
    def __init__(self, client_factory):
        self.completions = SafeCompletions(client_factory)

class SafeTranscriptions:
    def __init__(self, client_factory):
        self.client_factory = client_factory

    def create(self, *args, **kwargs):
        requested_model = kwargs.get("model")
        models_to_try = []
        if requested_model:
            models_to_try.append(requested_model)
        for m in PREFERRED_AUDIO_MODELS:
            if m not in models_to_try:
                models_to_try.append(m)

        keys_to_try = _ordered_keys()

        scope = ai_metering.current_scope()
        ai_metering.ensure_not_blocked(scope)
        started = time.perf_counter()

        last_exception = None

        for key in keys_to_try:
            for model in models_to_try:
                try:
                    if "model" in kwargs or requested_model:
                        kwargs["model"] = model
                    client = Groq(api_key=key)
                    response = client.audio.transcriptions.create(*args, **kwargs)
                    ai_metering.record_usage(
                        "groq", model,
                        audio_seconds=ai_metering.estimate_audio_seconds(response, kwargs),
                        duration_ms=(time.perf_counter() - started) * 1000,
                        scope=scope,
                    )
                    return response
                except (RateLimitError, APIStatusError) as e:
                    last_exception = e
                    status_code = getattr(e, "status_code", None)
                    if status_code == 404:
                        logger.warning(f"Groq audio model not found: {model}. Trying next...")
                        continue
                    if status_code in (429, 401, 403) or isinstance(e, RateLimitError):
                        logger.warning(f"Groq transcription key failed (status={status_code}). Retrying...")
                        mark_key_failed(key)
                        continue
                    raise e
                except Exception as e:
                    last_exception = e
                    err_str = str(e).lower()
                    if "rate limit" in err_str or "429" in err_str or "limit exceeded" in err_str:
                        logger.warning(f"Groq transcription limit/auth: {sanitize_error_msg(e)}. Retrying...")
                        mark_key_failed(key)
                        continue
                    if "model_not_found" in err_str or "does not exist" in err_str:
                        logger.warning(f"Groq audio model error: {sanitize_error_msg(e)}. Trying next...")
                        continue
                    raise e

        if last_exception:
            raise last_exception
        raise RuntimeError("Groq transcription failed: No available key/model succeeded.")

class SafeAudio:
    def __init__(self, client_factory):
        self.transcriptions = SafeTranscriptions(client_factory)

class SafeGroq:
    def __init__(self, api_key=None, *args, **kwargs):
        self.explicit_api_key = api_key
        self.init_args = args
        self.init_kwargs = kwargs
        self._inner_client = None
        self._inner_client_key = None
        self.chat = SafeChat(self._get_client)
        self.audio = SafeAudio(self._get_client)

    def _get_client(self) -> Groq:
        current_key = self.explicit_api_key or get_current_key()

        if not self._inner_client or self._inner_client_key != current_key:
            self._inner_client = Groq(api_key=current_key, *self.init_args, **self.init_kwargs)
            self._inner_client_key = current_key
        return self._inner_client

    def __getattr__(self, name):
        client = self._get_client()
        return getattr(client, name)

cached_best_model = None
# After a failed models lookup, don't retry it before every single call.
_MODELS_LOOKUP_RETRY_SECONDS = 1800
_models_lookup_failed_at: float | None = None


def get_best_groq_model(groq_client=None) -> str:
    """The first preferred model the account actually offers. Asks with each
    usable key in turn — the lookup used to go only through the primary key,
    so an invalid primary failed it (and was retried) on every call."""
    global cached_best_model, _models_lookup_failed_at
    if cached_best_model:
        return cached_best_model
    fallback = next((m for m in PREFERRED_TEXT_MODELS if m not in _missing_models), PREFERRED_TEXT_MODELS[0])
    if _models_lookup_failed_at and time.monotonic() - _models_lookup_failed_at < _MODELS_LOOKUP_RETRY_SECONDS:
        return fallback

    clients = [groq_client] if groq_client is not None else [Groq(api_key=k) for k in _ordered_keys()]
    for client in clients:
        try:
            available_ids = [m.id for m in client.models.list().data]
        except APIStatusError as e:
            if getattr(e, "status_code", None) in (401, 403):
                mark_key_invalid(getattr(client, "api_key", ""))
            logger.warning(f"Failed to fetch Groq models list ({sanitize_error_msg(e)}); trying next key.")
            continue
        except Exception as e:
            logger.warning(f"Failed to fetch Groq models list ({sanitize_error_msg(e)}); trying next key.")
            continue
        for pm in PREFERRED_TEXT_MODELS:
            if pm in available_ids:
                cached_best_model = pm
                logger.info(f"Dynamically selected Groq model: {pm}")
                return pm

    _models_lookup_failed_at = time.monotonic()
    logger.warning(f"Groq models lookup failed with every key; using {fallback} for the next 30 minutes.")
    return fallback

    try:
        models_res = temp_client.models.list()
        available_ids = [m.id for m in models_res.data]
        for pm in PREFERRED_TEXT_MODELS:
            if pm in available_ids:
                cached_best_model = pm
                logger.info(f"Dynamically selected Groq model: {pm}")
                return pm
    except Exception as e:
        logger.warning(f"Failed to fetch Groq models list dynamically ({e}). Using default fallback.")

    return PREFERRED_TEXT_MODELS[0]
