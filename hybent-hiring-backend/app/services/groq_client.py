import logging
import re
import os
from groq import Groq, RateLimitError, APIStatusError
from app.core.config import settings

logger = logging.getLogger(__name__)

PRIMARY_KEY = settings.groq_api_key
FALLBACK_KEY = os.getenv("GROQ_FALLBACK_API_KEY", settings.groq_api_key)

# Global state to track fallback status
_use_fallback = False

def sanitize_error_msg(err_obj) -> str:
    msg = str(err_obj)
    # Mask any Groq API keys matching gsk_ pattern
    return re.sub(r'gsk_[A-Za-z0-9_-]+', '[REDACTED_API_KEY]', msg)

def get_current_key() -> str:
    global _use_fallback
    if _use_fallback:
        return FALLBACK_KEY
    return PRIMARY_KEY or FALLBACK_KEY

def mark_primary_failed():
    global _use_fallback
    _use_fallback = True
    logger.warning("Primary Groq API key hit rate limit or failed. Switched to fallback API key globally.")

class SafeCompletions:
    def __init__(self, client_factory):
        self.client_factory = client_factory

    def create(self, *args, **kwargs):
        try:
            client = self.client_factory()
            return client.chat.completions.create(*args, **kwargs)
        except (RateLimitError, APIStatusError) as e:
            status_code = getattr(e, "status_code", None)
            if status_code in (429, 401, 403) or isinstance(e, RateLimitError):
                logger.warning(f"Groq API primary key failed (status={status_code}, error={sanitize_error_msg(e)}). Switching to fallback key...")
                mark_primary_failed()
                client = self.client_factory()
                return client.chat.completions.create(*args, **kwargs)
            raise e
        except Exception as e:
            err_str = str(e).lower()
            if "rate limit" in err_str or "429" in err_str or "limit exceeded" in err_str or "authentication" in err_str or "api_key" in err_str:
                logger.warning(f"Groq API limit or auth error detected via message: {sanitize_error_msg(e)}. Switching to fallback key...")
                mark_primary_failed()
                client = self.client_factory()
                return client.chat.completions.create(*args, **kwargs)
            raise e

class SafeChat:
    def __init__(self, client_factory):
        self.completions = SafeCompletions(client_factory)

class SafeTranscriptions:
    def __init__(self, client_factory):
        self.client_factory = client_factory

    def create(self, *args, **kwargs):
        try:
            client = self.client_factory()
            return client.audio.transcriptions.create(*args, **kwargs)
        except (RateLimitError, APIStatusError) as e:
            status_code = getattr(e, "status_code", None)
            if status_code in (429, 401, 403) or isinstance(e, RateLimitError):
                logger.warning(f"Groq API primary key failed (status={status_code}, error={sanitize_error_msg(e)}) on audio transcription. Switching to fallback key...")
                mark_primary_failed()
                client = self.client_factory()
                return client.audio.transcriptions.create(*args, **kwargs)
            raise e
        except Exception as e:
            err_str = str(e).lower()
            if "rate limit" in err_str or "429" in err_str or "limit exceeded" in err_str or "authentication" in err_str or "api_key" in err_str:
                logger.warning(f"Groq API limit or auth error detected via message: {sanitize_error_msg(e)} on audio transcription. Switching to fallback key...")
                mark_primary_failed()
                client = self.client_factory()
                return client.audio.transcriptions.create(*args, **kwargs)
            raise e

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
        global _use_fallback
        if _use_fallback:
            current_key = FALLBACK_KEY
        else:
            current_key = self.explicit_api_key or get_current_key()

        if not self._inner_client or self._inner_client_key != current_key:
            self._inner_client = Groq(api_key=current_key, *self.init_args, **self.init_kwargs)
            self._inner_client_key = current_key
        return self._inner_client

    def __getattr__(self, name):
        client = self._get_client()
        return getattr(client, name)
