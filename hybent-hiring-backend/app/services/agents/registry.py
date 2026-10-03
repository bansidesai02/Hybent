"""
Tool registry for agents.

Each tool is a plain async function plus the metadata an agent needs:
  - an OpenAI-format JSON schema (what the model sees),
  - kind: "read" runs straight away, "write" pauses for human approval,
  - status: a short progress label shown to the user while the tool runs,
    followed by the values of `status_args` from the call, e.g.
    "Searching candidates · python · Ahmedabad". No extra LLM call is spent
    describing progress.

Handlers get a ToolContext built from the authenticated request — never
from model output — so tenant scoping can't be steered by a prompt.
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class ToolContext:
    organization_id: str
    user_id: str
    user_role: Optional[str]
    db: AsyncSession
    user_message: str = ""
    page_context: Optional[dict] = None
    background_tasks: Optional[Any] = None  # the request's FastAPI BackgroundTasks
    # Everything the recruiter has typed in this conversation (lower-cased) —
    # lets write tools check a choice really came from them, not the model.
    recruiter_text: str = ""


@dataclass
class ToolResult:
    """`data` goes back to the model (compact JSON). `display` is an optional
    ready-made markdown card for the user. `summary` is the short line shown
    on the finished step, e.g. "Found 12 candidates". `focus` updates what
    the conversation is about (candidate_id, job_id, ...)."""
    data: Any
    summary: str = ""
    display: str = ""
    focus: dict = field(default_factory=dict)
    ok: bool = True


Handler = Callable[[dict, ToolContext], Awaitable[ToolResult]]
# Checks a write call's args before asking for approval; returns an error
# message for the model (e.g. "ask for the exact candidate name") or None.
Validator = Callable[[dict], Optional[str]]
# Async, DB-aware check before approval: resolves names to real records and
# returns (normalised args, None) or (args, problem for the model).
Preparer = Callable[[dict, "ToolContext"], Awaitable[tuple[dict, Optional[str]]]]


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    handler: Handler
    kind: Literal["read", "write"] = "read"
    status: str = ""
    status_args: tuple = ()
    validate: Optional[Validator] = None
    prepare: Optional[Preparer] = None

    def schema(self) -> dict:
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }

    def status_label(self, args: dict) -> str:
        """Base label plus the values of `status_args` that were given, e.g.
        "Searching candidates · python · Ahmedabad"."""
        label = self.status or self.name.replace("_", " ").capitalize()
        details = []
        for key in self.status_args:
            value = args.get(key)
            if value in (None, "", [], {}) or isinstance(value, bool):
                continue
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value[:3])
            details.append(str(value).replace("_", " ")[:40])
        return " · ".join([label, *details])


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def tool(
        self, name: str, description: str, parameters: dict, *,
        kind: str = "read", status: str = "", status_args: tuple = (),
        validate: Optional[Validator] = None,
        prepare: Optional[Preparer] = None,
    ):
        def decorator(fn: Handler) -> Handler:
            if name in self._tools:
                raise ValueError(f"Tool {name!r} already registered")
            self._tools[name] = Tool(name, description, parameters, fn, kind, status, tuple(status_args), validate, prepare)
            return fn
        return decorator

    def get(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return list(self._tools)

    def schemas(self, names: Optional[list[str]] = None) -> list[dict]:
        """Schemas in a stable order — identical bytes on every call keep the
        prompt prefix cacheable on the provider side."""
        selected = names if names is not None else sorted(self._tools)
        return [self._tools[n].schema() for n in selected if n in self._tools]


def params(properties: dict, required: Optional[list[str]] = None) -> dict:
    """JSON schema for a tool's arguments. Optional params also accept null,
    since some models send `null` for an omitted optional field and Groq
    rejects the call when the schema doesn't allow it."""
    required = required or []
    props = {}
    for key, spec in properties.items():
        spec = dict(spec)
        if key not in required and isinstance(spec.get("type"), str):
            spec["type"] = [spec["type"], "null"]
        props[key] = spec
    return {"type": "object", "properties": props, "required": required}
