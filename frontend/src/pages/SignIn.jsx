import { useEffect, useState } from "react"
import { ShieldCheck, UserCheck, Sparkles, ArrowRight, Lock, Clock } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { signInWithGoogle, signInAsGuest, logoutUser } from "../services/authService"

function SignIn() {
  const location = useLocation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState("")

  const switchingAccount =
    new URLSearchParams(location.search).get("switch") === "1"

  useEffect(() => {
    if (!switchingAccount) return
    logoutUser()
  }, [switchingAccount])

  async function handleGoogleSignIn() {
    if (loading || guestLoading) return
    setLoading(true)
    setError("")

    try {
      await signInWithGoogle()
      window.location.replace("/playground")
    } catch (err) {
      console.error("Google sign-in error:", err)
      setError(err?.message || "Google sign-in failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleGuestSignIn() {
    if (loading || guestLoading) return
    setGuestLoading(true)
    setError("")

    try {
      await signInAsGuest()
      window.location.replace("/playground")
    } catch (err) {
      console.error("Guest sign-in error:", err)
      setError(err?.message || "Could not start guest session.")
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md">
        
        {/* BRAND HEADER */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <ShieldCheck size={30} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            ControlPlane<span className="text-violet-400">.ai</span>
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enterprise AI Governance & Real-time Guardrail Plane
          </p>
        </div>

        {/* MAIN AUTH CARD */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">
              {switchingAccount ? "Switch Account" : "Access Workspace"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Sign in with Google to retain persistent history or enter as a guest.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* GOOGLE SIGN IN BUTTON */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || guestLoading}
            className="
              relative flex w-full items-center justify-center gap-3
              rounded-xl
              border border-slate-700
              bg-white
              px-4 py-3.5
              text-sm font-semibold
              text-slate-900
              shadow-sm
              transition-all
              hover:bg-slate-100 hover:shadow-md
              active:scale-[0.99]
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-900" />
                <span>Authenticating with Google...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M21.35 12.27c0-.79-.07-1.55-.22-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 21.99c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.29v2.53A9.75 9.75 0 0 0 12 21.99Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.53 14.07A5.86 5.86 0 0 1 6.22 12c0-.72.12-1.42.31-2.07V7.4H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.6l3.24-2.53Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.89c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.83 2.91 14.63 2 12 2a9.75 9.75 0 0 0-8.71 5.4l3.24 2.53C7.3 7.61 9.46 5.89 12 5.89Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* DIVIDER */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-slate-800" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              or explore sandbox
            </span>
            <div className="h-[1px] flex-1 bg-slate-800" />
          </div>

          {/* GUEST ACCESS BUTTON */}
          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={loading || guestLoading}
            className="
              group flex w-full items-center justify-between
              rounded-xl
              border border-violet-500/30
              bg-violet-600/10
              px-4 py-3.5
              text-left
              transition-all
              hover:border-violet-500/60 hover:bg-violet-600/20
              active:scale-[0.99]
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 group-hover:bg-violet-500/30">
                <UserCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-violet-200">
                  {guestLoading ? "Starting Guest Sandbox..." : "Continue as Guest"}
                </p>
                <p className="text-[11px] text-slate-400">
                  Instant access • History resets on refresh
                </p>
              </div>
            </div>

            <ArrowRight size={16} className="text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-violet-300" />
          </button>

          {/* FEATURE COMPARISON PILLS */}
          <div className="mt-7 space-y-2.5 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex items-start gap-2.5 text-[11px] text-slate-300">
              <Lock size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              <span>
                <strong className="text-emerald-400">Authenticated:</strong> Retains full chat history, past interactions & audit logs across reloads.
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-[11px] text-slate-400">
              <Clock size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <span>
                <strong className="text-amber-400">Guest Mode:</strong> Temporary session. Chat history resets when you refresh the page.
              </span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Protected AI Governance Control Plane • v4.0
        </p>
      </div>
    </div>
  )
}

export default SignIn