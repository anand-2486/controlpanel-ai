import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  GitBranch,
  History as HistoryIcon,
  Layers,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react"


// ============================================================
// API
// ============================================================

const API_URL = `http://${window.location.hostname || "127.0.0.1"}:8000`


function getToken() {
  return (
    localStorage.getItem("controlpanel_token") ||
    sessionStorage.getItem("controlpanel_token") ||
    ""
  )
}


async function apiRequest(path, options = {}) {
  const token = getToken()

  const headers = {
    Accept: "application/json",
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let response

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      }
    )
  } catch {
    throw new Error(
      `Cannot reach the backend at ${API_URL}. Make sure Uvicorn is running on port 8000.`
    )
  }

  const contentType =
    response.headers.get("content-type") || ""

  let data

  try {
    if (
      contentType.includes(
        "application/json"
      )
    ) {
      data = await response.json()
    } else {
      const text = await response.text()
      data = text
        ? { detail: text }
        : {}
    }
  } catch {
    data = {}
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Your session has expired. Please sign in again."
      )
    }

    if (response.status === 403) {
      throw new Error(
        "You do not have permission to access this resource."
      )
    }

    const detail =
      Array.isArray(data?.detail)
        ? data.detail
            .map((item) => {
              const location =
                Array.isArray(item?.loc)
                  ? item.loc.join(" → ")
                  : "request"

              return `${location}: ${
                item?.msg ||
                "Validation error"
              }`
            })
            .join("\n")
        : data?.detail ||
          data?.message

    throw new Error(
      detail ||
        `Backend request failed (${response.status}).`
    )
  }

  return data
}


// ============================================================
// GOVERNANCE HELPERS
// ============================================================

function getResultValue(
  result,
  keys = []
) {
  for (const key of keys) {
    const value = result?.[key]

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return value
    }
  }

  return ""
}


function getPolicyCategory(
  result,
  prompt = ""
) {
  const raw = [
    getResultValue(result, [
      "policy_type",
      "policyType",
      "category",
      "policy_category",
      "policyCategory",
      "violation_type",
      "violationType",
      "risk_type",
      "riskType",
      "policy",
      "rule",
    ]),

    getResultValue(result, [
      "reason",
      "detail",
      "message",
      "response",
      "explanation",
    ]),

    prompt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()


  if (
    raw.includes("privacy") ||
    raw.includes("personal data") ||
    raw.includes("personal information") ||
    raw.includes("pii") ||
    raw.includes("personally identifiable") ||
    raw.includes("sensitive data") ||
    raw.includes("phone number") ||
    raw.includes("email address") ||
    raw.includes("home address") ||
    raw.includes("date of birth") ||
    raw.includes("aadhaar") ||
    raw.includes("passport") ||
    raw.includes("bank account") ||
    raw.includes("credit card")
  ) {
    return "Privacy"
  }


  if (
    raw.includes("security") ||
    raw.includes("credential") ||
    raw.includes("password") ||
    raw.includes("secret") ||
    raw.includes("api key") ||
    raw.includes("malware") ||
    raw.includes("exploit")
  ) {
    return "Security"
  }


  if (
    raw.includes("financial") ||
    raw.includes("finance") ||
    raw.includes("investment") ||
    raw.includes("fraud") ||
    raw.includes("transaction")
  ) {
    return "Financial"
  }


  if (
    raw.includes("harm") ||
    raw.includes("violence") ||
    raw.includes("self-harm") ||
    raw.includes("abuse")
  ) {
    return "Safety"
  }


  if (
    raw.includes("toxic") ||
    raw.includes("harassment") ||
    raw.includes("hate speech")
  ) {
    return "Content Safety"
  }


  if (
    raw.includes("bias") ||
    raw.includes("discriminat")
  ) {
    return "Bias & Fairness"
  }


  if (
    raw.includes("hallucination") ||
    raw.includes("unsupported") ||
    raw.includes("fabricated") ||
    raw.includes("unverified")
  ) {
    return "Hallucination"
  }


  return "General Governance"
}


function getDecision(result) {
  const raw = String(
    result?.decision ||
      result?.action ||
      ""
  )
    .trim()
    .toUpperCase()

  if (
    raw === "BLOCK" ||
    raw === "BLOCKED" ||
    raw === "DENY" ||
    raw === "DENIED" ||
    raw === "REJECT" ||
    raw === "REJECTED"
  ) {
    return "BLOCKED"
  }

  if (
    raw === "HUMAN_REVIEW" ||
    raw === "HUMAN REVIEW" ||
    raw === "REVIEW" ||
    raw === "FLAG"
  ) {
    return "HUMAN_REVIEW"
  }

  if (
    raw === "ALLOW" ||
    raw === "ALLOWED" ||
    raw === "APPROVE" ||
    raw === "APPROVED"
  ) {
    return "ALLOWED"
  }

  return "UNKNOWN"
}


/*
 * HUMAN REVIEW RULES
 *
 * Human review is used when the request can potentially be handled,
 * but the final decision has meaningful consequences for a person or
 * requires context/authorization that the AI should not decide alone.
 *
 * Examples: hiring/admissions decisions, lending/insurance decisions,
 * employment actions, eligibility decisions, or other high-impact
 * decisions about an individual.
 */
function requiresHumanReview(prompt = "") {
  const text = String(prompt).toLowerCase().trim()

  if (!text) return false

  const highImpactTerms = [
    "hire",
    "hiring",
    "candidate",
    "job applicant",
    "recruitment",
    "employment decision",
    "fire this employee",
    "terminate this employee",
    "promote this employee",
    "admission",
    "admissions",
    "admit this student",
    "reject this student",
    "college applicant",
    "loan approval",
    "approve this loan",
    "reject this loan",
    "credit decision",
    "creditworthiness",
    "insurance eligibility",
    "insurance claim",
    "deny this claim",
    "approve this claim",
    "benefits eligibility",
    "eligibility decision",
    "government benefit",
    "housing application",
    "tenant screening",
    "medical treatment decision",
    "diagnosis decision",
    "patient eligibility",
    "risk score this person",
    "score this person",
    "rank these people",
    "decide who should be selected",
    "decide who should be rejected"
  ]

  return highImpactTerms.some((term) =>
    text.includes(term)
  )
}


function getHumanReviewReason(prompt = "") {
  const text = String(prompt).toLowerCase()

  if (
    text.includes("hire") ||
    text.includes("candidate") ||
    text.includes("employment") ||
    text.includes("employee") ||
    text.includes("recruitment")
  ) {
    return "This request involves an employment decision that can significantly affect an individual and requires human judgment."
  }

  if (
    text.includes("admission") ||
    text.includes("student") ||
    text.includes("college applicant")
  ) {
    return "This request involves an admissions decision affecting an individual and requires human judgment."
  }

  if (
    text.includes("loan") ||
    text.includes("credit") ||
    text.includes("insurance") ||
    text.includes("benefits") ||
    text.includes("eligibility")
  ) {
    return "This request involves a high-impact eligibility or financial decision and requires human review before a final decision."
  }

  if (
    text.includes("medical") ||
    text.includes("diagnosis") ||
    text.includes("patient") ||
    text.includes("treatment")
  ) {
    return "This request could affect an individual's health-related outcome and requires qualified human judgment."
  }

  return "This request involves a consequential decision that should not be made solely by an AI system."
}


// ============================================================
// NORMALIZE GOVERNANCE RESULT
// ============================================================

function normalizeGovernanceResult(
  data,
  prompt
) {
  const result = {
    ...(data || {}),
  }


  /*
   * IMPORTANT:
   *
   * This keeps the privacy protection you already added.
   * If the backend ever sends a stale ALLOWED result for
   * an obvious privacy request, the frontend still identifies
   * the category from the prompt/evidence.
   */

  const category =
    getPolicyCategory(
      result,
      prompt
    )


  let decision =
    getDecision(result)

  /*
   * Do not turn a backend BLOCKED decision into HUMAN_REVIEW.
   * For otherwise allowed/unknown requests, route high-impact
   * decisions to a human instead of letting the AI make the final call.
   */
  if (
    decision !== "BLOCKED" &&
    requiresHumanReview(prompt)
  ) {
    decision = "HUMAN_REVIEW"
    result.decision = "HUMAN_REVIEW"
    result.action = "HUMAN_REVIEW"
    result.decision_reason =
      result?.decision_reason ||
      getHumanReviewReason(prompt)
  }


  result._category = category


  /*
   * Do not override a real backend BLOCK/REVIEW decision.
   *
   * But if the backend response itself contains privacy
   * evidence, keep Privacy as the displayed category.
   */

  if (
    category === "Privacy" &&
    result?.evidence?.privacy
  ) {
    result._category = "Privacy"
  }


  result._prompt = prompt
  result._decision = decision


  return result
}


// ============================================================
// CONVERSATION MESSAGE HELPERS
// ============================================================

function createUserMessage(
  text
) {
  return {
    id:
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`,

    role: "user",

    content: text,

    createdAt:
      new Date().toISOString(),
  }
}


function createAssistantMessage(
  result,
  prompt
) {
  return {
    id:
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`,

    role: "assistant",

    content:
      result?.response ||
      result?.ai_response ||
      result?.message ||
      result?.reason ||
      result?.decision_reason ||
      "Governance evaluation completed.",

    governance: result,

    prompt,

    createdAt:
      new Date().toISOString(),
  }
}


// ============================================================
// LOCAL CONVERSATION STORAGE
// ============================================================

const STORAGE_KEY =
  "controlpanel_playground_conversations"


function loadSavedConversations() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      )

    if (!raw) return []

    const parsed =
      JSON.parse(raw)

    return Array.isArray(parsed)
      ? parsed
      : []
  } catch {
    return []
  }
}


