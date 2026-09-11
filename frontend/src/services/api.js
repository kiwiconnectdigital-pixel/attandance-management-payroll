// services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
  changePassword: (data) => api.put("/auth/change-password", data),
  register: (data) => api.post("/auth/register", data),
};

// ─── Employees ────────────────────────────────────────
export const employeeAPI = {
  getAll: (params) => api.get("/employees", { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (formData) =>
    api.post("/employees", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id, formData) =>
    api.put(`/employees/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id) => api.delete(`/employees/${id}`),
};

// ─── Attendance ───────────────────────────────────────
export const attendanceAPI = {
  checkIn: (formData) =>
    api.post("/attendance/checkin", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  checkInWithLocation: (formData) =>
    api.post("/attendance/check-in-location", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  checkOut: (formData) =>
    api.post("/attendance/checkout", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getAllDetailed: (params) => api.get("/attendance/all-detailed", { params }),
  getAll: (params) => api.get("/attendance", { params }),
  getTodaySummary: () => api.get("/attendance/today-summary"),
  getById: (id) => api.get(`/attendance/${id}`),
  getMonthlyCalendar: (params) =>
    api.get("/attendance/monthly-calendar", { params }),
  update: (id, data) => api.put(`/attendance/${id}`, data),
  create: (data) => api.post("/attendance/create", data),
  delete: (id) => api.delete(`/attendance/${id}`),
  bulkUpdate: (data) => api.post("/attendance/bulk-update", data),
  getLiveLocations: () => api.get("/attendance/live-locations"),
  getLocationTrail: (attendanceId) =>
    api.get(`/attendance/${attendanceId}/location-trail`),
  trackLocation: (data) => api.post("/attendance/location-ping", data),
};

// ─── Leaves ───────────────────────────────────────────
export const leaveAPI = {
  apply: (data) => api.post("/leaves", data),
  getAll: (params) => api.get("/leaves", { params }),
  review: (id, data) => api.put(`/leaves/${id}/review`, data),
};

// ─── Payroll ──────────────────────────────────────────
export const payrollAPI = {
  process: (data) => api.post("/payroll/process", data),
  getAll: (params) => api.get("/payroll", { params }),
  markPaid: (id) => api.put(`/payroll/${id}/mark-paid`),
};

// ─── Payslips ─────────────────────────────────────────
export const payslipAPI = {
  generate: (payrollId) => api.post(`/payslips/generate/${payrollId}`),
  getAll: (params) => api.get("/payslips", { params }),
};

// ─── Branches ─────────────────────────────────────────
export const branchAPI = {
  getAll: (params) => api.get("/branches", { params }),
  create: (data) => api.post("/branches", data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
  updateGeofence: (id, data) => api.put(`/branches/${id}/geofence`, data),
  testGeofence: (id, data) => api.post(`/branches/${id}/geofence/test`, data),
};

// ─── Holidays ─────────────────────────────────────────
export const holidayAPI = {
  getAll: (params) => api.get("/holidays", { params }),
  getById: (id) => api.get(`/holidays/${id}`),
  create: (data) => api.post("/holidays", data),
  bulkCreate: (data) => api.post("/holidays/bulk", data),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  delete: (id) => api.delete(`/holidays/${id}`),
};

// ─── Companies (Super Admin) ────────────────────────────
export const companyAPI = {
  getAll: (params) => api.get("/companies", { params }),

  getById: (id) => api.get(`/companies/${id}`),

  create: (data) => api.post("/companies", data),

  // =====================================================
  // PATCH SETTINGS
  // =====================================================

  updateEmployeeTracking: (id, enabled) =>
    api.patch(`/companies/${id}/employee-tracking`, {
      employeeTrackingEnabled: enabled,
    }),

  updateEmployeeLimit: (id, limit) =>
    api.patch(`/companies/${id}/employee-limit`, {
      employeeLimit: Number(limit),
    }),

  updateOfficeLocation: (id, enabled) =>
    api.patch(`/companies/${id}/office-location`, {
      officeLocationEnabled: enabled,
    }),

  // =====================================================
  // COMPANY STATUS
  // =====================================================

  toggleStatus: (id) =>
    api.patch(`/companies/${id}/toggle-status`),

  // =====================================================
  // DELETE
  // =====================================================

  delete: (id) =>
    api.delete(`/companies/${id}`),

  // =====================================================
  // COMPANY ADMINS
  // =====================================================

  getAdmins: (companyId) =>
    api.get(`/companies/${companyId}/admins`),

  createAdmin: (companyId, data) =>
    api.post(`/companies/${companyId}/admins`, data),
};

// ─── Users / Accounts ─────────────────────────────────
export const userAPI = {
  getAll: (params) => api.get("/users", { params }),

  create: (data) =>
    api.post("/users", {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      company_id: data.companyId || data.company_id || null,
    }),

  update: (id, data) =>
    api.put(`/users/${id}`, {
      name: data.name,
      email: data.email,
      role: data.role,
      company_id: data.companyId || data.company_id || null,
      is_active: data.is_active,
    }),

  updateStatus: (id, is_active) =>
    api.patch(`/users/${id}/status`, { is_active }),

  resetPassword: (id, password) =>
    api.post(`/users/${id}/reset-password`, { password }),

  delete: (id) => api.delete(`/users/${id}`),
};

export default api;