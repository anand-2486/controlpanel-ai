import {
  Bell,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  UserRoundPlus,
} from "lucide-react"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import { signOut } from "firebase/auth"
import { auth } from "../../services/firebase"
import { useNavigate } from "react-router-dom"


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
  // USER
  // ----------------------------------------------------------

  const [user, setUser] = useState(() => {
    try {
      const stored =
        localStorage.getItem(
          "controlpanel_user"
        )

      return stored
        ? JSON.parse(stored)
        : null
    } catch {
      return null
    }
  })


  // ----------------------------------------------------------
  // ACCOUNT DROPDOWN
  // ----------------------------------------------------------

  const [accountOpen, setAccountOpen] =
    useState(false)

  const accountRef = useRef(null)


  // ----------------------------------------------------------
  // LISTEN FOR USER CHANGES
  // ----------------------------------------------------------

  useEffect(() => {
    function updateUser() {
      try {
        const stored =
          localStorage.getItem(
            "controlpanel_user"
          )

        setUser(
          stored
            ? JSON.parse(stored)
            : null
        )
      } catch {
        setUser(null)
      }
    }

    window.addEventListener(
      "auth-changed",
      updateUser
    )

    window.addEventListener(
      "storage",
      updateUser
    )

    return () => {
      window.removeEventListener(
        "auth-changed",
        updateUser
      )

      window.removeEventListener(
        "storage",
        updateUser
      )
    }
  }, [])


  // ----------------------------------------------------------
  // CLOSE DROPDOWN OUTSIDE CLICK
  // ----------------------------------------------------------

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        accountRef.current &&
        !accountRef.current.contains(
          event.target
        )
      ) {
        setAccountOpen(false)
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    )

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      )
    }
  }, [])


  // ----------------------------------------------------------
  // USER DETAILS
  // ----------------------------------------------------------

  const displayName =
    user?.displayName ||
    user?.name ||
    user?.display_name ||
    user?.email?.split("@")[0] ||
    "User"

  const email =
    user?.email || ""

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join("") ||
    "U"


  // ----------------------------------------------------------
  // SIGN OUT
  // ----------------------------------------------------------

  async function handleSignOut() {
    setAccountOpen(false)

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

    window.dispatchEvent(
      new Event("auth-changed")
    )

    navigate(
      "/signin",
      { replace: true }
    )
  }


  // ----------------------------------------------------------
  // CHANGE ACCOUNT
  // ----------------------------------------------------------

  async function handleChangeAccount() {
    setAccountOpen(false)

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

    window.dispatchEvent(
      new Event("auth-changed")
    )

    navigate(
      "/signin?switch=1",
      { replace: true }
    )
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

        {/* DARK MODE */}

        <button
          type="button"
          onClick={() =>
            setDarkMode(
              (value) => !value
            )
          }
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
          title={
            darkMode
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >
          {darkMode ? (
            <Sun
              size={17}
              strokeWidth={1.8}
            />
          ) : (
            <Moon
              size={17}
              strokeWidth={1.8}
            />
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
          <Bell
            size={17}
            strokeWidth={1.8}
          />

          <span
            className="
              absolute
              right-1.5
              top-1.5
              h-1.5
              w-1.5
              rounded-full
              bg-red-500
            "
          />
        </button>


        {/* ACCOUNT */}

        <div
          ref={accountRef}
          className="relative"
        >

          <button
            type="button"
            onClick={() =>
              setAccountOpen(
                (value) => !value
              )
            }
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

            <div
              className="
                flex
                h-6
                w-6
                items-center
                justify-center
                rounded-full
                bg-violet-100
                text-[9px]
                font-semibold
                text-violet-700

                dark:bg-violet-900/50
                dark:text-violet-300
              "
            >
              {initials}
            </div>

            <ChevronDown
              size={13}
              className={`
                text-slate-400
                transition-transform

                ${
                  accountOpen
                    ? "rotate-180"
                    : ""
                }
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
                w-64
                overflow-hidden
                rounded-2xl
                border
                border-slate-200
                bg-white
                shadow-xl

                dark:border-slate-700
                dark:bg-slate-900
              "
            >

              {/* USER */}

              <div
                className="
                  border-b
                  border-slate-100
                  px-4
                  py-4

                  dark:border-slate-800
                "
              >

                <div className="flex items-center gap-3">

                  <div
                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      bg-violet-100
                      text-sm
                      font-semibold
                      text-violet-700

                      dark:bg-violet-900/50
                      dark:text-violet-300
                    "
                  >
                    {initials}
                  </div>

                  <div className="min-w-0">

                    <p
                      className="
                        truncate
                        text-sm
                        font-semibold
                        text-slate-900

                        dark:text-white
                      "
                    >
                      {displayName}
                    </p>

                    {email && (
                      <p
                        className="
                          truncate
                          text-xs
                          text-slate-500

                          dark:text-slate-400
                        "
                      >
                        {email}
                      </p>
                    )}

                  </div>

                </div>

              </div>


              {/* CHANGE ACCOUNT */}

              <button
                type="button"
                onClick={
                  handleChangeAccount
                }
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  px-4
                  py-3
                  text-left
                  text-sm
                  text-slate-700
                  transition
                  hover:bg-slate-50

                  dark:text-slate-200
                  dark:hover:bg-slate-800
                "
              >

                <UserRoundPlus
                  size={16}
                  className="
                    text-slate-400
                  "
                />

                <div>
                  <p className="font-medium">
                    Change account
                  </p>

                  <p
                    className="
                      text-xs
                      text-slate-400
                    "
                  >
                    Sign in with another Google account
                  </p>
                </div>

              </button>


              {/* SIGN OUT */}

              <button
                type="button"
                onClick={
                  handleSignOut
                }
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  border-t
                  border-slate-100
                  px-4
                  py-3
                  text-left
                  text-sm
                  text-red-600
                  transition
                  hover:bg-red-50

                  dark:border-slate-800
                  dark:text-red-400
                  dark:hover:bg-red-950/30
                "
              >

                <LogOut size={16} />

                <div>
                  <p className="font-medium">
                    Sign out
                  </p>

                  <p
                    className="
                      text-xs
                      text-red-400
                    "
                  >
                    End this session
                  </p>
                </div>

              </button>

            </div>
          )}

        </div>

      </div>

    </header>
  )
}

export default Topbar