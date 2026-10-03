"""
Async streaming chat-with-tools over SafeGroq.

SafeGroq is synchronous, and iterating a stream on the event loop blocks
every other request for the whole generation. `stream_chat` runs the request
and the iteration in a worker thread and hands chunks back through an
asyncio.Queue, so text can be forwarded to the browser as it arrives.

Metering is untouched: SafeGroq wraps the stream in MeteredGroqStream, which
charges the AI scope (copied into the thread by asyncio.to_thread) when the
stream ends. Key rotation and model fallback also stay inside SafeGroq.

If Groq fails completely, a plain-text Gemini answer is returned (no tools).
"""
import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Callable, Optional

from app.core.config import settings
from app.services.groq_client import SafeGroq, get_best_groq_model

logger = logging.getLogger(__name__)

GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"

_DONE = object()


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: str = ""

    def parsed_args(self) -> dict:
        try:
            value = json.loads(self.arguments) if self.arguments else {}
        except json.JSONDecodeError:
            return {}
        return value if isinstance(value, dict) else {}


@dataclass
class LLMTurn:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def assistant_message(self) -> dict:
        """The OpenAI-format assistant message to append to the history."""
        msg: dict = {"role": "assistant", "content": self.content or ""}
        if self.tool_calls:
            msg["tool_calls"] = [
                {"id": tc.id, "type": "function", "function": {"name": tc.name, "arguments": tc.arguments or "{}"}}
                for tc in self.tool_calls
            ]
        return msg


class ToolCallAccumulator:
    """Rebuilds complete tool calls from streamed deltas. Groq sends the id and
    name in the first delta for an index, then the arguments in pieces."""

    def __init__(self):
        self._by_index: dict[int, ToolCall] = {}

    def add(self, delta_tool_calls) -> None:
        for pos, tc in enumerate(delta_tool_calls or []):
            index = getattr(tc, "index", None)
            if index is None:
                index = pos
            call = self._by_index.get(index)
            if call is None:
                call = self._by_index[index] = ToolCall(id="", name="")
            if getattr(tc, "id", None):
                call.id = tc.id
            fn = getattr(tc, "function", None)
            if fn is not None:
                if getattr(fn, "name", None):
                    call.name += fn.name
                if getattr(fn, "arguments", None):
                    call.arguments += fn.arguments

    def result(self) -> list[ToolCall]:
        calls = [self._by_index[i] for i in sorted(self._by_index)]
        for n, call in enumerate(calls):
            if not call.id:
                call.id = f"call_{n}"
        return [c for c in calls if c.name]


def _usage_from_chunk(chunk):
    x_groq = getattr(chunk, "x_groq", None)
    usage = getattr(x_groq, "usage", None) if x_groq is not None else None
    return usage or getattr(chunk, "usage", None)


async def stream_chat(
    messages: list[dict],
    *,
    tools: Optional[list[dict]] = None,
    tool_choice: str = "auto",
    max_tokens: int = 1024,
    temperature: float = 0.1,
    model: Optional[str] = None,
    on_text: Optional[Callable[[str], None]] = None,
) -> LLMTurn:
    """One streamed completion. `on_text` is called (on the event loop) with
    each text delta as it arrives; tool calls are returned complete."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def put(item):
        loop.call_soon_threadsafe(queue.put_nowait, item)

    client = SafeGroq(api_key=settings.groq_api_key)

    def worker():
        try:
            kwargs = dict(
                model=model or get_best_groq_model(client),
                messages=messages,
                stream=True,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = tool_choice
            for chunk in client.chat.completions.create(**kwargs):
                put(chunk)
        except BaseException as exc:  # surfaced to the awaiting coroutine
            put(exc)
        finally:
            put(_DONE)

    thread_task = asyncio.ensure_future(asyncio.to_thread(worker))
    turn = LLMTurn()
    acc = ToolCallAccumulator()
    text_parts: list[str] = []
    error: Optional[BaseException] = None

    while True:
        item = await queue.get()
        if item is _DONE:
            break
        if isinstance(item, BaseException):
            error = item
            continue
        usage = _usage_from_chunk(item)
        if usage is not None:
            turn.prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            turn.completion_tokens = getattr(usage, "completion_tokens", 0) or 0
        if getattr(item, "model", None):
            turn.model = item.model
        for choice in getattr(item, "choices", None) or []:
            delta = getattr(choice, "delta", None)
            if delta is None:
                continue
            if getattr(delta, "tool_calls", None):
                acc.add(delta.tool_calls)
            content = getattr(delta, "content", None)
            if content:
                text_parts.append(content)
                if on_text is not None:
                    on_text(content)

    await thread_task

    if error is not None:
        if text_parts or acc.result():
            # Part of the answer already reached the user; keep what we have.
            logger.warning("Agent LLM stream ended early: %s", error)
        else:
            return await _gemini_fallback(messages, error, on_text)

    turn.content = "".join(text_parts)
    turn.tool_calls = acc.result()
    return turn


def _flatten_for_gemini(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        role = m.get("role")
        content = m.get("content") or ""
        if role == "tool":
            lines.append(f"[Tool result]\n{content}")
        elif role == "system":
            lines.append(content)
        elif content:
            lines.append(f"{role.upper()}: {content}")
    lines.append("ASSISTANT:")
    return "\n\n".join(lines)


async def _gemini_fallback(messages: list[dict], error: BaseException, on_text) -> LLMTurn:
    """Plain-text answer from Gemini when every Groq key/model failed. No tool
    calling here — the agent just answers from what it already has."""
    logger.warning("Agent LLM: Groq failed (%s); falling back to Gemini text.", error)
    if not settings.gemini_api_key:
        raise error
    try:
        import google.generativeai as genai

        model = genai.GenerativeModel(GEMINI_FALLBACK_MODEL)
        response = await asyncio.to_thread(
            model.generate_content,
            _flatten_for_gemini(messages),
            generation_config={"temperature": 0.2, "max_output_tokens": 1024},
        )
        text_out = (getattr(response, "text", "") or "").strip()
    except Exception as gem_err:
        logger.error("Agent LLM: Gemini fallback failed too: %s", gem_err)
        raise error
    if not text_out:
        raise error
    if on_text is not None:
        on_text(text_out)
    return LLMTurn(content=text_out, model=GEMINI_FALLBACK_MODEL)
