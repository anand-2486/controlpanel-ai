import {
  Bell,
  ChevronDown,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  UserCheck,
  LogIn,
  RefreshCw,
} from "lucide-react"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import { useNavigate } from "react-router-dom"
import { getStoredUser, isGuestUser, logoutUser } from "../../services/authService"


function Topbar({
  title,
  description,
}) {
  const navigate = useNavigate()

  // ----------------------------------------------------------
  // THEME
  // ----------------------------------------------------------

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark"
  })

  useEffect(() => {
    const root = document.documentElement

    if (darkMode) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [darkMode])


  // ----------------------------------------------------------
  // USER STATE
  // ----------------------------------------------------------

  const [user, setUser] = useState(() => getStoredUser())
  const [isGuest, setIsGuest] = useState(() => isGuestUser())

  // ----------------------------------------------------------
  // ACCOUNT DROPDOWN
  // ----------------------------------------------------------

  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)


  // ----------------------------------------------------------
  // LISTEN FOR AUTH CHANGES
  // ----------------------------------------------------------

  useEffect(() => {
    function updateUser() {
      const current = getStoredUser()
      setUser(current)
      setIsGuest(isGuestUser())
    }

    window.addEventListener("auth-changed", updateUser)
    window.addEventListener("storage", updateUser)

    return () => {
      window.removeEventListener("auth-changed", updateUser)
      window.removeEventListener("storage", updateUser)
    }
  }, [])


  // ----------------------------------------------------------
  // CLOSE DROPDOWN ON OUTSIDE CLICK
  // ----------------------------------------------------------

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target)
      ) {
        setAccountOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [])


  // ----------------------------------------------------------
  // USER DETAILS
  // ----------------------------------------------------------

  const displayName = isGuest ? "Guest User" : (user?.name || user?.displayName || "Enterprise User")
  const email = isGuest ? "Temporary Session (History not saved)" : (user?.email || "")
  const initials = isGuest
    ? "GU"
    : displayName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "EU"

  const photoURL = !isGuest && (user?.picture || user?.photoURL)


  async function handleLogout() {
    setAccountOpen(false)
    await logoutUser()
    navigate("/signin")
  }

  function handleSwitchAccount() {
    setAccountOpen(false)
    navigate("/signin?switch=1")
  }

  function handleSignIn() {
    setAccountOpen(false)
    navigate("/signin")
  }


  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <header
      className="
        flex
        h-[72px]
        w-full
        shrink-0
        items-center
        justify-between
        border-b
        border-slate-200
        bg-white
        px-7
        dark:border-slate-800
        dark:bg-slate-900
      "
    >
      {/* PAGE TITLE */}
      <div>
        <h1
          className="
            text-[18px]
            font-semibold
            tracking-tight
            text-slate-900
            dark:text-white
          "
        >
          {title}
        </h1>

        {description && (
          <p
            className="
              mt-0.5
              text-[11px]
              text-slate-500
              dark:text-slate-400
            "
          >
            {description}
          </p>
        )}
      </div>


      {/* RIGHT CONTROLS */}
      <div className="flex items-center gap-3">

        {/* GUEST MODE PILL */}
        {isGuest && (
          <button
            type="button"
            onClick={handleSignIn}
            className="
              hidden sm:flex items-center gap-1.5
              rounded-full
              border border-amber-300 dark:border-amber-700/50
              bg-amber-50 dark:bg-amber-950/40
              px-2.5 py-1
              text-[11px] font-medium
              text-amber-700 dark:text-amber-300
              transition hover:bg-amber-100 dark:hover:bg-amber-900/40
            "
            title="Click to sign in and save chat history"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Guest Mode</span>
            <span className="font-semibold underline ml-1">Save Chats</span>
          </button>
        )}

        {/* DARK MODE */}
        <button
          type="button"
          onClick={() => setDarkMode((value) => !value)}
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            text-slate-500
            transition
            hover:bg-slate-100
            hover:text-slate-700
            dark:text-slate-400
            dark:hover:bg-slate-800
            dark:hover:text-white
          "
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <Sun size={17} strokeWidth={1.8} />
          ) : (
            <Moon size={17} strokeWidth={1.8} />
          )}
        </button>


        {/* NOTIFICATIONS */}
        <button
          type="button"
          className="
            relative
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            text-slate-500
            transition
            hover:bg-slate-100
            hover:text-slate-700
            dark:text-slate-400
            dark:hover:bg-slate-800
            dark:hover:text-white
          "
        >
          <Bell size={17} strokeWidth={1.8} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>


        {/* ACCOUNT BUTTON */}
        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((value) => !value)}
            className="
              flex
              items-center
              gap-2
              rounded-full
              border
              border-slate-200
              bg-slate-50
              px-2
              py-1.5
              transition
              hover:bg-slate-100
              dark:border-slate-700
              dark:bg-slate-800
              dark:hover:bg-slate-700
            "
          >
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="h-6 w-6 rounded-full object-cover ring-1 ring-violet-400/50"
              />
            ) : (
              <div
                className={`
                  flex
                  h-6
                  w-6
                  items-center
                  justify-center
                  rounded-full
                  text-[9px]
                  font-semibold
                  ${
                    isGuest
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                  }
                `}
              >
                {initials}
              </div>
            )}

            <ChevronDown
              size={13}
              className={`
                text-slate-400
                transition-transform
                ${accountOpen ? "rotate-180" : ""}
              `}
            />
          </button>


          {/* DROPDOWN */}
          {accountOpen && (
            <div
              className="
                absolute
                right-0
                top-[46px]
                z-[100]
                w-72
                overflow-hidden
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-2xl
                dark:border-slate-700
                dark:bg-slate-900
              "
            >
              {/* USER HEADER */}
              <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-violet-500/20"
                    />
                  ) : (
                    <div
                      className={`
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        text-sm
                        font-semibold
                        ${
                          isGuest
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                            : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                        }
                      `}
                    >
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {displayName}
                      </p>
                      {isGuest ? (
                        <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                          GUEST
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {email}
                    </p>
                  </div>
                </div>
              </div>

              {/* GUEST NOTICE / SIGN IN CTA */}
              {isGuest ? (
                <div className="border-b border-slate-100 bg-amber-50/70 p-3.5 dark:border-slate-800 dark:bg-amber-950/20">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    ⚠️ <strong>Guest sessions are ephemeral.</strong> Previous chats and interactions will reset when you refresh the page.
                  </p>

                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="
                      mt-2.5 flex w-full items-center justify-center gap-2
                      rounded-xl
                      bg-violet-600
                      px-3 py-2
                      text-xs font-semibold
                      text-white
                      shadow-sm
                      transition hover:bg-violet-700
                    "
                  >
                    <LogIn size={14} />
                    Sign in with Google (Save History)
                  </button>
                </div>
              ) : (
                <div className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>Persistent chat history & audit log enabled</span>
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="p-1.5">
                {!isGuest && (
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="
                      flex w-full items-center gap-2.5
                      rounded-xl
                      px-3 py-2.5
                      text-xs font-medium
                      text-slate-700 transition
                      hover:bg-slate-100
                      dark:text-slate-200 dark:hover:bg-slate-800
                    "
                  >
                    <RefreshCw size={14} className="text-slate-400" />
                    Switch Google Account
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    flex w-full items-center gap-2.5
                    rounded-xl
                    px-3 py-2.5
                    text-xs font-medium
                    text-red-600 transition
                    hover:bg-red-50
                    dark:text-red-400 dark:hover:bg-red-950/30
                  "
                >
                  <LogOut size={14} className="text-red-500" />
                  {isGuest ? "Exit Guest Mode" : "Sign Out"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Topbar