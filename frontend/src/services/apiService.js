import api from "./api"

export async function getApplications() {
  const response =
    await api.get("/api/applications")

  return response.data
}

export async function getPolicies() {
  const response =
    await api.get("/api/policies")

  return response.data
}

export async function createPolicy(policy) {
  const response =
    await api.post("/api/policies", policy)

  return response.data
}

export async function updatePolicy(
  policyId,
  policy
) {
  const response =
    await api.put(
      `/api/policies/${policyId}`,
      policy
    )

  return response.data
}

export async function sendChatMessage({
  applicationId,
  userId,
  message,
  prompt,
  ai_response,
  context_docs,
  history,
}) {
  const text = message || prompt
  const response =
    await api.post("/api/chat", {
      application_id: applicationId,
      user_id: userId,
      message: text,
      prompt: text,
      ai_response,
      context_docs,
      history,
    })

  return response.data
}

export async function getInteractions() {
  const response =
    await api.get("/api/interactions")

  return response.data
}

export async function getInteractionDetails(
  interactionId
) {
  const response =
    await api.get(
      `/api/interactions/${interactionId}`
    )

  return response.data
}

export async function getHumanReviews() {
  const response =
    await api.get("/api/human-review")

  return response.data
}

export async function checkBackendHealth() {
  const response =
    await api.get("/health")

  return response.data
}

export async function checkSession() {
  const response =
    await api.get("/api/auth/me")

  return response.data
}