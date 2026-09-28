"""
Central AI metering.

Every Groq call goes through SafeGroq and every Gemini call through the
google.generativeai SDK; both report what they actually consumed here, and
the organization (and user) in the current *AI scope* is charged for it.

Scope:
  - Authenticated requests bind one automatically (get_current_user).
  - Work outside a request (Celery jobs, public/candidate endpoints with no
    staff user) opens one explicitly:  ``async with ai_scope(org_id, user_id):``
  - The feature name comes from ``@ai_feature("resume_parsing")`` on the
    service function (defaults to "general").

Enforcement:
  - Entry points still call AICreditsService.check_credits_available() for a
    clear error before starting work.
  - As a backstop for call sites without that check, pools found spent are
    remembered in-process and further calls for them are refused before they
    reach the provider.

Charges run as background tasks on the scope's event loop, so AI calls from
worker threads are charged too.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import functools
import inspect
import logging
import time
import uuid
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field

from app.utils.exceptions import InsufficientCreditsException

logger = logging.getLogger(__name__)


# Only admins and recruiters use AI features (and seats). Interviewer and
# candidate requests never reach a provider.
NO_AI_ROLES = {"interviewer", "candidate"}
NO_AI_MESSAGE = "AI features are available to admins and recruiters."


@dataclass
class AIScope:
    organization_id: uuid.UUID | None
    user_id: uuid.UUID | None
    loop: asyncio.AbstractEventLoop | None
    pending: set = field(default_factory=set)
    role: str | None = None


_scope: ContextVar[AIScope | None] = ContextVar("ai_scope", default=None)
_feature: ContextVar[str | None] = ContextVar("ai_feature", default=None)

# Strong references to in-flight charge tasks (asyncio only keeps weak ones).
_inflight: set = set()


def current_scope() -> AIScope | None:
    return _scope.get()


def _running_loop() -> asyncio.AbstractEventLoop | None:
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return None


def bind_request_scope(organization_id, user_id, role=None) -> None:
    """Attach the authenticated user's org/user/role to the rest of the request."""
    _scope.set(AIScope(
        _as_uuid(organization_id), _as_uuid(user_id), _running_loop(),
        role=getattr(role, "value", role),
    ))


@asynccontextmanager
async def ai_scope(organization_id, user_id=None):
    """Charge AI calls made inside the block to this org/user, and wait for
    their charges to be written before leaving."""
    scope = AIScope(_as_uuid(organization_id), _as_uuid(user_id), asyncio.get_running_loop())
    token = _scope.set(scope)
    try:
        yield scope
    finally:
        await drain(scope)
        _scope.reset(token)


async def drain(scope: AIScope | None = None) -> None:
    scope = scope or _scope.get()
    if not scope or not scope.pending:
        return
    waitables = [
        asyncio.wrap_future(p) if isinstance(p, concurrent.futures.Future) else p
        for p in list(scope.pending)
    ]
    await asyncio.gather(*waitables, return_exceptions=True)


def _as_uuid(value):
    if value is None or isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


# ── Feature naming ───────────────────────────────────────────────────────────

@contextmanager
def feature(name: str):
    token = _feature.set(name)
    try:
        yield
    finally:
        _feature.reset(token)


def ai_feature(name: str):
    """Decorator: AI calls made inside the function are logged under `name`."""
    def decorator(fn):
        if inspect.isasyncgenfunction(fn):
            @functools.wraps(fn)
            async def agen_wrapper(*args, **kwargs):
                gen = fn(*args, **kwargs)
                try:
                    while True:
                        token = _feature.set(name)
                        try:
                            item = await gen.__anext__()
                        except StopAsyncIteration:
                            return
                        finally:
                            _feature.reset(token)
                        yield item
                finally:
                    await gen.aclose()
            return agen_wrapper

        if inspect.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                with feature(name):
                    return await fn(*args, **kwargs)
            return async_wrapper

        @functools.wraps(fn)
        def sync_wrapper(*args, **kwargs):
            with feature(name):
                return fn(*args, **kwargs)
        return sync_wrapper
    return decorator


def current_feature() -> str:
    return _feature.get() or "general"


# ── Backstop: pools known to be spent ────────────────────────────────────────

# key -> (blocked until, message). Keys are ("org", id) or ("user", id).
_blocked: dict[tuple[str, uuid.UUID], tuple[float, str]] = {}
_BLOCK_TTL_SECONDS = 300


def mark_blocked(kind: str, key_id: uuid.UUID, message: str, until: float | None = None) -> None:
    _blocked[(kind, key_id)] = (until or time.time() + _BLOCK_TTL_SECONDS, message)


def clear_blocked(organization_id=None, user_id=None) -> None:
    if organization_id:
        _blocked.pop(("org", _as_uuid(organization_id)), None)
    if user_id:
        _blocked.pop(("user", _as_uuid(user_id)), None)