function saveConversations(
  conversations
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        conversations
      )
    )
  } catch (error) {
    console.error(
      "Could not save conversations:",
      error
    )
  }
}


// ============================================================
// LANGGRAPH WORKFLOW TRACE VISUALIZER
// ============================================================

function LangGraphWorkflowVisualizer({
  trace = [],
  latency = 0,
  multiTurnRisk = null,
}) {
  const [expanded, setExpanded] = useState(true)

  if (!trace || trace.length === 0) return null

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="font-mono text-[11px] text-violet-600 dark:text-violet-400">
            LangGraph Execution Pipeline
          </span>
          <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {trace.length} nodes
          </span>
        </div>

        <div className="flex items-center gap-2">
          {latency > 0 && (
            <span className="font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              ⚡ {latency}ms
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {expanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200/70 p-3 dark:border-slate-800/80">
          <div className="relative space-y-2 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
            {trace.map((step, idx) => {
              const isBlocked =
                step.status === "BLOCK" || step.status === "BLOCKED"
              const isWarning =
                step.status === "WARNING" || step.status === "HUMAN_REVIEW"
              const isPassed =
                step.status === "PASSED" || step.status === "ALLOW"

              const dotColor = isBlocked
                ? "bg-red-500 ring-4 ring-red-100 dark:ring-red-950"
                : isWarning
                  ? "bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950"
                  : isPassed
                    ? "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950"
                    : "bg-violet-500 ring-4 ring-violet-100 dark:ring-violet-950"

              return (
                <div key={idx} className="relative flex items-start gap-3 pl-1">
                  <div
                    className={`relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`}
                  />
                  <div className="flex-1 rounded-lg border border-slate-200/60 bg-white p-2 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {step.node_name}
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span
                          className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                            isBlocked
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : isWarning
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {step.status}
                        </span>
                        <span className="text-slate-400">
                          {step.duration_ms}ms
                        </span>
                      </div>
                    </div>

                    {step.evidence && step.evidence.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {step.evidence.join(" • ")}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {multiTurnRisk && multiTurnRisk.turns_analyzed > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
              <span className="font-medium">
                Multi-Turn History Window:
              </span>
              <span className="font-mono">
                {multiTurnRisk.turns_analyzed} turns (Compound Risk:{" "}
                {Math.round(multiTurnRisk.score * 100)}%)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ============================================================
// GOVERNANCE CARD
// ============================================================

function GovernanceCard({ result }) {
  const decision = getDecision(result)
  const category = result?._category || getPolicyCategory(result, result?._prompt)
  const risk = result?.risk || result?.risk_scores || {}
  const evidence = result?.evidence || {}
  const trace = result?.workflow_trace || []
  const multiTurnRisk = result?.multi_turn_risk || null
  const latency = result?.latency_ms || 0

  // ── Human Review state ────────────────────────────────────
  const [reviewStatus, setReviewStatus] = useState(null) // null | 'approved' | 'rejected' | 'editing'
  const [editText, setEditText] = useState("")
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState("")

  const interactionId =
    result?.interaction_id ||
    result?.id ||
    result?.governance?.interaction_id ||
    null

  async function handleApprove() {
    if (!interactionId) { setReviewError("No interaction ID found — cannot approve."); return }
    setReviewLoading(true); setReviewError("")
    try {
      await apiRequest(`/api/human-review/${interactionId}/approve`, { method: "POST" })
      setReviewStatus("approved")
    } catch (e) {
      setReviewError(e?.message || "Approval failed.")
    } finally { setReviewLoading(false) }
  }

  async function handleReject() {
    if (!interactionId) { setReviewError("No interaction ID found — cannot reject."); return }
    setReviewLoading(true); setReviewError("")
    try {
      await apiRequest(`/api/human-review/${interactionId}/reject`, { method: "POST" })
      setReviewStatus("rejected")
    } catch (e) {
      setReviewError(e?.message || "Rejection failed.")
    } finally { setReviewLoading(false) }
  }

  async function handleEditRelease() {
    if (!interactionId) { setReviewError("No interaction ID found."); return }
    setReviewLoading(true); setReviewError("")
    try {
      await apiRequest(`/api/human-review/${interactionId}/edit`, {
        method: "POST",
        body: JSON.stringify({ action: "ALLOW", comment: editText || "Edited and released by reviewer" }),
      })
      setReviewStatus("edited")
    } catch (e) {
      setReviewError(e?.message || "Edit & release failed.")
    } finally { setReviewLoading(false) }
  }

  const blocked = decision === "BLOCKED" || decision === "BLOCK"
  const review = decision === "HUMAN_REVIEW" || decision === "REVIEW"

  const categoryEvidence =
    category === "Privacy"
      ? evidence.privacy
      : category === "Security"
        ? evidence.security
        : category === "Policy Safety"
          ? evidence.policy
          : category === "Bias & Fairness"
            ? evidence.bias
            : category === "Hallucination"
              ? evidence.hallucination
              : []

  const reason =
    result?.decision_reason ||
    result?.reason ||
    result?.detail ||
    result?.explanation ||
    result?.response ||
    "Governance evaluation completed."

  const border = blocked
    ? "border-red-200 dark:border-red-900/60"
    : review
      ? "border-amber-200 dark:border-amber-900/60"
      : "border-emerald-200 dark:border-emerald-900/60"

  const header = blocked
    ? "bg-red-50 dark:bg-red-950/30"
    : review
      ? "bg-amber-50 dark:bg-amber-950/30"
      : "bg-emerald-50 dark:bg-emerald-950/30"

  const title = blocked
    ? "text-red-700 dark:text-red-300"
    : review
      ? "text-amber-700 dark:text-amber-300"
      : "text-emerald-700 dark:text-emerald-300"

  return (
    <div
      className={`
        mt-3
        overflow-hidden
        rounded-xl
        border
        ${border}
        bg-white
        shadow-sm
        dark:bg-slate-900
      `}
    >
      {/* HEADER */}
      <div className={`border-b px-4 py-3 ${header}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {blocked ? (
              <LockKeyhole
                size={16}
                className="text-red-600 dark:text-red-400"
              />
            ) : review ? (
              <AlertTriangle
                size={16}
                className="text-amber-600 dark:text-amber-400"
              />
            ) : (
              <CheckCircle2
                size={16}
                className="text-emerald-600 dark:text-emerald-400"
              />
            )}

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Governance decision
              </p>
              <p className={`text-sm font-bold ${title}`}>
                {decision === "HUMAN_REVIEW" ? "HUMAN REVIEW" : decision}
              </p>
            </div>
          </div>

          <span
            className={`
              rounded-full
              px-2.5
              py-1
              text-[9px]
              font-bold
              uppercase
              tracking-wide
              ${
                blocked
                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                  : review
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              }
            `}
          >
            {category}
          </span>
        </div>
      </div>

      {/* BODY */}
      <div className="p-4">
        <p className={`text-xs leading-5 ${title}`}>
          {blocked
            ? `This interaction was blocked because it triggered the ${category.toLowerCase()} governance policy.`
            : review
              ? "This interaction requires human review because it involves a consequential decision that should not be made solely by an AI system."
              : "This interaction passed the governance checks."}
        </p>

        {/* REASON */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Evaluation details
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {String(reason)}
          </p>
        </div>

        {/* HUMAN-IN-THE-LOOP ACTION PANEL */}
        {review && (
          <div style={{ marginTop: "12px", borderRadius: "10px", border: "1px solid #fbbf24", background: "#fffbeb", padding: "14px" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#92400e", marginBottom: "10px" }}>
              Reviewer Actions
            </p>

            {/* RESOLVED STATE */}
            {reviewStatus === "approved" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#d1fae5", borderRadius: "8px", padding: "10px 12px" }}>
                <CheckCircle2 size={14} style={{ color: "#059669" }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#065f46" }}>Approved — interaction released to user.</span>
              </div>
            )}
            {reviewStatus === "rejected" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fee2e2", borderRadius: "8px", padding: "10px 12px" }}>
                <LockKeyhole size={14} style={{ color: "#dc2626" }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#991b1b" }}>Rejected — interaction blocked.</span>
              </div>
            )}
            {reviewStatus === "edited" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#d1fae5", borderRadius: "8px", padding: "10px 12px" }}>
                <CheckCircle2 size={14} style={{ color: "#059669" }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#065f46" }}>Edited & released — updated response sent.</span>
              </div>
            )}

            {/* ACTION BUTTONS */}
            {!reviewStatus && (
              <>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {/* APPROVE */}
                  <button
                    onClick={handleApprove}
                    disabled={reviewLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                      background: "#059669", color: "#fff", fontSize: "12px", fontWeight: 700,
                      opacity: reviewLoading ? 0.6 : 1,
                    }}
                  >
                    <CheckCircle2 size={13} />
                    {reviewLoading ? "Processing…" : "Approve & Release"}
                  </button>

                  {/* REJECT */}
                  <button
                    onClick={handleReject}
                    disabled={reviewLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                      background: "#dc2626", color: "#fff", fontSize: "12px", fontWeight: 700,
                      opacity: reviewLoading ? 0.6 : 1,
                    }}
                  >
                    <LockKeyhole size={13} />
                    {reviewLoading ? "Processing…" : "Reject & Block"}
                  </button>

                  {/* TOGGLE EDIT */}
                  <button
                    onClick={() => setReviewStatus(reviewStatus === "editing" ? null : "editing")}
                    disabled={reviewLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "7px 14px", borderRadius: "8px", cursor: "pointer",
                      background: "transparent", border: "1.5px solid #d97706", color: "#d97706",
                      fontSize: "12px", fontWeight: 700, opacity: reviewLoading ? 0.6 : 1,
                    }}
                  >
                    <Sparkles size={13} />
                    Edit & Release
                  </button>
                </div>

                {/* EDIT AREA */}
                {reviewStatus === "editing" && (
                  <div style={{ marginTop: "10px" }}>
                    <textarea
                      rows={3}
                      placeholder="Write an edited safe response for the user, then click Release…"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      style={{
                        width: "100%", borderRadius: "8px", border: "1px solid #fcd34d",
                        padding: "8px 10px", fontSize: "12px", resize: "vertical",
                        background: "#fff", color: "#1e293b", outline: "none", boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={handleEditRelease}
                      disabled={reviewLoading}
                      style={{
                        marginTop: "8px", padding: "7px 16px", borderRadius: "8px",
                        background: "#d97706", color: "#fff", border: "none",
                        fontSize: "12px", fontWeight: 700, cursor: "pointer",
                        opacity: reviewLoading ? 0.6 : 1,
                      }}
                    >
                      {reviewLoading ? "Releasing…" : "Confirm & Release"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ERROR */}
            {reviewError && (
              <p style={{ marginTop: "8px", fontSize: "11px", color: "#dc2626" }}>{reviewError}</p>
            )}
          </div>
        )}

        {/* EVIDENCE */}
        {Array.isArray(categoryEvidence) && categoryEvidence.length > 0 && (

          <div className="mt-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Detected evidence
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categoryEvidence.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className={`
                    rounded-full
                    px-2
                    py-1
                    text-[9px]
                    font-medium
                    ${
                      blocked
                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }
                  `}
                >
                  {String(item)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* LANGGRAPH WORKFLOW TRACE */}
        {trace && trace.length > 0 && (
          <LangGraphWorkflowVisualizer
            trace={trace}
            latency={latency}
            multiTurnRisk={multiTurnRisk}
          />
        )}

        {/* RISK SCORES */}
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {[
            ["Privacy", risk.privacy],
            ["Security", risk.security],
            ["Policy", risk.policy],
            ["Bias", risk.bias],
            ["Halluc.", risk.hallucination],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/70"
            >
              <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {Math.round(Number(value || 0) * 100)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


// ============================================================
// CHAT MESSAGE
// ============================================================

function ChatMessage({
  item,
}) {
  const isUser =
    item.role === "user"


  return (
    <div
      className={`
        flex
        gap-3
        ${
          isUser
            ? "justify-end"
            : "justify-start"
        }
      `}
    >

      {!isUser && (
        <div
          className="
            mt-1
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-violet-100
            text-violet-600
            dark:bg-violet-950/50
            dark:text-violet-300
          "
        >
          <Sparkles size={15} />
        </div>
      )}


      <div
        className={`
          max-w-[82%]
          ${
            isUser
              ? "items-end"
              : "items-start"
          }
        `}
      >

        <div
          className={`
            rounded-2xl
            px-4
            py-3
            text-sm
            leading-6

            ${
              isUser
                ? "rounded-br-md bg-violet-600 text-white"
                : "rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }
          `}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{item.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 style={{ fontSize: "1.15em", fontWeight: 700, marginBottom: "0.5em", marginTop: "0.75em" }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: "1.05em", fontWeight: 700, marginBottom: "0.4em", marginTop: "0.65em" }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: "0.97em", fontWeight: 700, marginBottom: "0.35em", marginTop: "0.55em", color: "#7c3aed" }}>{children}</h3>,
                p: ({ children }) => <p style={{ marginBottom: "0.6em", lineHeight: 1.65 }}>{children}</p>,
                strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                ul: ({ children }) => <ul style={{ paddingLeft: "1.3em", marginBottom: "0.6em", listStyleType: "disc" }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: "1.3em", marginBottom: "0.6em", listStyleType: "decimal" }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: "0.2em", lineHeight: 1.6 }}>{children}</li>,
                hr: () => <hr style={{ margin: "0.75em 0", borderColor: "#e2e8f0" }} />,
                code: ({ inline, children }) =>
                  inline ? (
                    <code style={{ background: "#f1f5f9", borderRadius: "4px", padding: "1px 5px", fontSize: "0.85em", fontFamily: "monospace", color: "#7c3aed" }}>{children}</code>
                  ) : (
                    <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75em 1em", overflowX: "auto", marginBottom: "0.6em" }}>
                      <code style={{ fontSize: "0.82em", fontFamily: "monospace" }}>{children}</code>
                    </pre>
                  ),
                table: ({ children }) => (
                  <div style={{ overflowX: "auto", marginBottom: "0.75em" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead style={{ background: "#f1f5f9" }}>{children}</thead>,
                th: ({ children }) => <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: "5px 12px", borderBottom: "1px solid #e2e8f0" }}>{children}</td>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid #7c3aed", paddingLeft: "0.8em", color: "#64748b", marginBottom: "0.6em", fontStyle: "italic" }}>{children}</blockquote>,
              }}
            >
              {item.content}
            </ReactMarkdown>
          )}
        </div>


        {!isUser &&
          item.governance && (
            <GovernanceCard
              result={
                item.governance
              }
            />
          )}

      </div>


      {isUser && (
        <div
          className="
            mt-1
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-slate-200
            text-slate-500
            dark:bg-slate-800
            dark:text-slate-400
          "
        >
          <User size={15} />
        </div>
      )}

    </div>
  )
}


// ============================================================
// HISTORY ITEM
// ============================================================

function HistoryItem({
  conversation,
  active,
  onClick,
}) {
  const lastUserMessage =
    [...(conversation.messages || [])]
      .reverse()
      .find(
        (item) =>
          item.role ===
          "user"
      )


  const firstUserMessage =
    (conversation.messages || [])
      .find(
        (item) =>
          item.role ===
          "user"
      )


  const title =
    conversation.title ||
    firstUserMessage?.content ||
    lastUserMessage?.content ||
    "New conversation"


  const messageCount =
    conversation.messages?.length ||
    0


  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full
        rounded-xl
        border
        p-3
        text-left
        transition

        ${
          active
            ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
            : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
        }
      `}
    >

      <div className="flex gap-3">

        <div
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-slate-100
            text-slate-500
            dark:bg-slate-800
            dark:text-slate-400
          "
        >
          <MessageSquare
            size={14}
          />
        </div>


        <div className="min-w-0 flex-1">

          <p
            className="
              line-clamp-2
              text-xs
              font-medium
              text-slate-800
              dark:text-slate-200
            "
          >
            {title}
          </p>


          <div className="mt-2 flex items-center gap-2">

            <span className="text-[9px] text-slate-400 dark:text-slate-500">
              {messageCount}{" "}
              {messageCount ===
              1
                ? "message"
                : "messages"}
            </span>

          </div>

        </div>

      </div>

    </button>
  )
}


// ============================================================
// PLAYGROUND
// ============================================================

function Playground() {

  const [message, setMessage] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [
    applications,
    setApplications,
  ] = useState([])

  const [
    selectedApplication,
    setSelectedApplication,
  ] = useState(null)

  const [error, setError] =
    useState("")

  const [
    loadingApplications,
    setLoadingApplications,
  ] = useState(true)


  // ==========================================================
  // CHAT
  // ==========================================================

  const [
    conversations,
    setConversations,
  ] = useState(
    loadSavedConversations
  )


  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState(null)


  const [
    messages,
    setMessages,
  ] = useState([])


  // ==========================================================
  // HISTORY
  // ==========================================================

  const [
    historyOpen,
    setHistoryOpen,
  ] = useState(false)


  const [
    historySearch,
    setHistorySearch,
  ] = useState("")


  const [
    selectedHistoryId,
    setSelectedHistoryId,
  ] = useState(null)


  const [
    history,
    setHistory,
  ] = useState([])


  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(false)


  const [
    historyError,
    setHistoryError,
  ] = useState("")


  const messagesEndRef =
    useRef(null)


  // ==========================================================
  // SAVE LOCAL CONVERSATIONS
  // ==========================================================

  useEffect(() => {
    saveConversations(
      conversations
    )
  }, [conversations])


  // ==========================================================
  // SCROLL TO BOTTOM
  // ==========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    )
  }, [messages, loading])


  // ==========================================================
  // LOAD APPLICATIONS
  // ==========================================================

  useEffect(() => {

    let cancelled = false


    async function loadApplications() {

      try {

        setLoadingApplications(
          true
        )

        setError("")


        const data =
          await apiRequest(
            "/api/applications"
          )


        if (cancelled) return


        const list =
          Array.isArray(data)
            ? data
            : []


        setApplications(list)


        setSelectedApplication(
          list[0] || null
        )


        if (list.length === 0) {
          setError(
            "No AI application is available yet."
          )
        }

      } catch (err) {

        if (cancelled) return


        console.error(
          "Applications error:",
          err
        )


        setApplications([])

        setSelectedApplication(
          null
        )


        setError(
          err?.message ||
            "Could not load applications."
        )

      } finally {

        if (!cancelled) {
          setLoadingApplications(
            false
          )
        }

      }

    }


    loadApplications()


    return () => {
      cancelled = true
    }

  }, [])


  // ==========================================================
  // LOAD BACKEND HISTORY
  // ==========================================================

  async function loadHistory() {

    try {
      setHistoryError("")


      const data =
        await apiRequest(
          "/api/interactions"
        )


      const list =
        Array.isArray(data)
          ? data
          : []


      setHistory(list)

    } catch (err) {

      console.error(
        "History loading error:",
        err
      )


      setHistoryError(
        err?.message ||
          "Could not load history."
      )

    } finally {

      setHistoryLoading(false)

    }

  }


  useEffect(() => {
    loadHistory()
  }, [])


  // ==========================================================
  // FILTER BACKEND HISTORY
  // ==========================================================

  const filteredBackendHistory =
    useMemo(() => {

      const query =
        historySearch
          .trim()
          .toLowerCase()


      if (!query) {
        return history
      }


      return history.filter(
        (item) => {

          const prompt =
            String(
              item?.prompt ||
                item?.input ||
                item?.message ||
                ""
            ).toLowerCase()


          const category =
            getPolicyCategory(
              item,
              prompt
            ).toLowerCase()


          const decision =
            getDecision(
              item
            ).toLowerCase()


          return (
            prompt.includes(
              query
            ) ||
            category.includes(
              query
            ) ||
            decision.includes(
              query
            )
          )

        }
      )

    }, [
      history,
      historySearch,
    ])


  // ==========================================================
  // NEW CHAT
  // ==========================================================

  function handleNewChat() {

    const id =
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`


    const newConversation = {
      id,

      title: "New conversation",

      messages: [],

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    }


    setConversations(
      (previous) => [
        newConversation,
        ...previous,
      ]
    )


    setActiveConversationId(
      id
    )

    setMessages([])

    setMessage("")

    setError("")

    setSelectedHistoryId(
      null
    )

  }


  // ==========================================================
  // GET / CREATE ACTIVE CONVERSATION
  // ==========================================================

  function ensureConversation() {

    if (activeConversationId) {
      return activeConversationId
    }


    const id =
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`


    const newConversation = {
      id,

      title: "New conversation",

      messages: [],

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    }


    setConversations(
      (previous) => [
        newConversation,
        ...previous,
      ]
    )


    setActiveConversationId(
      id
    )


    return id
  }


  // ==========================================================
  // UPDATE ACTIVE CONVERSATION
  // ==========================================================

  function updateConversation(
    conversationId,
    nextMessages
  ) {

    setConversations(
      (previous) =>
        previous.map(
          (conversation) => {

            if (
              conversation.id !==
              conversationId
            ) {
              return conversation
            }


            const firstUser =
              nextMessages.find(
                (item) =>
                  item.role ===
                  "user"
              )


            return {
              ...conversation,

              title:
                firstUser?.content ||
                conversation.title ||
                "New conversation",

              messages:
                nextMessages,

              updatedAt:
                new Date().toISOString(),
            }

          }
        )
    )

  }


  // ==========================================================
  // AI / GOVERNANCE ADAPTER
  // ==========================================================

  /*
   * ===========================================================
   *
   * THIS IS THE ONLY PART YOUR PARTNER NEEDS TO CHANGE LATER.
   *
   * Right now it calls your existing governance endpoint.
   *
   * Later:
   *
   * 1. Send conversationMessages to the AI model.
   * 2. Get the AI response.
   * 3. Pass the AI response through governance.
   * 4. Return the same result shape.
   *
   * The chat UI does NOT need to change.
   *
   * ===========================================================
   */

  async function callAI({
    prompt,
    conversationMessages,
    applicationId,
  }) {
    const history = (conversationMessages || [])
      .slice(-10)
      .map((m) => ({
        role: m.role || (m.type === "user" ? "user" : "assistant"),
        content: m.content || m.text || m.prompt || "",
      }))
      .filter((m) => m.content)

    const data = await apiRequest("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        app_id: applicationId,
        application_id: applicationId,
        prompt,
        message: prompt,
        history,
        conversation: conversationMessages,
        messages: conversationMessages,
      }),
    })

    return data
  }


  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  async function handleSendMessage() {

    const prompt =
      message.trim()


    if (
      !prompt ||
      loading
    ) {
      return
    }


    const applicationId =
      selectedApplication?.id ||
      selectedApplication?.application_id ||
      applications?.[0]?.id ||
      "app-001"


    const conversationId =
      ensureConversation()


    const userMessage =
      createUserMessage(
        prompt
      )


    /*
     * Add user message immediately.
     */

    const messagesBeforeSend =
      [
        ...messages,
        userMessage,
      ]


    setMessages(
      messagesBeforeSend
    )


    updateConversation(
      conversationId,
      messagesBeforeSend
    )


    setMessage("")

    setError("")

    setLoading(true)


    try {

      /*
       * Send the COMPLETE conversation
       * to the adapter.
       *
       * Your current backend can ignore
       * the extra conversation field.
       */

      const data =
        await callAI({
          prompt,

          conversationMessages:
            messagesBeforeSend,

          applicationId,
        })


      console.log(
        "GOVERNANCE RESPONSE:",
        data
      )


      /*
       * Keep your existing normalization.
       */

      const normalized =
        normalizeGovernanceResult(
          data,
          prompt
        )


      const assistantMessage =
        createAssistantMessage(
          normalized,
          prompt
        )


      const nextMessages =
        [
          ...messagesBeforeSend,
          assistantMessage,
        ]


      setMessages(
        nextMessages
      )


      updateConversation(
        conversationId,
        nextMessages
      )


      /*
       * Refresh backend history because
       * /api/chat creates an interaction.
       */

      loadHistory()

    } catch (err) {

      console.error(
        "Chat error:",
        err
      )


      setError(
        err?.message ||
          "Something went wrong while processing the request."
      )

    } finally {

      setLoading(false)

    }

  }


  // ==========================================================
  // ENTER
  // ==========================================================

  function handleKeyDown(event) {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault()

      handleSendMessage()

    }

  }


  // ==========================================================
  // OPEN LOCAL CONVERSATION
  // ==========================================================

  function openConversation(
    conversation
  ) {

    setActiveConversationId(
      conversation.id
    )


    setMessages(
      conversation.messages ||
        []
    )


    setMessage("")

    setError("")

    setSelectedHistoryId(
      conversation.id
    )

  }


  // ==========================================================
  // OPEN BACKEND HISTORY ITEM
  // ==========================================================

  async function handleOpenBackendHistory(
    interaction
  ) {

    const id =
      interaction?.id ||
      interaction?.interaction_id


    if (!id) return


    setSelectedHistoryId(id)


    try {

      const data =
        await apiRequest(
          `/api/interactions/${id}`
        )


      const prompt =
        data?.prompt ||
        data?.input ||
        data?.message ||
        interaction?.prompt ||
        ""


      const normalized =
        normalizeGovernanceResult(
          data,
          prompt
        )


      /*
       * Convert this old single interaction
       * into a proper chat conversation.
       *
       * This allows the user to continue
       * typing immediately.
       */

      const userMessage =
        createUserMessage(
          prompt
        )


      const assistantMessage =
        createAssistantMessage(
          normalized,
          prompt
        )


      const conversationId =
        `history-${id}`


      const restoredMessages =
        [
          userMessage,
          assistantMessage,
        ]


      setMessages(
        restoredMessages
      )


      setActiveConversationId(
        conversationId
      )


      /*
       * Save restored conversation locally.
       */

      setConversations(
        (previous) => {

          const exists =
            previous.some(
              (item) =>
                item.id ===
                conversationId
            )


          if (exists) {
            return previous.map(
              (item) =>
                item.id ===
                conversationId
                  ? {
                      ...item,
                      messages:
                        restoredMessages,
                    }
                  : item
            )
          }


          return [
            {
              id:
                conversationId,

              title:
                prompt ||
                "Conversation",

              messages:
                restoredMessages,

              createdAt:
                new Date().toISOString(),

              updatedAt:
                new Date().toISOString(),
            },

            ...previous,
          ]

        }
      )


      setMessage("")

    } catch (err) {

      console.error(
        "Could not open interaction:",
        err
      )


      setError(
        err?.message ||
          "Could not open this interaction."
      )

    }

  }


  // ==========================================================
  // DELETE / CLEAR LOCAL CHAT
  // ==========================================================

  function handleClearCurrentChat() {

    setMessages([])

    setMessage("")

    setError("")

    setSelectedHistoryId(
      null
    )

    setActiveConversationId(
      null
    )

  }





  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className="
        flex
        h-full
        min-h-0
        w-full
        overflow-hidden
        bg-[#F8FAFC]
        text-slate-900
        dark:bg-slate-950
        dark:text-slate-100
      "
    >

      {/* =====================================================
          MAIN CHAT AREA
      ===================================================== */}

      <main
        className="
          flex
          min-w-0
          flex-1
          flex-col
        "
      >

        {/* ===================================================
            CHAT HEADER
        =================================================== */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b
            border-slate-200
            bg-white
            px-5
            py-4
            dark:border-slate-800
            dark:bg-slate-900
          "
        >

          <div className="flex items-center gap-3">

            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                bg-violet-600
              "
            >
              <Sparkles
                size={18}
                className="text-white"
              />
            </div>


            <div>

              <h1
                className="
                  text-sm
                  font-semibold
                  text-slate-900
                  dark:text-white
                "
              >
                AI Playground
              </h1>

              <p
                className="
                  text-[11px]
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Chat with your governed AI
              </p>

            </div>

          </div>


          <div className="flex items-center gap-2">

            {/* NEW CHAT */}

            <button
              type="button"
              onClick={
                handleNewChat
              }
              className="
                flex
                items-center
                gap-2
                rounded-lg
                border
                border-slate-200
                bg-white
                px-3
                py-2
                text-[11px]
                font-medium
                text-slate-600
                transition
                hover:border-violet-300
                hover:text-violet-600
                dark:border-slate-700
                dark:bg-slate-900
                dark:text-slate-300
              "
            >

              <Plus size={14} />

              New chat

            </button>


            {/* HISTORY */}

            <button
              type="button"
              onClick={() =>
                setHistoryOpen(
                  (open) => !open
                )
              }
              className={`
                flex
                items-center
                gap-2
                rounded-lg
                px-3
                py-2
                text-[11px]
                font-medium
                transition

                ${
                  historyOpen
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }
              `}
            >

              <HistoryIcon size={14} />

              History

            </button>

          </div>

        </div>


        {/* ===================================================
            APPLICATION SELECTOR
        =================================================== */}

        <div
          className="
            shrink-0
            border-b
            border-slate-200
            bg-white
            px-5
            py-3
            dark:border-slate-800
            dark:bg-slate-900
          "
        >

          <div className="flex items-center gap-3">

            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Application
            </span>


            {applications.length >
            0 ? (

              <select
                value={
                  selectedApplication?.id ||
                  selectedApplication?.application_id ||
                  ""
                }
                onChange={(event) => {

                  const selected =
                    applications.find(
                      (application) =>
                        String(
                          application.id ||
                            application.application_id
                        ) ===
                        event.target.value
                    )


                  setSelectedApplication(
                    selected ||
                      null
                  )

                }}
                className="
                  max-w-[260px]
                  rounded-lg
                  border
                  border-slate-200
                  bg-slate-50
                  px-3
                  py-1.5
                  text-xs
                  outline-none
                  focus:border-violet-400
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-slate-200
                "
              >

                {applications.map(
                  (application) => {

                    const id =
                      application.id ||
                      application.application_id


                    return (
                      <option
                        key={id}
                        value={id}
                      >
                        {application.name ||
                          application.application_name ||
                          `Application ${id}`}
                      </option>
                    )

                  }
                )}

              </select>

            ) : (

              <span className="text-xs text-slate-400">
                {loadingApplications
                  ? "Loading..."
                  : "No application available"}
              </span>

            )}

          </div>

        </div>


        {/* ===================================================
            CHAT MESSAGES
        =================================================== */}

        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            px-5
            py-6
          "
        >

          {messages.length ===
            0 && (
            <div
              className="
                flex
                h-full
                min-h-[420px]
                flex-col
                items-center
                justify-center
                text-center
              "
            >

              <div
                className="
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-violet-100
                  text-violet-600
                  dark:bg-violet-950/50
                  dark:text-violet-300
                "
              >
                <Sparkles size={25} />
              </div>


              <h2
                className="
                  mt-4
                  text-lg
                  font-semibold
                  text-slate-900
                  dark:text-white
                "
              >
                Start a conversation
              </h2>


              <p
                className="
                  mt-1
                  max-w-md
                  text-xs
                  leading-5
                  text-slate-500
                  dark:text-slate-400
                "
              >
                Send a message and ControlPanel.ai
                will evaluate the interaction through
                your governance policies.
              </p>

            </div>
          )}


          <div className="mx-auto w-full max-w-4xl space-y-6">

            {messages.map(
              (item) => (
                <ChatMessage
                  key={item.id}
                  item={item}
                />
              )
            )}


            {/* LOADING */}

            {loading && (
              <div className="flex gap-3">

                <div
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-full
                    bg-violet-100
                    text-violet-600
                    dark:bg-violet-950/50
                    dark:text-violet-300
                  "
                >
                  <Sparkles size={15} />
                </div>


                <div
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-2xl
                    rounded-bl-md
                    border
                    border-slate-200
                    bg-white
                    px-4
                    py-3
                    text-xs
                    text-slate-500
                    dark:border-slate-700
                    dark:bg-slate-900
                    dark:text-slate-400
                  "
                >

                  <Loader2
                    size={14}
                    className="animate-spin"
                  />

                  Evaluating interaction...

                </div>

              </div>
            )}


            <div
              ref={messagesEndRef}
            />

          </div>

        </div>


        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="shrink-0 px-5">

            <div
              className="
                mx-auto
                flex
                max-w-4xl
                items-start
                gap-2
                rounded-xl
                border
                border-red-200
                bg-red-50
                p-3
                dark:border-red-900/60
                dark:bg-red-950/30
              "
            >

              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0 text-red-500"
              />

              <p
                className="
                  whitespace-pre-wrap
                  text-xs
                  text-red-600
                  dark:text-red-400
                "
              >
                {error}
              </p>

            </div>

          </div>
        )}


        {/* ===================================================
            COMPOSER
        =================================================== */}

        <div
          className="
            shrink-0
            border-t
            border-slate-200
            bg-white
            p-4
            dark:border-slate-800
            dark:bg-slate-900
          "
        >

          <div className="mx-auto max-w-4xl">

            <div
              className="
                flex
                items-end
                gap-2
                rounded-2xl
                border
                border-slate-200
                bg-slate-50
                p-2
                transition
                focus-within:border-violet-400
                focus-within:ring-2
                focus-within:ring-violet-100
                dark:border-slate-700
                dark:bg-slate-800
                dark:focus-within:ring-violet-950
              "
            >

              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder={
                  messages.length > 0
                    ? "Continue the conversation..."
                    : "Message your AI..."
                }
                rows={1}
                className="
                  max-h-32
                  min-h-[42px]
                  flex-1
                  resize-none
                  bg-transparent
                  px-3
                  py-2.5
                  text-sm
                  text-slate-900
                  outline-none
                  placeholder:text-slate-400
                  dark:text-slate-100
                  dark:placeholder:text-slate-500
                "
              />


              <button
                type="button"
                onClick={
                  handleSendMessage
                }
                disabled={
                  loading ||
                  !message.trim() ||
                  !selectedApplication
                }
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-violet-600
                  text-white
                  transition
                  hover:bg-violet-700
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >

                {loading ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={17} />
                )}

              </button>

            </div>


            <div className="mt-2 flex items-center justify-between">

              <p className="text-[9px] text-slate-400 dark:text-slate-500">
                Enter to send · Shift + Enter for a new line
              </p>


              {messages.length >
                0 && (
                <button
                  type="button"
                  onClick={
                    handleClearCurrentChat
                  }
                  className="
                    text-[9px]
                    font-medium
                    text-slate-400
                    transition
                    hover:text-red-500
                  "
                >
                  Clear chat
                </button>
              )}

            </div>

          </div>

        </div>

      </main>


      {/* =====================================================
          RIGHT HISTORY PANEL
      ===================================================== */}

      {historyOpen && (
        <aside
          className="
            flex
            w-[330px]
            shrink-0
            flex-col
            border-l
            border-slate-200
            bg-white
            dark:border-slate-800
            dark:bg-slate-900
          "
        >

          {/* HISTORY HEADER */}

          <div
            className="
              flex
              shrink-0
              items-center
              justify-between
              border-b
              border-slate-200
              px-4
              py-4
              dark:border-slate-800
            "
          >

            <div>

              <div className="flex items-center gap-2">

                <HistoryIcon
                  size={15}
                  className="text-violet-500"
                />

                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  History
                </h2>

              </div>

              <p className="mt-1 text-[10px] text-slate-400">
                Continue previous conversations
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                setHistoryOpen(
                  false
                )
              }
              className="
                rounded-lg
                p-1.5
                text-slate-400
                hover:bg-slate-100
                hover:text-slate-700
                dark:hover:bg-slate-800
                dark:hover:text-slate-200
              "
            >
              <X size={15} />
            </button>

          </div>


          {/* SEARCH */}

          <div className="shrink-0 px-3 py-3">

            <div
              className="
                flex
                items-center
                gap-2
                rounded-lg
                border
                border-slate-200
                bg-slate-50
                px-3
                py-2
                dark:border-slate-700
                dark:bg-slate-800
              "
            >

              <Search
                size={13}
                className="text-slate-400"
              />

              <input
                value={historySearch}
                onChange={(event) =>
                  setHistorySearch(
                    event.target.value
                  )
                }
                placeholder="Search history..."
                className="
                  min-w-0
                  flex-1
                  bg-transparent
                  text-xs
                  outline-none
                  placeholder:text-slate-400
                  dark:text-slate-200
                "
              />

            </div>

          </div>


          {/* NEW CHAT */}

          <div className="shrink-0 px-3 pb-2">

            <button
              type="button"
              onClick={
                handleNewChat
              }
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                rounded-lg
                bg-violet-600
                px-3
                py-2.5
                text-xs
                font-medium
                text-white
                transition
                hover:bg-violet-700
              "
            >

              <Plus size={14} />

              New conversation

            </button>

          </div>


          {/* HISTORY CONTENT */}

          <div
            className="
              min-h-0
              flex-1
              overflow-y-auto
              px-3
              pb-3
            "
          >

            {/* LOCAL CONVERSATIONS */}

            {conversations.length >
              0 && (
              <div className="mb-4">

                <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Conversations
                </p>


                <div className="space-y-1">

                  {conversations
                    .filter(
                      (conversation) => {

                        if (
                          !historySearch.trim()
                        ) {
                          return true
                        }


                        const text =
                          JSON.stringify(
                            conversation
                          ).toLowerCase()


                        return text.includes(
                          historySearch
                            .toLowerCase()
                        )

                      }
                    )
                    .sort(
                      (a, b) =>
                        new Date(
                          b.updatedAt ||
                            b.createdAt
                        ) -
                        new Date(
                          a.updatedAt ||
                            a.createdAt
                        )
                    )
                    .map(
                      (
                        conversation
                      ) => (
                        <HistoryItem
                          key={
                            conversation.id
                          }
                          conversation={
                            conversation
                          }
                          active={
                            activeConversationId ===
                            conversation.id
                          }
                          onClick={() =>
                            openConversation(
                              conversation
                            )
                          }
                        />
                      )
                    )}

                </div>

              </div>
            )}


            {/* BACKEND HISTORY */}

            <div>

              <div className="mb-2 flex items-center justify-between px-1">

                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Processed interactions
                </p>


                <button
                  type="button"
                  onClick={
                    loadHistory
                  }
                  disabled={
                    historyLoading
                  }
                  title="Refresh history"
                  className="
                    rounded
                    p-1
                    text-slate-400
                    hover:bg-slate-100
                    hover:text-slate-700
                    dark:hover:bg-slate-800
                  "
                >

                  <RefreshCw
                    size={11}
                    className={
                      historyLoading
                        ? "animate-spin"
                        : ""
                    }
                  />

                </button>

              </div>


              {historyError && (
                <p className="px-1 py-2 text-[10px] text-red-500">
                  {historyError}
                </p>
              )}


              {!historyLoading &&
                !historyError &&
                filteredBackendHistory.length ===
                  0 && (
                  <div
                    className="
                      rounded-xl
                      border
                      border-dashed
                      border-slate-200
                      p-5
                      text-center
                      dark:border-slate-700
                    "
                  >

                    <Clock3
                      size={18}
                      className="mx-auto text-slate-300 dark:text-slate-600"
                    />

                    <p className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      No processed interactions
                    </p>

                  </div>
                )}


              <div className="space-y-1">

                {filteredBackendHistory.map(
                  (
                    interaction,
                    index
                  ) => {

                    const id =
                      interaction?.id ||
                      interaction?.interaction_id ||
                      `backend-${index}`


                    const prompt =
                      interaction?.prompt ||
                      interaction?.input ||
                      interaction?.message ||
                      "Interaction"


                    const decision =
                      getDecision(
                        interaction
                      )


                    const category =
                      getPolicyCategory(
                        interaction,
                        prompt
                      )


                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          handleOpenBackendHistory(
                            interaction
                          )
                        }
                        className={`
                          w-full
                          rounded-xl
                          border
                          p-3
                          text-left
                          transition

                          ${
                            selectedHistoryId ===
                            id
                              ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                          }
                        `}
                      >

                        <div className="flex gap-3">

                          <div
                            className="
                              flex
                              h-8
                              w-8
                              shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              bg-slate-100
                              text-slate-500
                              dark:bg-slate-800
                              dark:text-slate-400
                            "
                          >
                            <MessageSquare
                              size={14}
                            />
                          </div>


                          <div className="min-w-0 flex-1">

                            <p className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                              {prompt}
                            </p>


                            <div className="mt-2 flex items-center gap-2">

                              <span
                                className={`
                                  rounded-full
                                  px-2
                                  py-0.5
                                  text-[8px]
                                  font-bold
                                  uppercase
                                  ${
                                    decision ===
                                    "BLOCKED"
                                      ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                      : decision ===
                                          "HUMAN_REVIEW"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  }
                                `}
                              >
                                {decision ===
                                "HUMAN_REVIEW"
                                  ? "REVIEW"
                                  : decision}
                              </span>


                              <span className="truncate text-[8px] text-slate-400">
                                {category}
                              </span>

                            </div>

                          </div>

                        </div>

                      </button>
                    )

                  }
                )}

              </div>

            </div>

          </div>


          {/* HISTORY FOOTER */}

          <div
            className="
              shrink-0
              border-t
              border-slate-200
              px-3
              py-3
              dark:border-slate-800
            "
          >

            <div className="flex items-center justify-between">

              <p className="text-[9px] text-slate-400">
                History is saved locally
              </p>


              <button
                type="button"
                onClick={() =>
                  setHistoryOpen(
                    false
                  )
                }
                className="
                  flex
                  items-center
                  gap-1
                  text-[9px]
                  font-medium
                  text-slate-400
                  hover:text-violet-500
                "
              >

                Hide

                <ChevronRight
                  size={11}
                />

              </button>

            </div>

          </div>

        </aside>
      )}
    </div>
  )
}


export default Playground