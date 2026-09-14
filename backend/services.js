/* =========================================================================
   services.js — cross-cutting writes that several routes share:
   the audit trail, in-app notifications, and announcement audience matching.

   Keeping these here (rather than inline in each route) is what makes it
   possible to guarantee that every admin action is recorded the same way.
   ========================================================================= */
const repo = require("./repo");

/* ---------------------------------- audit -------------------------------- */

/** Fields never written to the audit trail in plain text. */
const REDACTED = ["password", "plainSeed", "token", "newPassword", "currentPassword"];

function scrub(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACTED.includes(k) ? "[redacted]" : v;
  }
  return out;
}

/**
 * Record an admin action. Never throws — an audit failure must not take down
 * the operation being audited, but it is logged so it cannot pass silently.
 *
 * @param req           the express request (for actor + IP)
 * @param action        verb, e.g. "student.enrolled"
 * @param entityType    e.g. "student"
 * @param entityId      affected record id
 * @param before/after  optional value snapshots (scrubbed of secrets)
 */
function audit(req, { action, entityType, entityId, before, after, summary }) {
  try {
    const row = {
      id: repo.nextId("auditLogs", "LOG", "audit"),
      actorId: req.user ? req.user.id : null,
      actorName: req.user ? req.user.name || req.user.username : "system",
      actorRole: req.user ? req.user.role : "system",
      action,
      entityType,
      entityId: entityId == null ? null : String(entityId),
      summary: summary || "",
      before: before === undefined ? null : scrub(before),
      after: after === undefined ? null : scrub(after),
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
      userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
      at: new Date().toISOString(),
    };
    repo.insert("auditLogs", row);
    return row;
  } catch (e) {
    console.error("audit write failed:", e.message);
    return null;
  }
}

/* ------------------------------ notifications ---------------------------- */

/** Create one notification for one user. */
function notify(userId, { title, message, type = "info", relatedType = null, relatedId = null }) {
  if (!userId) return null;
  return repo.insert("notifications", {
    id: repo.nextId("notifications", "NTF", "notification"),
    userId,
    title,
    message: message || "",
    type,
    relatedType,
    relatedId,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/** Create the same notification for many users in one write. */
function notifyMany(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return [];
  const now = new Date().toISOString();
  const rows = unique.map((userId) => ({
    id: repo.nextId("notifications", "NTF", "notification"),
    userId,
    title: payload.title,
    message: payload.message || "",
    type: payload.type || "info",
    relatedType: payload.relatedType || null,
    relatedId: payload.relatedId || null,
    read: false,
    createdAt: now,
  }));
  return repo.insertMany("notifications", rows);
}

/* --------------------------- announcement audience ------------------------ */

/**
 * Does this announcement reach this user?
 *
 * Audience shape: { roles: [], streams: [], departments: [], classes: [], studentIds: [] }
 * An empty/absent audience means everyone. A filter that is present and
 * non-empty must match, so narrowing never accidentally widens.
 *
 * This is the single source of truth for targeting: both the "what can I see"
 * read filter and the "who gets notified" write path call it, so a user can
 * never be notified about something they are not allowed to open.
 */
function audienceMatches(announcement, user, db) {
  const a = announcement.audience || {};
  const has = (k) => Array.isArray(a[k]) && a[k].length > 0;

  // Admin sees everything, including drafts, for management purposes.
  if (user.role === "Admin") return true;

  if (has("roles") && !a.roles.includes(user.role)) return false;

  // Student/Parent-specific narrowing resolves through the student record.
  const needsStudent = has("streams") || has("departments") || has("classes") || has("studentIds");
  if (!needsStudent) return true;

  const studentIds =
    user.role === "Student" ? [user.linkedId]
    : user.role === "Parent" ? linkedChildIds(user, db)
    : [];

  // Faculty and staff are not tied to a student record, so a purely
  // student-scoped announcement does not reach them.
  if (!studentIds.length) return false;

  return studentIds.some((sid) => {
    const s = (db.students || []).find((x) => x.id === sid);
    if (!s) return false;
    if (has("studentIds") && !a.studentIds.includes(s.id)) return false;
    if (has("streams") && !a.streams.includes(s.stream)) return false;
    if (has("departments") && !a.departments.includes(s.department)) return false;
    if (has("classes") && !a.classes.includes(s.classId || s.semester)) return false;
    return true;
  });
}

/** Every student id a parent account is allowed to see. */
function linkedChildIds(user, db) {
  if (Array.isArray(user.linkedIds) && user.linkedIds.length) return user.linkedIds;
  // Token issued before multi-child support — fall back to the stored account.
  const stored = (db.users || []).find((u) => u.id === user.id);
  if (stored && Array.isArray(stored.linkedIds) && stored.linkedIds.length) return stored.linkedIds;
  return user.linkedId ? [user.linkedId] : [];
}

/** Is the announcement live right now (published, and inside its date window)? */
function isLive(announcement, at = new Date()) {
  if (!announcement.published) return false;
  const t = at.getTime();
  if (announcement.publishDate && new Date(announcement.publishDate).getTime() > t) return false;
  if (announcement.expiryDate) {
    // Expiry is inclusive of the whole day it names.
    const end = new Date(announcement.expiryDate);
    end.setHours(23, 59, 59, 999);
    if (end.getTime() < t) return false;
  }
  return true;
}

/** The user accounts an announcement should notify on publish. */
function recipientsFor(announcement, db) {
  return (db.users || [])
    .filter((u) => u.status !== "Inactive")
    .filter((u) => u.role !== "Admin")
    .filter((u) => audienceMatches(announcement, u, db));
}

module.exports = {
  audit,
  notify,
  notifyMany,
  audienceMatches,
  linkedChildIds,
  isLive,
  recipientsFor,
};