def ensure_not_blocked(scope: AIScope | None = None) -> None:
    """Raise if the scope's org or user is known to be out of credits."""
    scope = scope or _scope.get()
    if not scope:
        return
    if scope.role in NO_AI_ROLES:
        raise InsufficientCreditsException(NO_AI_MESSAGE)
    now = time.time()
    for key in (("org", scope.organization_id), ("user", scope.user_id)):
        if key[1] is None:
            continue
        entry = _blocked.get(key)
        if entry:
            until, message = entry
            if until > now:
                raise InsufficientCreditsException(message)
            _blocked.pop(key, None)


# ── Recording usage ──────────────────────────────────────────────────────────

def record_usage(
    provider: str,
    model: str,
    *,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    audio_seconds: float | None = None,
    cost_usd: float | None = None,
    duration_ms: float = 0.0,
    feature_name: str | None = None,
    scope: AIScope | None = None,
) -> None:
    """Charge one completed AI call to the scope's org/user (asynchronously)."""
    scope = scope or _scope.get()
    name = feature_name or current_feature()
    if not scope or not scope.organization_id:
        logger.debug(f"Unmetered AI call ({provider}/{model}, feature={name}): no organization in scope.")
        return

    from app.services.ai_credit_service import AICreditsService

    async def _charge():
        await AICreditsService.charge(
            None,
            organization_id=scope.organization_id,
            user_id=scope.user_id,
            feature=name,
            provider=provider,
            model=model,
            prompt_tokens=int(prompt_tokens or 0),
            completion_tokens=int(completion_tokens or 0),
            audio_seconds=audio_seconds,
            cost_usd=cost_usd,
            duration_ms=duration_ms,
        )
        await _refresh_blocks(scope)

    def _done(fut):
        _inflight.discard(fut)
        scope.pending.discard(fut)
        exc = fut.exception() if not fut.cancelled() else None
        if exc:
            logger.error(f"Failed to charge AI usage ({provider}/{model}, {name}): {exc}")

    running = _running_loop()
    target = scope.loop
    if running is not None and (target is None or running is target):
        fut = running.create_task(_charge())
    elif target is not None and target.is_running() and not target.is_closed():
        fut = asyncio.run_coroutine_threadsafe(_charge(), target)
    else:
        logger.error(f"Could not charge AI usage ({provider}/{model}, {name}): no running event loop for the scope.")
        return
    _inflight.add(fut)
    scope.pending.add(fut)
    fut.add_done_callback(_done)


async def _refresh_blocks(scope: AIScope) -> None:
    """After a charge, remember pools that are now spent so the backstop
    refuses further calls without a DB round trip."""
    from app.core.database import AsyncSessionLocal
    from app.services.ai_credit_service import AICreditsService, daily_limit_for

    async with AsyncSessionLocal() as db:
        org = await AICreditsService.get_or_create_org_credits(db, scope.organization_id)
        if AICreditsService.org_remaining(org) <= 0:
            mark_blocked("org", scope.organization_id,
                         "Your organization has used all of its AI credits for this month. "
                         "Ask your admin to buy a top-up, or wait for the monthly reset.")
        if scope.user_id:
            row = await AICreditsService.get_or_create_user_credits(db, scope.organization_id, scope.user_id)
            if row is not None:
                if row.used_credits >= row.monthly_limit:
                    mark_blocked("user", scope.user_id,
                                 f"You've used your monthly AI credit limit ({row.monthly_limit:,} credits). "
                                 "Ask your admin to raise your limit.")
                elif AICreditsService.user_daily_used(row) >= daily_limit_for(row.monthly_limit):
                    # Default TTL, not "until midnight": an admin may raise the
                    # limit, and other processes only notice on re-check.
                    mark_blocked("user", scope.user_id,
                                 f"You've reached today's AI credit limit ({daily_limit_for(row.monthly_limit):,} credits). "
                                 "It resets at midnight UTC.")
        await db.commit()


# ── Provider instrumentation ─────────────────────────────────────────────────

def record_groq_completion(response, model: str, started: float, scope: AIScope | None) -> None:
    usage = getattr(response, "usage", None)
    record_usage(
        "groq", getattr(response, "model", None) or model,
        prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
        completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
        duration_ms=(time.perf_counter() - started) * 1000,
        scope=scope,
    )


