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
  checkOut: (formData) =>
    api.post("/attendance/checkout", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
     getAllDetailed: (params) =>
    api.get("/attendance/all-detailed", { params }),
  getAll: (params) => api.get("/attendance", { params }),
  getTodaySummary: () => api.get("/attendance/today-summary"),
  getById: (id) => api.get(`/attendance/${id}`),
  getMonthlyCalendar: (params) => api.get("/attendance/monthly-calendar", { params }),
  // Add to attendanceAPI object
update: (id, data) => api.put(`/attendance/${id}`, data),
create: (data) => api.post('/attendance/create', data),
delete: (id) => api.delete(`/attendance/${id}`),
bulkUpdate: (data) => api.post('/attendance/bulk-update', data),
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
  // Supports text-based geofence save (locationQuery) for backend auto-geocoding fallback.
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
// NOTE: These endpoints are new — backend needs to implement:
//   GET    /companies            -> { data: [{ _id, name, code, email, phone, status, branchCount, createdAt }] }
//   GET    /companies/:id        -> { data: {...} }
//   POST   /companies            body: { name, code, email, phone } -> { data: {...} }
//   PUT    /companies/:id        body: { name, code, email, phone }
//   PUT    /companies/:id/status body: { status: 'active' | 'inactive' }
//   DELETE /companies/:idI

export const companyAPI = {
  getAll: (params) => api.get("/companies", { params }),
  getById: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post("/companies", data),
  
  // ✅ Unified update - handles both JSON and FormData
  update: (id, data) => {
    // If data is FormData, send as multipart
    if (data instanceof FormData) {
      return api.put(`/companies/${id}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    // Otherwise send as JSON
    return api.put(`/companies/${id}`, data);
  },
  
  updateStatus: (id, status) => api.put(`/companies/${id}/status`, { status }),
  delete: (id) => api.delete(`/companies/${id}`),
  
  // ✅ Logo upload using the same update route
  updateLogo: (id, formData) => 
    api.put(`/companies/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ─── Users / Accounts (Super Admin manages Admin & HR) ──
// NOTE: These endpoints are new — backend needs to implement:
//   GET    /users?role=admin,hr&companyId=   -> { data: [{ _id, name, email, role, companyId, status, createdAt }] }
//   PUT    /users/:id            body: { name, email, role, companyId }
//   PUT    /users/:id/status     body: { status: 'active' | 'inactive' }
//   PUT    /users/:id/reset-password  body: { password }
//   DELETE /users/:id
// Account creation reuses the existing POST /auth/register endpoint
// (pass { name, email, password, role, companyId }).
// services/api.js - User API service
export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  
  create: (data) => api.post('/users', {
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    // ✅ Use company_id (snake_case) to match backend
    company_id: data.companyId || data.company_id || null
  }),
  
  update: (id, data) => api.put(`/users/${id}`, {
    name: data.name,
    email: data.email,
    role: data.role,
    company_id: data.companyId || data.company_id || null,
    is_active: data.is_active
  }),
  
  updateStatus: (id, is_active) => 
    api.patch(`/users/${id}/status`, { is_active }),
  
  resetPassword: (id, password) => 
    api.post(`/users/${id}/reset-password`, { password }),
  
  delete: (id) => api.delete(`/users/${id}`)
};

export default api;
