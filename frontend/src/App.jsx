import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import AppShell from "./components/layout/AppShell"

import Playground from "./pages/Playground"
import Dashboard from "./pages/Dashboard"
import Policies from "./pages/Policies"
import Incidents from "./pages/Incidents"
import HumanReview from "./pages/HumanReview"


function App() {

  return (

    <Routes>

      {/* =====================================================
          ROOT -> DASHBOARD
      ===================================================== */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />


      {/* =====================================================
          SIGN IN (Redirect to Dashboard in auth-free mode)
      ===================================================== */}

      <Route
        path="/signin"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />


      {/* =====================================================
          PLAYGROUND
      ===================================================== */}

      <Route
        path="/playground"
        element={
          <AppShell>
            <Playground />
          </AppShell>
        }
      />


      {/* =====================================================
          DASHBOARD
      ===================================================== */}

      <Route
        path="/dashboard"
        element={
          <AppShell>
            <Dashboard />
          </AppShell>
        }
      />


      {/* =====================================================
          POLICIES
      ===================================================== */}

      <Route
        path="/policies"
        element={
          <AppShell>
            <Policies />
          </AppShell>
        }
      />


      {/* =====================================================
          INCIDENTS
      ===================================================== */}

      <Route
        path="/incidents"
        element={
          <AppShell>
            <Incidents />
          </AppShell>
        }
      />


      {/* =====================================================
          HUMAN REVIEW
      ===================================================== */}

      <Route
        path="/human-review"
        element={
          <AppShell>
            <HumanReview />
          </AppShell>
        }
      />


      {/* =====================================================
          FALLBACK
      ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

    </Routes>

  )
}


export default App