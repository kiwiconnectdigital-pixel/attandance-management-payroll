import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import RoleRoute from "./components/common/RoleRoute";
import DashboardLayout from "./layouts/DashboardLayout";

import Login from "./pages/auth/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import EmployeeList from "./pages/employees/EmployeeList";
import EmployeeForm from "./pages/employees/EmployeeForm";
import EmployeeProfile from "./pages/employees/EmployeeProfile";
import AttendancePage from "./pages/attendance/AttendancePage";
import LeavePage from "./pages/leave/LeavePage";
import PayrollPage from "./pages/payroll/PayrollPage";
import PayslipPage from "./pages/payslip/PayslipPage";
import ReportsPage from "./pages/reports/ReportsPage";
import BranchPage from "./pages/branches/BranchPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/leaves" element={<LeavePage />} />
              <Route path="/payslips" element={<PayslipPage />} />

              {/* HR and Admin routes */}
              <Route element={<RoleRoute roles={["admin", "hr"]} />}>
                <Route path="/employees" element={<EmployeeList />} />
                <Route path="/employees/new" element={<EmployeeForm />} />
                <Route path="/employees/:id/edit" element={<EmployeeForm />} />
                <Route path="/employees/:id" element={<EmployeeProfile />} />
                <Route path="/payroll" element={<PayrollPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

              {/* Admin only */}
              <Route element={<RoleRoute roles={["admin"]} />}>
                <Route path="/branches" element={<BranchPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
