"""
Agent infrastructure (LangGraph orchestration over the existing SafeGroq client).

llm.py          — async streaming chat-with-tools over SafeGroq (metered)
registry.py     — tool registry: name → JSON schema, handler, read/write kind
checkpointer.py — Postgres checkpointer shared by every agent graph
copilot/        — Recruiter Copilot agent (v2)
"""
