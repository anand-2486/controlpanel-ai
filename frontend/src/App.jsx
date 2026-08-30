import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"

import AppShell from "./components/layout/AppShell"
import SignIn from "./pages/SignIn"
import Playground from "./pages/Playground"
import Dashboard from "./pages/Dashboard"
import Policies from "./pages/Policies"
import Incidents from "./pages/Incidents"
import HumanReview from "./pages/HumanReview"
import { getStoredUser } from "./services/authService"

function RequireAuth({ children }) {
  const user = getStoredUser()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  return children
}

function App() {
  const user = getStoredUser()

  return (
    <Routes>
      {/* =====================================================
          ROOT -> PLAYGROUND (if logged in/guest) else SIGNIN
      ===================================================== */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/playground" replace />
          ) : (
            <Navigate to="/signin" replace />
          )
        }
      />

      {/* =====================================================
          SIGN IN
      ===================================================== */}
      <Route
        path="/signin"
        element={<SignIn />}
      />

      {/* =====================================================
          PLAYGROUND
      ===================================================== */}
      <Route
        path="/playground"
        element={
          <RequireAuth>
            <AppShell>
              <Playground />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* =====================================================
          DASHBOARD
      ===================================================== */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <AppShell>
              <Dashboard />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* =====================================================
          POLICIES
      ===================================================== */}
      <Route
        path="/policies"
        element={
          <RequireAuth>
            <AppShell>
              <Policies />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* =====================================================
          INCIDENTS
      ===================================================== */}
      <Route
        path="/incidents"
        element={
          <RequireAuth>
            <AppShell>
              <Incidents />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* =====================================================
          HUMAN REVIEW
      ===================================================== */}
      <Route
        path="/human-review"
        element={
          <RequireAuth>
            <AppShell>
              <HumanReview />
            </AppShell>
          </RequireAuth>
        }
      />

      {/* =====================================================
          FALLBACK
      ===================================================== */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  )
}

export default App