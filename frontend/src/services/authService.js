import {
    signInWithPopup,
    signOut,
  } from "firebase/auth"
  
  import { auth, googleProvider } from "../firebase"
  import api from "./api"
  
  export async function signInWithGoogle() {
    // 1. Open Google account selector
    const result = await signInWithPopup(
      auth,
      googleProvider
    )
  
    // 2. Get Firebase ID token
    const firebaseToken = await result.user.getIdToken()
  
    // 3. Send Firebase token to FastAPI
    const response = await api.post(
      "/api/auth/google",
      {
        credential: firebaseToken,
      }
    )
  
    const { token, user } = response.data
  
    // 4. Store ControlPanel backend session
    localStorage.setItem(
      "controlpanel_token",
      token
    )
  
    localStorage.setItem(
      "controlpanel_user",
      JSON.stringify(user)
    )
  
    return user
  }
  
  export async function logoutUser() {
    try {
      await api.post("/api/auth/logout")
    } catch (error) {
      console.warn("Backend logout failed:", error)
    }
  
    await signOut(auth)
  
    localStorage.removeItem("controlpanel_token")
    localStorage.removeItem("controlpanel_user")
  }
  
  export function getStoredUser() {
    const user = localStorage.getItem(
      "controlpanel_user"
    )
  
    if (!user) {
      return null
    }
  
    try {
      return JSON.parse(user)
    } catch {
      localStorage.removeItem(
        "controlpanel_user"
      )
  
      return null
    }
  }
  
  export function getStoredToken() {
    return localStorage.getItem(
      "controlpanel_token"
    )
  }