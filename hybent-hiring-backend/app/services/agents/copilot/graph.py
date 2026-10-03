"""Builds and caches the compiled Copilot agent graph."""
from langgraph.graph import END, START, StateGraph

from app.services.agents.checkpointer import get_checkpointer
from app.services.agents.copilot import tools_candidate, tools_read, tools_write  # noqa: F401 — register tools
from app.services.agents.copilot.nodes import (
    agent, approval, finalize, route_after_agent, route_after_tools, tools,
)
from app.services.agents.copilot.state import CopilotContext, CopilotState

_graph = None
_graph_saver = None


def build_graph(checkpointer):
    g = StateGraph(CopilotState, context_schema=CopilotContext)
    g.add_node("agent", agent)
    g.add_node("tools", tools)
    g.add_node("approval", approval)
    g.add_node("finalize", finalize)
    g.add_edge(START, "agent")
    g.add_conditional_edges("agent", route_after_agent, {"tools": "tools", "finalize": "finalize"})
    g.add_conditional_edges("tools", route_after_tools, {"approval": "approval", "agent": "agent"})
    g.add_edge("approval", "agent")
    g.add_edge("finalize", END)
    return g.compile(checkpointer=checkpointer)


def get_graph():
    """Compiled once per checkpointer (it changes only at startup/shutdown)."""
    global _graph, _graph_saver
    saver = get_checkpointer()
    if _graph is None or _graph_saver is not saver:
        _graph = build_graph(saver)
        _graph_saver = saver
    return _graph
