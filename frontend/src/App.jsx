import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom"

import AppShell from "./components/layout/AppShell"

import SignIn from "./pages/SignIn"
import Playground from "./pages/Playground"
import Dashboard from "./pages/Dashboard"
import Policies from "./pages/Policies"
import Incidents from "./pages/Incidents"
import HumanReview from "./pages/HumanReview"


function ProtectedRoute({ children }) {

  const token =
    localStorage.getItem(
      "controlpanel_token"
    ) ||
    sessionStorage.getItem(
      "controlpanel_token"
    )

  if (!token) {
    return (
      <Navigate
        to="/signin"
        replace
      />
    )
  }

  return children
}


function App() {

  return (

    <Routes>

      {/* =====================================================
          ROOT
      ===================================================== */}

      <Route
        path="/"
        element={
          <Navigate
            to="/signin"
            replace
          />
        }
      />


      {/* =====================================================
          SIGN IN
      ===================================================== */}

      <Route
        path="/signin"
        element={
          <SignIn />
        }
      />


      {/* =====================================================
          PLAYGROUND
          History is now INSIDE Playground.jsx
      ===================================================== */}

      <Route
        path="/playground"
        element={
          <ProtectedRoute>
            <AppShell>
              <Playground />
            </AppShell>
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          DASHBOARD
      ===================================================== */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          POLICIES
      ===================================================== */}

      <Route
        path="/policies"
        element={
          <ProtectedRoute>
            <AppShell>
              <Policies />
            </AppShell>
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          INCIDENTS
      ===================================================== */}

      <Route
        path="/incidents"
        element={
          <ProtectedRoute>
            <AppShell>
              <Incidents />
            </AppShell>
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          HUMAN REVIEW
      ===================================================== */}

      <Route
        path="/human-review"
        element={
          <ProtectedRoute>
            <AppShell>
              <HumanReview />
            </AppShell>
          </ProtectedRoute>
        }
      />


      {/* =====================================================
          FALLBACK
      ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/signin"
            replace
          />
        }
      />

    </Routes>

  )
}


export default App