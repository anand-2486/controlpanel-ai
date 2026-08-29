import { useEffect, useMemo, useState } from "react"

import {
  Activity,
  AlertTriangle,
  Ban,
  Users,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from "lucide-react"

import api from "../services/api"


/* ============================================================
   STAT CARD
   ============================================================ */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>

        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">

          <Icon
            size={20}
            className="text-slate-600 dark:text-slate-300"
          />

        </div>

      </div>

    </div>
  )
}


/* ============================================================
   RISK BAR
   ============================================================ */

function RiskBar({
  label,
  value,
}) {
  const safeValue = Math.max(
    0,
    Math.min(1, Number(value) || 0)
  )

  const percentage = Math.round(
    safeValue * 100
  )

  return (
    <div className="mb-5">

      <div className="mb-2 flex items-center justify-between">

        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>

        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {percentage}%
        </span>

      </div>

      <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">

        <div
          className="h-2.5 rounded-full bg-slate-900 transition-all dark:bg-slate-200"
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  )
}


/* ============================================================
   DECISION BADGE
   ============================================================ */

function DecisionBadge({
  decision,
}) {
  const styles = {
    ALLOW:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",

    BLOCK:
      "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",

    FLAG:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",

    HUMAN_REVIEW:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",

    "ALLOW+WARNING":
      "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",

    EDIT:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  }

  return (
    <span
      className={`
        rounded-md
        px-2.5
        py-1
        text-[10px]
        font-bold
        ${
          styles[decision] ||
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }
      `}
    >
      {decision || "UNKNOWN"}
    </span>
  )
}


/* ============================================================
   DASHBOARD
   ============================================================ */

