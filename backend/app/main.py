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

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    response = llm.generate(req.message)
    return {
        "interaction_id": "demo-001",
        "response": response,
        "risk": {
            "privacy": 0.0,
            "hallucination": 0.0,
            "bias": 0.0,
            "security": 0.0,
            "policy": 0.0,
            "overall": 0.0
        },
        "decision": "ALLOW",
        "reasons": []
    }