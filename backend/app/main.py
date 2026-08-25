import uuid
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Float, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session


SQLALCHEMY_DATABASE_URL = "sqlite:///./controlpanel.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

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
        return f"Mock AI generating based on: {prompt}"

class DBInteraction(Base):
    __tablename__ = "interactions"
    id = Column(String, primary_key=True, index=True)
    app_id = Column(String)
    user_id = Column(String)
    prompt = Column(String)
    response = Column(String)

class DBRiskAssessment(Base):
    __tablename__ = "risk_assessments"
    interaction_id = Column(String, primary_key=True)
    privacy = Column(Float)
    hallucination = Column(Float)
    bias = Column(Float)
    security = Column(Float)
    policy = Column(Float)
    overall = Column(Float)

class DBDecision(Base):
    __tablename__ = "decisions"
    interaction_id = Column(String, primary_key=True)
    action = Column(String)
    reason = Column(String)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
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
    if "phone" in text.lower() or "salary" in text.lower():
        return {
            "detected": True,
            "evidence": ["phone", "salary"]
        }
    return {"detected": False, "evidence": []}

def calculate_risk(results: dict) -> dict:
    overall = (
        0.30 * results.get("privacy", 0.0) +
        0.30 * results.get("hallucination", 0.0) +
        0.15 * results.get("bias", 0.0) +
        0.15 * results.get("security", 0.0) +
        0.10 * results.get("policy", 0.0)
    )
    results["overall"] = round(overall, 2)
    return results

def make_decision(risk_score: float) -> str:
    if risk_score <= 0.30: return "ALLOW"
    if risk_score <= 0.50: return "ALLOW+WARNING"
    if risk_score <= 0.70: return "FLAG"
    if risk_score <= 0.85: return "HUMAN_REVIEW"
    return "BLOCK"

def evaluate_bias(response_text: str) -> float:
    biased_keywords = ["always", "never", "obviously", "stupid", "lazy"]
    if any(word in response_text.lower() for word in biased_keywords):
        return 0.85
    return 0.10 

def evaluate_hallucination(prompt: str, response_text: str) -> float:
    # Simulating a hallucination detector
    if "I don't know" in response_text or "made up" in response_text:
        return 0.90
    if len(response_text) > 200:
        return 0.40
    return 0.05

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    interaction_id = f"int_{uuid.uuid4().hex[:8]}"
    
    app_context = get_application(req.application_id)
    policy = get_policy(app_context["policy_id"])
    
    input_result = detect_pii(req.message)
    
    response_text = ""
    risk_scores = {"privacy": 0.0, "hallucination": 0.0, "bias": 0.0, "security": 0.0, "policy": 0.0}
    reasons = []

    if input_result["detected"]:
        if policy["config"]["pii_action"] == "BLOCK":
            response_text = "Request blocked due to PII violation."
            risk_scores["privacy"] = 1.0
            risk_scores["policy"] = 1.0
            reasons.append("Sensitive information detected")
        elif policy["config"]["pii_action"] == "REDACT":
            safe_message = req.message.replace("phone", "****").replace("salary", "****")
            response_text = llm.generate(safe_message)
            risk_scores["privacy"] = 0.5
            reasons.append("PII redacted")
    else:
        response_text = llm.generate(req.message)

    if response_text != "Request blocked due to PII violation.":
        risk_scores["bias"] = evaluate_bias(response_text)
        risk_scores["hallucination"] = evaluate_hallucination(req.message, response_text)
        
        if risk_scores["bias"] > 0.5:
            reasons.append("High bias detected in AI output")
        if risk_scores["hallucination"] > 0.5:
            reasons.append("Potential hallucination detected")

    final_risk = calculate_risk(risk_scores)
    
    if input_result["detected"]:
        if policy["config"]["pii_action"] == "BLOCK":
            decision = "BLOCK"
        elif policy["config"]["pii_action"] == "REDACT":
            decision = "EDIT"
    else:
        decision = make_decision(final_risk["overall"])

    db_interaction = DBInteraction(id=interaction_id, app_id=req.application_id, user_id=req.user_id, prompt=req.message, response=response_text)
    db_risk = DBRiskAssessment(interaction_id=interaction_id, **final_risk)
    db_decision = DBDecision(interaction_id=interaction_id, action=decision, reason=", ".join(reasons) if reasons else "No violations")

    db.add(db_interaction)
    db.add(db_risk)
    db.add(db_decision)
    db.commit()

    return {
        "interaction_id": interaction_id,
        "response": response_text,
        "risk": final_risk,
        "decision": decision,
        "reasons": reasons
    }

@app.get("/api/interactions")
def get_all_interactions(db: Session = Depends(get_db)):
    interactions = db.query(DBInteraction).all()
    return interactions

@app.get("/api/interactions/{interaction_id}")
def get_interaction_details(interaction_id: str, db: Session = Depends(get_db)):
    interaction = db.query(DBInteraction).filter(DBInteraction.id == interaction_id).first()
    risk = db.query(DBRiskAssessment).filter(DBRiskAssessment.interaction_id == interaction_id).first()
    decision = db.query(DBDecision).filter(DBDecision.interaction_id == interaction_id).first()
    
    if not interaction:
        return {"error": "Interaction not found"}
        
    return {
        "interaction": interaction,
        "risk": risk,
        "decision": decision
    }
