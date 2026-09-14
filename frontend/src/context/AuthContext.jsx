import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import client from "../api/client";
import { readToken, readUser, writeAuth, updateStoredUser, clearAuthStorage } from "../api/session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [loading, setLoading] = useState(true);
  /**
   * Bumped on every login and logout. Contexts holding user-scoped caches
   * (see DataContext) key off this so they drop stale data the instant the
   * account changes — clearing `user` alone would leave the previous
   * account's fetched records sitting in memory.
   */
  const [sessionId, setSessionId] = useState(0);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (!readToken()) {
      // No token: whatever profile is stored is meaningless. Drop it rather
      // than render a dashboard for an account we cannot authenticate.
      clearAuthStorage();
      setUser(null);
      setLoading(false);
      return;
    }
    client
      .get("/auth/me")
      .then(({ data }) => {
        // Trust the SERVER's view of who this token belongs to, not the stored
        // copy, so the UI can never render one role while the API serves another.
        if (data?.user) {
          const fresh = { ...readUser(), ...data.user };
          setUser(fresh);
          updateStoredUser(fresh);
        }
        setLoading(false);
      })
      .catch(() => {
        clearAuthStorage();
        setUser(null);
        setLoading(false);
      });
  }, []);

  /** Revoke a session on the server. Takes the token explicitly, so it still
   *  works after local storage has already been cleared. */
  const revokeOnServer = useCallback((token) => {
    if (!token) return;
    client.post("/auth/logout", null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }, []);

  /**
   * Sign in with EXACTLY the credentials typed into the form, plus the role
   * that was selected. Any previous session is ended first — on the server as
   * well as locally — so a failed attempt can never leave the last account
   * signed in behind the error message.
   */
  const login = useCallback(
    async (username, password, { role, remember = false } = {}) => {
      revokeOnServer(readToken());
      clearAuthStorage();
      setUser(null);
      setSessionId((n) => n + 1);

      const { data } = await client.post("/auth/login", { username, password, role });
      writeAuth({ token: data.token, user: data.user, remember });
      setUser(data.user);
      setSessionId((n) => n + 1);
      return data.user;
    },
    [revokeOnServer]
  );

  const logout = useCallback(() => {
    // Capture the token before clearing storage, then revoke it server-side:
    // a copy of it must stop working, not just this browser's.
    revokeOnServer(readToken());
    clearAuthStorage();
    setUser(null);
    setSessionId((n) => n + 1);
  }, [revokeOnServer]);

  const updateUser = useCallback((patch) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...patch };
      updateStoredUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser, sessionId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
