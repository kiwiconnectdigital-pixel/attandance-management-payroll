import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const getAuthConfig = () => {
  const token = localStorage.getItem("token");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

// Get AI risks
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

// Get single AI risk
export const getAIRiskById = async (id) => {
  const response = await axios.get(
    `${API_URL}/attendance-ai-risks/${id}`,
    getAuthConfig()
  );

  return response.data;
};

// Get dashboard summary
export const getAIRiskSummary = async () => {
  const response = await axios.get(
    `${API_URL}/attendance-ai-risks/summary`,
    getAuthConfig()
  );

  return response.data;
};

// Review / dismiss / confirm
export const reviewAIRisk = async (id, status) => {
  const response = await axios.patch(
    `${API_URL}/attendance-ai-risks/${id}/review`,
    { status },
    getAuthConfig()
  );

  return response.data;
};

// Employee AI profile
export const getEmployeeAIRiskProfile = async (employeeId) => {
  const response = await axios.get(
    `${API_URL}/employees/${employeeId}/ai-risk-profile`,
    getAuthConfig()
  );

  return response.data;
};