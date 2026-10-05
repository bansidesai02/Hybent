"""State and per-run context for the Copilot agent graph."""
import uuid
from dataclasses import dataclass, field
from typing import Annotated, Optional, TypedDict

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession


def merge_dict(left: Optional[dict], right: Optional[dict]) -> dict:
    """Reducer: a node returns only the keys it changes. A key mapped to None
    is removed."""
    merged = dict(left or {})
    for k, v in (right or {}).items():
        if v is None:
            merged.pop(k, None)
        else:
            merged[k] = v
    return merged


RESET = {"role": "__reset__"}


def add_messages(left: Optional[list], right: Optional[list]) -> list:
    """Reducer: append, unless the update starts with RESET (a new turn)."""
    right = right or []
    if right and right[0] == RESET:
        return list(right[1:])
    return list(left or []) + list(right)


def replace_dict(left: Optional[dict], right: Optional[dict]) -> dict:
    """Reducer: displays are per turn; {"__reset__": True} clears them."""
    if right and right.get("__reset__"):
        return {k: v for k, v in right.items() if k != "__reset__"}
    return merge_dict(left, right)


class CopilotState(TypedDict, total=False):
    # Current turn only, OpenAI-format dicts (user / assistant / tool). Earlier
    # turns are rebuilt from saved chat history, so checkpoints stay small.
    messages: Annotated[list[dict], add_messages]
    # What the conversation is about: candidate_id/name, job_id/title, ...
    focus: Annotated[dict, merge_dict]
    # Result cards the model can place in its answer with [[show:<id>]].
    displays: Annotated[dict, replace_dict]
    # Text already streamed to the user this turn (saved as the reply).
    answer: str
    iterations: int
    tokens_used: int
    # Write call awaiting approval: {"id", "tool_call_id", "name", "args"}.
    pending: Optional[dict]


@dataclass
class CopilotContext:
    """Per-request values. Passed as LangGraph runtime context, so they're
    never written to a checkpoint (and the DB session needn't serialise).
    organization_id / user_id come from the authenticated request only."""
    organization_id: uuid.UUID
    user_id: uuid.UUID
    user_role: Optional[str]
    db: AsyncSession
    conversation_id: str
    user_message: str = ""
    history: list[dict] = field(default_factory=list)
    page_context: Optional[dict] = None
    current_time: str = ""
    team: str = "none on file"
    background_tasks: Optional[BackgroundTasks] = None
    # The recruiter is scolding the Copilot: the reply opens with an apology.
    complaint: bool = False
