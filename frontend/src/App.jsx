import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";
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
import EmployeeAttendanceCalendar from "./pages/attendance/EmployeeAttendanceCalendar";
import HolidayManager from "./pages/holidays/Holidaymanager";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import CompaniesPage from "./pages/superadmin/CompaniesPage";
import AccountsPage from "./pages/superadmin/AccountsPage";
import CompanySettings from './pages/settings/CompanySettings';
import LiveLocationsPage from './pages/attendance/LiveLocationsPage';

// Sends a logged-in user to the right landing page for their role
function RoleHome() {
  const { isSuperAdmin } = useAuth();
  return <Navigate to={isSuperAdmin ? "/super-admin" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<RoleHome />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/leaves" element={<LeavePage />} />
              <Route path="/payslips" element={<PayslipPage />} />
              <Route path="/live-location" element={<Navigate to="/live-locations" replace />} />
<Route path="/live-locations" element={<LiveLocationsPage />} />

              {/* HR and Admin routes */}
              <Route element={<RoleRoute roles={["company_admin", "hr"]} />}>
                <Route path="/employees" element={<EmployeeList />} />
                <Route path="/employees/new" element={<EmployeeForm />} />
                <Route path="/employees/:id/edit" element={<EmployeeForm />} />
                <Route path="/employees/:id" element={<EmployeeProfile />} />
                <Route path="/payroll" element={<PayrollPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/calendar" element={<EmployeeAttendanceCalendar />} />
                <Route path="/holidays" element={<HolidayManager />} />
                <Route path="/settings" element={<CompanySettings />} />
              </Route>

              {/* Admin only */}
              <Route element={<RoleRoute roles={["company_admin"]} />}>
                <Route path="/branches" element={<BranchPage />} />
              </Route>

              {/* Super Admin only */}
              <Route element={<RoleRoute roles={["super_admin"]} />}>
                <Route path="/super-admin" element={<SuperAdminDashboard />} />
                <Route path="/super-admin/companies" element={<CompaniesPage />} />
                <Route path="/super-admin/accounts" element={<AccountsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<RoleHome />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
