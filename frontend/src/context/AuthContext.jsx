import { createContext, useContext, useEffect, useState, useCallback } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("cms_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cms_token");
    if (!token) {
      setLoading(false);
      return;
    }
    client
      .get("/auth/me")
      .then(() => setLoading(false))
      .catch(() => {
        localStorage.removeItem("cms_token");
        localStorage.removeItem("cms_user");
        setUser(null);
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await client.post("/auth/login", { username, password });
    localStorage.setItem("cms_token", data.token);
    localStorage.setItem("cms_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("cms_token");
    localStorage.removeItem("cms_user");
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...patch };
      localStorage.setItem("cms_user", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
