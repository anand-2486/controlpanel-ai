import time
from typing import Dict, Any, List, Optional
from langgraph.graph import StateGraph, START, END
from app.checker.state import GovernanceState
from app.checker.nodes import (
    input_analysis_node,
    pii_scanner_node,
    security_scanner_node,
    bias_scanner_node,
    grounding_scanner_node,
    policy_aggregator_node,
    decision_router_node,
    mitigation_node,
)

_compiled_governance_graph = None

def build_governance_graph():
    """
    Builds and compiles the full LangGraph Responsible AI Control Plane Graph.
    """
    builder = StateGraph(GovernanceState)

    # Add all 8 specialized nodes
    builder.add_node("input_analysis", input_analysis_node)
    builder.add_node("pii_scanner", pii_scanner_node)
    builder.add_node("security_scanner", security_scanner_node)
    builder.add_node("bias_scanner", bias_scanner_node)
    builder.add_node("grounding_scanner", grounding_scanner_node)
    builder.add_node("policy_aggregator", policy_aggregator_node)
    builder.add_node("decision_router", decision_router_node)
    builder.add_node("mitigation", mitigation_node)

    # Define execution edges
    builder.add_edge(START, "input_analysis")
    builder.add_edge("input_analysis", "pii_scanner")
    builder.add_edge("pii_scanner", "security_scanner")
    builder.add_edge("security_scanner", "bias_scanner")
    builder.add_edge("bias_scanner", "grounding_scanner")
    builder.add_edge("grounding_scanner", "policy_aggregator")
    builder.add_edge("policy_aggregator", "decision_router")
    builder.add_edge("decision_router", "mitigation")
    builder.add_edge("mitigation", END)

    return builder.compile()


def get_governance_graph():
    global _compiled_governance_graph
    if _compiled_governance_graph is None:
        _compiled_governance_graph = build_governance_graph()
    return _compiled_governance_graph


def run_governance_pipeline(
    prompt: str,
    ai_response: Optional[str] = None,
    context_docs: Optional[List[str]] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    application_id: str = "app-001",
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Executes the compiled LangGraph state graph.
    Returns complete decision, composite risk metrics, multi-turn risk index,
    mitigated response, and full workflow step execution trace for the UI.
    """
    graph = get_governance_graph()
    overall_start = time.perf_counter()

    initial_state: GovernanceState = {
        "prompt": prompt,
        "ai_response": ai_response or "",
        "context_docs": context_docs or [],
        "conversation_history": conversation_history or [],
        "application_id": application_id,
        "policy": policy or {},
        "pii_result": {},
        "security_result": {},
        "bias_result": {},
        "grounding_result": {},
        "multi_turn_risk": {},
        "composite_risk": {},
        "decision": "ALLOW",
        "decision_reason": "",
        "safe_response": "",
        "workflow_trace": [],
    }

    # Execute StateGraph
    accumulated_trace = []
    final_state = initial_state

    # Stream or invoke through LangGraph
    result = graph.invoke(initial_state)

    # Flatten and consolidate execution trace
    total_duration_ms = round((time.perf_counter() - overall_start) * 1000, 2)

    # Format structured evidence
    evidence = {
        "privacy": result.get("pii_result", {}).get("evidence", []),
        "security": result.get("security_result", {}).get("evidence", []),
        "bias": result.get("bias_result", {}).get("evidence", []),
        "hallucination": result.get("grounding_result", {}).get("evidence", []),
        "multi_turn": result.get("multi_turn_risk", {}).get("evidence", []),
    }

    return {
        "decision": result.get("decision", "ALLOW"),
        "decision_reason": result.get("decision_reason", ""),
        "composite_risk": result.get("composite_risk", {}),
        "multi_turn_risk": result.get("multi_turn_risk", {}),
        "pii_result": result.get("pii_result", {}),
        "security_result": result.get("security_result", {}),
        "bias_result": result.get("bias_result", {}),
        "grounding_result": result.get("grounding_result", {}),
        "safe_response": result.get("safe_response", ""),
        "workflow_trace": result.get("workflow_trace", []),
        "total_latency_ms": total_duration_ms,
        "evidence": evidence,
    }
