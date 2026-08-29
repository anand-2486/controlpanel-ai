import api from "./api"

export const getIncidents = async () => {
  const response = await api.get("/incidents")

  return response.data
}