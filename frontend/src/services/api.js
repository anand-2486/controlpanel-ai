import axios from "axios"

const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname || "127.0.0.1"}:8000`

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Automatically attach stored token to outgoing requests
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("controlpanel_token") ||
    sessionStorage.getItem("controlpanel_token")

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api