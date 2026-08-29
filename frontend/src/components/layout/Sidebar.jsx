import {
  Bell,
  CircleUserRound,
  FileCog,
  LayoutDashboard,
  Network,
  Settings2,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"

import { signOut } from "firebase/auth"
import { auth } from "../../services/firebase"


const navigation = [
  {
    label: "Playground",
    path: "/playground",
    icon: Network,
  },
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Policies",
    path: "/policies",
    icon: FileCog,
  },
  {
    label: "Incidents",
    path: "/incidents",
    icon: Bell,
  },
  {
    label: "Human Review",
    path: "/human-review",
    icon: CircleUserRound,
  },
]


function Sidebar({
  collapsed,
  setCollapsed,
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const [accountOpen, setAccountOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)


  // ==========================================================
  // USER
  // ==========================================================

  let user = null

  try {
    const storedUser =
      localStorage.getItem("controlpanel_user")

    if (storedUser) {
      user = JSON.parse(storedUser)
    }
  } catch {
    user = null
  }


  const userName =
    user?.displayName ||
    user?.name ||
    "User"

  const userEmail =
    user?.email ||
    ""

  const photoURL =
    user?.photoURL ||
    user?.picture ||
    null


  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (word) =>
          word.charAt(0)
      )
      .join("")
      .toUpperCase() ||
    "U"


  // ==========================================================
  // NAVIGATION
  // ==========================================================

  function handleNavigation(path) {
    if (location.pathname === path) {
      return
    }

    navigate(path)
  }


  // ==========================================================
  // SIDEBAR TOGGLE
  // ==========================================================

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current

      // Close account menu when collapsing
      if (next) {
        setAccountOpen(false)
      }

      return next
    })
  }


  // ==========================================================
  // SIGN OUT
  // ==========================================================

  async function handleSignOut() {
    if (signingOut) {
      return
    }

    setSigningOut(true)

    try {
      await signOut(auth)
    } catch (error) {
      console.error(
        "Firebase sign out:",
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

    navigate("/signin", {
      replace: true,
    })

    setSigningOut(false)
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <aside
      className="
        relative
        flex
        h-screen
        w-full
        flex-col
        bg-[#0B1020]
        text-white
      "
    >

      {/* =====================================================
          LOGO + COLLAPSE
      ===================================================== */}

      <div
        className={`
          flex
          h-[72px]
          shrink-0
          items-center
          ${
            collapsed
              ? "justify-center"
              : "justify-between px-5"
          }
        `}
      >

        {/* LOGO */}

        <div className="flex items-center gap-2.5">

          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-violet-600
            "
          >
            <Shield
              size={18}
              className="text-white"
            />
          </div>


          {!collapsed && (
            <span
              className="
                whitespace-nowrap
                text-[16px]
                font-semibold
                tracking-tight
              "
            >
              ControlPanel

              <span className="text-violet-400">
                .ai
              </span>
            </span>
          )}

        </div>


        {/* COLLAPSE BUTTON */}

        {!collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              text-slate-500
              transition
              hover:bg-white/5
              hover:text-white
            "
          >
            <PanelLeftClose size={17} />
          </button>
        )}

      </div>


      {/* =====================================================
          EXPAND BUTTON
      ===================================================== */}

      {collapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          title="Expand sidebar"
          className="
            absolute
            -right-3
            top-[76px]
            z-[60]
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-full
            border
            border-slate-700
            bg-[#111827]
            text-slate-400
            shadow-lg
            transition
            hover:bg-violet-600
            hover:text-white
          "
        >
          <PanelLeftOpen size={14} />
        </button>
      )}


      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav
        className={`
          flex-1
          overflow-y-auto
          pt-4
          ${
            collapsed
              ? "px-2"
              : "px-3"
          }
        `}
      >

        {!collapsed && (
          <p
            className="
              mb-3
              px-3
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-slate-500
            "
          >
            Governance
          </p>
        )}


        <div className="space-y-1">

          {navigation.map((item) => {

            const Icon = item.icon

            const active =
              location.pathname === item.path


            return (
              <button
                key={item.path}
                type="button"
                onClick={() =>
                  handleNavigation(
                    item.path
                  )
                }
                title={
                  collapsed
                    ? item.label
                    : undefined
                }
                className={`
                  flex
                  w-full
                  items-center
                  rounded-lg
                  py-2.5
                  text-[13px]
                  font-medium
                  transition-all

                  ${
                    collapsed
                      ? "justify-center px-0"
                      : "gap-3 px-3"
                  }

                  ${
                    active
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }
                `}
              >

                <Icon
                  size={17}
                  strokeWidth={
                    active
                      ? 2.2
                      : 1.8
                  }
                  className="shrink-0"
                />

                {!collapsed && (
                  <span className="whitespace-nowrap">
                    {item.label}
                  </span>
                )}

              </button>
            )
          })}

        </div>

      </nav>


      {/* =====================================================
          ACCOUNT POPUP
      ===================================================== */}

      {accountOpen && (
        <div
          className={`
            absolute
            bottom-[75px]
            z-[70]
            w-[226px]
            overflow-hidden
            rounded-xl
            border
            border-slate-700
            bg-[#111827]
            shadow-2xl

            ${
              collapsed
                ? "left-[65px]"
                : "left-3"
            }
          `}
        >

          {/* USER DETAILS */}

          <div
            className="
              border-b
              border-slate-700
              px-4
              py-3
            "
          >

            <p
              className="
                truncate
                text-xs
                font-medium
                text-white
              "
            >
              {userName}
            </p>


            {userEmail && (
              <p
                className="
                  mt-1
                  truncate
                  text-[10px]
                  text-slate-500
                "
              >
                {userEmail}
              </p>
            )}

          </div>


          {/* SIGN OUT */}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="
              flex
              w-full
              items-center
              gap-3
              px-4
              py-3
              text-left
              text-xs
              text-red-400
              hover:bg-red-500/10
            "
          >

            <LogOut size={15} />

            {signingOut
              ? "Signing out..."
              : "Sign out"}

          </button>

        </div>
      )}


      {/* =====================================================
          USER
      ===================================================== */}

      <div
        className="
          shrink-0
          border-t
          border-white/10
          p-3
        "
      >

        <button
          type="button"
          onClick={() =>
            setAccountOpen(
              (open) => !open
            )
          }
          title={
            collapsed
              ? userName
              : undefined
          }
          className={`
            flex
            w-full
            items-center
            rounded-lg
            py-3
            text-left
            hover:bg-white/5

            ${
              collapsed
                ? "justify-center px-0"
                : "gap-3 px-3"
            }
          `}
        >

          {/* AVATAR */}

          {photoURL ? (

            <img
              src={photoURL}
              alt={userName}
              className="
                h-8
                w-8
                shrink-0
                rounded-full
                object-cover
              "
            />

          ) : (

            <div
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-slate-700
                text-[10px]
                font-semibold
              "
            >
              {initials}
            </div>

          )}


          {/* USER INFO */}

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">

                <p
                  className="
                    truncate
                    text-xs
                    font-medium
                    text-white
                  "
                >
                  {userName}
                </p>

                <p
                  className="
                    truncate
                    text-[10px]
                    text-slate-500
                  "
                >
                  Governance Admin
                </p>

              </div>


              <Settings2
                size={14}
                className={`
                  shrink-0
                  text-slate-500
                  transition-transform

                  ${
                    accountOpen
                      ? "rotate-90 text-violet-400"
                      : ""
                  }
                `}
              />
            </>
          )}

        </button>

      </div>

    </aside>
  )
}


export default Sidebar