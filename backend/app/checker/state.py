import operator
from typing import TypedDict, Optional, List, Dict, Any, Annotated

class WorkflowStepTrace(TypedDict):
    node_name: str
    status: str  # "PASSED", "WARNING", "BLOCKED", "PROCESSED"
    duration_ms: float
    evidence: List[str]
    score: float
    details: Dict[str, Any]

class GovernanceState(TypedDict):
    # Inputs
    prompt: str
    ai_response: Optional[str]
    context_docs: List[str]
    conversation_history: List[Dict[str, str]]  # Sliding window of last 10 messages
    application_id: str
    policy: Dict[str, Any]  # Active DB policy thresholds

    # Intermediate Scanner Results
    pii_result: Dict[str, Any]
    security_result: Dict[str, Any]
    bias_result: Dict[str, Any]
    grounding_result: Dict[str, Any]
    multi_turn_risk: Dict[str, Any]

    # Composite & Final Output
    composite_risk: Dict[str, Any]
    decision: str  # "ALLOW", "FLAG", "HUMAN_REVIEW", "BLOCK"
    decision_reason: str
    safe_response: str
    # Concatenates traces from all 8 nodes in execution order
    workflow_trace: Annotated[List[WorkflowStepTrace], operator.add]
