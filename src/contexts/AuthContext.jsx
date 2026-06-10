import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for existing tokens and fetch user profile
  useEffect(() => {
    const token = localStorage.getItem("ea_access_token");
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get("/api/agent/profile/");
      setUser(data);
      // Organization comes nested in the profile response:
      // { username, full_name, organization: { id, name, logo_url }, enabled_modules: [...] }
      if (data.organization) {
        setOrganization(data.organization);
      }
    } catch {
      localStorage.removeItem("ea_access_token");
      localStorage.removeItem("ea_refresh_token");
      setUser(null);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (username, password) => {
    const { data } = await api.post("/api/token/", { username, password });
    localStorage.setItem("ea_access_token", data.access);
    localStorage.setItem("ea_refresh_token", data.refresh);
    await fetchProfile();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ea_access_token");
    localStorage.removeItem("ea_refresh_token");
    setUser(null);
    setOrganization(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
