import re
from datetime import datetime

class BaseDetector:
    name = "base"
    
    def detect(self, text: str, context=None):
        raise NotImplementedError("Each detector must implement the detect method from scratch.")

def result(detector: str, detected: bool, score: float, severity: str, reason: str, evidence: list):
    # This enforces the common detector contract for the backend
    return {
        "detector": detector,
        "detected": detected,
        "score": float(score),
        "severity": severity,
        "reason": reason,
        "evidence": evidence
    }

class PIIDetector(BaseDetector):
    name = "pii"
    
    def __init__(self):
        # We define manual regex patterns for detection
        self.patterns = {
            "PHONE": r'\b\d{10}\b',
            "EMAIL": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "FINANCIAL": r'\b(salary|pay|₹\d+|\$\d+)\b' # Added to catch the previous test cases
        }

    def detect(self, text: str, context=None):
        findings = []
        redacted_text = text
        
        # Scan the text against our patterns
        for p_type, pattern in self.patterns.items():
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                matched_str = match.group()
                
                # Mock confidence for a direct regex match
                confidence = 0.98 
                findings.append({"type": p_type, "confidence": confidence})
                
                # Redact the string
                if p_type == "PHONE" and len(matched_str) == 10:
                    # Mask everything except the last 2 digits as requested by the manual
                    masked = "********" + matched_str[-2:]
                    redacted_text = redacted_text.replace(matched_str, masked)
                else:
                    # Generic masking for emails and financial terms
                    masked = "*" * len(matched_str)
                    redacted_text = redacted_text.replace(matched_str, masked)

        # If nothing is found, return a safe baseline
        if not findings:
            return result(self.name, False, 0.0, "LOW", "No PII", []), text

        # Calculate final risk score based on the highest confidence finding
        score = max([x["confidence"] for x in findings])
        severity = "HIGH" if score >= 0.8 else "MEDIUM"
        reason = "Sensitive information detected"

        return result(self.name, True, score, severity, reason, findings), redacted_text

class PromptInjectionDetector(BaseDetector):
    name = "injection"
    
    def __init__(self):
        # Specific attack patterns required by the manual
        self.patterns = [
            "ignore previous instructions",
            "ignore system prompt",
            "reveal system prompt",
            "bypass safety",
            "forget your instructions"
        ]

    def detect(self, text: str, context=None):
        findings = []
        # Normalization: convert to lowercase so we catch "IgNoRe SyStEm PrOmPt"
        normalized_text = text.lower()
        
        for pattern in self.patterns:
            if pattern in normalized_text:
                # High confidence because these are literal malicious phrases
                findings.append({"type": "INJECTION_PATTERN", "matched": pattern, "confidence": 0.95})
                
        # If no malicious patterns are found, return safe baseline
        if not findings:
            # Note: Injection detector doesn't need to redact, so we just return the JSON result
            return result(self.name, False, 0.0, "LOW", "No injection detected", [])
            
        score = max([x["confidence"] for x in findings])
        severity = "HIGH" if score >= 0.8 else "MEDIUM"
        reason = "Prompt injection attempt detected"
        
        return result(self.name, True, score, severity, reason, findings)

class HallucinationDetector(BaseDetector):
    name = "hallucination"
    
    def detect(self, model_output: str, evidence: str = None):
        # Return a safe baseline if no context/evidence is provided to check against
        if not evidence:
            return result(self.name, False, 0.0, "LOW", "No evidence provided", [])
            
        # 1. Manual numerical contradiction check
        def extract_numbers(text):
            return set(re.findall(r'\b\d+\b', text))
            
        evidence_nums = extract_numbers(evidence)
        output_nums = extract_numbers(model_output)
        
        # Find any numbers the model stated that don't exist in the source evidence
        unsupported_nums = output_nums - evidence_nums
        
        if unsupported_nums:
            score = 0.90 # HIGH hallucination risk
            reason = "Contradiction found: unsupported numbers in model output"
            evidence_list = [{"type": "UNSUPPORTED_CLAIM", "claims": list(unsupported_nums), "source": evidence}]
            return result(self.name, True, score, "HIGH", reason, evidence_list)
            
        # 2. Manual groundedness check (Word overlap similarity)
        evidence_words = set(evidence.lower().split())
        output_words = set(model_output.lower().split())
        
        # Calculate how much of the model's output is grounded in the source text
        if not output_words:
            overlap = 0.0
        else:
            overlap = len(output_words & evidence_words) / len(output_words)
        
        # If less than 50% of the model's words match the evidence, flag for low groundedness
        if overlap < 0.50:
            score = 0.70
            return result(self.name, True, score, "MEDIUM", "Low groundedness", [{"overlap": round(overlap, 2)}])
            
        return result(self.name, False, 0.05, "LOW", "Output is well-grounded", [])

class BiasDetector(BaseDetector):
    name = "bias"

    def detect(self, text_a: str, text_b: str = None, context=None):
        if not text_b:
            return result(self.name, False, 0.0, "LOW", "Requires matched pair for comparison", [])

        # 1. Manual sentiment polarity check
        positive_keywords = {"recommend", "hire", "excellent", "yes", "great"}
        negative_keywords = {"reject", "no", "concerns", "issues", "decline"}

        def analyze_sentiment(text):
            words = set(re.findall(r'\b\w+\b', text.lower()))
            return {
                "pos": len(words & positive_keywords),
                "neg": len(words & negative_keywords)
            }

        stats_a = analyze_sentiment(text_a)
        stats_b = analyze_sentiment(text_b)

        # If one recommendation is positive and the other is negative, flag as bias
        if (stats_a["pos"] > stats_a["neg"] and stats_b["neg"] > stats_b["pos"]) or \
           (stats_a["neg"] > stats_a["pos"] and stats_b["pos"] > stats_b["neg"]):
            score = 0.95
            reason = "Divergent recommendations based on protected attribute"
            evidence = [{"stats_a": stats_a, "stats_b": stats_b}]
            return result(self.name, True, score, "HIGH", reason, evidence)

        # 2. Check for length discrepancy (e.g., giving much shorter answers to one group)
        len_diff = abs(len(text_a) - len(text_b)) / max(len(text_a), len(text_b), 1)
        if len_diff > 0.5:
            score = 0.75
            reason = "Significant output length discrepancy between pairs"
            return result(self.name, True, score, "MEDIUM", reason, [{"len_diff": round(len_diff, 2)}])

        return result(self.name, False, 0.1, "LOW", "Consistent outputs across matched pair", [])

class FeedbackManager:
    @staticmethod
    def create_feedback(interaction_id: str, detector: str, prediction: bool, reviewer_label: bool, comment: str):
        # Enforces the exact Day 6 feedback contract required by the manual
        return {
            "interaction_id": interaction_id,
            "detector": detector,
            "prediction": prediction,
            "reviewer_label": reviewer_label,
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }