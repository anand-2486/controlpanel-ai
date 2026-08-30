import re
import time
from typing import Dict, Any, List, Tuple
from app.checker.state import GovernanceState, WorkflowStepTrace
from app.core.groq_client import evaluate_with_groq, generate_ai_chat_response

def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


# ============================================================
# 1. INPUT & MULTI-TURN CONTEXT ANALYSIS NODE
# ============================================================

def input_analysis_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    prompt = state.get("prompt", "") or ""
    ai_response = state.get("ai_response", "") or ""
    history = state.get("conversation_history", []) or []

    # Limit to sliding window of last 10 messages
    recent_history = history[-10:] if len(history) > 10 else history

    # Analyze multi-turn compounding patterns
    turn_count = len(recent_history)
    suspicious_probes = 0
    repeated_redactions = 0

    for msg in recent_history:
        content = (msg.get("content") or "").lower()
        if any(kw in content for kw in ["ignore", "override", "bypass", "system prompt", "api key", "secret", "password"]):
            suspicious_probes += 1
        if any(kw in content for kw in ["phone", "email", "ssn", "aadhaar", "salary", "bank"]):
            repeated_redactions += 1

    # Compounding risk index: accumulates if user persistently probes boundaries across turns
    compound_risk = 0.0
    evidence = []
    if suspicious_probes >= 2:
        compound_risk = min(0.9, 0.3 * suspicious_probes)
        evidence.append(f"Compounding boundary probing detected across {suspicious_probes} recent dialogue turns")
    if repeated_redactions >= 3:
        compound_risk = max(compound_risk, min(0.85, 0.25 * repeated_redactions))
        evidence.append(f"Repeated sensitive information requests across {repeated_redactions} dialogue turns")

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Context & Multi-Turn Node",
        "status": "WARNING" if compound_risk >= 0.4 else "PASSED",
        "duration_ms": duration,
        "evidence": evidence,
        "score": compound_risk,
        "details": {
            "turns_analyzed": turn_count,
            "suspicious_probes": suspicious_probes,
            "repeated_redactions": repeated_redactions,
        }
    }

    return {
        "multi_turn_risk": {
            "score": compound_risk,
            "evidence": evidence,
            "turns_analyzed": turn_count,
        },
        "workflow_trace": [trace],
    }


# ============================================================
# 2. PII / PRIVACY SCANNER NODE
# ============================================================

def pii_scanner_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    text_to_scan = f"{state.get('prompt', '')} {state.get('ai_response', '')}".strip()
    lower = text_to_scan.lower()

    evidence = []
    score = 0.0
    redacted = text_to_scan

    patterns = {
        "Email Address": (
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            "[REDACTED_EMAIL]"
        ),
        "Phone Number": (
            r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b",
            "[REDACTED_PHONE]"
        ),
        "US SSN": (
            r"\b\d{3}-\d{2}-\d{4}\b",
            "[REDACTED_SSN]"
        ),
        "Credit Card / Debit Card": (
            r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
            "[REDACTED_CARD]"
        ),
        "Aadhaar Number": (
            r"\b\d{4}\s\d{4}\s\d{4}\b",
            "[REDACTED_AADHAAR]"
        ),
        "PAN Card": (
            r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b",
            "[REDACTED_PAN]"
        ),
        "Bank Account Details": (
            r"\b(bank account|ifsc code|routing number|iban)\s*[:=]?\s*[A-Za-z0-9-]+\b",
            "[REDACTED_BANK_INFO]"
        ),
        "API Key / Secret Token": (
            r"\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|bearer\s+[A-Za-z0-9._-]{20,})\b",
            "[REDACTED_API_KEY]"
        ),
    }

    # Match actual data & redact
    for label, (pat, repl) in patterns.items():
        if re.search(pat, text_to_scan, re.IGNORECASE):
            evidence.append(label)
            score = max(score, 0.95)
            redacted = re.sub(pat, repl, redacted, flags=re.IGNORECASE)

    # Contextual keywords for privacy intent
    intent_patterns = {
        "Salary / Compensation disclosure": r"\b(salary|compensation|annual earnings|monthly pay)\b",
        "Personal Health / Medical data": r"\b(medical history|prescription|diagnosis|patient record|health status)\b",
        "Home / Residential address": r"\b(residential address|home address|personal address)\b",
        "Date of Birth inquiry": r"\b(date of birth|dob|birth date)\b",
    }
    for label, pat in intent_patterns.items():
        if re.search(pat, lower):
            evidence.append(label)
            score = max(score, 0.85)

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "PII Scanner Node",
        "status": "BLOCKED" if score >= 0.8 else ("WARNING" if score >= 0.4 else "PASSED"),
        "duration_ms": duration,
        "evidence": list(dict.fromkeys(evidence)),
        "score": clamp(score),
        "details": {"detected_entities": list(dict.fromkeys(evidence)), "redacted_available": score > 0}
    }

    return {
        "pii_result": {
            "score": clamp(score),
            "evidence": list(dict.fromkeys(evidence)),
            "redacted_text": redacted,
        },
        "workflow_trace": [trace],
    }


