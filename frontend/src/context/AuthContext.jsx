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

  const normalizedRole = String(user?.role || "")
    .trim()
    .toLowerCase();

  // On mount: validate stored token by calling /auth/me
  useEffect(() => {
    const token = localStorage.getItem("token");

    // If no token or token is literally "undefined"/"null", skip
    if (!token || token === "undefined" || token === "null") {
      setLoading(false);
      return;
    }

    authAPI
      .getMe()
      .then((res) => {
        setUser(res.data.data);
      })
      .catch(() => {
        // Token is invalid/expired — clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { user: userData, token } = res.data.data;

    // Validate token before storing
    if (!token || typeof token !== "string") {
      throw new Error("Invalid token received from server");
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const isAdmin = normalizedRole === "admin";
  const isHR = normalizedRole === "hr";
  const isEmployee = normalizedRole === "employee";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin,
        isHR,
        isEmployee,
        normalizedRole,
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
