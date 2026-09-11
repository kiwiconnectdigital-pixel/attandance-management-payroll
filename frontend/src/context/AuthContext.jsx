import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const normalizedRole = String(user?.role || "")
    .trim()
    .toLowerCase();

  // ✅ NEW — company settings pulled straight from login/me response
  const company = user?.company || null;
  const officeLocationEnabled = Boolean(company?.office_location_enabled);
  const employeeTrackingEnabled = Boolean(company?.employee_tracking_enabled);

  // On mount: validate stored token by calling /auth/me
  useEffect(() => {
    const validateToken = async () => {
      try {
        const token = localStorage.getItem("token");

        // If no token or token is literally "undefined"/"null", skip
        if (!token || token === "undefined" || token === "null") {
          setLoading(false);
          return;
        }

        // ✅ Wrap in try-catch to prevent unhandled promise rejections
        const res = await authAPI.getMe();
        setUser(res.data.data);
        setAuthError(null);
      } catch (error) {
        console.error("Token validation failed:", error);
        // Token is invalid/expired — clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setAuthError(error.message);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      // ✅ Validate inputs
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const res = await authAPI.login({ email, password });

      // ✅ Check if response has expected structure
      if (!res || !res.data || !res.data.data) {
        throw new Error("Invalid response structure from server");
      }

      const { user: userData, token } = res.data.data;

      // Validate token before storing
      if (!token || typeof token !== "string" || token.trim() === "") {
        throw new Error("Invalid token received from server");
      }

      // ✅ Validate user data
      if (!userData || typeof userData !== "object") {
        throw new Error("Invalid user data received from server");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      setAuthError(null);
      return userData;

    } catch (error) {
      console.error("Login error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });

      // ✅ Re-throw with a clean error message
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          "Login failed. Please try again.";
      throw new Error(errorMessage);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setAuthError(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, []);

  const isSuperAdmin = normalizedRole === "super_admin";
  const isAdmin = normalizedRole === "company_admin";
  const isHR = normalizedRole === "hr";
  const isEmployee = normalizedRole === "employee";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isSuperAdmin,
        isAdmin,
        isHR,
        isEmployee,
        normalizedRole,
        authError,
        setAuthError,
        // ✅ NEW
        company,
        officeLocationEnabled,
        employeeTrackingEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};