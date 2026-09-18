/* =========================================================================
   supabase.js — the server-side Supabase client.

   SECURITY
     The service-role key bypasses every Row Level Security policy. It lives
     ONLY in this process's environment, is never sent to the browser, never
     written to a response, and never logged. Nothing in frontend/ imports
     this file.

   Supabase is OPT-IN: with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set,
   the backend uses Postgres and Storage. Without them it keeps using the
   local JSON file exactly as before, so development is unchanged and a
   missing variable can never silently fall back to a half-configured state
   in production (see assertProductionReady below).
   ========================================================================= */
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let client = null;

/** Is Supabase configured for this process? */
function isEnabled() {
  return !!(URL && SERVICE_KEY);
}

/** The shared service-role client, or null when Supabase is not configured. */
function getClient() {
  if (!isEnabled()) return null;
  if (!client) {
    client = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      // This backend has its own JWT auth; Supabase Auth is not used.
      global: { headers: { "x-application-name": "cms-backend" } },
    });
  }
  return client;
}

/**
 * In production the app must not quietly run on the local JSON file, because
 * that file does not survive a redeploy. Fail loudly at startup instead.
 */
function assertProductionReady() {
  if (process.env.NODE_ENV === "production" && !isEnabled()) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set when NODE_ENV=production. " +
        "Without them the backend would store data in a local file that is lost on redeploy."
    );
  }
}

/** Confirms the credentials work, without ever revealing them. */
async function checkConnection() {
  const supabase = getClient();
  if (!supabase) return { ok: false, reason: "not-configured" };
  try {
    const { error } = await supabase.from("cms_seq").select("key").limit(1);
    if (error) return { ok: false, reason: error.message };
    return { ok: true, url: URL };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = { getClient, isEnabled, assertProductionReady, checkConnection, SUPABASE_URL: URL };