# ============================================================
# 3. SECURITY & INJECTION DETECTOR NODE
# ============================================================

def security_scanner_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    prompt = (state.get("prompt") or "").lower()
    ai_response = (state.get("ai_response") or "").lower()
    combined = f"{prompt} {ai_response}"

    evidence = []
    score = 0.0

    attack_patterns = [
        ("Prompt Injection / Instruction Override", r"\b(ignore|disregard|override|forget)\b.*\b(all\s+)?(previous|prior|above|system)\s+(instructions?|rules?|policies?|prompts?)\b"),
        ("Developer Mode / DAN Jailbreak", r"\b(developer\s+mode|dan\s+mode|jailbreak|unrestricted\s+mode|do\s+anything\s+now)\b"),
        ("System Prompt Extraction Attack", r"\b(reveal|show|print|dump|output|give me)\b.*\b(system prompt|system instructions|developer instructions|hidden prompt|initial prompt)\b"),
        ("Secret / Env Key Extraction", r"\b(reveal|show|dump|give me)\b.*\b(api key|credentials?|secret key|\.env|passwords?|tokens?)\b"),
        ("Security / Guardrail Bypass Attempt", r"\b(bypass|disable|circumvent|remove|turn off)\b.*\b(safety|security|guardrails?|filter|moderation|governance)\b"),
        ("Authentication Bypass Exploitation", r"\bbypass\s+(auth|authentication|login|2fa|mfa|firewall)\b"),
        ("Cyber Misuse / Malicious Payload Generation", r"\b(write|create|build|generate|deploy)\b.*\b(malware|ransomware|keylogger|exploit|phishing script|sql injection|ddos script)\b"),
        ("Prohibited Physical Harm / Weapons", r"\b(make a bomb|build a bomb|synthesize weapon|manufacture explosives|buy illegal weapons)\b"),
    ]

    for label, pat in attack_patterns:
        if re.search(pat, combined):
            evidence.append(label)
            score = max(score, 0.95)

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Security & Injection Node",
        "status": "BLOCKED" if score >= 0.8 else ("WARNING" if score >= 0.4 else "PASSED"),
        "duration_ms": duration,
        "evidence": evidence,
        "score": clamp(score),
        "details": {"attacks_found": evidence}
    }

    return {
        "security_result": {
            "score": clamp(score),
            "evidence": evidence,
        },
        "workflow_trace": [trace],
    }


# ============================================================
# 4. BIAS & STEREOTYPE DETECTOR NODE
# ============================================================

