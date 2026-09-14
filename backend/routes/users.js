/* =========================================================================
   users.js — Admin-only account administration.

   SECURITY: there is deliberately NO public registration path anywhere in
   this API. Accounts exist only because an Admin created them here, and
   every route below is behind verifyToken + requireRole("Admin").
   ========================================================================= */
const express = require("express");
const bcrypt = require("bcryptjs");
const repo = require("../repo");
const { load, save } = require("../db");
const { verifyToken, requireRole, revokeUserSessions } = require("../middleware/auth");
const { generateUsername, generatePassword } = require("../utils");
const { audit, notify } = require("../services");

const router = express.Router();
router.use(verifyToken, requireRole("Admin"));

const ROLES = ["Admin", "Faculty", "Attendance Staff", "Student", "Parent"];

/** Account shape returned to the client. Never includes the password hash. */
function publicUser(u, db) {
  const linkedIds = u.role === "Parent" ? u.linkedIds || (u.linkedId ? [u.linkedId] : []) : [];
  let linkedName = "";
  if (u.role === "Student") linkedName = (db.students.find((s) => s.id === u.linkedId) || {}).name || "";
  if (u.role === "Faculty") linkedName = (db.faculty.find((f) => f.id === u.linkedId) || {}).name || "";
  if (u.role === "Parent") {
    linkedName = linkedIds
      .map((id) => (db.students.find((s) => s.id === id) || {}).name)
      .filter(Boolean)
      .join(", ");
  }
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    email: u.email || "",
    status: u.status || "Active",
    linkedId: u.linkedId || null,
    linkedIds,
    linkedName,
    mustReset: !!u.mustReset,
    createdAt: u.createdAt || null,
    lastLogin: u.lastLogin || null,
  };
}

// GET /api/users — searchable, filterable, paginated account list.
router.get("/", (req, res) => {
  const db = load();
  const { q, role, status, page, pageSize } = req.query;
  let list = db.users.slice();

  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter(
      (u) =>
        u.username.toLowerCase().includes(s) ||
        (u.name || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s) ||
        String(u.linkedId || "").toLowerCase().includes(s)
    );
  }
  if (role) list = list.filter((u) => u.role === role);
  if (status) list = list.filter((u) => (u.status || "Active") === status);

  list.sort((a, b) => a.username.localeCompare(b.username));
  const { rows, meta } = repo.paginate(list, { page, pageSize });
  res.json({ ...meta, users: rows.map((u) => publicUser(u, db)) });
});

// GET /api/users/stats — account counts by role and status, for the dashboard.
router.get("/stats", (req, res) => {
  const db = load();
  const byRole = {};
  ROLES.forEach((r) => {
    byRole[r] = db.users.filter((u) => u.role === r).length;
  });
  res.json({
    byRole,
    total: db.users.length,
    active: db.users.filter((u) => (u.status || "Active") === "Active").length,
    inactive: db.users.filter((u) => u.status === "Inactive").length,
    neverLoggedIn: db.users.filter((u) => !u.lastLogin).length,
  });
});

// POST /api/users — create an account for an existing profile (or a
// standalone Admin / Attendance Staff account, which have no profile row).
router.post("/", (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!ROLES.includes(b.role)) {
    return res.status(400).json({ error: "A valid role is required." });
  }
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ error: "Name is required." });
  }

  // Roles backed by a profile record must point at one that exists, and
  // must not already have an account.
  let linkedId = b.linkedId || null;
  let linkedIds = Array.isArray(b.linkedIds) ? b.linkedIds.filter(Boolean) : [];

  if (b.role === "Student") {
    if (!linkedId) return res.status(400).json({ error: "A student must be selected." });
    if (!db.students.some((s) => s.id === linkedId)) {
      return res.status(404).json({ error: "That student record does not exist." });
    }
    if (db.users.some((u) => u.role === "Student" && u.linkedId === linkedId)) {
      return res.status(409).json({ error: "This student already has a login account." });
    }
  } else if (b.role === "Faculty") {
    if (!linkedId) return res.status(400).json({ error: "A faculty member must be selected." });
    if (!db.faculty.some((f) => f.id === linkedId)) {
      return res.status(404).json({ error: "That faculty record does not exist." });
    }
    if (db.users.some((u) => u.role === "Faculty" && u.linkedId === linkedId)) {
      return res.status(409).json({ error: "This faculty member already has a login account." });
    }
  } else if (b.role === "Parent") {
    if (!linkedIds.length) return res.status(400).json({ error: "Link the parent to at least one student." });
    const missing = linkedIds.filter((id) => !db.students.some((s) => s.id === id));
    if (missing.length) {
      return res.status(404).json({ error: `Unknown student record(s): ${missing.join(", ")}` });
    }
    linkedId = linkedIds[0];
  } else {
    linkedId = null;
    linkedIds = [];
  }

  const username = b.username
    ? String(b.username).trim().toLowerCase()
    : generateUsername(b.name, db.users.map((u) => u.username));
  if (db.users.some((u) => u.username.toLowerCase() === username)) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const plainPassword = generatePassword(10);
  db.seq.user = (db.seq.user || 0) + 1;
  const user = {
    id: db.seq.user,
    username,
    password: bcrypt.hashSync(plainPassword, 10),
    role: b.role,
    name: String(b.name).trim(),
    linkedId,
    linkedIds,
    email: b.email || "",
    status: "Active",
    mustReset: true, // the temporary password must be changed at first login
    createdAt: new Date().toISOString(),
    lastLogin: null,
  };
  db.users.push(user);
  save(db);

  audit(req, {
    action: "account.created",
    entityType: "user",
    entityId: user.id,
    after: publicUser(user, db),
    summary: `Created ${user.role} account '${user.username}'`,
  });
  notify(user.id, {
    title: "Your account is ready",
    message: "An administrator created your account. Please change your temporary password after signing in.",
    type: "account",
  });

  res.status(201).json({
    user: publicUser(user, db),
    // Returned exactly once, at creation. Never stored or retrievable later.
    credentials: { username, password: plainPassword, role: user.role },
  });
});

