import api from "./api"

export const analyzePrompt = async (payload) => {
  const response = await api.post("/analyze", payload)

  return response.data
}