const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { load, save, seed } = require("../db");
const {
  signToken,
  verifyToken,
  createSession,
  revokeSession,
  revokeUserSessions,
  JWT_SECRET,
} = require("../middleware/auth");
const { audit } = require("../services");

const router = express.Router();

const GENERIC_LOGIN_ERROR = "Invalid username or password.";

// Compared against when the username does not exist, so an unknown account
// takes as long to reject as a wrong password — response timing then cannot
// be used to discover which usernames exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", 10);

// Ensure seed users have real bcrypt hashes on first boot,
// and that seed accounts added after this data.json was created (e.g. the
// Attendance Staff and Parent roles) are present without needing a DB reset.
function ensureSeedUsers() {
  const db = load();
  let changed = false;
  const isProduction = process.env.NODE_ENV === "production";

  seed().users.forEach((s) => {
    // The demo accounts for the non-admin roles exist so the dashboards can
    // be signed into while developing. A real deployment must not gain a
    // login nobody asked for, so in production only the administrator is
    // created; every other account is made deliberately by an administrator.
    if (isProduction && s.username !== "admin") return;
    if (!db.users.some((u) => u.username.toLowerCase() === s.username.toLowerCase())) {
      db.users.push({ ...s });
      db.seq.user = Math.max(db.seq.user || 0, s.id);
      changed = true;
    }
  });

  db.users.forEach((u) => {
    if (u.password) return;
    const supplied = u.username === "admin" ? process.env.SEED_ADMIN_PASSWORD : null;
    const plain = supplied || crypto.randomBytes(12).toString("base64url");
    u.password = bcrypt.hashSync(plain, 10);
    // A generated password is a one-time way in, so it must be replaced at
    // first sign-in. One supplied deliberately is left as the owner set it.
    if (!supplied) {
      u.mustReset = true;
      console.log(`  First-run password for "${u.username}": ${plain}`);
      console.log("  This is shown once. Sign in and change it now.");
    }
    delete u.plainSeed;
    changed = true;
  });
  if (changed) save(db);
}
// With Supabase the database is not in memory yet at require time, so the
// seed check runs from server.js once initStore() has finished.
if (!require("../supabase").isEnabled()) ensureSeedUsers();

// POST /api/auth/login  { username, password, role? }
router.post("/login", (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const db = load();
  const user = db.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  const passwordOk = bcrypt.compareSync(String(password), user && user.password ? user.password : DUMMY_HASH);
  if (!user || !passwordOk) {
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }

  // The role chosen on the login screen is part of the attempt. It used to be
  // ignored entirely: with "Student" selected, Admin credentials left in the
  // fields signed straight back into Admin. A mismatch returns the same
  // generic error as a wrong password, so it cannot reveal an account's role.
  // Optional, so scripts and API clients that send no role keep working.
  if (role !== undefined && role !== null && role !== "" && role !== user.role) {
    return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
  }

  // Checked after the password, so this response cannot be used to enumerate
  // which usernames exist.
  if (user.status === "Inactive") {
    return res.status(403).json({ error: "This account has been deactivated. Please contact the college office." });
  }

  user.lastLogin = new Date().toISOString();
  save(db);

  const session = createSession(user, req);
  const token = signToken(user, session);
  res.json({
    token,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      linkedId: user.linkedId,
      linkedIds: user.linkedIds || (user.linkedId ? [user.linkedId] : []),
      email: user.email,
      mustReset: !!user.mustReset,
    },
  });
});

router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
// Revokes the presented token's server-side session, so that token stops
// working immediately — not only in this browser. Always answers 200: signing
// out must never fail from the user's point of view.
router.post("/logout", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  let revoked = false;
  if (token) {
    try {
      // The signature must be genuine; expiry does not matter — an expired
      // token's session is still closed.
      const claims = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      if (claims.jti) {
        revoked = revokeSession(claims.jti, "logout");
        if (revoked) {
          audit(
            { user: claims, ip: req.ip, headers: req.headers, socket: req.socket },
            { action: "auth.logout", entityType: "user", entityId: claims.id, summary: `${claims.username} signed out` }
          );
        }
      }
    } catch {
      /* forged or malformed token: nothing to revoke */
    }
  }
  res.json({ ok: true, revoked });
});

router.post("/change-password", verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const db = load();
  const user = db.users.find((u) => u.id === req.user.id);
  // 400, not 401: a wrong current password is a validation failure. A 401
  // here made the client treat it as an ended session and sign the user out.
  if (!user || !bcrypt.compareSync(currentPassword || "", user.password)) {
    return res.status(400).json({ error: "Current password is incorrect." });
  }
  user.password = bcrypt.hashSync(newPassword, 10);
  user.mustReset = false;
  save(db);

  // End every OTHER session for this account: a password change should cut
  // off anyone still holding access from the old password. This one continues.
  const ended = revokeUserSessions(user.id, { exceptJti: req.session && req.session.jti, reason: "password-changed" });
  res.json({ ok: true, otherSessionsEnded: ended });
});

module.exports = router;
module.exports.ensureSeedUsers = ensureSeedUsers;
