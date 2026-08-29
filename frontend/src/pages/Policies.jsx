import { useEffect, useState } from "react"
import {
  FileCog,
  Plus,
  Settings2,
  ShieldCheck,
  Pencil,
  X,
  Save,
} from "lucide-react"

import api from "../services/api"

const DEFAULT_CONFIG = {
  pii_action: "BLOCK",
  hallucination_threshold: 0.7,
  bias_threshold: 0.6,
  injection_action: "BLOCK",
  human_review_threshold: 0.75,
}

function Policies() {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [showModal, setShowModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState(null)

  const [form, setForm] = useState({
    id: "",
    name: "",
    version: "1.0",
    config: { ...DEFAULT_CONFIG },
  })

  // ============================================================
  // FETCH POLICIES
  // ============================================================

  const fetchPolicies = async () => {
    try {
      setLoading(true)
      setError("")

      /*
       * IMPORTANT:
       * Use api instead of axios directly.
       *
       * api.js automatically attaches:
       *
       * Authorization: Bearer <controlpanel_token>
       */

      const response = await api.get("/api/policies")

      const data = Array.isArray(response.data)
        ? response.data
        : []

      /*
       * Remove duplicate policies with the same name.
       */

      const uniquePolicies = []

      data.forEach((policy) => {
        const existingIndex =
          uniquePolicies.findIndex(
            (item) =>
              item.name?.trim().toLowerCase() ===
              policy.name?.trim().toLowerCase()
          )

        if (existingIndex === -1) {
          uniquePolicies.push(policy)
          return
        }

        const existing =
          uniquePolicies[existingIndex]

        const currentIsPreferred =
          policy.id?.startsWith("pol-")

        const existingIsPreferred =
          existing.id?.startsWith("pol-")

        if (
          currentIsPreferred &&
          !existingIsPreferred
        ) {
          uniquePolicies[existingIndex] =
            policy
        }
      })

      setPolicies(uniquePolicies)
    } catch (err) {
      console.error(
        "Failed to load policies:",
        err
      )

      if (err.response?.status === 401) {
        setError(
          "Authentication required. Please sign in again."
        )
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to load policies. Is the backend running?"
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicies()
  }, [])

  // ============================================================
  // NORMALIZE POLICY
  // ============================================================

  const getPolicyConfig = (policy) => {
    return {
      pii_action:
        policy.config?.pii_action ??
        policy.pii_action ??
        DEFAULT_CONFIG.pii_action,

      hallucination_threshold:
        Number(
          policy.config?.hallucination_threshold ??
            policy.hallucination_threshold ??
            DEFAULT_CONFIG.hallucination_threshold
        ),

      bias_threshold:
        Number(
          policy.config?.bias_threshold ??
            policy.bias_threshold ??
            DEFAULT_CONFIG.bias_threshold
        ),

      injection_action:
        policy.config?.injection_action ??
        policy.injection_action ??
        DEFAULT_CONFIG.injection_action,

      human_review_threshold:
        Number(
          policy.config?.human_review_threshold ??
            policy.human_review_threshold ??
            DEFAULT_CONFIG.human_review_threshold
        ),
    }
  }

  // ============================================================
  // CREATE POLICY
  // ============================================================

  const openCreateModal = () => {
    setEditingPolicy(null)

    setForm({
      id: "",
      name: "",
      version: "1.0",
      config: {
        ...DEFAULT_CONFIG,
      },
    })

    setShowModal(true)
  }

  // ============================================================
  // EDIT POLICY
  // ============================================================

  const openEditModal = (policy) => {
    const config = getPolicyConfig(policy)

    setEditingPolicy(policy)

    setForm({
      id: policy.id,
      name: policy.name || "",
      version: policy.version || "1.0",
      config,
    })

    setShowModal(true)
  }

  // ============================================================
  // CLOSE MODAL
  // ============================================================

  const closeModal = () => {
    setShowModal(false)
    setEditingPolicy(null)
  }

  // ============================================================
  // UPDATE CONFIG
  // ============================================================

  const updateConfig = (key, value) => {
    setForm((previous) => ({
      ...previous,

      config: {
        ...previous.config,
        [key]: value,
      },
    }))
  }

  // ============================================================
  // SAVE POLICY
  // ============================================================

  const savePolicy = async () => {
    if (!form.id.trim()) {
      alert("Please enter a Policy ID.")
      return
    }

    if (!form.name.trim()) {
      alert("Please enter a Policy Name.")
      return
    }

    try {
      const payload = {
        id: form.id.trim(),
        name: form.name.trim(),
        version: form.version || "1.0",

        config: {
          pii_action:
            form.config.pii_action,

          hallucination_threshold:
            Number(
              form.config.hallucination_threshold
            ),

          bias_threshold:
            Number(
              form.config.bias_threshold
            ),

          injection_action:
            form.config.injection_action,

          human_review_threshold:
            Number(
              form.config.human_review_threshold
            ),
        },
      }

      if (editingPolicy) {
        await api.put(
          `/api/policies/${editingPolicy.id}`,
          payload
        )
      } else {
        await api.post(
          "/api/policies",
          payload
        )
      }

      await fetchPolicies()

      closeModal()
    } catch (err) {
      console.error(
        "Policy save error:",
        err.response?.data || err
      )

      if (err.response?.status === 401) {
        alert(
          "Authentication required. Please sign in again."
        )
      } else {
        alert(
          err.response?.data?.detail ||
            "Could not save policy."
        )
      }
    }
  }

  // ============================================================
  // FORMAT VALUE
  // ============================================================

  const formatThreshold = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—"
    }

    const number = Number(value)

    if (Number.isNaN(number)) {
      return value
    }

    return number.toFixed(2)
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-full bg-slate-50 p-7">

      {/* HEADER */}

      <div className="mb-7 flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Policies
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure governance rules and AI safety thresholds
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          <Plus size={17} />

          Create Policy
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* LOADING */}

      {loading ? (

        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">

          <p className="text-sm text-slate-500">
            Loading policies...
          </p>

        </div>

      ) : (

        <>

          {/* POLICY GRID */}

          {policies.length > 0 && (

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

              {policies.map((policy) => {

                const config =
                  getPolicyConfig(policy)

                return (

                  <div
                    key={policy.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                  >

                    {/* POLICY HEADER */}

                    <div className="flex items-start justify-between">

                      <div className="flex items-center gap-3">

                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-50">

                          <FileCog
                            size={21}
                            className="text-brand-600"
                          />

                        </div>

                        <div>

                          <h2 className="text-lg font-semibold text-slate-900">
                            {policy.name}
                          </h2>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {policy.id} · Version{" "}
                            {policy.version || "1.0"}
                          </p>

                        </div>

                      </div>

                      <button
                        onClick={() =>
                          openEditModal(policy)
                        }
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil size={16} />
                      </button>

                    </div>

                    {/* ACTIVE BADGE */}

                    <div className="mt-5 flex items-center gap-2">

                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">

                        <ShieldCheck size={13} />

                        {policy.active === false
                          ? "Inactive"
                          : "Active"}

                      </span>

                    </div>

                    {/* RULES */}

                    <div className="mt-5 space-y-3">

                      <RuleRow
                        label="PII Action"
                        value={config.pii_action}
                      />

                      <RuleRow
                        label="Hallucination Threshold"
                        value={formatThreshold(
                          config.hallucination_threshold
                        )}
                      />

                      <RuleRow
                        label="Bias Threshold"
                        value={formatThreshold(
                          config.bias_threshold
                        )}
                      />

                      <RuleRow
                        label="Injection Action"
                        value={config.injection_action}
                      />

                      <RuleRow
                        label="Human Review Threshold"
                        value={formatThreshold(
                          config.human_review_threshold
                        )}
                      />

                    </div>

                  </div>

                )
              })}

            </div>

          )}

          {/* EMPTY STATE */}

          {policies.length === 0 && !error && (

            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">

              <Settings2
                size={30}
                className="mx-auto text-slate-400"
              />

              <h3 className="mt-3 text-base font-semibold text-slate-900">
                No policies found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create your first governance policy.
              </p>

            </div>

          )}

        </>

      )}

      {/* CREATE / EDIT MODAL */}

      {showModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5">

          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>

                <h2 className="text-lg font-semibold text-slate-900">

                  {editingPolicy
                    ? "Edit Policy"
                    : "Create Policy"}

                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Configure governance rules for AI applications.
                </p>

              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>

            </div>

            {/* FORM */}

            <div className="space-y-5 p-6">

              {/* POLICY ID */}

              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Policy ID
                </label>

                <input
                  value={form.id}
                  disabled={!!editingPolicy}
                  onChange={(e) =>
                    setForm((previous) => ({
                      ...previous,
                      id: e.target.value,
                    }))
                  }
                  placeholder="pol_example"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 disabled:bg-slate-100"
                />

              </div>

              {/* POLICY NAME */}

              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Policy Name
                </label>

                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((previous) => ({
                      ...previous,
                      name: e.target.value,
                    }))
                  }
                  placeholder="HR Strict"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />

              </div>

              {/* PII ACTION */}

              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  PII Action
                </label>

                <select
                  value={form.config.pii_action}
                  onChange={(e) =>
                    updateConfig(
                      "pii_action",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                >

                  <option value="BLOCK">
                    Block
                  </option>

                  <option value="REDACT">
                    Redact
                  </option>

                  <option value="ALLOW">
                    Allow
                  </option>

                </select>

              </div>

              {/* THRESHOLDS */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <ThresholdInput
                  label="Hallucination Threshold"
                  value={
                    form.config.hallucination_threshold
                  }
                  onChange={(value) =>
                    updateConfig(
                      "hallucination_threshold",
                      value
                    )
                  }
                />

                <ThresholdInput
                  label="Bias Threshold"
                  value={
                    form.config.bias_threshold
                  }
                  onChange={(value) =>
                    updateConfig(
                      "bias_threshold",
                      value
                    )
                  }
                />

                <ThresholdInput
                  label="Human Review Threshold"
                  value={
                    form.config.human_review_threshold
                  }
                  onChange={(value) =>
                    updateConfig(
                      "human_review_threshold",
                      value
                    )
                  }
                />

              </div>

              {/* INJECTION ACTION */}

              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Prompt Injection Action
                </label>

                <select
                  value={
                    form.config.injection_action
                  }
                  onChange={(e) =>
                    updateConfig(
                      "injection_action",
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                >

                  <option value="BLOCK">
                    Block
                  </option>

                  <option value="FLAG">
                    Flag
                  </option>

                  <option value="ALLOW">
                    Allow
                  </option>

                </select>

              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">

              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={savePolicy}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >

                <Save size={16} />

                {editingPolicy
                  ? "Save Changes"
                  : "Create Policy"}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  )
}

// ============================================================
// RULE ROW
// ============================================================

function RuleRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">

      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
        {value}
      </span>

    </div>
  )
}

// ============================================================
// THRESHOLD INPUT
// ============================================================

function ThresholdInput({
  label,
  value,
  onChange,
}) {
  return (
    <div>

      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value))
        }
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
      />

    </div>
  )
}

export default Policies