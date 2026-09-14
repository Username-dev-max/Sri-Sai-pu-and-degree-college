const crypto = require("crypto");
const jwt = require("jsonwebtoken");

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

/** Open a session for a successful login. */
function createSession(user, req) {
  const { load, save } = db();
  const data = load();
  if (!Array.isArray(data.authSessions)) data.authSessions = [];
  const now = Date.now();

  // Drop expired sessions so the store cannot grow without bound. A token
  // whose session is gone is rejected anyway, so pruning never re-admits one.
  data.authSessions = data.authSessions.filter((s) => new Date(s.expiresAt).getTime() > now);

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
  data.authSessions.push(session);
  save(data);
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
  const { load, save } = db();
  const data = load();
  const s = (data.authSessions || []).find((x) => x.jti === jti);
  if (!s || s.revokedAt) return false;
  s.revokedAt = new Date().toISOString();
  s.revokedReason = reason;
  save(data);
  return true;
}

/** Revoke every open session for a user, optionally sparing one. */
function revokeUserSessions(userId, { exceptJti = null, reason = "revoked" } = {}) {
  const { load, save } = db();
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

function readBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function verifyToken(req, res, next) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ error: "Missing authentication token." });

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  const data = db().load();

  // The session must exist, belong to this user, and not be revoked. A token
  // from before sessions existed has no jti and is rejected, which signs any
  // such browser out once.
  const session = claims.jti ? (data.authSessions || []).find((s) => s.jti === claims.jti) : null;
  if (!session || session.revokedAt || session.userId !== claims.id) {
    return res.status(401).json({ error: "Your session has ended. Please sign in again." });
  }

  // An account deactivated (or deleted) mid-session loses access on its next
  // request rather than when the token happens to expire.
  const account = data.users.find((u) => u.id === claims.id);
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
