import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ShieldAlert,
  Eye,
  RefreshCw,
} from "lucide-react"

import api from "../services/api"

function Incidents() {
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchInteractions = async () => {
    try {
      setError("")

      // api automatically adds the logged-in user's token
      const response = await api.get("/api/interactions")

      setInteractions(
        Array.isArray(response.data)
          ? response.data
          : []
      )
    } catch (error) {
      console.error(
        "Failed to load incidents:",
        error
      )

      if (error.response?.status === 401) {
        setError(
          "Authentication required. Please sign in again."
        )
      } else {
        setError(
          error.response?.data?.detail ||
            "Unable to load incidents."
        )
      }

      setInteractions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInteractions()
  }, [])

  const incidents = interactions.filter((item) => {
    const response =
      item.response?.toLowerCase() || ""

    return (
      response.includes("blocked") ||
      response.includes("violation") ||
      response.includes("flagged")
    )
  })

  return (
    <div className="min-h-full bg-slate-50 p-7">

      {/* HEADER */}

      <div className="mb-7 flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Incidents
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor flagged and blocked AI interactions
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true)
            fetchInteractions()
          }}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <SummaryCard
          icon={AlertTriangle}
          label="Total Incidents"
          value={incidents.length}
        />

        <SummaryCard
          icon={ShieldAlert}
          label="Blocked"
          value={incidents.length}
        />

        <SummaryCard
          icon={Eye}
          label="Under Review"
          value="0"
        />

      </div>

      {/* INCIDENT TABLE */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-6 py-4">

          <h2 className="text-base font-semibold text-slate-900">
            Recent Incidents
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Generated from AI governance interactions
          </p>

        </div>

        {/* LOADING */}

        {loading ? (

          <div className="p-10 text-center">

            <RefreshCw
              size={24}
              className="mx-auto animate-spin text-slate-400"
            />

            <p className="mt-3 text-sm text-slate-500">
              Loading incidents...
            </p>

          </div>

        ) : incidents.length === 0 ? (

          /* EMPTY STATE */

          <div className="p-10 text-center">

            <ShieldAlert
              size={30}
              className="mx-auto text-slate-300"
            />

            <p className="mt-3 text-sm font-medium text-slate-600">
              No incidents found
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Blocked or flagged interactions will appear here.
            </p>

          </div>

        ) : (

          /* INCIDENT LIST */

          <div className="divide-y divide-slate-100">

            {incidents.map((incident) => (

              <div
                key={incident.id}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-50"
              >

                <div className="flex items-center gap-4">

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">

                    <AlertTriangle
                      size={18}
                      className="text-red-500"
                    />

                  </div>

                  <div>

                    <p className="text-sm font-medium text-slate-900">
                      Governance violation detected
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Interaction ID: {incident.id}
                    </p>

                  </div>

                </div>

                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                  BLOCKED
                </span>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">

          <Icon
            size={19}
            className="text-brand-600"
          />

        </div>

        <div>

          <p className="text-xs text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-xl font-semibold text-slate-900">
            {value}
          </p>

        </div>

      </div>

    </div>
  )
}

export default Incidents