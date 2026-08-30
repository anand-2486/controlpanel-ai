# ControlPlane.ai 🛡️

> **Enterprise Responsible AI Governance & Real-Time Guardrail Control Plane**

ControlPlane.ai provides automated AI risk evaluation, proactive policy enforcement, PII redaction, prompt injection defense, multi-turn boundary tracking, and human-in-the-loop (HITL) review routing.

---

## ⚡ Quick Start

### 1. Backend (FastAPI + LangGraph)
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (React + Vite + TailwindCSS)
```bash
cd frontend
npm install
npm run dev
```

---

## 🐳 Docker Deployment
```bash
docker compose up -d --build
```