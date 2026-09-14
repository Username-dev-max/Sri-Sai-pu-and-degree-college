/* =========================================================================
   session.js — the ONLY place the app reads or writes sign-in data.

   Every piece of authentication storage lives behind these functions, so
   signing out clears all of it in one place. The 401 handler in client.js
   and the AuthContext previously each cleared their own subset of keys.

   What is stored: the session token and the non-sensitive profile the login
   response returns. What is NEVER stored anywhere: the password — or the
   username as a login-form value.

   "Remember me":
     checked   -> localStorage   (stays signed in after the browser closes)
     unchecked -> sessionStorage (signed out when the tab or browser closes)
   Either way, logout revokes the session on the server and clears both.

   Unrelated preferences (theme, login-screen sound) are deliberately left
   alone: they belong to the device, not to whoever signed in.
   ========================================================================= */

export const TOKEN_KEY = "cms_token";
export const USER_KEY = "cms_user";

// Left over from the old client-side notification read tracking.
const LEGACY_KEYS = ["cms_read_notices"];

function stores() {
  const list = [];
  try {
    list.push(window.sessionStorage);
  } catch {
    /* storage unavailable (private mode, blocked) */
  }
  try {
    list.push(window.localStorage);
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function readToken() {
  for (const s of stores()) {
    try {
      const t = s.getItem(TOKEN_KEY);
      if (t) return t;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function readUser() {
  for (const s of stores()) {
    try {
      const raw = s.getItem(USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Remove every sign-in key from BOTH storages. */
export function clearAuthStorage() {
  for (const s of stores()) {
    [TOKEN_KEY, USER_KEY, ...LEGACY_KEYS].forEach((k) => {
      try {
        s.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  }
}

/** Store a new session, first wiping any trace of the previous one. */
export function writeAuth({ token, user, remember }) {
  clearAuthStorage();
  const target = remember ? window.localStorage : window.sessionStorage;
  target.setItem(TOKEN_KEY, token);
  target.setItem(USER_KEY, JSON.stringify(user));
}

/** Update the stored profile wherever the current session lives. */
export function updateStoredUser(user) {
  for (const s of stores()) {
    try {
      if (s.getItem(TOKEN_KEY)) {
        s.setItem(USER_KEY, JSON.stringify(user));
        return;
      }
    } catch {
      /* ignore */
    }
  }
}