class MeteredGroqStream:
    """Wraps a Groq streaming response; charges once the stream ends, using
    the usage Groq attaches to the final chunk (estimated if absent)."""

    def __init__(self, stream, model: str, started: float, scope: AIScope | None, feature_name: str, prompt_chars: int):
        self._stream = stream
        self._model = model
        self._started = started
        self._scope = scope
        self._feature = feature_name
        self._prompt_chars = prompt_chars
        self._recorded = False

    def __iter__(self):
        usage = None
        out_chars = 0
        try:
            for chunk in self._stream:
                x_groq = getattr(chunk, "x_groq", None)
                u = getattr(x_groq, "usage", None) if x_groq is not None else None
                u = u or getattr(chunk, "usage", None)
                if u is not None:
                    usage = u
                for choice in getattr(chunk, "choices", None) or []:
                    delta = getattr(choice, "delta", None)
                    out_chars += len(getattr(delta, "content", None) or "")
                yield chunk
        finally:
            self._record(usage, out_chars)

    def _record(self, usage, out_chars: int) -> None:
        if self._recorded:
            return
        self._recorded = True
        if usage is not None:
            prompt, completion = getattr(usage, "prompt_tokens", 0) or 0, getattr(usage, "completion_tokens", 0) or 0
        else:
            prompt, completion = self._prompt_chars // 4, out_chars // 4
        record_usage(
            "groq", self._model, prompt_tokens=prompt, completion_tokens=completion,
            duration_ms=(time.perf_counter() - self._started) * 1000,
            feature_name=self._feature, scope=self._scope,
        )

    def __getattr__(self, name):
        return getattr(self._stream, name)


def prompt_chars(kwargs: dict) -> int:
    total = 0
    for m in kwargs.get("messages") or []:
        content = m.get("content") if isinstance(m, dict) else getattr(m, "content", "")
        if isinstance(content, str):
            total += len(content)
        elif isinstance(content, list):
            total += sum(len(str(part)) for part in content)
    return total


def estimate_audio_seconds(response, kwargs: dict) -> float:
    duration = getattr(response, "duration", None)
    if duration:
        return float(duration)
    f = kwargs.get("file")
    size = 0
    try:
        if isinstance(f, (bytes, bytearray)):
            size = len(f)
        elif isinstance(f, tuple) and len(f) > 1:
            payload = f[1]
            if isinstance(payload, (bytes, bytearray)):
                size = len(payload)
            elif hasattr(payload, "seek") and hasattr(payload, "tell"):
                pos = payload.tell()
                payload.seek(0, 2)
                size = payload.tell()
                payload.seek(pos)
        elif hasattr(f, "seek") and hasattr(f, "tell"):
            pos = f.tell()
            f.seek(0, 2)
            size = f.tell()
            f.seek(pos)
    except Exception:
        size = 0
    # ~32 kbps compressed speech (webm/opus, m4a) ≈ 4 KB per second.
    return size / 4000 if size else 0.0


_gemini_installed = False


def install_gemini_metering() -> None:
    """Patch google.generativeai so every generate_content / embed_content
    call is checked against the backstop and charged."""
    global _gemini_installed
    if _gemini_installed:
        return
    try:
        import google.generativeai as genai
    except Exception:
        return

    model_cls = genai.GenerativeModel
    original_sync = model_cls.generate_content
    original_async = model_cls.generate_content_async
    original_embed = genai.embed_content

    def _record_gemini(self, response, started, scope):
        meta = getattr(response, "usage_metadata", None)
        completion = (getattr(meta, "candidates_token_count", 0) or 0) + (getattr(meta, "thoughts_token_count", 0) or 0)
        record_usage(
            "gemini", getattr(self, "model_name", "gemini"),
            prompt_tokens=getattr(meta, "prompt_token_count", 0) or 0,
            completion_tokens=completion,
            duration_ms=(time.perf_counter() - started) * 1000,
            scope=scope,
        )

    @functools.wraps(original_sync)
    def generate_content(self, *args, **kwargs):
        scope = _scope.get()
        ensure_not_blocked(scope)
        started = time.perf_counter()
        response = original_sync(self, *args, **kwargs)
        if not kwargs.get("stream"):
            _record_gemini(self, response, started, scope)
        return response

    @functools.wraps(original_async)
    async def generate_content_async(self, *args, **kwargs):
        scope = _scope.get()
        ensure_not_blocked(scope)
        started = time.perf_counter()
        response = await original_async(self, *args, **kwargs)
        if not kwargs.get("stream"):
            _record_gemini(self, response, started, scope)
        return response

    @functools.wraps(original_embed)
    def embed_content(*args, **kwargs):
        scope = _scope.get()
        ensure_not_blocked(scope)
        started = time.perf_counter()
        result = original_embed(*args, **kwargs)
        content = kwargs.get("content", args[1] if len(args) > 1 else "")
        chars = sum(len(str(c)) for c in content) if isinstance(content, list) else len(str(content or ""))
        record_usage(
            "gemini", str(kwargs.get("model", args[0] if args else "gemini-embedding-001")),
            prompt_tokens=chars // 4, duration_ms=(time.perf_counter() - started) * 1000,
            scope=scope,
        )
        return result

    model_cls.generate_content = generate_content
    model_cls.generate_content_async = generate_content_async
    genai.embed_content = embed_content
    _gemini_installed = True
