import {
  Bell,
  CircleUserRound,
  FileCog,
  LayoutDashboard,
  Network,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"


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

  // ==========================================================
  // USER DETAILS
  // ==========================================================

  const userName = "Enterprise Admin"
  const userEmail = "admin@controlplane.ai"
  const photoURL = null
  const initials = "EA"


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
    setCollapsed((current) => !current)
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
          USER BADGE (Auth-free mode)
      ===================================================== */}

      <div
        className="
          shrink-0
          border-t
          border-white/10
          p-3
        "
      >

        <div
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

            ${
              collapsed
                ? "justify-center px-0"
                : "gap-3 px-3"
            }
          `}
        >

          {/* AVATAR */}

          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-violet-600
              text-[10px]
              font-semibold
              text-white
            "
          >
            {initials}
          </div>


          {/* USER INFO */}

          {!collapsed && (
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
                  text-emerald-400
                "
              >
                ● System Active
              </p>

            </div>
          )}

        </div>

      </div>

    </aside>
  )
}


export default Sidebar