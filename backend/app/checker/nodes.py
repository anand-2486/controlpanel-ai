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

    # Fast unified Groq LLM-as-a-Judge evaluation run once for all downstream nodes
    groq_eval = evaluate_with_groq(
        prompt=prompt,
        ai_response=ai_response,
        context_docs=state.get("context_docs", []),
    )

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
            "ai_judge_connected": groq_eval is not None,
        }
    }

    return {
        "multi_turn_risk": {
            "score": compound_risk,
            "evidence": evidence,
            "turns_analyzed": turn_count,
        },
        "groq_eval": groq_eval,
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

    # Contextual keywords for privacy intent & personal data solicitation
    intent_patterns = {
        "Personal Phone / Contact Number Solicitation": (
            r"\b(phone\s*number|phone\s*no|mobile\s*number|mobile\s*no|cell\s*number|cell\s*phone|contact\s*number|contact\s*no|whatsapp\s*number|telephone\s*number|call\s*number|personal\s*number|personal\s*phone)\b|"
            r"\b(phone|mobile|cell|contact\s*no|phone\s*no|number|contact\s*details|contact\s*info)\b.*\b(of|for)\b.*\b(hr|human\s*resources|manager|employee|boss|ceo|staff|colleague|candidate|person|user|admin|recruiter|someone)\b|"
            r"\b(give\s*me|what\s*is|tell\s*me|get|show|share|find|provide|extract|leak|send\s*me)\b.*\b(phone|mobile|cell|number|contact|email|address)\b.*\b(hr|human\s*resources|employee|manager|staff|ceo|boss|user|someone|colleague|recruiter)\b|"
            r"\bhow\s*can\s*i\s*(call|reach|contact|phone|text|whatsapp)\b.*\b(hr|human\s*resources|employee|manager|ceo|staff)\b"
        ),
        "Personal Email Request": (
            r"\b(personal\s*email|private\s*email|direct\s*email)\b|"
            r"\b(email|email\s*id|email\s*address)\b.*\b(of|for)\b.*\b(hr|human\s*resources|manager|employee|boss|ceo|staff|colleague|candidate|recruiter)\b"
        ),
        "Salary / Compensation disclosure": r"\b(salary|compensation|annual earnings|monthly pay|payslip|wage)\b",
        "Personal Health / Medical data": r"\b(medical history|prescription|diagnosis|patient record|health status)\b",
        "Home / Residential address": r"\b(residential address|home address|personal address)\b",
        "Date of Birth inquiry": r"\b(date of birth|dob|birth date)\b",
    }
    for label, pat in intent_patterns.items():
        if re.search(pat, lower):
            evidence.append(label)
            score = max(score, 0.90)

    # Groq LLM-as-Judge privacy risk score integration
    groq_eval = state.get("groq_eval")
    if groq_eval and "privacy_score" in groq_eval:
        groq_priv = float(groq_eval.get("privacy_score", 0.0))
        if groq_priv > score:
            score = groq_priv
            if groq_eval.get("explanation") and groq_eval.get("explanation") not in evidence:
                evidence.append(f"AI Judge Privacy: {groq_eval.get('explanation')}")

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

    # Groq LLM-as-Judge security risk score integration
    groq_eval = state.get("groq_eval")
    if groq_eval and "security_score" in groq_eval:
        groq_sec = float(groq_eval.get("security_score", 0.0))
        if groq_sec > score:
            score = groq_sec
            if groq_eval.get("explanation") and groq_eval.get("explanation") not in evidence:
                evidence.append(f"AI Judge Security: {groq_eval.get('explanation')}")

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

    # Groq LLM-as-Judge check
    groq_eval = state.get("groq_eval") or evaluate_with_groq(prompt=state.get("prompt", ""), ai_response=state.get("ai_response", ""), context_docs=state.get("context_docs", []))
    if groq_eval and "bias_score" in groq_eval:
        groq_bias = float(groq_eval.get("bias_score", 0.0))
        if groq_bias > score:
            score = groq_bias
            if groq_eval.get("explanation") and groq_eval.get("explanation") not in evidence:
                evidence.append(f"AI Judge Bias: {groq_eval.get('explanation')}")

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

    # Groq LLM-as-Judge hallucination scoring
    groq_eval = state.get("groq_eval") or evaluate_with_groq(prompt=state.get("prompt", ""), ai_response=state.get("ai_response", ""), context_docs=context_docs)
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

    text_to_scan = f"{state.get('prompt', '')} {state.get('ai_response', '')}".strip()

    # ── 🔴 Prohibited Harm Policy Rules (Strict BLOCK) ───────────
    prohibited_evidence = []
    prohibited_reasons = []
    prohibited_score = 0.0

    prohibited_rules = [
        # 1. Weapons & Explosives
        (
            "Weapons & Explosives",
            r"\b(how\s+to\s+)?(make|build|construct|manufacture|synthesize|assemble|create|design|modify)\s+(a\s+)?(pipe\s+bomb|car\s+bomb|dirty\s+bomb|ied\b|improvised\s+explosive|molotov\s+cocktail|plastic\s+explosive|c4\s+explosive|dynamite|suicide\s+vest|ghost\s+gun|chemical\s+weapon|biological\s+weapon|nerve\s+agent|weapon\s+of\s+mass\s+destruction)\b|"
            r"\b(instructions?\s+for|recipe\s+for|guide\s+to)\s+(making|building|synthesizing)\s+(explosives?|bombs?|chemical\s+weapons?)\b|"
            r"\b(modify|convert)\s+(a\s+)?(firearm|gun|weapon)\s+(to\s+full\s+auto|to\s+cause\s+maximum\s+harm|to\s+kill\s+more\s+people)\b",
            "Weapons & explosives: Request for actionable instructions to construct or modify lethal weapons/explosives"
        ),

        # 2. Cyber Abuse & Unauthorized Exploitation
        (
            "Cyber Abuse",
            r"\b(how\s+to\s+)?(write|create|build|generate|deploy|develop)\s+(a\s+)?(malware|ransomware|keylogger|trojan\s+virus|spyware|botnet|rootkit|phishing\s+kit|credential\s+harvester|exploit\s+payload|zero-day\s+exploit|ddos\s+script|packet\s+flooder)\b|"
            r"\b(how\s+to\s+)?(steal|hack|intercept|dump|crack|bypass|harvest)\s+(user\s+)?(passwords?|credentials?|session\s+tokens?|auth\s+tokens?|jwt\s+tokens?|ssh\s+keys?|database\s+credentials?|mfa\s+codes?)\b|"
            r"\b(launch|perform|execute)\s+(a\s+)?(ddos\s+attack|denial\s+of\s+service|distributed\s+denial\s+of\s+service)\s+(on|against)\b|"
            r"\b(instructions?\s+to\s+hack|guide\s+to\s+infiltrate|unauthorized\s+penetration\s+of)\s+([a-z0-9._-]+\.(com|org|net|gov|edu|io)|networks?|servers?|databases?)\b",
            "Cyber abuse: Malicious exploitation, credential theft, malware generation, or unauthorized attack instructions"
        ),

        # 3. Serious Violent Wrongdoing & Physical Harm
        (
            "Serious Violent Wrongdoing",
            r"\b(how\s+to\s+)?(kill|murder|assassinate|poison|strangle|torture|stab|snipe|inflict\s+fatal\s+injury\s+on)\s+(someone|somebody|a\s+person|my\s+(boss|wife|husband|enemy|neighbor|ex)|a\s+target|people)\b|"
            r"\b(plan|coordinate|execute)\s+(a\s+)?(mass\s+shooting|terrorist\s+attack|violent\s+attack|assassination|kidnapping|hostage\s+taking|arson\s+attack)\b|"
            r"\b(best\s+way\s+to|undetectable\s+way\s+to|lethal\s+method\s+to)\s+(kill|poison|murder|harm)\s+(someone|a\s+human)\b",
            "Serious violent wrongdoing: Actionable instructions or planning for physical violence, murder, or severe injury"
        ),

        # 4. Child Sexual Exploitation & Abuse (CSAM)
        (
            "Child Sexual Exploitation",
            r"\b(csam|child\s+pornography|child\s+sexual\s+abuse|pedophil\w*|underage\s+sexual\s+abuse|minor\s+sexual\s+abuse|sex\s+with\s+(a\s+)?(child|minor|kid|underage))\b",
            "Child sexual exploitation: Severe policy violation involving sexual abuse or exploitation of minors"
        ),

        # 5. Sexual Violence & Exploitation
        (
            "Sexual Violence / Exploitation",
            r"\b(how\s+to\s+)?(commit\s+sexual\s+assault|facilitate\s+rape|drug\s+and\s+assault|non-consensual\s+sexual|sex\s+traffick\w*|human\s+traffick\w*)\b|"
            r"\b(how\s+to\s+slip|administer)\s+(roofies?|rohypnol|ghb)\s+(to\s+someone|in\s+a\s+drink)\b",
            "Sexual violence: Instructions facilitating non-consensual sexual assault, drugging, or human trafficking"
        ),

        # 6. Illegal Drug Production & Synthesis
        (
            "Illegal Drug Production",
            r"\b(how\s+to\s+)?(cook|synthesize|manufacture|produce|extract|make|scale)\s+(meth|methamphetamine|fentanyl|heroin|crack\s+cocaine|lsd\b|mdma|ecstasy|pcp\b|controlled\s+substances?|illegal\s+drugs?)\b|"
            r"\b(recipe|precursors?|chemical\s+synthesis)\s+for\s+(making|manufacturing|producing)\s+(fentanyl|methamphetamine|heroin|lsd|narcotics)\b",
            "Illegal drug production: Actionable chemical instructions for manufacturing illicit controlled substances"
        ),

        # 7. Fraud & Financial Crime
        (
            "Fraud & Financial Crime",
            r"\b(how\s+to\s+)?(launder\s+money|clean\s+dirty\s+money|evade\s+financial\s+controls|bypass\s+aml\s+checks|smurf\s+cash)\b|"
            r"\b(how\s+to\s+)?(run|create|operate|set\s+up)\s+(a\s+)?(ponzi\s+scheme|pyramid\s+scheme|advance\s+fee\s+scam|crypto\s+scam|phishing\s+scam|boiler\s+room\s+scam)\b|"
            r"\b(how\s+to\s+)?(commit|perform|execute)\s+(credit\s+card\s+fraud|wire\s+fraud|identity\s+theft|bank\s+fraud|check\s+kiting|synthetic\s+identity\s+fraud)\b|"
            r"\b(generate|create|steal)\s+(stolen\s+credit\s+cards?|fake\s+ssn\s+for\s+credit|fraudulent\s+bank\s+accounts?)\b",
            "Fraud & financial crime: Instructions for money laundering, financial scams, or identity/credit fraud"
        ),

        # 8. Harmful Safety-Control Evasion
        (
            "Harmful Safety-Control Evasion",
            r"\b(how\s+to\s+)?(jailbreak|bypass|disable|circumvent|turn\s+off|override)\s+(ai\s+)?(safety|guardrails?|governance|content\s+filters?|moderation|security\s+controls?)\s*(to|and|for)\s*(generate|build|create|enable|make)\s*(malware|weapons?|bombs?|exploits?|harm|drugs?)\b",
            "Harmful safety-control evasion: Circumventing governance controls specifically to enable prohibited activities"
        ),
    ]

    for cat_name, pat, reason_desc in prohibited_rules:
        if re.search(pat, text_to_scan, re.IGNORECASE):
            prohibited_evidence.append(f"Prohibited Policy Violation ({cat_name}): {reason_desc}")
            prohibited_reasons.append(reason_desc)
            prohibited_score = max(prohibited_score, 1.0)

    # ── 🟠 High-Stakes Human-in-the-Loop (HITL) Critical Decision Evaluation ──
    hitl_evidence = []
    hitl_reasons = []
    hitl_score = 0.0

    hitl_rules = [
        # 9. Self-Harm & Suicide Crisis Expressions (Contextual - word boundary matching)
        (
            "Self-Harm / Suicide",
            r"\b(i\s+want\s+to\s+(die|kill\s+myself|end\s+my\s+life|hang\s+myself|shoot\s+myself)|"
            r"i('m|\s+am)\s+(feeling\s+suicidal|going\s+to\s+kill\s+myself|planning\s+suicide|thinking\s+of\s+ending\s+my\s+life)|"
            r"how\s+to\s+commit\s+suicide|painless\s+ways?\s+to\s+(die|end\s+life)|suicide\s+methods?|ways?\s+to\s+kill\s+myself|"
            r"help\s+me\s+commit\s+suicide|i\s+don't\s+want\s+to\s+live\s+anymore|self[- ]harm\s+instructions?)\b",
            "Self-harm / crisis expression: Genuine self-harm or suicide expression requires immediate human crisis review"
        ),

        # 10. Mental-Health Crisis
        (
            "Mental-Health Crisis",
            r"\b(having\s+a\s+(severe\s+)?mental\s+health\s+crisis|psychiatric\s+emergency|"
            r"feeling\s+hopeless\s+and\s+want\s+to\s+harm\s+myself|overwhelming\s+urge\s+to\s+cut\s+myself|"
            r"crisis\s+intervention\s+needed|acute\s+psychosis\s+episode|psychiatric\s+evaluation)\b",
            "Mental-health crisis: Severe mental health crisis expression requires licensed professional review"
        ),

        # 11. High-Impact Protected Characteristics Discrimination
        (
            "Protected Characteristic Discrimination",
            r"\b(hire|hiring|fire|firing|terminate|terminating|reject|rejecting|promote|promoting|demote|demoting|layoff)\s+"
            r"(someone|candidate|applicant|employee|worker|staff)\s+(because|due\s+to|based\s+on)\s+(their\s+)?"
            r"(disability|handicap|pregnancy|pregnant|race|ethnicity|skin\s+color|gender|sex|age|older\s+age|religion|religious\s+belief|sexual\s+orientation|medical\s+condition|chronic\s+illness|genetic\s+information)\b|"
            r"\b(reject|fire|terminate|deny\s+promotion\s+to)\s+(pregnant\s+women|disabled\s+people|older\s+workers|minority\s+candidates|employees?\s+with\s+(disabilities|cancer|medical\s+conditions?))\b",
            "High-impact decision: Employment action based on protected characteristics requires human compliance review"
        ),

        # 12. Healthcare & Clinical Decision
        (
            "Medical Advice / Clinical Decision",
            r"\b(treatment\s*plan|prescribe\s*medication|medical\s*diagnosis|clinical\s*recommendation|drug\s*dosage|recommend(s)?\s*(a\s*)?treatment|surgery\s*recommendation|doctor\s*review|medical\s*advice|diagnose\s*condition|lab\s*results?\s*interpretation|alter\s*medication)\b",
            "Medical advice: AI clinical recommendation or treatment plan requires doctor review"
        ),

        # 13. Legal Decision & Contract Violation
        (
            "Legal Decision / Contract Violation",
            r"\b(contract\s*violation|lawyer\s*review|legal\s*liability|terminate\s*contract|breach\s*of\s*contract|binding\s*agreement|legal\s*settlement|sue\b|litigation\s*risk|legal\s*decision|attorney\s*review|draft\s*binding\s*clause)\b",
            "Legal decision: Potential contract violation or legal liability requires lawyer review"
        ),

        # 14. Regulatory Compliance & Audit Findings
        (
            "Regulatory Compliance & Audit Findings",
            r"\b(gdpr\s*violation|hipaa\s*breach|regulatory\s*non-compliance|sec\s*filing\s*irregularity|compliance\s*audit\s*failure|regulatory\s*fine|subpoena|whistleblower\s*report)\b",
            "Regulatory compliance: High-risk audit finding or compliance breach requires legal counsel review"
        ),

        # 15. Financial Transaction / Refund Approval
        (
            "Financial Transaction / Refund Approval",
            r"\b(approve\s*(a\s*)?([₹$€£]|rs\.?|inr|usd)?\s*\d+.*refund|refund\s*approval|approve\s*(a\s*)?refund|refund\s*of|financial\s*transaction|fund\s*transfer|disburse\s*funds|credit\s*limit\s*increase|wire\s*transfer|authorize\s*payment|financial\s*approval|payout\s*authorization)\b",
            "Financial transaction: High-value refund or transaction authorization requires human manager approval"
        ),

        # 16. Loan & Credit Underwriting Decision
        (
            "Loan & Credit Underwriting Decision",
            r"\b(loan\s*approval|mortgage\s*underwriting|approve\s*credit\s*application|deny\s*loan|reject\s*mortgage|credit\s*risk\s*decision|underwriter\s*review)\b",
            "Credit underwriting: Loan or mortgage approval/denial requires human underwriter review"
        ),

        # 17. Tax Filing & Financial Audit
        (
            "Tax Filing & Financial Audit",
            r"\b(tax\s*audit|file\s*tax\s*return|irs\s*submission|dispute\s*tax\s*liability|corporate\s*tax\s*filing|cpa\s*sign-off)\b",
            "Financial accounting: Tax filing or audit submission requires certified accountant review"
        ),

        # 18. Human Resources & Employment
        (
            "Employment / Hiring Decision",
            r"\b(recommends?\s*rejecting\s*(a\s*)?candidate|candidate\s*rejection|reject\s*(a\s*)?candidate|recruiter\s*review|hiring\s*decision|reject\s*applicant|shortlist\s*candidate|extend\s*job\s*offer)\b",
            "Hiring decision: Candidate rejection or employment offer requires recruiter review"
        ),
        (
            "Employee Termination & Disciplinary Action",
            r"\b(terminate\s*employee|fire\s*employee|layoff|performance\s*improvement\s*plan|pip\s*issuance|disciplinary\s*action|workplace\s*harassment\s*allegation|hr\s*investigation)\b",
            "Employment action: Disciplinary action or employee termination requires HR director review"
        ),
        (
            "Compensation & Salary Adjustment",
            r"\b(salary\s*increase|bonus\s*allocation|equity\s*grant\s*approval|compensation\s*revision|pay\s*raise\s*authorization)\b",
            "Compensation decision: Employee salary adjustment or equity allocation requires management approval"
        ),

        # 19. Customer & Crisis Communications
        (
            "Sensitive Customer Escalation / Crisis Email",
            r"\b(angry\s*customer|escalated\s*customer|review\s*before\s*sending|customer\s*legal\s*threat|crisis\s*statement|sensitive\s*email|executive\s*response|customer\s*dispute|pr\s*crisis)\b",
            "Sensitive email: Response to angry customer or escalation requires review before sending"
        ),
        (
            "Public Relations / Media Announcement",
            r"\b(press\s*release\s*approval|media\s*statement|public\s*apology|product\s*recall\s*announcement|crisis\s*communication\s*release)\b",
            "Public relations: High-impact media statement or public disclosure requires PR officer review"
        ),

        # 20. Trust, Safety & Content Moderation
        (
            "Potentially Harmful Content Moderation",
            r"\b(potentially\s*harmful\s*content|detected\s*potentially\s*harmful|flagged\s*(as\s*)?harmful|harmful\s*content|human\s*moderator\s*review|hate\s*speech\s*review|content\s*moderation\s*queue|disturbing\s*content)\b",
            "Content moderation: Potentially harmful content requires human moderator review"
        ),
        (
            "Policy Violation / User Sanction",
            r"\b(policy\s*violation|ban\s*(this\s*)?user|suspend\s*(this\s*)?user|user\s*sanction|flagged\s*this\s*user|account\s*termination|terms\s*of\s*service\s*violation)\b",
            "Policy violation: User policy violation flagged requires moderator review"
        ),

        # 21. Model Confidence & Safety Edge Cases
        (
            "Low Confidence / Ambiguous AI Output",
            r"\b((only\s+)?(5\d|4\d|3\d|2\d|1\d|[0-9])%\s*confident|low\s*confidence|low\s*certainty|uncertain\s*answer|confidence\s*score\s*below|human\s*verification\s*required|uncertain\s*prediction)\b",
            "High-risk AI output: Low confidence output requires human verification"
        ),

        # 22. Infrastructure & Destructive System Operations
        (
            "Destructive System / External Action",
            r"\b(delete\s*\d+\s*files|delete\s*files|drop\s*database|truncate\s*table|wipe\s*data|execute\s*command|reboot\s*server|shutdown\s*cluster|bulk\s*delete|external\s*action|delete\s*records|purge\s*storage)\b",
            "External action: Destructive file deletion or system action requires human approval"
        ),
        (
            "Production Deployment & Infrastructure Change",
            r"\b(deploy\s*to\s*production|modify\s*firewall\s*rules|change\s*dns\s*records|reconfigure\s*load\s*balancer|terminate\s*cloud\s*instance)\b",
            "Infrastructure change: Production deployment or network reconfiguration requires DevOps engineer approval"
        ),

        # 23. Cybersecurity & Access Control
        (
            "Privileged Access Control & Permissions",
            r"\b(grant(ing)?\s*admin\s*access|admin\s*privilege|security\s*review\s*required|elevate\s*permission|sudo\s*access|root\s*access|superadmin\s*role|access\s*control|grant\s*privilege|override\s*2fa|bypass\s*mfa)\b",
            "Access control: Granting admin access requires security review"
        ),
        (
            "Security Incident & Active Breach Response",
            r"\b(security\s*incident\s*response|isolate\s*infected\s*host|quarantine\s*workstation|ransomware\s*containment|compromised\s*credentials\s*action)\b",
            "Security operations: Incident containment action requires SOC analyst authorization"
        ),

        # 24. Insurance, Real Estate & Government
        (
            "Insurance Claim Adjudication",
            r"\b(insurance\s*claim\s*approval|deny\s*insurance\s*claim|damage\s*payout\s*authorization|pre-authorization\s*denial|adjuster\s*review)\b",
            "Insurance adjudication: Claim payout authorization or denial requires claims adjuster review"
        ),
        (
            "Real Estate & Tenant Eviction",
            r"\b(tenant\s*eviction\s*notice|terminate\s*lease\s*agreement|property\s*foreclosure\s*action|withhold\s*security\s*deposit)\b",
            "Real estate action: Lease termination or eviction notice requires property manager review"
        ),
        (
            "High-Value Procurement & Vendor Contracts",
            r"\b(purchase\s*order\s*approval|vendor\s*contract\s*signing|procurement\s*authorization|sign\s*master\s*service\s*agreement)\b",
            "Procurement decision: High-value purchase order or vendor agreement requires procurement officer sign-off"
        ),
        (
            "Academic Admissions & Integrity Sanctions",
            r"\b(admit\s*student|reject\s*admission\s*applicant|plagiarism\s*sanction|academic\s*expulsion|revoke\s*degree)\b",
            "Academic governance: Student admission or academic integrity sanction requires admissions board review"
        ),
        (
            "Government Benefits & Visa Approvals",
            r"\b(approve\s*visa\s*application|deny\s*welfare\s*benefit|grant\s*immigration\s*status|revoke\s*operating\s*license|permit\s*approval)\b",
            "Government administration: Welfare benefit or immigration decision requires authorized officer review"
        ),
    ]

    for cat_name, pat, reason_desc in hitl_rules:
        if re.search(pat, text_to_scan, re.IGNORECASE):
            hitl_evidence.append(f"HITL Trigger ({cat_name}): {reason_desc}")
            hitl_reasons.append(reason_desc)
            hitl_score = max(hitl_score, 0.90)

    # Groq AI Judge human_review_score
    groq_eval = state.get("groq_eval")
    if groq_eval and "human_review_score" in groq_eval:
        groq_hitl = float(groq_eval.get("human_review_score", 0.0))
        if groq_hitl >= 0.70:
            hitl_score = max(hitl_score, groq_hitl)
            if groq_eval.get("explanation"):
                hitl_evidence.append(f"AI Judge HITL: {groq_eval.get('explanation')}")
                if not hitl_reasons:
                    hitl_reasons.append(groq_eval.get("explanation"))

    # Composite calculation: maximum severity + weighted contribution
    max_single_risk = max(p_score, s_score, b_score, h_score, m_score, hitl_score, prohibited_score)
    weighted_composite = clamp(
        0.30 * s_score +
        0.25 * p_score +
        0.20 * hitl_score +
        0.15 * b_score +
        0.10 * h_score
    )
    overall_score = max(max_single_risk, weighted_composite)

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace: WorkflowStepTrace = {
        "node_name": "Policy Aggregator Node",
        "status": "PROCESSED",
        "duration_ms": duration,
        "evidence": [f"Overall Composite Risk: {round(overall_score * 100, 1)}%"] + prohibited_evidence + hitl_evidence,
        "score": clamp(overall_score),
        "details": {
            "privacy": p_score,
            "security": s_score,
            "bias": b_score,
            "hallucination": h_score,
            "multi_turn": m_score,
            "hitl_score": hitl_score,
            "hitl_reasons": hitl_reasons,
            "prohibited_score": prohibited_score,
            "prohibited_reasons": prohibited_reasons,
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
            "hitl": clamp(hitl_score),
            "hitl_reasons": hitl_reasons,
            "prohibited_score": clamp(prohibited_score),
            "prohibited_reasons": prohibited_reasons,
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

    prohibited_reasons = composite.get("prohibited_reasons", []) or []
    prohibited_score = composite.get("prohibited_score", 0.0)
    hitl_reasons = composite.get("hitl_reasons", []) or []
    hitl_score = composite.get("hitl", 0.0)

    # Precedence: Prohibited harmful requests must be strictly BLOCKED first
    if prohibited_score >= 0.80 or len(prohibited_reasons) > 0:
        action = "BLOCK"
        reason = prohibited_reasons[0] if prohibited_reasons else "Prohibited policy violation detected"
    elif composite.get("security", 0.0) >= sec_thresh:
        action = inj_action if inj_action in ["BLOCK", "HUMAN_REVIEW", "FLAG"] else "BLOCK"
        reason = "High security / prompt injection risk detected exceeding policy threshold"
    elif composite.get("privacy", 0.0) >= priv_thresh:
        action = pii_action if pii_action in ["BLOCK", "HUMAN_REVIEW", "FLAG"] else "BLOCK"
        reason = "Sensitive personal / PII information detected exceeding privacy policy"
    elif hitl_score >= 0.70 or len(hitl_reasons) > 0:
        action = "HUMAN_REVIEW"
        reason = hitl_reasons[0] if hitl_reasons else "Critical high-stakes action requiring human expert review"
    elif composite.get("bias", 0.0) >= 0.80:
        action = "BLOCK"
        reason = "Severe bias or discriminatory content detected exceeding policy threshold"
    elif composite.get("bias", 0.0) >= bias_thresh:
        action = "FLAG"
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
                "hitl_score": hitl_score,
                "prohibited_score": prohibited_score,
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