// PATCH /api/users/:id/status — activate / deactivate.
router.patch("/:id/status", (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Account not found." });

  const status = req.body?.status;
  if (!["Active", "Inactive"].includes(status)) {
    return res.status(400).json({ error: "Status must be Active or Inactive." });
  }
  // Guard against an admin locking the last way into the system.
  if (status === "Inactive" && user.role === "Admin") {
    const activeAdmins = db.users.filter((u) => u.role === "Admin" && (u.status || "Active") === "Active");
    if (activeAdmins.length <= 1) {
      return res.status(409).json({ error: "This is the only active administrator account — it cannot be deactivated." });
    }
  }
  if (status === "Inactive" && user.id === req.user.id) {
    return res.status(409).json({ error: "You cannot deactivate your own account." });
  }

  const before = user.status || "Active";
  user.status = status;
  save(db);
  // Deactivation also closes the account's open sessions outright.
  if (status === "Inactive") revokeUserSessions(user.id, { reason: "deactivated" });

  audit(req, {
    action: status === "Active" ? "account.activated" : "account.deactivated",
    entityType: "user",
    entityId: user.id,
    before: { status: before },
    after: { status },
    summary: `${status === "Active" ? "Activated" : "Deactivated"} '${user.username}'`,
  });
  notify(user.id, {
    title: status === "Active" ? "Account activated" : "Account deactivated",
    message:
      status === "Active"
        ? "Your account has been activated. You can sign in now."
        : "Your account has been deactivated by an administrator.",
    type: "account",
  });

  res.json({ user: publicUser(user, db) });
});

// POST /api/users/:id/reset-password — issue a fresh temporary password.
router.post("/:id/reset-password", (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Account not found." });

  const plainPassword = generatePassword(10);
  user.password = bcrypt.hashSync(plainPassword, 10);
  user.mustReset = true;
  save(db);
  // Anyone still signed in with the old password is signed out now.
  revokeUserSessions(user.id, { reason: "password-reset-by-admin" });

  audit(req, {
    action: "account.password_reset",
    entityType: "user",
    entityId: user.id,
    summary: `Reset password for '${user.username}'`,
  });
  notify(user.id, {
    title: "Your password was reset",
    message: "An administrator issued you a new temporary password. You will be asked to change it when you sign in.",
    type: "account",
  });

  res.json({ credentials: { username: user.username, password: plainPassword, role: user.role } });
});

// PUT /api/users/:id — edit the editable parts of an account.
router.put("/:id", (req, res) => {
  const db = load();
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Account not found." });

  const before = publicUser(user, db);
  const b = req.body || {};
  if (b.name !== undefined) user.name = String(b.name).trim();
  if (b.email !== undefined) user.email = b.email;
  if (b.role !== undefined && b.role !== user.role) {
    return res.status(400).json({ error: "An account's role cannot be changed. Deactivate it and create the correct one." });
  }
  if (user.role === "Parent" && Array.isArray(b.linkedIds)) {
    const missing = b.linkedIds.filter((id) => !db.students.some((s) => s.id === id));
    if (missing.length) return res.status(404).json({ error: `Unknown student record(s): ${missing.join(", ")}` });
    user.linkedIds = b.linkedIds;
    user.linkedId = b.linkedIds[0] || null;
  }
  save(db);

  audit(req, {
    action: "account.updated",
    entityType: "user",
    entityId: user.id,
    before,
    after: publicUser(user, db),
    summary: `Updated account '${user.username}'`,
  });
  res.json({ user: publicUser(user, db) });
});

module.exports = router;
module.exports.publicUser = publicUser;
