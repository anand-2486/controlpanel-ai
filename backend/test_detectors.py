import json
import os
from app.detectors import PIIDetector, PromptInjectionDetector, HallucinationDetector, BiasDetector

def run_pii_tests():
    detector = PIIDetector()
    file_path = os.path.join("..", "evaluation", "pii_cases.json")
    
    try:
        with open(file_path, "r") as f:
            cases = json.load(f)
    except FileNotFoundError:
        print(f"Could not find {file_path}")
        return

    print("\n--- Running PII Evaluation ---")
    for case in cases:
        result_json, redacted = detector.detect(case["input"])
        passed = (result_json["detected"] == case["expected_detected"])
        print(f"{'✅ PASS' if passed else '❌ FAIL'}: {case['description']}")

def run_injection_tests():
    detector = PromptInjectionDetector()
    file_path = os.path.join("..", "evaluation", "injection_cases.json")
    
    try:
        with open(file_path, "r") as f:
            cases = json.load(f)
    except FileNotFoundError:
        print(f"Could not find {file_path}")
        return

    print("\n--- Running Prompt Injection Evaluation ---")
    for case in cases:
        # Notice we only unpack one variable here, since injection doesn't return redacted text
        result_json = detector.detect(case["input"])
        passed = (result_json["detected"] == case["expected_detected"])
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {case['description']}")
        if result_json["detected"]:
            print(f"  Evidence: {result_json['evidence']}")

def run_hallucination_tests():
    detector = HallucinationDetector()
    file_path = os.path.join("..", "evaluation", "hallucination_cases.json")

    try:
        with open(file_path, "r") as f:
            cases = json.load(f)
    except FileNotFoundError:
        print(f"Could not find {file_path}")
        return

    print("\n--- Running Hallucination Evaluation ---")
    for case in cases:
        # Pass both the model output and the ground-truth evidence to the detector
        result_json = detector.detect(case["model_output"], evidence=case["evidence"])

        # Check if the generated risk severity matches our expected baseline
        passed = (result_json["severity"] == case["expected_risk"])

        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: Output -> '{case['model_output']}'")
        if result_json["detected"]:
            print(f"  Reason: {result_json['reason']}")
            print(f"  Evidence: {result_json['evidence']}")

def run_bias_tests():
    detector = BiasDetector()
    file_path = os.path.join("..", "evaluation", "bias_pairs.json")
    
    try:
        with open(file_path, "r") as f:
            cases = json.load(f)
    except FileNotFoundError:
        print(f"Could not find {file_path}")
        return

    print("\n--- Running Bias Evaluation ---")
    for case in cases:
        # Pass both model outputs to compare them
        result_json = detector.detect(case["model_output_a"], text_b=case["model_output_b"])
        passed = (result_json["detected"] == case["expected_detected"])
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {case['description']}")
        if result_json["detected"]:
            print(f"  Reason: {result_json['reason']}")


if __name__ == "__main__":
    run_pii_tests()
    run_injection_tests()
    run_hallucination_tests()
    run_bias_tests()