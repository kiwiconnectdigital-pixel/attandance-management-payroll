import axios from "axios";

// the rest of the app uses VITE_API_BASE_URL; accept either one
const API_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

const getAuthConfig = () => {
  const token = localStorage.getItem("token");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

export const getAIRisks = async (params = {}) => {
  const response = await axios.get(
    `${API_URL}/attendance-ai-risks`,
    {
      ...getAuthConfig(),
      params,
    }
  );

  return response.data;
};

export const getAIRiskById = async (id) => {
  const response = await axios.get(
    `${API_URL}/attendance-ai-risks/${id}`,
    getAuthConfig()
  );

  return response.data;
};

export const getAIRiskSummary = async () => {
  const response = await axios.get(
    `${API_URL}/attendance-ai-risks/summary`,
    getAuthConfig()
  );

  return response.data;
};

export const reviewAIRisk = async (id, status) => {
  const response = await axios.patch(
    `${API_URL}/attendance-ai-risks/${id}/review`,
    { status },
    getAuthConfig()
  );

  return response.data;
};

export const getEmployeeAIRiskProfile = async (employeeId) => {
  const response = await axios.get(
    `${API_URL}/attendance-ai-risks/employee/${employeeId}`,
    getAuthConfig()
  );

  return response.data;
};

// Scans the last `days` days of attendance and stores the unusual patterns
export const runAIRiskAnalysis = async (payload = {}) => {
  const response = await axios.post(
    `${API_URL}/attendance-ai-risks/run`,
    payload,
    getAuthConfig()
  );

  return response.data;
};