import { useEffect, useState } from "react"
import {
  CheckCircle2,
  Clock3,
  ShieldAlert,
} from "lucide-react"

import api from "../services/api"

function HumanReview() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [error, setError] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // ============================================================
  // LOAD HUMAN REVIEW CASES
  // ============================================================

  async function loadCases() {
    try {
      setLoading(true)
      setError("")

      // api.js automatically attaches the logged-in user's token
      const response = await api.get(
        "/api/human-review"
      )

      const data = Array.isArray(response.data)
        ? response.data
        : []

      setCases(data)

      if (data.length > 0) {
        setSelectedCase(data[0])
      } else {
        setSelectedCase(null)
      }

    } catch (err) {
      console.error(
        "Failed to load human review cases:",
        err
      )

      if (err.response?.status === 401) {
        setError(
          "Authentication required. Please sign in again."
        )
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load human review cases."
        )
      }

      setCases([])
      setSelectedCase(null)

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCases()
  }, [])

  // ============================================================
  // RISK HELPERS
  // ============================================================

  function getRiskLabel(score) {
    const value = Number(score) || 0

    if (value >= 0.75) {
      return "HIGH"
    }

    if (value >= 0.5) {
      return "MEDIUM"
    }

    return "LOW"
  }

  function getRiskStyle(score) {
    const value = Number(score) || 0

    if (value >= 0.75) {
      return "bg-red-100 text-red-700"
    }

    if (value >= 0.5) {
      return "bg-orange-100 text-orange-700"
    }

    return "bg-emerald-100 text-emerald-700"
  }

  // ============================================================
  // REMOVE CURRENT CASE
  // ============================================================

  function removeCurrentCase(interactionId) {
    const remainingCases = cases.filter(
      (item) =>
        item.interaction_id !== interactionId
    )

    setCases(remainingCases)

    if (remainingCases.length > 0) {
      setSelectedCase(remainingCases[0])
    } else {
      setSelectedCase(null)
    }
  }

  // ============================================================
  // APPROVE
  // ============================================================

  async function handleApprove() {
    if (!selectedCase?.interaction_id) {
      setError("No review case selected.")
      return
    }

    try {
      setActionLoading(true)
      setError("")

      await api.post(
        `/api/human-review/${selectedCase.interaction_id}/approve`
      )

      const approvedId =
        selectedCase.interaction_id

      removeCurrentCase(approvedId)

    } catch (err) {
      console.error(
        "Approve failed:",
        err
      )

      if (err.response?.status === 401) {
        setError(
          "Authentication required. Please sign in again."
        )
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to approve this review."
        )
      }

    } finally {
      setActionLoading(false)
    }
  }

  // ============================================================
  // REJECT
  // ============================================================

  async function handleReject() {
    if (!selectedCase?.interaction_id) {
      setError("No review case selected.")
      return
    }

    try {
      setActionLoading(true)
      setError("")

      await api.post(
        `/api/human-review/${selectedCase.interaction_id}/reject`
      )

      const rejectedId =
        selectedCase.interaction_id

      removeCurrentCase(rejectedId)

    } catch (err) {
      console.error(
        "Reject failed:",
        err
      )

      if (err.response?.status === 401) {
        setError(
          "Authentication required. Please sign in again."
        )
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to reject this review."
        )
      }

    } finally {
      setActionLoading(false)
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-full bg-slate-50">

      <div className="p-8">

        {/* STATS */}

        <div className="mb-5 grid grid-cols-4 gap-4">

          {/* PENDING */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">

                <Clock3
                  size={20}
                  className="text-purple-600"
                />

              </div>

              <div>

                <p className="text-xs text-slate-500">
                  Pending Reviews
                </p>

                <p className="text-2xl font-bold text-slate-900">
                  {cases.length}
                </p>

              </div>

            </div>

          </div>

          {/* HIGH RISK */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">

                <ShieldAlert
                  size={20}
                  className="text-red-500"
                />

              </div>

              <div>

                <p className="text-xs text-slate-500">
                  High Risk Cases
                </p>

                <p className="text-2xl font-bold text-slate-900">

                  {
                    cases.filter(
                      (item) =>
                        (item.risk?.overall || 0) >=
                        0.75
                    ).length
                  }

                </p>

              </div>

            </div>

          </div>

          {/* AVERAGE RISK */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">

                <CheckCircle2
                  size={20}
                  className="text-emerald-600"
                />

              </div>

              <div>

                <p className="text-xs text-slate-500">
                  Average Risk
                </p>

                <p className="text-2xl font-bold text-slate-900">

                  {cases.length
                    ? (
                        cases.reduce(
                          (sum, item) =>
                            sum +
                            (item.risk?.overall || 0),
                          0
                        ) / cases.length
                      ).toFixed(2)
                    : "0.00"}

                </p>

              </div>

            </div>

          </div>

        </div>

        {/* LOADING */}

        {loading && (

          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">

            Loading review queue...

          </div>

        )}

        {/* ERROR */}

        {error && (

          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">

            {error}

          </div>

        )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          cases.length === 0 && (

            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">

              <CheckCircle2
                size={40}
                className="mx-auto text-emerald-500"
              />

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                No cases awaiting review
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                All governance decisions have been processed.
              </p>

            </div>

          )}

        {/* REVIEW AREA */}

        {!loading &&
          !error &&
          cases.length > 0 && (

            <div className="grid grid-cols-[780px_minmax(0,1.8fr)] gap-6">

              {/* QUEUE */}

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-200 px-5 py-4">

                  <h2 className="font-semibold text-slate-900">
                    Review Queue
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Select a case to inspect
                  </p>

                </div>

                <div className="divide-y divide-slate-100">

                  {cases.map((item) => (

                    <button
                      type="button"
                      key={item.interaction_id}
                      onClick={() =>
                        setSelectedCase(item)
                      }
                      className={`w-full px-5 py-4 text-left transition ${
                        selectedCase?.interaction_id ===
                        item.interaction_id
                          ? "bg-purple-50"
                          : "hover:bg-slate-50"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.interaction_id}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {item.prompt}
                          </p>

                        </div>

                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${getRiskStyle(
                            item.risk?.overall || 0
                          )}`}
                        >
                          {getRiskLabel(
                            item.risk?.overall || 0
                          )}
                        </span>

                      </div>

                    </button>

                  ))}

                </div>

              </div>

              {/* DETAILS */}

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

                {!selectedCase ? (

                  <div className="flex h-full min-h-[500px] items-center justify-center text-center">

                    <div>

                      <Clock3
                        size={40}
                        className="mx-auto text-slate-300"
                      />

                      <p className="mt-4 text-sm text-slate-500">
                        Select a case from the review queue
                      </p>

                    </div>

                  </div>

                ) : (

                  <div>

                    {/* CASE HEADER */}

                    <div className="border-b border-slate-200 px-6 py-5">

                      <div className="flex items-center justify-between">

                        <div>

                          <h2 className="text-lg font-semibold text-slate-900">
                            Review Case
                          </h2>

                          <p className="mt-1 text-xs text-slate-500">
                            {selectedCase.interaction_id}
                          </p>

                        </div>

                        <span className="rounded-md bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700">
                          HUMAN REVIEW
                        </span>

                      </div>

                    </div>

                    <div className="space-y-6 p-6">

                      {/* PROMPT */}

                      <div>

                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          User Prompt
                        </p>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                          {selectedCase.prompt}
                        </div>

                      </div>

                      {/* RESPONSE */}

                      <div>

                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          AI Response
                        </p>

                        <div className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                          {selectedCase.response}
                        </div>

                      </div>

                      {/* RISK */}

                      <div>

                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Risk Assessment
                        </p>

                        <div className="grid grid-cols-2 gap-3">

                          {[
                            [
                              "Privacy",
                              selectedCase.risk?.privacy,
                            ],
                            [
                              "Hallucination",
                              selectedCase.risk?.hallucination,
                            ],
                            [
                              "Bias",
                              selectedCase.risk?.bias,
                            ],
                            [
                              "Security",
                              selectedCase.risk?.security,
                            ],
                          ].map(
                            ([label, value]) => {

                              const numericValue =
                                Number(value) || 0

                              return (

                                <div
                                  key={label}
                                  className="rounded-lg border border-slate-200 p-4"
                                >

                                  <p className="text-xs text-slate-500">
                                    {label}
                                  </p>

                                  <p className="mt-2 text-xl font-bold text-slate-900">
                                    {numericValue.toFixed(2)}
                                  </p>

                                  <span
                                    className={`mt-2 inline-block rounded px-2 py-1 text-[10px] font-bold ${getRiskStyle(
                                      numericValue
                                    )}`}
                                  >
                                    {getRiskLabel(
                                      numericValue
                                    )}
                                  </span>

                                </div>

                              )
                            }
                          )}

                        </div>

                      </div>

                      {/* REASON */}

                      <div>

                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Reason for Review
                        </p>

                        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
                          {selectedCase.reason ||
                            "This interaction exceeded the human review threshold."}
                        </div>

                      </div>

                      {/* ACTIONS */}

                      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleReject}
                          className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionLoading
                            ? "Processing..."
                            : "Reject"}
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleApprove}
                          className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionLoading
                            ? "Processing..."
                            : "Approve"}
                        </button>

                      </div>

                    </div>

                  </div>

                )}

              </div>

            </div>

          )}

      </div>

    </div>
  )
}

export default HumanReview