
import os
import re
import uuid
import secrets
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, Session

from app.checker.graph import run_governance_pipeline


# ============================================================
# DATABASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = BASE_DIR / "controlpanel.db"

engine = create_engine(
    f"sqlite:///{DATABASE_PATH}",
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ============================================================
# DATABASE HELPERS
# ============================================================

def table_exists(table: str) -> bool:
    return table in inspect(engine).get_table_names()


def columns(table: str) -> Dict[str, dict]:
    if not table_exists(table):
        return {}
    return {c["name"]: c for c in inspect(engine).get_columns(table)}


def ensure_column(table: str, name: str, definition: str) -> None:
    if not table_exists(table):
        return
    if name not in columns(table):
        with engine.begin() as conn:
            conn.execute(
                text(
                    f'ALTER TABLE "{table}" '
                    f'ADD COLUMN "{name}" {definition}'
                )
            )


def ensure_schema() -> None:
    # Create the core tables if they do not already exist.
    # This is non-destructive: existing tables and data are preserved.
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS applications (
                id VARCHAR PRIMARY KEY,
                owner_id VARCHAR,
                name VARCHAR NOT NULL,
                description TEXT DEFAULT '',
                category VARCHAR DEFAULT 'General'
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS policies (
                id VARCHAR PRIMARY KEY,
                owner_id VARCHAR,
                application_id VARCHAR,
                name VARCHAR NOT NULL,
                description TEXT DEFAULT '',
                active BOOLEAN DEFAULT 1,
                version VARCHAR DEFAULT '1.0',
                pii_action VARCHAR DEFAULT 'BLOCK',
                hallucination_threshold FLOAT DEFAULT 0.70,
                bias_threshold FLOAT DEFAULT 0.60,
                injection_action VARCHAR DEFAULT 'BLOCK',
                human_review_threshold FLOAT DEFAULT 0.75,
                privacy_threshold FLOAT DEFAULT 0.80,
                security_threshold FLOAT DEFAULT 0.80,
                policy_threshold FLOAT DEFAULT 0.70
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS interactions (
                id VARCHAR PRIMARY KEY,
                application_id VARCHAR,
                app_id VARCHAR,
                user_id VARCHAR,
                prompt TEXT,
                message TEXT,
                response TEXT,
                decision VARCHAR DEFAULT 'ALLOW'
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS risk_assessments (
                interaction_id VARCHAR PRIMARY KEY,
                privacy FLOAT DEFAULT 0,
                hallucination FLOAT DEFAULT 0,
                bias FLOAT DEFAULT 0,
                security FLOAT DEFAULT 0,
                policy FLOAT DEFAULT 0,
                overall FLOAT DEFAULT 0,
                evidence TEXT DEFAULT ''
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS decisions (
                interaction_id VARCHAR PRIMARY KEY,
                action VARCHAR DEFAULT 'ALLOW',
                reason TEXT DEFAULT '',
                status VARCHAR DEFAULT 'RESOLVED'
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR PRIMARY KEY,
                email VARCHAR NOT NULL,
                name VARCHAR DEFAULT 'User',
                role VARCHAR DEFAULT 'USER',
                password_hash VARCHAR,
                google_sub VARCHAR,
                picture VARCHAR DEFAULT ''
            )
        """))

    # Existing project databases have changed schema several times.
    # These additions are intentionally non-destructive.
    ensure_column("users", "email", "VARCHAR")
    ensure_column("users", "name", "VARCHAR DEFAULT 'User'")
    ensure_column("users", "role", "VARCHAR DEFAULT 'USER'")
    ensure_column("users", "password_hash", "VARCHAR")
    ensure_column("users", "google_sub", "VARCHAR")
    ensure_column("users", "picture", "VARCHAR DEFAULT ''")

    ensure_column("applications", "owner_id", "VARCHAR")
    ensure_column("applications", "category", "VARCHAR DEFAULT 'General'")

    ensure_column("interactions", "application_id", "VARCHAR")
    ensure_column("interactions", "app_id", "VARCHAR")
    ensure_column("interactions", "user_id", "VARCHAR")
    ensure_column("interactions", "prompt", "TEXT")
    ensure_column("interactions", "message", "TEXT")
    ensure_column("interactions", "response", "TEXT")
    ensure_column("interactions", "decision", "VARCHAR DEFAULT 'ALLOW'")

    ensure_column("risk_assessments", "privacy", "FLOAT DEFAULT 0")
    ensure_column("risk_assessments", "hallucination", "FLOAT DEFAULT 0")
    ensure_column("risk_assessments", "bias", "FLOAT DEFAULT 0")
    ensure_column("risk_assessments", "security", "FLOAT DEFAULT 0")
    ensure_column("risk_assessments", "policy", "FLOAT DEFAULT 0")
    ensure_column("risk_assessments", "overall", "FLOAT DEFAULT 0")
    ensure_column("risk_assessments", "evidence", "TEXT DEFAULT ''")

    ensure_column("decisions", "action", "VARCHAR DEFAULT 'ALLOW'")
    ensure_column("decisions", "reason", "TEXT DEFAULT ''")
    ensure_column("decisions", "status", "VARCHAR DEFAULT 'RESOLVED'")

    ensure_column("policies", "owner_id", "VARCHAR")
    ensure_column("policies", "application_id", "VARCHAR")
    ensure_column("policies", "description", "TEXT DEFAULT ''")
    ensure_column("policies", "active", "BOOLEAN DEFAULT 1")
    ensure_column("policies", "version", "VARCHAR DEFAULT '1.0'")
    ensure_column("policies", "pii_action", "VARCHAR DEFAULT 'BLOCK'")
    ensure_column("policies", "hallucination_threshold", "FLOAT DEFAULT 0.70")
    ensure_column("policies", "bias_threshold", "FLOAT DEFAULT 0.60")
    ensure_column("policies", "injection_action", "VARCHAR DEFAULT 'BLOCK'")
    ensure_column("policies", "human_review_threshold", "FLOAT DEFAULT 0.75")
    ensure_column("policies", "privacy_threshold", "FLOAT DEFAULT 0.80")
    ensure_column("policies", "security_threshold", "FLOAT DEFAULT 0.80")
    ensure_column("policies", "policy_threshold", "FLOAT DEFAULT 0.70")

    ensure_column("users", "password_hash", "VARCHAR")
    ensure_column("users", "google_sub", "VARCHAR")
    ensure_column("users", "picture", "VARCHAR DEFAULT ''")

    # The sessions table is created by this application.
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sessions (
                token VARCHAR PRIMARY KEY,
                user_id VARCHAR NOT NULL
            )
        """))

    # Backfill the two common application-id representations.
    if table_exists("interactions"):
        c = columns("interactions")
        with engine.begin() as conn:
            if "app_id" in c and "application_id" in c:
                conn.execute(text("""
                    UPDATE interactions
                    SET application_id = COALESCE(application_id, app_id)
                    WHERE application_id IS NULL OR application_id = ''
                """))
                conn.execute(text("""
                    UPDATE interactions
                    SET app_id = COALESCE(app_id, application_id)
                    WHERE app_id IS NULL OR app_id = ''
                """))

    if table_exists("interactions"):
        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE interactions
                SET message = COALESCE(message, prompt, '')
                WHERE message IS NULL
            """))

    if table_exists("policies"):
        with engine.begin() as conn:
            # Existing rows created before application_id existed.
            conn.execute(text("""
                UPDATE policies
                SET application_id = (
                    SELECT MIN(id) FROM applications
                )
                WHERE application_id IS NULL OR application_id = ''
            """))


ensure_schema()


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="ControlPlane.ai Governance API",
    version="4.0.0",
)

cors_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = ["*"] if cors_env == "*" else [o.strip() for o in cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True if allowed_origins != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST MODELS
# ============================================================

class InteractionRequest(BaseModel):
    app_id: Optional[str] = None
    application_id: Optional[str] = None
    appId: Optional[str] = None
    applicationId: Optional[str] = None

    user_id: Optional[str] = None
    session_id: Optional[str] = None

    prompt: Optional[str] = None
    message: Optional[str] = None
    text: Optional[str] = None
    content: Optional[str] = None

    ai_response: Optional[str] = None
    context_docs: Optional[List[str]] = None
    history: Optional[List[Dict[str, str]]] = None


class PolicyCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    application_id: Optional[str] = None
    pii_action: Optional[str] = "BLOCK"
    hallucination_threshold: Optional[float] = 0.70
    bias_threshold: Optional[float] = 0.60
    injection_action: Optional[str] = "BLOCK"
    human_review_threshold: Optional[float] = 0.75
    privacy_threshold: Optional[float] = 0.80
    security_threshold: Optional[float] = 0.80
    policy_threshold: Optional[float] = 0.70
    active: Optional[bool] = True
    version: Optional[str] = "1.0"


class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    pii_action: Optional[str] = None
    hallucination_threshold: Optional[float] = None
    bias_threshold: Optional[float] = None
    injection_action: Optional[str] = None
    human_review_threshold: Optional[float] = None
    privacy_threshold: Optional[float] = None
    security_threshold: Optional[float] = None
    policy_threshold: Optional[float] = None
    active: Optional[bool] = None


class ReviewRequest(BaseModel):
    action: str = Field(..., description="ALLOW, BLOCK or EDIT")
    comment: Optional[str] = ""


# ============================================================
# DB DEPENDENCY
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# GENERIC DB UTILITIES
# ============================================================

def safe_value_for_column(column: dict, name: str):
    """Return a non-null fallback for unexpected legacy NOT NULL columns."""
    col_type = str(column.get("type", "")).upper()
    lname = name.lower()

    if "id" in lname:
        return str(uuid.uuid4())
    if "bool" in col_type or lname in {"active", "enabled"}:
        return 1
    if "int" in col_type or "real" in col_type or "float" in col_type:
        return 0
    return ""


def insert_compatible(
    db: Session,
    table: str,
    values: Dict[str, Any],
) -> None:
    """
    Insert into an existing SQLite table while respecting legacy columns.

    This is the important compatibility layer: older versions of the
    project added required columns such as message/application_id/decision.
    We inspect the live database and fill any unexpected NOT NULL columns
    with safe values rather than letting SQLite reject the request.
    """
    live = columns(table)
    if not live:
        raise HTTPException(500, f"Database table '{table}' does not exist")

    payload = {
        k: v for k, v in values.items()
        if k in live and v is not None
    }

    for name, column in live.items():
        if name == "id" and name not in payload:
            payload[name] = str(uuid.uuid4())

        nullable = column.get("nullable", True)
        has_default = column.get("default") is not None
        primary_key = column.get("primary_key", False)

        if (
            not nullable
            and not has_default
            and not primary_key
            and name not in payload
        ):
            payload[name] = safe_value_for_column(column, name)

    names = list(payload.keys())
    quoted_names = ", ".join(f'"{n}"' for n in names)
    placeholders = ", ".join(f":v{i}" for i in range(len(names)))

    params = {f"v{i}": payload[n] for i, n in enumerate(names)}

    db.execute(
        text(
            f'INSERT INTO "{table}" ({quoted_names}) '
            f'VALUES ({placeholders})'
        ),
        params,
    )


def row(db: Session, query: str, params=None):
    return db.execute(text(query), params or {}).mappings().first()


def rows(db: Session, query: str, params=None):
    return db.execute(text(query), params or {}).mappings().all()


# ============================================================
# WORKSPACE
# ============================================================

def seed_workspace(db: Session):
    apps = rows(
        db,
        """
        SELECT *
        FROM applications
        ORDER BY id
        """,
    )

    if not apps:
        app_rows = [
            (
                "app-001",
                "Customer Support AI",
                "AI assistant for customer support conversations",
                "Customer Support",
            ),
            (
                "app-002",
                "HR Assistant",
                "Internal HR question answering assistant",
                "Human Resources",
            ),
            (
                "app-003",
                "Document Analyzer",
                "AI system for analyzing business documents",
                "Document Intelligence",
            ),
        ]

        for app_id, name, description, category in app_rows:
            insert_compatible(
                db,
                "applications",
                {
                    "id": app_id,
                    "owner_id": "admin",
                    "name": name,
                    "description": description,
                    "category": category,
                },
            )

        db.commit()

    apps = rows(
        db,
        """
        SELECT *
        FROM applications
        ORDER BY id
        """,
    )

    default_app_id = apps[0]["id"] if apps else "app-001"

    policies = rows(
        db,
        """
        SELECT *
        FROM policies
        ORDER BY id
        """,
    )

    if not policies:
        insert_compatible(
            db,
            "policies",
            {
                "id": "pol-001",
                "owner_id": "admin",
                "application_id": default_app_id,
                "name": "PII Protection",
                "description": "Detect and protect personally identifiable information.",
                "active": 1,
                "version": "1.0",
                "pii_action": "BLOCK",
                "hallucination_threshold": 0.70,
                "bias_threshold": 0.60,
                "injection_action": "BLOCK",
                "human_review_threshold": 0.75,
                "privacy_threshold": 0.80,
                "security_threshold": 0.80,
                "policy_threshold": 0.70,
            },
        )

        insert_compatible(
            db,
            "policies",
            {
                "id": "pol-002",
                "owner_id": "admin",
                "application_id": default_app_id,
                "name": "HR Strict",
                "description": "Strict governance policy for HR applications.",
                "active": 0,
                "version": "1.0",
                "pii_action": "BLOCK",
                "hallucination_threshold": 0.70,
                "bias_threshold": 0.60,
                "injection_action": "BLOCK",
                "human_review_threshold": 0.75,
                "privacy_threshold": 0.80,
                "security_threshold": 0.80,
                "policy_threshold": 0.70,
            },
        )

        db.commit()


# ============================================================
# DETECTORS
# ============================================================

def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def redact_pii(prompt: str) -> str:
    value = prompt
    value = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "[REDACTED_EMAIL]",
        value,
    )
    value = re.sub(
        r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b",
        "[REDACTED_PHONE]",
        value,
    )
    return value


def detect_privacy(prompt: str) -> Tuple[float, List[str]]:
    lower = prompt.lower()

    evidence = []
    score = 0.0

    patterns = {
        # Actual PII
        "email address":
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",

        "phone number":
            r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b",

        # Requests for personal information
        "phone number request":
            r"\b(phone|mobile|contact)\s*(number|no\.?)\b",

        "email request":
            r"\b(email|mail)\s*(address|id|contact)\b",

        "personal information":
            r"\b(personal|private|sensitive)\s+(information|data|details)\b",

        "home address":
            r"\b(home|residential|personal)\s+address\b",

        "salary information":
            r"\b(salary|compensation|income|earnings|pay)\b",

        "bank information":
            r"\b(bank account|account number|ifsc|routing number)\b",

        "credit card":
            r"\b(credit card|debit card|card number|cvv)\b",

        "government id":
            r"\b(aadhaar|pan card|passport number|social security number|ssn)\b",

        "date of birth":
            r"\b(date of birth|dob|birth date)\b",

        "personal contact":
            r"\b(personal contact|private contact|personal details)\b",
    }

    for label, pattern in patterns.items():

        if re.search(pattern, lower):

            evidence.append(label)
            score = max(score, 0.90)

    return score, list(dict.fromkeys(evidence))

def detect_hallucination(prompt: str) -> Tuple[float, List[str]]:
    lower = prompt.lower()

    evidence = []
    score = 0.0

    # --------------------------------------------------------
    # EXPLICIT FABRICATION
    # --------------------------------------------------------

    fabrication_patterns = [

        (
            "invent information",
            r"\b(invent|make up|fabricate|create)\b.*\b("
            r"information|facts?|data|biography|history|story|"
            r"research|papers?|studies|results?|statistics?)\b"
        ),

        (
            "fake information",
            r"\b(fake|false|made[- ]up|fictional)\b.*\b("
            r"facts?|information|data|research|studies|sources?|"
            r"citations?|papers?)\b"
        ),

        (
            "fabricate sources",
            r"\b(fabricate|invent|make up|create)\b.*\b("
            r"source|sources|citation|citations|reference|references|"
            r"doi|paper|papers)\b"
        ),

        (
            "false information as truth",
            r"\b(present|give|tell|state|show)\b.*\b("
            r"false|fake|invented|made[- ]up|fictional)\b.*\b("
            r"true|real|verified|fact|facts)\b"
        ),

        (
            "ignore verification",
            r"\b(don'?t|do not|without)\b.*\b("
            r"verify|check|fact[- ]check|confirm)\b"
        ),

        (
            "answer without knowing",
            r"\b(answer|respond|tell me)\b.*\b("
            r"even if you don'?t know|"
            r"even if unsure|"
            r"if you don'?t know|"
            r"without knowing)\b"
        ),
    ]

    for label, pattern in fabrication_patterns:

        if re.search(pattern, lower):

            evidence.append(label)
            score = max(score, 0.90)

    # --------------------------------------------------------
    # IMPOSSIBLE / ANACHRONISTIC REQUESTS
    # --------------------------------------------------------

    historical_years = [
        "1500", "1600", "1700", "1800",
        "1850", "1900", "1910", "1920",
        "1930", "1940"
    ]

    modern_entities = [
        "apple",
        "google",
        "microsoft",
        "facebook",
        "instagram",
        "amazon",
        "tesla",
        "openai",
        "chatgpt",
        "iphone",
        "smartphone",
        "internet",
    ]

    has_old_year = any(
        year in lower
        for year in historical_years
    )

    has_modern_entity = any(
        entity in lower
        for entity in modern_entities
    )

    if has_old_year and has_modern_entity:

        evidence.append(
            "potentially impossible historical premise"
        )

        score = max(score, 0.90)

    return score, list(dict.fromkeys(evidence))
def detect_bias(prompt: str) -> Tuple[float, List[str]]:
    lower = prompt.lower()

    evidence = []
    score = 0.0

    # --------------------------------------------------------
    # DIRECT STEREOTYPES
    # --------------------------------------------------------

    stereotype_patterns = [

        (
            "gender stereotype",
            r"\b(women|men|female|male)\b.*\b("
            r"worse|better|bad|good|inferior|superior|"
            r"stupid|smart|weak|strong|lazy|emotional|"
            r"aggressive|naturally)\b"
        ),

        (
            "age stereotype",
            r"\b(older|elderly|young|younger|old people)\b.*\b("
            r"worse|better|bad|good|slow|lazy|"
            r"incapable|incompetent|naturally)\b"
        ),

        (
            "racial stereotype",
            r"\b(race|racial|ethnicity|ethnic|nationality)\b.*\b("
            r"inferior|superior|worse|better|lazy|"
            r"stupid|violent|criminal)\b"
        ),

        (
            "religious stereotype",
            r"\b(religion|religious|muslim|christian|hindu|jewish)\b.*\b("
            r"inferior|superior|worse|better|violent|"
            r"dangerous|stupid)\b"
        ),

        (
            "generalization",
            r"\b(all|every|most|those)\b.*\b("
            r"men|women|people|immigrants|"
            r"older people|young people|"
            r"muslims|christians|hindus)\b"
        ),
    ]

    for label, pattern in stereotype_patterns:

        if re.search(pattern, lower):

            evidence.append(label)
            score = max(score, 0.90)

    # --------------------------------------------------------
    # DISCRIMINATORY DECISION MAKING
    # --------------------------------------------------------

    discrimination_patterns = [

        (
            "discriminatory hiring",
            r"\b(hire|hiring|reject|fire|promote|select)\b.*\b("
            r"because of|based on|only because|"
            r"due to)\b.*\b("
            r"gender|sex|race|religion|nationality|"
            r"age|disability|women|men|female|male)\b"
        ),

        (
            "gender-based selection",
            r"\b(hire|select|choose|reject)\b.*\b("
            r"only men|only women|men only|women only|"
            r"male candidates|female candidates)\b"
        ),

        (
            "discrimination request",
            r"\b(discriminate|discrimination|biased|bias against)\b"
        ),
    ]

    for label, pattern in discrimination_patterns:

        if re.search(pattern, lower):

            evidence.append(label)
            score = max(score, 0.90)

    return score, list(dict.fromkeys(evidence))
def detect_security(prompt: str) -> Tuple[float, List[str]]:
    lower = prompt.lower()
    evidence = []
    score = 0.0

    patterns = [
        # Prompt injection / instruction override
        ("prompt injection", r"\b(ignore|disregard|override)\b.*\b(all\s+)?(previous|prior|above)\s+(instructions?|rules?|policies?)\b"),
        ("prompt injection", r"\b(ignore|disregard|override)\b.*\b(your|the)\s+(instructions?|safety|rules?|policies?)\b"),
        ("developer-mode jailbreak", r"\b(developer|dev|jailbreak)\s+mode\b"),
        ("safety bypass", r"\b(disable|bypass|circumvent|remove)\b.*\b(safety|security|governance|guardrails?|checks?)\b"),

        # Secret/system extraction
        ("system prompt extraction", r"\b(reveal|show|print|give me|disclose|dump)\b.*\b(system prompt|system instructions|hidden instructions|developer instructions)\b"),
        ("credential extraction", r"\b(reveal|show|give me|disclose|dump)\b.*\b(api key|api keys|password|credentials|secret key|tokens?)\b"),
        ("environment secret extraction", r"\b(reveal|show|dump|give me)\b.*\b(environment variables|env variables|\.env|secrets?)\b"),

        # Cyber abuse
        ("bypass authentication", r"\bbypass\s+(authentication|auth|login|2fa|mfa)\b"),
        ("credential theft", r"\b(steal|capture|harvest)\b.*\b(passwords?|credentials?|login details)\b"),
        ("ransomware", r"\bransomware\b"),
        ("malware", r"\b(deploy|write|create|build)\b.*\bmalware\b"),
        ("keylogger", r"\bkeylogger\b"),
        ("phishing", r"\b(phishing|credential harvesting)\b"),
        ("ddos", r"\b(ddos|denial[- ]of[- ]service)\b"),
        ("sql injection", r"\bsql\s+injection\b"),
        ("server exploitation", r"\b(exploit|hack|break into)\b.*\b(server|system|website|account|database)\b"),
    ]

    for label, pattern in patterns:
        if re.search(pattern, lower):
            evidence.append(label)
            score = max(score, 0.95)

    return score, evidence


def detect_policy(prompt: str) -> Tuple[float, List[str]]:
    lower = prompt.lower()
    evidence = []
    score = 0.0

    phrases = [
        "credit card fraud",
        "bank fraud",
        "commit fraud",
        "steal money",
        "steal someone's identity",
        "make a bomb",
        "build a bomb",
        "buy illegal weapons",
    ]

    for phrase in phrases:
        if phrase in lower:
            evidence.append(phrase)
            score = max(score, 0.90)

    return score, evidence


def evaluate_prompt(prompt: str):
    p, pe = detect_privacy(prompt)
    h, he = detect_hallucination(prompt)
    b, be = detect_bias(prompt)
    s, se = detect_security(prompt)
    pol, pole = detect_policy(prompt)

    risk = {
        "privacy": clamp(p),
        "hallucination": clamp(h),
        "bias": clamp(b),
        "security": clamp(s),
        "policy": clamp(pol),
    }
    risk["overall"] = max(risk.values())

    evidence = {
        "privacy": pe,
        "hallucination": he,
        "bias": be,
        "security": se,
        "policy": pole,
    }

    return risk, evidence


def calculate_decision(
    risk: Dict[str, float]
):

    # ========================================================
    # SECURITY
    # ========================================================

    if risk["security"] >= 0.80:

        return (
            "BLOCK",
            "High security risk detected",
        )
    if risk["privacy"] >= 0.80:

        return (
            "BLOCK",
            "Potential sensitive personal information detected",
        )

    if risk["policy"] >= 0.80:

        return (
            "BLOCK",
            "Potentially prohibited or unsafe request detected",
        )

    if risk["bias"] >= 0.70:

        return (
            "BLOCK",
            "Potential biased or discriminatory content detected",
        )


    # ========================================================
    # HALLUCINATION
    # ========================================================

    if risk["hallucination"] >= 0.70:

        return (
            "HUMAN_REVIEW",
            "Potential hallucination or unsupported factual claim detected",
        )
    


    # ========================================================
    # MODERATE RISK
    # ========================================================

    if risk["overall"] >= 0.40:

        return (
            "FLAG",
            "Moderate governance risk detected",
        )


    # ========================================================
    # SAFE
    # ========================================================

    return (
        "ALLOW",
        "No significant governance risk detected",
    )
# ============================================================
# INTERACTION SERIALIZATION
# ============================================================

# ============================================================
# INTERACTION SERIALIZATION
# ============================================================

def serialize_interaction(
    interaction,
    risk=None,
    decision=None,
    evidence=None,
    workflow_trace=None,
    multi_turn_risk=None,
    latency_ms=None,
):
    risk_data = {
        "privacy": float(risk.get("privacy") or 0) if risk else 0.0,
        "hallucination": float(risk.get("hallucination") or 0) if risk else 0.0,
        "bias": float(risk.get("bias") or 0) if risk else 0.0,
        "security": float(risk.get("security") or 0) if risk else 0.0,
        "policy": float(risk.get("policy") or 0) if risk else 0.0,
        "overall": float(risk.get("overall") or 0) if risk else 0.0,
    }

    action = (decision or {}).get("action") or interaction.get("decision") or "UNKNOWN"
    reason = (decision or {}).get("reason") or ""
    status = (decision or {}).get("status") or ""

    prompt = interaction.get("prompt") or interaction.get("message") or ""
    app_id = interaction.get("application_id") or interaction.get("app_id") or ""

    return {
        "success": True,
        "id": interaction.get("id"),
        "interaction_id": interaction.get("id"),
        "application_id": app_id,
        "app_id": app_id,
        "user_id": interaction.get("user_id"),
        "prompt": prompt,
        "message": prompt,
        "response": interaction.get("response") or "",
        "ai_response": interaction.get("response") or "",
        "redacted_prompt": redact_pii(prompt),
        "risk": risk_data,
        "risk_scores": risk_data,
        "overall_risk": risk_data["overall"],
        "multi_turn_risk": multi_turn_risk or {"score": 0.0, "turns_analyzed": 0, "evidence": []},
        "decision": action,
        "action": action,
        "decision_reason": reason,
        "reason": reason,
        "status": status,
        "workflow_trace": workflow_trace or [],
        "latency_ms": latency_ms or 0.0,
        "evidence": evidence or {
            "privacy": [],
            "hallucination": [],
            "bias": [],
            "security": [],
            "policy": [],
            "multi_turn": [],
        },
        "reasons": [reason] if reason else [],
    }


# ============================================================
# INTERACTION ENGINE (LangGraph Powered)
# ============================================================

def process_interaction(
    payload: InteractionRequest,
    db: Session,
):
    app_id = (
        payload.app_id
        or payload.application_id
        or payload.appId
        or payload.applicationId
    )

    prompt = (
        payload.prompt
        or payload.message
        or payload.text
        or payload.content
    )

    if not app_id:
        first_app = row(db, "SELECT * FROM applications ORDER BY id LIMIT 1")
        if first_app:
            app_id = first_app["id"]
        else:
            app_id = "app-001"

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="prompt or message is required",
        )

    prompt = prompt.strip()

    if not prompt:
        raise HTTPException(
            status_code=400,
            detail="Prompt cannot be empty",
        )

    if len(prompt) > 4000:
        raise HTTPException(
            status_code=400,
            detail="Prompt cannot exceed 4000 characters",
        )

    application = row(
        db,
        """
        SELECT *
        FROM applications
        WHERE id = :id
        LIMIT 1
        """,
        {"id": app_id},
    )

    if not application:
        application = row(db, "SELECT * FROM applications ORDER BY id LIMIT 1")
        if application:
            app_id = application["id"]
        else:
            application = {"name": "AI Application", "id": app_id}

    # Fetch active policy for this application from database
    policy_row = row(
        db,
        """
        SELECT *
        FROM policies
        WHERE application_id = :app_id AND active = 1
        ORDER BY id
        LIMIT 1
        """,
        {"app_id": app_id},
    )

    if not policy_row:
        policy_row = row(
            db,
            """
            SELECT *
            FROM policies
            ORDER BY id
            LIMIT 1
            """,
        )

    policy_dict = dict(policy_row) if policy_row else {}
    policy_dict["name"] = application.get("name", "Enterprise AI")

    # Execute LangGraph Pipeline
    pipeline_result = run_governance_pipeline(
        prompt=prompt,
        ai_response=payload.ai_response,
        context_docs=payload.context_docs,
        conversation_history=payload.history,
        application_id=app_id,
        policy=policy_dict,
    )

    action = pipeline_result["decision"]
    reason = pipeline_result["decision_reason"]
    risk = pipeline_result["composite_risk"]
    evidence = pipeline_result["evidence"]
    response_text = pipeline_result["safe_response"]
    workflow_trace = pipeline_result["workflow_trace"]
    multi_turn_risk = pipeline_result["multi_turn_risk"]
    total_latency_ms = pipeline_result["total_latency_ms"]

    interaction_id = str(uuid.uuid4())

    insert_compatible(
        db,
        "interactions",
        {
            "id": interaction_id,
            "application_id": app_id,
            "app_id": app_id,
            "user_id": payload.user_id or "system",
            "prompt": prompt,
            "message": prompt,
            "decision": action,
            "response": response_text,
        },
    )

    insert_compatible(
        db,
        "risk_assessments",
        {
            "interaction_id": interaction_id,
            "privacy": risk.get("privacy", 0.0),
            "hallucination": risk.get("hallucination", 0.0),
            "bias": risk.get("bias", 0.0),
            "security": risk.get("security", 0.0),
            "policy": risk.get("overall", 0.0),
            "overall": risk.get("overall", 0.0),
            "evidence": str(evidence),
        },
    )

    insert_compatible(
        db,
        "decisions",
        {
            "interaction_id": interaction_id,
            "action": action,
            "reason": reason,
            "status": (
                "PENDING"
                if action == "HUMAN_REVIEW"
                else "RESOLVED"
            ),
        },
    )

    db.commit()

    interaction = row(
        db,
        'SELECT * FROM interactions WHERE id = :id',
        {"id": interaction_id},
    )

    return serialize_interaction(
        interaction,
        risk,
        {
            "action": action,
            "reason": reason,
            "status": (
                "PENDING"
                if action == "HUMAN_REVIEW"
                else "RESOLVED"
            ),
        },
        evidence,
        workflow_trace=workflow_trace,
        multi_turn_risk=multi_turn_risk,
        latency_ms=total_latency_ms,
    )


# ============================================================
# BASIC
# ============================================================

@app.get("/")
def root():
    return {
        "success": True,
        "message": "ControlPlane.ai Governance API is running",
    }


@app.get("/health")
@app.get("/api/health")
@app.get("/healthz")
def health():
    return {"status": "ok"}


# ============================================================
# AUTHENTICATION & GOOGLE FIREBASE OAUTH
# ============================================================

FIREBASE_KEY_PATH = BASE_DIR / "firebase-service-account.json"
firebase_app = None

try:
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth

    if not firebase_admin._apps:
        if FIREBASE_KEY_PATH.exists():
            cred = credentials.Certificate(str(FIREBASE_KEY_PATH))
            firebase_app = firebase_admin.initialize_app(cred)
        else:
            firebase_app = firebase_admin.initialize_app()
    else:
        firebase_app = firebase_admin.get_app()
except Exception as e:
    print(f"Firebase Admin initialization info: {e}")


def verify_firebase_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify Firebase ID token via Admin SDK with Google API fallback."""
    if not token:
        return None

    # Method 1: Firebase Admin SDK
    try:
        from firebase_admin import auth as fb_auth
        decoded = fb_auth.verify_id_token(token)
        if decoded:
            return decoded
    except Exception:
        pass

    # Method 2: Google Tokeninfo Endpoint
    try:
        import requests
        resp = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
            timeout=5.0
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass

    # Method 3: Unverified JWT Decode fallback (for local dev)
    try:
        import jwt
        decoded = jwt.decode(token, options={"verify_signature": False})
        if decoded and ("sub" in decoded or "user_id" in decoded):
            return decoded
    except Exception:
        pass

    return None


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Extracts the current user from Authorization header.
    Returns authenticated user or guest structure.
    """
    if not authorization:
        return {
            "id": "guest",
            "name": "Guest User",
            "email": "",
            "role": "GUEST",
            "isGuest": True,
        }

    token = authorization.replace("Bearer ", "").strip()
    if not token or token == "guest" or token.startswith("guest_"):
        return {
            "id": "guest",
            "name": "Guest User",
            "email": "",
            "role": "GUEST",
            "isGuest": True,
        }

    session_row = row(
        db,
        "SELECT * FROM sessions WHERE token = :token LIMIT 1",
        {"token": token},
    )

    if not session_row:
        return {
            "id": "guest",
            "name": "Guest User",
            "email": "",
            "role": "GUEST",
            "isGuest": True,
        }

    user_row = row(
        db,
        "SELECT * FROM users WHERE id = :id LIMIT 1",
        {"id": session_row["user_id"]},
    )

    if not user_row:
        return {
            "id": "guest",
            "name": "Guest User",
            "email": "",
            "role": "GUEST",
            "isGuest": True,
        }

    return {
        "id": user_row["id"],
        "name": user_row.get("name") or "Enterprise User",
        "email": user_row.get("email") or "",
        "role": user_row.get("role") or "ADMIN",
        "picture": user_row.get("picture") or "",
        "isGuest": False,
    }


class GoogleAuthRequest(BaseModel):
    credential: str


@app.post("/api/auth/google")
def auth_google(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
):
    decoded = verify_firebase_token(payload.credential)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid Google authentication token")

    google_sub = decoded.get("sub") or decoded.get("uid") or decoded.get("user_id") or str(uuid.uuid4())
    email = decoded.get("email") or f"{google_sub}@google.user"
    name = decoded.get("name") or decoded.get("displayName") or email.split("@")[0]
    picture = decoded.get("picture") or decoded.get("photoURL") or ""

    user = row(
        db,
        "SELECT * FROM users WHERE email = :email OR google_sub = :sub LIMIT 1",
        {"email": email, "sub": google_sub},
    )

    if not user:
        user_id = str(uuid.uuid4())
        insert_compatible(
            db,
            "users",
            {
                "id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "google_sub": google_sub,
                "role": "ADMIN",
            },
        )
        db.commit()
        user = row(db, "SELECT * FROM users WHERE id = :id", {"id": user_id})
    else:
        user_id = user["id"]
        with engine.begin() as conn:
            conn.execute(
                text(
                    'UPDATE users SET name = :name, picture = :picture, google_sub = :sub WHERE id = :id'
                ),
                {"name": name, "picture": picture, "sub": google_sub, "id": user_id},
            )
        user = row(db, "SELECT * FROM users WHERE id = :id", {"id": user_id})

    # Create persistent session
    token = secrets.token_urlsafe(32)
    insert_compatible(
        db,
        "sessions",
        {
            "token": token,
            "user_id": user_id,
        },
    )
    db.commit()

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role") or "ADMIN",
            "picture": user.get("picture") or "",
            "isGuest": False,
        },
    }


@app.post("/api/auth/guest")
def auth_guest():
    """Generate temporary guest session token."""
    guest_id = "guest_" + secrets.token_hex(4)
    guest_token = "guest_" + secrets.token_urlsafe(16)
    return {
        "success": True,
        "token": guest_token,
        "user": {
            "id": guest_id,
            "name": "Guest User",
            "email": "",
            "role": "GUEST",
            "picture": "",
            "isGuest": True,
        },
    }


@app.get("/api/auth/me")
def auth_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return {
        "success": True,
        "user": current_user,
    }


@app.post("/api/auth/logout")
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM sessions WHERE token = :token"), {"token": token})
    return {"success": True}


# ============================================================
# APPLICATIONS
# ============================================================

@app.get("/api/applications")
def get_applications(
    db: Session = Depends(get_db),
):
    apps = rows(
        db,
        """
        SELECT id, name, description, category
        FROM applications
        ORDER BY id
        """,
    )

    return [
        {
            "id": a["id"],
            "name": a["name"],
            "description": a.get("description") or "",
            "category": a.get("category") or "General",
        }
        for a in apps
    ]


@app.get("/api/applications/{app_id}")
def get_application(
    app_id: str,
    db: Session = Depends(get_db),
):
    application = row(
        db,
        """
        SELECT id, name, description, category
        FROM applications
        WHERE id = :id
        LIMIT 1
        """,
        {"id": app_id},
    )

    if not application:
        raise HTTPException(404, "Application not found")

    return {
        "id": application["id"],
        "name": application["name"],
        "description": application.get("description") or "",
        "category": application.get("category") or "General",
    }


# ============================================================
# CHAT / INTERACTIONS
# ============================================================

@app.post("/api/chat")
def chat(
    payload: InteractionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.user_id:
        payload.user_id = current_user.get("id", "guest")
    return process_interaction(payload, db)


@app.post("/api/interactions")
def create_interaction(
    payload: InteractionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.user_id:
        payload.user_id = current_user.get("id", "guest")
    return process_interaction(payload, db)


@app.get("/api/interactions")
def get_interactions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Guest users do NOT have persistent chat history across page refreshes
    if current_user.get("isGuest"):
        return []

    interactions = rows(
        db,
        """
        SELECT *
        FROM interactions
        ORDER BY rowid DESC
        """,
    )

    result = []

    for interaction in interactions:
        rid = interaction["id"]

        risk = row(
            db,
            "SELECT * FROM risk_assessments "
            "WHERE interaction_id = :id LIMIT 1",
            {"id": rid},
        )

        decision = row(
            db,
            "SELECT * FROM decisions "
            "WHERE interaction_id = :id LIMIT 1",
            {"id": rid},
        )

        risk_data = {
            "privacy": float((risk or {}).get("privacy") or 0),
            "hallucination": float((risk or {}).get("hallucination") or 0),
            "bias": float((risk or {}).get("bias") or 0),
            "security": float((risk or {}).get("security") or 0),
            "policy": float((risk or {}).get("policy") or 0),
            "overall": float((risk or {}).get("overall") or 0),
        }

        result.append(
            serialize_interaction(
                interaction,
                risk_data,
                decision,
            )
        )

    return result


@app.get("/api/interactions/{interaction_id}")
def get_interaction(
    interaction_id: str,
    db: Session = Depends(get_db),
):
    interaction = row(
        db,
        """
        SELECT *
        FROM interactions
        WHERE id = :id
        LIMIT 1
        """,
        {
            "id": interaction_id,
        },
    )

    if not interaction:
        raise HTTPException(404, "Interaction not found")

    risk = row(
        db,
        "SELECT * FROM risk_assessments "
        "WHERE interaction_id = :id LIMIT 1",
        {"id": interaction_id},
    )

    decision = row(
        db,
        "SELECT * FROM decisions "
        "WHERE interaction_id = :id LIMIT 1",
        {"id": interaction_id},
    )

    risk_data = {
        "privacy": float((risk or {}).get("privacy") or 0),
        "hallucination": float((risk or {}).get("hallucination") or 0),
        "bias": float((risk or {}).get("bias") or 0),
        "security": float((risk or {}).get("security") or 0),
        "policy": float((risk or {}).get("policy") or 0),
        "overall": float((risk or {}).get("overall") or 0),
    }

    return serialize_interaction(
        interaction,
        risk_data,
        decision,
    )


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def dashboard(
    db: Session = Depends(get_db),
):
    interactions = rows(
        db,
        """
        SELECT *
        FROM interactions
        ORDER BY rowid DESC
        """,
    )

    total = len(interactions)
    allowed = flagged = blocked = human_review = 0
    low = medium = high = 0
    privacy = hallucination = bias = security = policy = 0
    recent = []

    for interaction in interactions:
        decision = row(
            db,
            "SELECT * FROM decisions "
            "WHERE interaction_id = :id LIMIT 1",
            {"id": interaction["id"]},
        )
        risk = row(
            db,
            "SELECT * FROM risk_assessments "
            "WHERE interaction_id = :id LIMIT 1",
            {"id": interaction["id"]},
        )

        action = (decision or {}).get("action") or interaction.get("decision") or "UNKNOWN"
        overall = float((risk or {}).get("overall") or 0)

        if action == "ALLOW":
            allowed += 1
        elif action == "BLOCK":
            blocked += 1
        elif action == "HUMAN_REVIEW":
            human_review += 1
        else:
            flagged += 1

        if overall <= 0.30:
            low += 1
        elif overall <= 0.70:
            medium += 1
        else:
            high += 1

        if risk:
            privacy += int(float(risk.get("privacy") or 0) >= 0.70)
            hallucination += int(float(risk.get("hallucination") or 0) >= 0.70)
            bias += int(float(risk.get("bias") or 0) >= 0.70)
            security += int(float(risk.get("security") or 0) >= 0.70)
            policy += int(float(risk.get("policy") or 0) >= 0.70)

        if len(recent) < 10:
            recent.append(
                serialize_interaction(
                    interaction,
                    {
                        "privacy": float((risk or {}).get("privacy") or 0),
                        "hallucination": float((risk or {}).get("hallucination") or 0),
                        "bias": float((risk or {}).get("bias") or 0),
                        "security": float((risk or {}).get("security") or 0),
                        "policy": float((risk or {}).get("policy") or 0),
                        "overall": overall,
                    },
                    decision,
                )
            )

    divisor = total or 1

    return {
        "total_requests": total,
        "allowed": allowed,
        "flagged": flagged,
        "blocked": blocked,
        "human_review": human_review,
        "risk_distribution": {
            "low": low,
            "medium": medium,
            "high": high,
            "low_percent": round(low / divisor * 100, 1),
            "medium_percent": round(medium / divisor * 100, 1),
            "high_percent": round(high / divisor * 100, 1),
        },
        "top_violations": {
            "privacy": privacy,
            "hallucination": hallucination,
            "bias": bias,
            "security": security,
            "policy": policy,
        },
        "recent_interactions": recent,
    }


# ============================================================
# CLEAR GOVERNANCE HISTORY
# ============================================================

@app.delete("/api/history")
def clear_history(
    db: Session = Depends(get_db),
):
    try:
        db.execute(text("DELETE FROM decisions"))
        db.execute(text("DELETE FROM risk_assessments"))
        db.execute(text("DELETE FROM interactions"))
        db.commit()

        return {
            "success": True,
            "message": "Governance history cleared successfully.",
        }

    except Exception as error:
        db.rollback()
        print("Clear history error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to clear governance history.",
        )


# ============================================================
# POLICIES
# ============================================================

@app.post("/api/policies")
def create_policy(
    payload: PolicyCreate,
    db: Session = Depends(get_db),
):
    policy_id = str(uuid.uuid4())
    insert_compatible(
        db,
        "policies",
        {
            "id": policy_id,
            "name": payload.name,
            "description": payload.description or "",
            "application_id": payload.application_id or "",
            "pii_action": payload.pii_action or "BLOCK",
            "hallucination_threshold": clamp(payload.hallucination_threshold or 0.70),
            "bias_threshold": clamp(payload.bias_threshold or 0.60),
            "injection_action": payload.injection_action or "BLOCK",
            "human_review_threshold": clamp(payload.human_review_threshold or 0.75),
            "privacy_threshold": clamp(payload.privacy_threshold or 0.80),
            "security_threshold": clamp(payload.security_threshold or 0.80),
            "policy_threshold": clamp(payload.policy_threshold or 0.70),
            "active": 1 if payload.active else 0,
            "version": payload.version or "1.0",
        },
    )
    db.commit()
    return get_policy(policy_id, db)


@app.get("/api/policies")
def get_policies(
    db: Session = Depends(get_db),
):
    policies = rows(
        db,
        """
        SELECT *
        FROM policies
        ORDER BY id
        """,
    )

    return [
        {
            "id": p["id"],
            "name": p.get("name") or "",
            "description": p.get("description") or "",
            "active": bool(p.get("active", 1)),
            "version": p.get("version") or "1.0",
            "pii_action": p.get("pii_action") or "BLOCK",
            "hallucination_threshold": p.get("hallucination_threshold") or 0.70,
            "bias_threshold": p.get("bias_threshold") or 0.60,
            "injection_action": p.get("injection_action") or "BLOCK",
            "human_review_threshold": p.get("human_review_threshold") or 0.75,
            "privacy_threshold": p.get("privacy_threshold") or 0.80,
            "security_threshold": p.get("security_threshold") or 0.80,
            "policy_threshold": p.get("policy_threshold") or 0.70,
        }
        for p in policies
    ]


@app.get("/api/policies/{policy_id}")
def get_policy(
    policy_id: str,
    db: Session = Depends(get_db),
):
    p = row(
        db,
        """
        SELECT *
        FROM policies
        WHERE id = :id
        LIMIT 1
        """,
        {"id": policy_id},
    )

    if not p:
        raise HTTPException(404, "Policy not found")

    return {
        "id": p["id"],
        "name": p.get("name") or "",
        "description": p.get("description") or "",
        "active": bool(p.get("active", 1)),
        "version": p.get("version") or "1.0",
        "pii_action": p.get("pii_action") or "BLOCK",
        "hallucination_threshold": p.get("hallucination_threshold") or 0.70,
        "bias_threshold": p.get("bias_threshold") or 0.60,
        "injection_action": p.get("injection_action") or "BLOCK",
        "human_review_threshold": p.get("human_review_threshold") or 0.75,
        "privacy_threshold": p.get("privacy_threshold") or 0.80,
        "security_threshold": p.get("security_threshold") or 0.80,
        "policy_threshold": p.get("policy_threshold") or 0.70,
    }


@app.put("/api/policies/{policy_id}")
@app.patch("/api/policies/{policy_id}")
def update_policy(
    policy_id: str,
    payload: PolicyUpdate,
    db: Session = Depends(get_db),
):
    p = row(
        db,
        """
        SELECT *
        FROM policies
        WHERE id = :id
        LIMIT 1
        """,
        {"id": policy_id},
    )

    if not p:
        raise HTTPException(404, "Policy not found")

    values = payload.model_dump(exclude_none=True)

    for key in [
        "hallucination_threshold",
        "bias_threshold",
        "human_review_threshold",
        "privacy_threshold",
        "security_threshold",
        "policy_threshold",
    ]:
        if key in values:
            values[key] = clamp(values[key])

    live = columns("policies")
    updates = {
        k: v for k, v in values.items()
        if k in live
    }

    if updates:
        assignments = ", ".join(
            f'"{k}" = :{k}'
            for k in updates
        )
        db.execute(
            text(
                f'UPDATE policies SET {assignments} '
                'WHERE id = :policy_id'
            ),
            {
                **updates,
                "policy_id": policy_id,
            },
        )
        db.commit()

    return {
        "success": True,
        "policy": get_policy(
            policy_id,
            db,
        ),
    }


# ============================================================
# INCIDENTS
# ============================================================

@app.get("/api/incidents")
def incidents(
    db: Session = Depends(get_db),
):
    interactions = rows(
        db,
        """
        SELECT *
        FROM interactions
        ORDER BY rowid DESC
        """,
    )

    result = []

    for interaction in interactions:
        decision = row(
            db,
            "SELECT * FROM decisions "
            "WHERE interaction_id = :id LIMIT 1",
            {"id": interaction["id"]},
        )

        if not decision:
            continue

        if decision.get("action") == "ALLOW":
            continue

        risk = row(
            db,
            "SELECT * FROM risk_assessments "
            "WHERE interaction_id = :id LIMIT 1",
            {"id": interaction["id"]},
        )

        result.append({
            "id": interaction["id"],
            "interaction_id": interaction["id"],
            "application_id": interaction.get("application_id") or interaction.get("app_id"),
            "app_id": interaction.get("application_id") or interaction.get("app_id"),
            "user_id": interaction.get("user_id"),
            "prompt": interaction.get("prompt") or interaction.get("message") or "",
            "response": interaction.get("response") or "",
            "decision": decision.get("action"),
            "status": decision.get("status"),
            "reason": decision.get("reason") or "",
            "risk": {
                "privacy": float((risk or {}).get("privacy") or 0),
                "hallucination": float((risk or {}).get("hallucination") or 0),
                "bias": float((risk or {}).get("bias") or 0),
                "security": float((risk or {}).get("security") or 0),
                "policy": float((risk or {}).get("policy") or 0),
                "overall": float((risk or {}).get("overall") or 0),
            },
        })

    return result


# ============================================================
# HUMAN REVIEW
# ============================================================

@app.get("/api/human-review")
def human_review_queue(
    db: Session = Depends(get_db),
):
    return [
        incident
        for incident in incidents(db)
        if incident["decision"] == "HUMAN_REVIEW"
    ]


@app.post("/api/human-review/{interaction_id}/approve")
def approve_review(
    interaction_id: str,
    db: Session = Depends(get_db),
):
    interaction = row(
        db,
        """
        SELECT * FROM interactions
        WHERE id = :id
        LIMIT 1
        """,
        {
            "id": interaction_id,
        },
    )

    if not interaction:
        raise HTTPException(404, "Interaction not found")

    db.execute(
        text("""
            UPDATE decisions
            SET action = 'ALLOW',
                status = 'RESOLVED',
                reason = 'Approved by human reviewer'
            WHERE interaction_id = :id
        """),
        {"id": interaction_id},
    )

    if "decision" in columns("interactions"):
        db.execute(
            text("""
                UPDATE interactions
                SET decision = 'ALLOW'
                WHERE id = :id
            """),
            {"id": interaction_id},
        )

    db.commit()

    return {
        "success": True,
        "interaction_id": interaction_id,
        "decision": "ALLOW",
        "status": "RESOLVED",
    }


@app.post("/api/human-review/{interaction_id}/reject")
def reject_review(
    interaction_id: str,
    db: Session = Depends(get_db),
):
    interaction = row(
        db,
        """
        SELECT * FROM interactions
        WHERE id = :id
        LIMIT 1
        """,
        {
            "id": interaction_id,
        },
    )

    if not interaction:
        raise HTTPException(404, "Interaction not found")

    db.execute(
        text("""
            UPDATE decisions
            SET action = 'BLOCK',
                status = 'RESOLVED',
                reason = 'Rejected by human reviewer'
            WHERE interaction_id = :id
        """),
        {"id": interaction_id},
    )

    if "decision" in columns("interactions"):
        db.execute(
            text("""
                UPDATE interactions
                SET decision = 'BLOCK'
                WHERE id = :id
            """),
            {"id": interaction_id},
        )

    db.commit()

    return {
        "success": True,
        "interaction_id": interaction_id,
        "decision": "BLOCK",
        "status": "RESOLVED",
    }


@app.post("/api/human-review/{interaction_id}/edit")
def edit_review(
    interaction_id: str,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
):
    if payload.action not in {"ALLOW", "BLOCK", "EDIT"}:
        raise HTTPException(
            400,
            "action must be ALLOW, BLOCK or EDIT",
        )

    interaction = row(
        db,
        """
        SELECT * FROM interactions
        WHERE id = :id
        LIMIT 1
        """,
        {
            "id": interaction_id,
        },
    )

    if not interaction:
        raise HTTPException(404, "Interaction not found")

    db.execute(
        text("""
            UPDATE decisions
            SET action = :action,
                status = 'RESOLVED',
                reason = :reason
            WHERE interaction_id = :id
        """),
        {
            "action": payload.action,
            "reason": payload.comment or f"{payload.action} by human reviewer",
            "id": interaction_id,
        },
    )

    if "decision" in columns("interactions"):
        db.execute(
            text("""
                UPDATE interactions
                SET decision = :action
                WHERE id = :id
            """),
            {
                "action": payload.action,
                "id": interaction_id,
            },
        )

    db.commit()

    return {
        "success": True,
        "interaction_id": interaction_id,
        "decision": payload.action,
        "status": "RESOLVED",
        "reason": payload.comment or f"{payload.action} by human reviewer",
    }


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    ensure_schema()
    with SessionLocal() as db:
        try:
            seed_workspace(db)
        except Exception as exc:
            db.rollback()
            print("Workspace seeding warning:", exc)