def bias_scanner_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    prompt = (state.get("prompt") or "").lower()
    ai_response = (state.get("ai_response") or "").lower()
    combined = f"{prompt} {ai_response}"

    evidence = []
    score = 0.0

    patterns = [
        ("Gender Bias / Stereotype", r"\b(women|men|female|male|girls|boys)\b.*\b(inferior|superior|worse|better|stupid|emotional|weak|lazy|naturally aggressive|unfit)\b"),
        ("Age Bias / Discrimination", r"\b(older workers?|elderly|old people|youngsters)\b.*\b(slow|incompetent|lazy|useless|incapable|inflexible)\b"),
        ("Racial / Ethnic Stereotyping", r"\b(race|racial|ethnicity|nationality|immigrants?)\b.*\b(inferior|superior|violent|criminal|lazy|stupid|untrustworthy)\b"),
        ("Religious Stereotype", r"\b(muslims?|christians?|hindus?|jews?|religion)\b.*\b(violent|dangerous|terrorist|fanatic|inferior|superior)\b"),
        ("Discriminatory Hiring Decision", r"\b(hire|select|promote|reject|fire)\b.*\b(only men|only women|no women|no men|based on race|based on religion|due to age|due to disability)\b"),
    ]

    for label, pat in patterns:
        if re.search(pat, combined):
            evidence.append(label)
            score = max(score, 0.90)

    # Fast Groq LLM-as-Judge check if API key exists and score is not already maximum
    groq_eval = evaluate_with_groq(prompt=state.get("prompt", ""), ai_response=state.get("ai_response", ""), context_docs=state.get("context_docs", []))
    if groq_eval and "bias_score" in groq_eval:
        groq_bias = float(groq_eval.get("bias_score", 0.0))
        if groq_bias > score:
            score = groq_bias
            if groq_eval.get("explanation"):
                evidence.append(f"AI Judge: {groq_eval.get('explanation')}")

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Bias & Fairness Node",
        "status": "BLOCKED" if score >= 0.7 else ("WARNING" if score >= 0.4 else "PASSED"),
        "duration_ms": duration,
        "evidence": evidence,
        "score": clamp(score),
        "details": {"bias_categories": evidence}
    }

    return {
        "bias_result": {
            "score": clamp(score),
            "evidence": evidence,
        },
        "workflow_trace": [trace],
    }


# ============================================================
# 5. CONTEXT GROUNDING & HALLUCINATION DETECTOR NODE
# ============================================================

def grounding_scanner_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    prompt = (state.get("prompt") or "").lower()
    ai_response = (state.get("ai_response") or "").lower()
    context_docs = state.get("context_docs", []) or []

    evidence = []
    score = 0.0

    # 1. Intentional fabrication checks in prompt
    fab_patterns = [
        ("Explicit fabrication request", r"\b(invent|make up|fabricate|falsify)\b.*\b(facts?|data|citations?|sources?|research|stats?)\b"),
        ("Unverified claim generation", r"\b(answer|tell me)\b.*\b(even if you don'?t know|without knowing|without fact[- ]checking)\b"),
    ]
    for label, pat in fab_patterns:
        if re.search(pat, prompt):
            evidence.append(label)
            score = max(score, 0.85)

    # 2. Impossible anachronistic premises
    historical_years = ["1500", "1600", "1700", "1800", "1850", "1900", "1910", "1920", "1930", "1940"]
    modern_tech = ["apple", "google", "microsoft", "openai", "chatgpt", "iphone", "smartphone", "internet", "tesla"]
    if any(y in prompt for y in historical_years) and any(m in prompt for m in modern_tech):
        evidence.append("Anachronistic historical premise (impossible chronology)")
        score = max(score, 0.90)

    # 3. Context Grounding Verification against source documents
    grounding_overlap = 1.0
    if context_docs and ai_response:
        combined_context = " ".join(context_docs).lower()
        # Extract keywords from response (> 4 letters)
        response_words = set(re.findall(r"\b[a-z]{4,}\b", ai_response))
        context_words = set(re.findall(r"\b[a-z]{4,}\b", combined_context))

        if response_words:
            matched = response_words.intersection(context_words)
            grounding_overlap = len(matched) / len(response_words)
            if grounding_overlap < 0.35:
                evidence.append(f"Low source grounding ({round(grounding_overlap * 100, 1)}% contextual overlap with retrieved documents)")
                score = max(score, 0.75)

    # Fast Groq LLM-as-Judge hallucination scoring if available
    groq_eval = evaluate_with_groq(prompt=state.get("prompt", ""), ai_response=state.get("ai_response", ""), context_docs=context_docs)
    if groq_eval and "hallucination_score" in groq_eval:
        groq_hallu = float(groq_eval.get("hallucination_score", 0.0))
        if groq_hallu > score:
            score = groq_hallu
            if groq_eval.get("explanation") and groq_eval.get("explanation") not in evidence:
                evidence.append(f"AI Judge Grounding: {groq_eval.get('explanation')}")

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Grounding & Hallucination Node",
        "status": "WARNING" if score >= 0.6 else "PASSED",
        "duration_ms": duration,
        "evidence": evidence,
        "score": clamp(score),
        "details": {"grounding_overlap": round(grounding_overlap, 2), "context_docs_count": len(context_docs)}
    }

    return {
        "grounding_result": {
            "score": clamp(score),
            "grounding_overlap": grounding_overlap,
            "evidence": evidence,
        },
        "workflow_trace": [trace],
    }