function Dashboard() {

  const [dashboard, setDashboard] =
    useState(null)

  const [interactions, setInteractions] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [clearing, setClearing] =
    useState(false)

  const [error, setError] =
    useState("")


  /* ==========================================================
     LOAD DASHBOARD
     ========================================================== */

  useEffect(() => {
    loadDashboard()
  }, [])


  async function loadDashboard() {

    try {

      setLoading(true)
      setError("")

      const [
        dashboardResponse,
        interactionsResponse,
      ] = await Promise.all([
        api.get("/api/dashboard"),
        api.get("/api/interactions"),
      ])


      setDashboard(
        dashboardResponse.data
      )


      const interactionData =
        Array.isArray(
          interactionsResponse.data
        )
          ? interactionsResponse.data
          : []


      setInteractions(
        interactionData
      )


    } catch (err) {

      console.error(
        "Dashboard loading error:",
        err
      )

      if (
        err.response?.status === 401
      ) {

        setError(
          "Your session has expired. Please sign in again."
        )

      } else {

        setError(
          err.response?.data?.detail ||
          "Unable to load dashboard data."
        )

      }

    } finally {

      setLoading(false)

    }

  }


  /* ==========================================================
     CLEAR HISTORY
     ========================================================== */

  async function clearHistory() {

    const confirmed =
      window.confirm(
        "Are you sure you want to clear all governance history? This cannot be undone."
      )

    if (!confirmed) {
      return
    }


    try {

      setClearing(true)
      setError("")


      /*
       * Delete the actual records
       * from the backend.
       */

      await api.delete(
        "/api/history"
      )


      /*
       * Immediately clear the
       * frontend state.
       */

      setInteractions([])


      /*
       * Reload dashboard statistics
       * from the backend so every
       * counter becomes accurate.
       */

      await loadDashboard()


    } catch (err) {

      console.error(
        "Clear history error:",
        err
      )

      setError(
        err.response?.data?.detail ||
        "Unable to clear history."
      )

    } finally {

      setClearing(false)

    }

  }


  /* ==========================================================
     STATS
     ========================================================== */

  const stats = useMemo(() => {

    if (dashboard) {

      return {

        total:
          dashboard.interactions ??
          dashboard.total_requests ??
          interactions.length,

        allowed:
          dashboard.allowed ??
          0,

        blocked:
          dashboard.blocked ??
          0,

        flagged:
          dashboard.flagged ??
          0,

        humanReview:
          dashboard.pending_reviews ??
          dashboard.human_review ??
          0,

      }

    }


    return {

      total:
        interactions.length,

      allowed:
        interactions.filter(
          (item) =>
            item.decision === "ALLOW"
        ).length,

      blocked:
        interactions.filter(
          (item) =>
            item.decision === "BLOCK"
        ).length,

      flagged:
        interactions.filter(
          (item) =>
            item.decision === "FLAG"
        ).length,

      humanReview:
        interactions.filter(
          (item) =>
            item.decision === "HUMAN_REVIEW"
        ).length,

    }

  }, [
    dashboard,
    interactions,
  ])


  /* ==========================================================
     RISK STATS
     ========================================================== */

  const riskStats = useMemo(() => {

    if (
      !interactions.length
    ) {

      return {
        privacy: 0,
        hallucination: 0,
        bias: 0,
        security: 0,
        policy: 0,
      }

    }


    let privacy = 0
    let hallucination = 0
    let bias = 0
    let security = 0
    let policy = 0


    interactions.forEach(
      (interaction) => {

        const risk =
          interaction.risk ||
          interaction.risk_assessment ||
          {}


        privacy +=
          Number(
            risk.privacy || 0
          )

        hallucination +=
          Number(
            risk.hallucination || 0
          )

        bias +=
          Number(
            risk.bias || 0
          )

        security +=
          Number(
            risk.security || 0
          )

        policy +=
          Number(
            risk.policy || 0
          )

      }
    )


    const total =
      interactions.length


    return {

      privacy:
        privacy / total,

      hallucination:
        hallucination / total,

      bias:
        bias / total,

      security:
        security / total,

      policy:
        policy / total,

    }

  }, [
    interactions,
  ])


  /* ==========================================================
     LOADING
     ========================================================== */

  if (loading) {

    return (
      <div className="flex min-h-[500px] items-center justify-center bg-slate-50 dark:bg-slate-950">

        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">

          <RefreshCw
            size={18}
            className="animate-spin"
          />

          Loading dashboard...

        </div>

      </div>
    )

  }


  /* ==========================================================
     ERROR
     ========================================================== */

  if (error) {

    return (
      <div className="min-h-full bg-slate-50 p-7 dark:bg-slate-950">

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30">

          <div className="flex items-start gap-3">

            <AlertTriangle
              size={20}
              className="mt-0.5 text-red-500"
            />

            <div>

              <h2 className="font-semibold text-red-800 dark:text-red-300">
                Unable to load dashboard
              </h2>

              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>

              <button
                onClick={loadDashboard}
                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Try again
              </button>

            </div>

          </div>

        </div>

      </div>
    )

  }


  /* ==========================================================
     MAIN DASHBOARD
     ========================================================== */

  return (

    <div className="min-h-full w-full bg-[#F8FAFC] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">

      <div className="mx-auto w-full max-w-7xl p-7">

        {/* ====================================================
           HEADER
        ==================================================== */}

        <div className="mb-7 flex items-start justify-between">

          <div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Overview of your AI governance activity.
            </p>

          </div>


          {/* CLEAR HISTORY */}

          <button
            type="button"
            onClick={clearHistory}
            disabled={clearing}
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-red-200
              bg-white
              px-3.5
              py-2
              text-xs
              font-medium
              text-red-600
              shadow-sm
              transition

              hover:bg-red-50

              disabled:cursor-not-allowed
              disabled:opacity-50

              dark:border-red-900/60
              dark:bg-slate-900
              dark:text-red-400
              dark:hover:bg-red-950/30
            "
          >

            {clearing ? (
              <RefreshCw
                size={15}
                className="animate-spin"
              />
            ) : (
              <Trash2
                size={15}
              />
            )}

            {clearing
              ? "Clearing..."
              : "Clear History"}

          </button>

        </div>


        {/* ====================================================
           STAT CARDS
        ==================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total interactions"
            value={stats.total}
            subtitle="AI requests processed"
            icon={Activity}
          />

          <StatCard
            title="Allowed"
            value={stats.allowed}
            subtitle="Requests allowed"
            icon={CheckCircle2}
          />

          <StatCard
            title="Blocked"
            value={stats.blocked}
            subtitle="Requests blocked"
            icon={Ban}
          />

          <StatCard
            title="Human review"
            value={stats.humanReview}
            subtitle="Requests awaiting review"
            icon={Users}
          />

        </div>


        {/* ====================================================
           RISK + OVERVIEW
        ==================================================== */}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">


          {/* RISK OVERVIEW */}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="mb-6">

              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Risk overview
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Average risk scores across processed interactions.
              </p>

            </div>

            <RiskBar
              label="Privacy"
              value={riskStats.privacy}
            />

            <RiskBar
              label="Hallucination"
              value={riskStats.hallucination}
            />

            <RiskBar
              label="Bias"
              value={riskStats.bias}
            />

            <RiskBar
              label="Security"
              value={riskStats.security}
            />

            <RiskBar
              label="Policy"
              value={riskStats.policy}
            />

          </div>


          {/* WORKSPACE OVERVIEW */}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="mb-6">

              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Workspace overview
              </h2>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Current governance workspace statistics.
              </p>

            </div>


            <div className="space-y-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">

                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Applications
                </span>

                <span className="font-semibold text-slate-900 dark:text-white">
                  {dashboard?.applications ?? "—"}
                </span>

              </div>


              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">

                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Policies
                </span>

                <span className="font-semibold text-slate-900 dark:text-white">
                  {dashboard?.policies ?? "—"}
                </span>

              </div>


              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">

                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Human review
                </span>

                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {stats.humanReview}
                </span>

              </div>


              <div className="flex items-center justify-between">

                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Total interactions
                </span>

                <span className="font-semibold text-slate-900 dark:text-white">
                  {stats.total}
                </span>

              </div>

            </div>

          </div>

        </div>


        {/* ====================================================
           RECENT INTERACTIONS
        ==================================================== */}

        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">

            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent interactions
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Latest AI requests processed in your workspace.
            </p>

          </div>


          {interactions.length === 0 ? (

            <div className="px-6 py-12 text-center">

              <Activity
                size={28}
                className="mx-auto text-slate-300 dark:text-slate-600"
              />

              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                No interactions yet
              </p>

              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Run an interaction from the Playground
                to see it here.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-slate-100 dark:divide-slate-800">

              {interactions
                .slice(0, 8)
                .map((interaction) => (

                  <div
                    key={interaction.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >

                    <div className="min-w-0">

                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">

                        {interaction.prompt ||
                          interaction.message ||
                          "AI interaction"}

                      </p>

                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">

                        {interaction.application_name ||
                          interaction.app_id ||
                          "Application"}

                      </p>

                    </div>


                    <DecisionBadge
                      decision={
                        interaction.decision ||
                        interaction.action
                      }
                    />

                  </div>

                ))}

            </div>

          )}

        </div>

      </div>

    </div>

  )
}


export default Dashboard