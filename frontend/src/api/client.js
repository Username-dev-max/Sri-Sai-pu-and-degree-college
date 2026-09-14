import axios from "axios";
import { readToken, clearAuthStorage } from "./session";

const client = axios.create({ baseURL: "/api" });

client.interceptors.request.use((config) => {
  const token = readToken();
  // An explicitly supplied Authorization header wins. Logout relies on this:
  // it sends the token it captured BEFORE storage was cleared.
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    // A revoked, expired or unknown session. Clear BOTH storages: the old
    // handler cleared only localStorage, so a session held in sessionStorage
    // survived. A failed login attempt is a wrong password, not an ended
    // session, so it is excluded.
    const url = String(err.config?.url || "");
    if (err.response && err.response.status === 401 && !url.includes("/auth/login")) {
      clearAuthStorage();
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default client;
