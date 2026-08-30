import { useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"

import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

function AppShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Controls the actual sidebar width
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const pageInfo = {
    "/playground": {
      title: "AI Playground",
      description:
        "Test AI interactions and see governance decisions in real-time",
    },

    "/dashboard": {
      title: "Dashboard",
      description:
        "Monitor your AI governance activity",
    },

    "/policies": {
      title: "Policies",
      description:
        "Manage governance policies",
    },

    "/incidents": {
      title: "Incidents",
      description:
        "Review AI governance incidents",
    },

    "/human-review": {
      title: "Human Review",
      description:
        "Review interactions requiring human attention",
    },
  }

  const currentPage =
    pageInfo[location.pathname] ||
    pageInfo["/playground"]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">

      {/* =====================================================
          FIXED SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          h-screen
          transition-all
          duration-300
          ease-in-out
          ${
            sidebarCollapsed
              ? "w-[70px]"
              : "w-[250px]"
          }
        `}
      >
        <Sidebar
          activePage={location.pathname}
          onNavigate={navigate}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </aside>


      {/* =====================================================
          MAIN APPLICATION AREA
      ===================================================== */}

      <div
        className={`
          min-h-screen
          transition-all
          duration-300
          ease-in-out
          ${
            sidebarCollapsed
              ? "ml-[70px]"
              : "ml-[250px]"
          }
        `}
      >

        {/* =================================================
            FIXED TOPBAR
        ================================================= */}

        <div
          className={`
            fixed
            right-0
            top-0
            z-40
            h-[72px]
            transition-all
            duration-300
            ease-in-out
            ${
              sidebarCollapsed
                ? "left-[70px]"
                : "left-[250px]"
            }
          `}
        >
          <Topbar
            title={currentPage.title}
            description={currentPage.description}
          />
        </div>


        {/* =================================================
            SCROLLABLE CONTENT
        ================================================= */}

        <main
          className="
            h-screen
            overflow-y-auto
            bg-slate-50
            pt-[72px]
            dark:bg-slate-950
          "
        >
          {children}
        </main>

      </div>

    </div>
  )
}

export default AppShell