# ============================================================
# 6. DYNAMIC POLICY AGGREGATOR NODE
# ============================================================

def policy_aggregator_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    p_score = state.get("pii_result", {}).get("score", 0.0)
    s_score = state.get("security_result", {}).get("score", 0.0)
    b_score = state.get("bias_result", {}).get("score", 0.0)
    h_score = state.get("grounding_result", {}).get("score", 0.0)
    m_score = state.get("multi_turn_risk", {}).get("score", 0.0)

    # Composite calculation: maximum severity + weighted contribution
    max_single_risk = max(p_score, s_score, b_score, h_score, m_score)
    weighted_composite = clamp(
        0.35 * s_score +
        0.25 * p_score +
        0.20 * b_score +
        0.15 * h_score +
        0.05 * m_score
    )
    overall_score = max(max_single_risk, weighted_composite)

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Policy Aggregator Node",
        "status": "PROCESSED",
        "duration_ms": duration,
        "evidence": [f"Overall Composite Risk: {round(overall_score * 100, 1)}%"],
        "score": clamp(overall_score),
        "details": {
            "privacy": p_score,
            "security": s_score,
            "bias": b_score,
            "hallucination": h_score,
            "multi_turn": m_score,
            "overall": overall_score,
        }
    }

    return {
        "composite_risk": {
            "privacy": clamp(p_score),
            "security": clamp(s_score),
            "bias": clamp(b_score),
            "hallucination": clamp(h_score),
            "multi_turn": clamp(m_score),
            "overall": clamp(overall_score),
        },
        "workflow_trace": [trace],
    }


# ============================================================
# 7. DECISION ROUTER NODE (Enforces DB Policy Thresholds)
# ============================================================

