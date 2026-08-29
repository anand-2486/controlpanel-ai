import axios from "axios"

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
})

/*
 * Attach backend authentication token
 * to every API request.
 */
api.interceptors.request.use(
  (config) => {

    const token = localStorage.getItem(
      "controlpanel_token"
    )

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`
    }

    return config
  },

  (error) => {
    return Promise.reject(error)
  }
)


/*
 * If FastAPI says the token is invalid,
 * tell the application to log the user out.
 */
api.interceptors.response.use(
  (response) => response,

  (error) => {

    if (error.response?.status === 401) {

      window.dispatchEvent(
        new Event("auth-expired")
      )

    }

    return Promise.reject(error)
  }
)


export default api