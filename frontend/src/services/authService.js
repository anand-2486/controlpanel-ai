import {
  signInWithPopup,
  signOut,
} from "firebase/auth"

import { auth, googleProvider } from "./firebase"
import api from "./api"

export async function signInWithGoogle() {
  // 1. Open Google account selector
  const result = await signInWithPopup(
    auth,
    googleProvider
  )

  // 2. Get Firebase ID token
  const firebaseToken = await result.user.getIdToken(true)

  // 3. Send Firebase token to FastAPI
  const response = await api.post(
    "/api/auth/google",
    {
      credential: firebaseToken,
    }
  )

  const { token, user } = response.data

  // Clear any existing guest session
  sessionStorage.removeItem("controlpanel_token")
  sessionStorage.removeItem("controlpanel_user")

  // 4. Store persistent ControlPanel backend session
  localStorage.setItem(
    "controlpanel_token",
    token
  )

  const storedUser = {
    ...user,
    isGuest: false,
  }

  localStorage.setItem(
    "controlpanel_user",
    JSON.stringify(storedUser)
  )

  window.dispatchEvent(new Event("auth-changed"))
  return storedUser
}

export async function signInAsGuest() {
  try {
    const response = await api.post("/api/auth/guest")
    const { token, user } = response.data

    // Clear persistent storage so guest is isolated
    localStorage.removeItem("controlpanel_token")
    localStorage.removeItem("controlpanel_user")

    // Store ephemeral session in sessionStorage (clears on browser tab close/restart)
    sessionStorage.setItem("controlpanel_token", token)
    sessionStorage.setItem("controlpanel_user", JSON.stringify(user))

    window.dispatchEvent(new Event("auth-changed"))
    return user
  } catch (error) {
    console.warn("Guest endpoint fallback:", error)
    const fallbackGuest = {
      id: "guest_" + Math.random().toString(36).slice(2, 8),
      name: "Guest User",
      email: "",
      role: "GUEST",
      isGuest: true,
    }
    sessionStorage.setItem("controlpanel_token", "guest_local")
    sessionStorage.setItem("controlpanel_user", JSON.stringify(fallbackGuest))
    window.dispatchEvent(new Event("auth-changed"))
    return fallbackGuest
  }
}

export async function logoutUser() {
  try {
    const token = getStoredToken()
    if (token && !token.startsWith("guest_")) {
      await api.post("/api/auth/logout", {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
    }
  } catch (error) {
    console.warn("Backend logout failed:", error)
  }

  try {
    await signOut(auth)
  } catch {
    // Ignore firebase logout error
  }

  localStorage.removeItem("controlpanel_token")
  localStorage.removeItem("controlpanel_user")
  sessionStorage.removeItem("controlpanel_token")
  sessionStorage.removeItem("controlpanel_user")

  window.dispatchEvent(new Event("auth-changed"))
}

export function getStoredUser() {
  // Check persistent storage first (authenticated users)
  const localUser = localStorage.getItem("controlpanel_user")
  if (localUser) {
    try {
      const parsed = JSON.parse(localUser)
      if (parsed && !parsed.isGuest && parsed.role !== "GUEST") {
        return parsed
      }
    } catch {
      localStorage.removeItem("controlpanel_user")
    }
  }

  // Check ephemeral storage (guest session)
  const sessionUser = sessionStorage.getItem("controlpanel_user")
  if (sessionUser) {
    try {
      return JSON.parse(sessionUser)
    } catch {
      sessionStorage.removeItem("controlpanel_user")
    }
  }

  return null
}

export function getStoredToken() {
  return (
    localStorage.getItem("controlpanel_token") ||
    sessionStorage.getItem("controlpanel_token") ||
    ""
  )
}

export function isGuestUser() {
  const user = getStoredUser()
  return Boolean(!user || user.isGuest || user.role === "GUEST")
}