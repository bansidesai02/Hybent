"""Builds and caches the compiled Candidate Screening Agent graph."""
from langgraph.graph import END, START, StateGraph

from app.services.agents.checkpointer import get_checkpointer
from app.services.agents.screening.nodes import (
    apply, approval, decide, dedupe, load, match_jobs, record, route_after_dedupe, route_after_load,
)
from app.services.agents.screening.state import ScreeningContext, ScreeningState

_graph = None
_graph_saver = None


def build_graph(checkpointer):
    g = StateGraph(ScreeningState, context_schema=ScreeningContext)
    g.add_node("load", load)
    g.add_node("dedupe", dedupe)
    g.add_node("match_jobs", match_jobs)
    g.add_node("decide", decide)
    g.add_node("record", record)
    g.add_node("approval", approval)
    g.add_node("apply", apply)
    g.add_edge(START, "load")
    g.add_conditional_edges("load", route_after_load, {"end": END, "dedupe": "dedupe"})
    g.add_conditional_edges("dedupe", route_after_dedupe, {"record": "record", "match_jobs": "match_jobs"})
    g.add_edge("match_jobs", "decide")
    g.add_edge("decide", "record")
    g.add_edge("record", "approval")
    g.add_edge("approval", "apply")
    g.add_edge("apply", END)
    return g.compile(checkpointer=checkpointer)


def get_graph():
    """Compiled once per checkpointer (it changes only at startup/shutdown)."""
    global _graph, _graph_saver
    saver = get_checkpointer()
    if _graph is None or _graph_saver is not saver:
        _graph = build_graph(saver)
        _graph_saver = saver
    return _graph
