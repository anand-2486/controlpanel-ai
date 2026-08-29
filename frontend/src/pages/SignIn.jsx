import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { useLocation } from "react-router-dom"

import {
  signInWithPopup,
  signOut,
} from "firebase/auth"

import {
  auth,
  googleProvider,
} from "../services/firebase"

const API_URL = "http://127.0.0.1:8000"


function SignIn() {

  const location = useLocation()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const switchingAccount =
    new URLSearchParams(location.search).get("switch") === "1"


  /*
   * When switching accounts, clear
   * the previous session.
   */
  useEffect(() => {

    if (!switchingAccount) return

    async function prepareAccountSwitch() {

      try {
        await signOut(auth)
      } catch (error) {
        console.log(
          "Firebase sign-out:",
          error
        )
      }

      localStorage.removeItem(
        "controlpanel_token"
      )

      localStorage.removeItem(
        "controlpanel_user"
      )

      sessionStorage.removeItem(
        "controlpanel_token"
      )

      sessionStorage.removeItem(
        "controlpanel_user"
      )
    }

    prepareAccountSwitch()

  }, [switchingAccount])


  async function handleGoogleSignIn() {

    if (loading) return

    setLoading(true)
    setError("")


    try {

      /*
       * Make sure Firebase starts with
       * the account selector.
       */
      try {
        await signOut(auth)
      } catch {
        // No active Firebase account.
      }


      googleProvider.setCustomParameters({
        prompt: "select_account",
      })


      /*
       * GOOGLE LOGIN
       */
      console.log(
        "Opening Google sign-in..."
      )

      const result =
        await signInWithPopup(
          auth,
          googleProvider
        )


      const firebaseUser =
        result.user


      console.log(
        "Firebase login successful:",
        firebaseUser.email
      )


      /*
       * Get Firebase ID token.
       */
      const firebaseToken =
        await firebaseUser.getIdToken(true)


      console.log(
        "Firebase token received."
      )


      /*
       * Send Firebase token to FastAPI.
       */
      const response =
        await fetch(
          `${API_URL}/api/auth/google`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              credential:
                firebaseToken,
            }),
          }
        )


      const data =
        await response.json()


      console.log(
        "Backend response:",
        data
      )


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Backend authentication failed."
        )
      }


      /*
       * Make sure backend returned
       * a token.
       */
      if (!data.token) {

        throw new Error(
          "Backend did not return an authentication token."
        )
      }


      /*
       * SAVE BACKEND TOKEN
       */
      localStorage.setItem(
        "controlpanel_token",
        data.token
      )


      /*
       * Build user information.
       */
      const currentUser = {

        ...(data.user || {}),

        id:
          data.user?.id ||
          firebaseUser.uid,

        name:
          firebaseUser.displayName ||
          data.user?.name ||
          data.user?.displayName ||
          "User",

        displayName:
          firebaseUser.displayName ||
          data.user?.displayName ||
          data.user?.name ||
          "User",

        email:
          firebaseUser.email ||
          data.user?.email ||
          "",

        photoURL:
          firebaseUser.photoURL ||
          data.user?.photoURL ||
          null,
      }


      localStorage.setItem(
        "controlpanel_user",
        JSON.stringify(currentUser)
      )


      console.log(
        "Backend authentication successful."
      )

      console.log(
        "Token saved."
      )

      console.log(
        "Redirecting to playground..."
      )


      /*
       * IMPORTANT:
       *
       * Use a hard browser navigation instead
       * of React navigate here.
       *
       * This guarantees that App.jsx starts
       * again with the newly-created token.
       */
      window.location.replace(
        "/playground"
      )

    } catch (error) {

      console.error(
        "Google sign-in error:",
        error
      )


      setError(
        error?.message ||
        "Google sign-in failed."
      )


      try {
        await signOut(auth)
      } catch {
        // Ignore Firebase sign-out errors.
      }


      localStorage.removeItem(
        "controlpanel_token"
      )

      localStorage.removeItem(
        "controlpanel_user"
      )

      sessionStorage.removeItem(
        "controlpanel_token"
      )

      sessionStorage.removeItem(
        "controlpanel_user"
      )

    } finally {

      setLoading(false)

    }
  }


  return (

    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-6">

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">

            <ShieldCheck
              size={25}
              className="text-white"
            />

          </div>


          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            ControlPanel.ai
          </h1>


          <p className="mt-2 text-sm text-slate-500">
            AI governance and risk control
          </p>

        </div>


        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

          <div className="mb-7">

            <h2 className="text-xl font-semibold text-slate-900">
              Welcome back
            </h2>


            <p className="mt-1 text-sm text-slate-500">

              {switchingAccount
                ? "Choose a Google account for your governance workspace."
                : "Sign in to your governance workspace."}

            </p>

          </div>


          {error && (

            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">

              {error}

            </div>

          )}


          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="
              flex w-full items-center justify-center gap-3
              rounded-xl
              border border-slate-200
              bg-white
              px-4 py-3
              text-sm font-medium
              text-slate-800
              transition
              hover:bg-slate-50
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >

            {loading ? (

              <>

                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />

                Signing in...

              </>

            ) : (

              <>

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                >

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

                Continue with Google

              </>

            )}

          </button>

        </div>


        <p className="mt-6 text-center text-xs text-slate-400">
          Protected AI governance workspace
        </p>

      </div>

    </div>
  )
}


export default SignIn