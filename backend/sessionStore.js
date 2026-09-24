/* =========================================================================
   sessionStore.js — login sessions and account checks, read straight from
   the database rather than from the in-memory copy.

   WHY THIS EXISTS
     db.js holds the whole database in memory and writes changes back. That
     works for one process. On a serverless platform several instances serve
     traffic at once, each holding a snapshot taken when it started, and a
     session created on one instance is invisible to every other. The result
     was a valid token being rejected with "Your session has ended" on most
     requests: signing in appeared to work, then everything failed, and two
     people could not use the site at the same time.

     Measured on the deployed site before this change: 33 of 40 requests made
     with one freshly issued token came back 401.

     Sessions and the account behind them are therefore read and written
     directly, so every instance sees the same answer. That costs two indexed
     single-row lookups per authenticated request, which is the right trade
     for an application several people use at once. Everything else still
     goes through the in-memory copy.

   WITHOUT SUPABASE
     Local development on the JSON file has exactly one process, so the
     in-memory copy is already correct and is used unchanged.
   ========================================================================= */
const { getClient, isEnabled } = require("./supabase");

const SESSIONS = "cms_auth_sessions";
const USERS = "cms_users";

/** The local-file path: one process, so db.js is already the truth. */
const local = () => require("./db");

/* ------------------------------- sessions ------------------------------- */

async function createSession(session) {
  if (!isEnabled()) {
    const { load, save } = local();
    const data = load();
    if (!Array.isArray(data.authSessions)) data.authSessions = [];
    data.authSessions.push(session);
    save(data);
    return session;
  }
  const { error } = await getClient().from(SESSIONS).upsert({ data: session }, { onConflict: "jti" });
  if (error) throw new Error(`${SESSIONS}: ${error.message}`);
  return session;
}

async function getSession(jti) {
  if (!jti) return null;
  if (!isEnabled()) {
    return (local().load().authSessions || []).find((s) => s.jti === jti) || null;
  }
  const { data, error } = await getClient().from(SESSIONS).select("data").eq("jti", jti).maybeSingle();
  // A lookup failure must not be read as "no such session", which would sign
  // a legitimate user out. Let it surface as a server error instead.
  if (error) throw new Error(`${SESSIONS}: ${error.message}`);
  return data ? data.data : null;
}

async function revokeSession(jti, reason = "logout") {
  const existing = await getSession(jti);
  if (!existing || existing.revokedAt) return false;
  const updated = { ...existing, revokedAt: new Date().toISOString(), revokedReason: reason };
  if (!isEnabled()) {
    const { load, save } = local();
    const data = load();
    const s = (data.authSessions || []).find((x) => x.jti === jti);
    if (!s) return false;
    Object.assign(s, updated);
    save(data);
    return true;
  }
  const { error } = await getClient().from(SESSIONS).upsert({ data: updated }, { onConflict: "jti" });
  if (error) throw new Error(`${SESSIONS}: ${error.message}`);
  return true;
}

/** Revoke every open session for one account, optionally sparing one. */
async function revokeUserSessions(userId, { exceptJti = null, reason = "revoked" } = {}) {
  if (!isEnabled()) {
    const { load, save } = local();
    const data = load();
    let ended = 0;
    (data.authSessions || []).forEach((s) => {
      if (s.userId === userId && !s.revokedAt && s.jti !== exceptJti) {
        s.revokedAt = new Date().toISOString();
        s.revokedReason = reason;
        ended += 1;
      }
    });
    if (ended) save(data);
    return ended;
  }
  const client = getClient();
  const { data, error } = await client.from(SESSIONS).select("data").eq("user_id", String(userId));
  if (error) throw new Error(`${SESSIONS}: ${error.message}`);
  const now = new Date().toISOString();
  const rows = (data || [])
    .map((r) => r.data)
    .filter((s) => s && !s.revokedAt && s.jti !== exceptJti)
    .map((s) => ({ data: { ...s, revokedAt: now, revokedReason: reason } }));
  if (!rows.length) return 0;
  const { error: wErr } = await client.from(SESSIONS).upsert(rows, { onConflict: "jti" });
  if (wErr) throw new Error(`${SESSIONS}: ${wErr.message}`);
  return rows.length;
}

/**
 * Drop sessions that have already expired, so the table cannot grow without
 * bound. A token whose session is gone is rejected anyway, so removing an
 * expired one never re-admits anybody. Best effort: a failure here must
 * never fail the sign-in that triggered it.
 */
async function pruneExpired() {
  if (!isEnabled()) return 0;
  try {
    const now = new Date().toISOString();
    const { data, error } = await getClient().from(SESSIONS).select("data").limit(1000);
    if (error || !data) return 0;
    const dead = data.map((r) => r.data).filter((s) => s && s.expiresAt && s.expiresAt < now).map((s) => s.jti);
    if (!dead.length) return 0;
    await getClient().from(SESSIONS).delete().in("jti", dead);
    return dead.length;
  } catch {
    return 0;
  }
}

/* -------------------------------- account ------------------------------- */

/**
 * The account as stored right now. Read live for the same reason sessions
 * are: an account created, deactivated or changed on one instance must take
 * effect on all of them, not only after a restart.
 */
async function getUserById(id) {
  if (!isEnabled()) {
    return (local().load().users || []).find((u) => u.id === id) || null;
  }
  const { data, error } = await getClient().from(USERS).select("data").eq("id", Number(id)).maybeSingle();
  if (error) throw new Error(`${USERS}: ${error.message}`);
  return data ? data.data : null;
}

module.exports = {
  createSession,
  getSession,
  revokeSession,
  revokeUserSessions,
  pruneExpired,
  getUserById,
};