def decision_router_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    policy = state.get("policy") or {}
    composite = state.get("composite_risk") or {}

    # Extract dynamic thresholds from the active DB policy
    sec_thresh = float(policy.get("security_threshold", 0.80) or 0.80)
    priv_thresh = float(policy.get("privacy_threshold", 0.80) or 0.80)
    bias_thresh = float(policy.get("bias_threshold", 0.60) or 0.60)
    hallu_thresh = float(policy.get("hallucination_threshold", 0.70) or 0.70)
    review_thresh = float(policy.get("human_review_threshold", 0.75) or 0.75)
    pol_thresh = float(policy.get("policy_threshold", 0.70) or 0.70)

    pii_action = policy.get("pii_action", "BLOCK") or "BLOCK"
    inj_action = policy.get("injection_action", "BLOCK") or "BLOCK"

    action = "ALLOW"
    reason = "No significant governance risk detected"

    if composite.get("security", 0.0) >= sec_thresh:
        action = inj_action if inj_action in ["BLOCK", "HUMAN_REVIEW", "FLAG"] else "BLOCK"
        reason = "High security / prompt injection risk detected exceeding policy threshold"
    elif composite.get("privacy", 0.0) >= priv_thresh:
        action = pii_action if pii_action in ["BLOCK", "HUMAN_REVIEW", "FLAG"] else "BLOCK"
        reason = "Sensitive personal / PII information detected exceeding privacy policy"
    elif composite.get("bias", 0.0) >= bias_thresh:
        action = "BLOCK" if composite.get("bias", 0.0) >= 0.80 else "FLAG"
        reason = "Biased or discriminatory content detected exceeding policy threshold"
    elif composite.get("hallucination", 0.0) >= hallu_thresh:
        action = "HUMAN_REVIEW"
        reason = "Potential hallucination or low source grounding requiring human verification"
    elif composite.get("overall", 0.0) >= review_thresh:
        action = "HUMAN_REVIEW"
        reason = "High composite risk requiring analyst sign-off before release"
    elif composite.get("overall", 0.0) >= 0.40:
        action = "FLAG"
        reason = "Moderate governance risk detected"

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Policy Decision Node",
        "status": action,
        "duration_ms": duration,
        "evidence": [f"Decision: {action} ({reason})"],
        "score": composite.get("overall", 0.0),
        "details": {
            "action": action,
            "reason": reason,
            "policy_id": policy.get("id"),
            "applied_thresholds": {
                "security": sec_thresh,
                "privacy": priv_thresh,
                "bias": bias_thresh,
                "hallucination": hallu_thresh,
            }
        }
    }

    return {
        "decision": action,
        "decision_reason": reason,
        "workflow_trace": [trace],
    }


# ============================================================
# 8. MITIGATION & RESPONSE REWRITER NODE
# ============================================================

def mitigation_node(state: GovernanceState) -> Dict[str, Any]:
    start_time = time.perf_counter()
    action = state.get("decision", "ALLOW")
    app_name = state.get("policy", {}).get("name", "Enterprise AI")
    pii_redacted = state.get("pii_result", {}).get("redacted_text")

    if action == "BLOCK":
        safe_response = f"⛔ This interaction was blocked because it violates the governance policy ({state.get('decision_reason', '')})."
    elif action == "HUMAN_REVIEW":
        safe_response = f"⏳ This interaction was routed to the Human Review Queue before release. Reason: {state.get('decision_reason', '')}."
    elif action == "FLAG":
        safe_response = pii_redacted if (pii_redacted and pii_redacted != state.get("prompt", "")) else f"⚠️ Moderate risk flagged: {state.get('decision_reason', '')}."
    else:
        # ALLOW tier
        if state.get("ai_response"):
            safe_response = pii_redacted if (pii_redacted and pii_redacted != state.get("prompt", "")) else state.get("ai_response")
        else:
            # Generate real answer from Groq LLM if API key is present
            groq_answer = generate_ai_chat_response(
                prompt=state.get("prompt", ""),
                conversation_history=state.get("conversation_history", []),
                system_instruction=f"You are {app_name}, an enterprise AI assistant. Provide a helpful, clear, and direct answer to the user.",
            )
            if groq_answer:
                safe_response = groq_answer
            else:
                safe_response = pii_redacted if (pii_redacted and pii_redacted != state.get("prompt", "")) else f"Governance evaluation completed for {app_name}. Request is safe and permitted."

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Response Mitigation Node",
        "status": "PROCESSED",
        "duration_ms": duration,
        "evidence": ["Safe response synthesized"],
        "score": 0.0,
        "details": {"action": action}
    }

    return {
        "safe_response": safe_response,
        "workflow_trace": [trace],
    }
