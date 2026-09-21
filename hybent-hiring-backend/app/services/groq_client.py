import logging
import re
import os
from groq import Groq, RateLimitError, APIStatusError
from app.core.config import settings

logger = logging.getLogger(__name__)


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

PREFERRED_TEXT_MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "groq/compound",
    "groq/compound-mini",
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "llama3-70b-8192"
]

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
    healthy = [k for k in ALL_KEYS if k not in _failed_keys]
    failed = [k for k in ALL_KEYS if k in _failed_keys]
    return healthy + failed


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

        # 2. Determine keys to try — every configured key, healthy ones first
        keys_to_try = _ordered_keys()

        last_exception = None

        for key in keys_to_try:
            for model in models_to_try:
                try:
                    # Update kwargs with the model we are trying
                    if "model" in kwargs or requested_model:
                        kwargs["model"] = model

                    logger.info(f"Attempting Groq completion with model={model} and key={key[:12] if key else 'None'}...")
                    client = Groq(api_key=key)
                    return client.chat.completions.create(*args, **kwargs)
                except (RateLimitError, APIStatusError) as e:
                    last_exception = e
                    status_code = getattr(e, "status_code", None)

                    # If model not found, try the next model
                    if status_code == 404:
                        logger.warning(f"Groq Model not found: {model} (status=404). Trying next model...")
                        continue

                    # If rate limit or auth, try the next key (or next model if keys exhausted)
                    if status_code in (429, 401, 403) or isinstance(e, RateLimitError):
                        logger.warning(f"Groq API key failed (status={status_code}, error={sanitize_error_msg(e)}). Retrying with fallback options...")
                        mark_key_failed(key)
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

        last_exception = None

        for key in keys_to_try:
            for model in models_to_try:
                try:
                    if "model" in kwargs or requested_model:
                        kwargs["model"] = model
                    client = Groq(api_key=key)
                    return client.audio.transcriptions.create(*args, **kwargs)
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

def get_best_groq_model(groq_client=None) -> str:
    global cached_best_model
    if cached_best_model:
        return cached_best_model

    temp_client = groq_client
    if not temp_client:
        try:
            temp_client = SafeGroq(api_key=settings.groq_api_key) if settings.groq_api_key else None
        except Exception:
            temp_client = None

    if not temp_client:
        return PREFERRED_TEXT_MODELS[0]

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
