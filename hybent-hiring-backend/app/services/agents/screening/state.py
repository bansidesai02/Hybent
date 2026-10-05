"""State and per-run context for the Candidate Screening Agent graph."""
import uuid
from dataclasses import dataclass
from typing import Optional, TypedDict

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession


class ScreeningState(TypedDict, total=False):
    candidate_id: str
    # Compact view of the candidate (repo.load_candidate). Never the ORM row,
    # so checkpoints stay small and serialisable.
    candidate: Optional[dict]
    # Set when the run ends early: "missing", "already_screened".
    stop_reason: Optional[str]
    # Earlier profile with the same email/phone: {"id", "full_name", "pipeline_stage"}.
    duplicate: Optional[dict]
    # Open jobs scored, best first: [{"job_id", "title", "score", "source", ...}]
    matches: list[dict]
    # {"recommendation", "job_id", "reasons", "risks", "confidence", "engine"}
    decision: Optional[dict]
    recommendation_id: Optional[str]
    # What happened after the recruiter's decision (actions.apply_decision).
    outcome: Optional[dict]


@dataclass
class ScreeningContext:
    """Per-run values, passed as LangGraph runtime context (never checkpointed).
    organization_id comes from the candidate row the task was queued for,
    never from model output."""
    organization_id: uuid.UUID
    db: AsyncSession
    # The decide request's, when a recruiter resumes the run (emails go out
    # after the response). None in the worker.
    background_tasks: Optional[BackgroundTasks] = None
