from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Control Panel.ai")

@app.get("/health")
def health_check():
    return {"status": "ok"}

class ChatRequest(BaseModel):
    application_id: str
    user_id: str
    message: str

class ChatResponse(BaseModel):
    interaction_id: str
    response: str
    risk: dict
    decision: str
    reasons: list[str]

class LLMGateway:
    def generate(self, prompt: str, context=None) -> str:
        return "This is a mock response from the LLM Gateway."

llm = LLMGateway()

policies_db = {
    "pol_hr": {
        "id": "pol_hr",
        "name": "HR Strict",
        "version": "1.0",
        "config": {
            "pii_action": "BLOCK",
            "hallucination_threshold": 0.70,
            "bias_threshold": 0.60,
            "injection_action": "BLOCK",
            "human_review_threshold": 0.75
        }
    },
    "pol_cs": {
        "id": "pol_cs",
        "name": "Customer Support",
        "version": "1.0",
        "config": {
            "pii_action": "REDACT",
            "hallucination_threshold": 0.70
        }
    }
}

applications_db = {
    "hr_assistant": {
        "id": "hr_assistant",
        "name": "HR Assistant",
        "type": "internal",
        "policy_id": "pol_hr",
        "model": "default-model"
    },
    "customer_support": {
        "id": "customer_support",
        "name": "Customer Support AI",
        "type": "external",
        "policy_id": "pol_cs",
        "model": "default-model"
    },
    "agent_demo": {
        "id": "agent_demo",
        "name": "Agent Demo",
        "type": "agent",
        "policy_id": "pol_hr",
        "model": "default-model"
    }
}

@app.get("/api/applications")
def get_applications():
    return list(applications_db.values())

@app.get("/api/policies")
def get_policies():
    return list(policies_db.values())

@app.post("/api/policies")
def create_policy(policy: dict):
    # Basic mock for Day 2 contract
    policies_db[policy["id"]] = policy
    return {"status": "success", "policy": policy}

@app.put("/api/policies/{policy_id}")
def update_policy(policy_id: str, policy: dict):
    # Basic mock for Day 2 contract
    policies_db[policy_id] = policy
    return {"status": "success", "policy": policy}

def get_application(application_id: str):
    return applications_db.get(application_id)

def get_policy(policy_id: str):
    return policies_db.get(policy_id)

def detect_pii(text: str):
    # A simple mock detector that flags if the word "phone" or "salary" is in the prompt
    if "phone" in text.lower() or "salary" in text.lower():
        return {
            "detected": True,
            "evidence": ["phone", "salary"]
        }
    return {"detected": False, "evidence": []}

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    # 1. Fetch the application context and policy
    app_context = get_application(req.application_id)
    policy = get_policy(app_context["policy_id"])
    
    # 2. Run the Input Guard (PII Detection)
    input_result = detect_pii(req.message)
    
    # 3. Enforce the Policy Decision
    if input_result["detected"]:
        if policy["config"]["pii_action"] == "BLOCK":
            return {
                "interaction_id": "demo-002",
                "response": "Request blocked due to PII violation.",
                "risk": {"privacy": 1.0, "hallucination": 0.0, "bias": 0.0, "security": 0.0, "policy": 1.0, "overall": 1.0},
                "decision": "BLOCK",
                "reasons": ["Sensitive employee information detected"]
            }
        elif policy["config"]["pii_action"] == "REDACT":
            # Simple redaction mock
            safe_message = req.message.replace("phone", "****").replace("salary", "****")
            response = llm.generate(safe_message)
            return {
                "interaction_id": "demo-002",
                "response": f"REDACTED PROMPT SENT: {response}",
                "risk": {"privacy": 0.5, "hallucination": 0.0, "bias": 0.0, "security": 0.0, "policy": 0.5, "overall": 0.5},
                "decision": "EDIT",
                "reasons": ["PII redacted before processing"]
            }

    # 4. Normal Execution if no PII is found
    response = llm.generate(req.message)
    return {
        "interaction_id": "demo-002",
        "response": response,
        "risk": {"privacy": 0.0, "hallucination": 0.0, "bias": 0.0, "security": 0.0, "policy": 0.0, "overall": 0.0},
        "decision": "ALLOW",
        "reasons": []
    }