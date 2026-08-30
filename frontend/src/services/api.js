import axios from "axios"

const api = axios.create({
  baseURL: `http://${window.location.hostname || "127.0.0.1"}:8000`,
  headers: {
    "Content-Type": "application/json",
  },
})

export default api