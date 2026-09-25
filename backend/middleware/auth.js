const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// The fallback secret is public in this repository, so tokens signed with it
// could be forged by anyone. Production refuses to run without a real one.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set when NODE_ENV=production.");
}
const JWT_SECRET = process.env.JWT_SECRET || "cms-dev-secret-change-in-production";
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

/* =========================================================================
   Server-side sessions.

   A JWT on its own cannot be revoked. Previously /auth/logout only asked the
   browser to forget its token — any copy of that token kept working against
   the API for its full 8 hours. Every token now carries a session id (jti)
   that must exist in db.authSessions and must not be revoked. Logging out
   revokes it, so the token stops working on the very next request.
   ========================================================================= */

// Required lazily: db.js must not be pulled in while this module loads, or
// the two would form a require cycle.
const db = () => require("../db");
const sessions = require("../sessionStore");

/**
 * Open a session for a successful login.
 *
 * Written straight to the store rather than into the in-memory copy: on a
 * serverless platform the next request may be served by a different
 * instance, which would otherwise never see this session and would reject
 * the token it was just issued. See sessionStore.js.
 */
async function createSession(user, req) {
  const now = Date.now();
  const session = {
    jti: crypto.randomUUID(),
    userId: user.id,
    role: user.role,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_SECONDS * 1000).toISOString(),
    revokedAt: null,
    revokedReason: "",
    ip: req ? String(req.ip || "") : "",
    userAgent: req ? String(req.headers["user-agent"] || "").slice(0, 200) : "",
  };
  await sessions.createSession(session);
  // Housekeeping only; never allowed to fail the sign-in.
  sessions.pruneExpired().catch(() => {});
  return session;
}

function signToken(user, session) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      linkedId: user.linkedId,
      // Parents may be linked to several children; carried in the token so
      // scoping checks never have to trust a client-supplied id.
      linkedIds: user.linkedIds || (user.linkedId ? [user.linkedId] : []),
      name: user.name,
      jti: session.jti,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

/** Revoke one session. Returns true if it was open and is now closed. */
function revokeSession(jti, reason = "logout") {
  return sessions.revokeSession(jti, reason);
}

/** Revoke every open session for a user, optionally sparing one. */
function revokeUserSessions(userId, options = {}) {
  return sessions.revokeUserSessions(userId, options);
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function verifyToken(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: "Missing authentication token." });

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  let session;
  let account;
  try {
    // Both read live, so an instance that started before this session was
    // opened still recognises it. Fetched together to keep the added cost to
    // a single round trip.
    [session, account] = await Promise.all([
      sessions.getSession(claims.jti),
      sessions.getUserById(claims.id),
    ]);
  } catch (e) {
    // A lookup that failed is not proof the session is gone. Saying so would
    // sign a legitimate user out on a transient database blip.
    console.error("SESSION LOOKUP FAILED:", e.message);
    return res.status(503).json({ error: "Could not verify your session. Please try again." });
  }

  // The session must exist, belong to this user, and not be revoked. A token
  // from before sessions existed has no jti and is rejected, which signs any
  // such browser out once.
  if (!session || session.revokedAt || session.userId !== claims.id) {
    return res.status(401).json({ error: "Your session has ended. Please sign in again." });
  }

  // An account deactivated (or deleted) mid-session loses access on its next
  // request rather than when the token happens to expire.
  if (!account) {
    return res.status(401).json({ error: "This account no longer exists. Please log in again." });
  }
  if (account.status === "Inactive") {
    return res.status(403).json({ error: "This account has been deactivated. Please contact the college office." });
  }

  // Trust the stored record over the token for anything authorisation
  // depends on, so a role or link change takes effect without re-login.
  req.user = {
    ...claims,
    role: account.role,
    linkedId: account.linkedId,
    linkedIds: account.linkedIds || (account.linkedId ? [account.linkedId] : []),
    // Read from the stored record rather than the token, so a photo changed
    // just now appears without signing in again.
    name: account.name,
    email: account.email || "",
    photoUrl: account.photoUrl || "",
  };
  req.session = session;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You are not authorized to perform this action." });
    }
    next();
  };
}

module.exports = {
  signToken,
  verifyToken,
  requireRole,
  createSession,
  revokeSession,
  revokeUserSessions,
  JWT_SECRET,
  TOKEN_TTL_SECONDS,
};
