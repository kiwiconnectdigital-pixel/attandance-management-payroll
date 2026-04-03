import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RoleRoute({ roles }) {
  const { normalizedRole } = useAuth();
  const allowed = roles.map((role) => String(role).trim().toLowerCase());

  return allowed.includes(normalizedRole) ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}
