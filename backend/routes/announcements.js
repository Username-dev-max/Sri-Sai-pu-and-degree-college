/* =========================================================================
   announcements.js — targeted announcements.

   The audience filter is applied on the SERVER for every read. Hiding a
   card in the UI is not the control: a Student calling GET /api/announcements
   simply never receives rows addressed to Faculty, and GET /:id on one
   returns 404.
   ========================================================================= */
const express = require("express");
const repo = require("../repo");
const { load } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notifyMany, audienceMatches, isLive, recipientsFor } = require("../services");

const router = express.Router();
router.use(verifyToken);

const CATEGORIES = ["General", "Academic", "Examination", "Fees", "Event", "Holiday", "Urgent"];
const PRIORITIES = ["Normal", "High", "Urgent"];

function normaliseAudience(raw) {
  const a = raw || {};
  const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  return {
    roles: arr(a.roles),
    streams: arr(a.streams),
    departments: arr(a.departments),
    classes: arr(a.classes),
    studentIds: arr(a.studentIds),
  };
}

/** What a non-admin reader is allowed to see of an announcement. */
function forReader(a) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    priority: a.priority,
    attachmentUrl: a.attachmentUrl || "",
    attachmentName: a.attachmentName || "",
    publishDate: a.publishDate,
    expiryDate: a.expiryDate || "",
    createdAt: a.createdAt,
    postedBy: a.postedByName || "College Office",
  };
}

// GET /api/announcements — the caller's own feed (Admin sees all, incl. drafts).
router.get("/", (req, res) => {
  const db = load();
  const all = repo.findAll("announcements");

  if (req.user.role === "Admin") {
    const sorted = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ announcements: sorted });
  }

  const visible = all
    .filter((a) => isLive(a))
    .filter((a) => audienceMatches(a, req.user, db))
    .sort((a, b) => {
      const rank = { Urgent: 0, High: 1, Normal: 2 };
      const d = (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
      return d !== 0 ? d : new Date(b.publishDate || b.createdAt) - new Date(a.publishDate || a.createdAt);
    })
    .map(forReader);

  res.json({ announcements: visible });
});

// GET /api/announcements/:id
router.get("/:id", (req, res) => {
  const db = load();
  const a = repo.findById("announcements", req.params.id);
  if (!a) return res.status(404).json({ error: "Announcement not found." });
  if (req.user.role === "Admin") return res.json({ announcement: a });
  // Not visible to this reader → indistinguishable from not existing.
  if (!isLive(a) || !audienceMatches(a, req.user, db)) {
    return res.status(404).json({ error: "Announcement not found." });
  }
  res.json({ announcement: forReader(a) });
});

// POST /api/announcements  (Admin)
router.post("/", requireRole("Admin"), (req, res) => {
  const b = req.body || {};
  if (!b.title || !String(b.title).trim()) return res.status(400).json({ error: "Title is required." });
  if (b.category && !CATEGORIES.includes(b.category)) {
    return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(", ")}` });
  }
  if (b.priority && !PRIORITIES.includes(b.priority)) {
    return res.status(400).json({ error: `Priority must be one of: ${PRIORITIES.join(", ")}` });
  }
  if (b.publishDate && b.expiryDate && new Date(b.expiryDate) < new Date(b.publishDate)) {
    return res.status(400).json({ error: "The expiry date cannot be before the publish date." });
  }

  const now = new Date().toISOString();
  const row = {
    id: repo.nextId("announcements", "ANN", "announcement"),
    title: String(b.title).trim(),
    body: b.body || "",
    category: b.category || "General",
    priority: b.priority || "Normal",
    attachmentUrl: b.attachmentUrl || "",
    attachmentName: b.attachmentName || "",
    publishDate: b.publishDate || now.slice(0, 10),
    expiryDate: b.expiryDate || "",
    audience: normaliseAudience(b.audience),
    published: !!b.published,
    createdBy: req.user.id,
    postedByName: req.user.name || "College Office",
    createdAt: now,
    notifiedAt: null,
  };
  repo.insert("announcements", row);

  audit(req, {
    action: "announcement.created",
    entityType: "announcement",
    entityId: row.id,
    after: row,
    summary: `Created announcement "${row.title}"${row.published ? " (published)" : " (draft)"}`,
  });

  if (row.published) fanOut(req, row);
  res.status(201).json({ announcement: row });
});

// PUT /api/announcements/:id  (Admin)
router.put("/:id", requireRole("Admin"), (req, res) => {
  const a = repo.findById("announcements", req.params.id);
  if (!a) return res.status(404).json({ error: "Announcement not found." });
  const before = { ...a };
  const b = req.body || {};

  const wasPublished = a.published;
  ["title", "body", "category", "priority", "attachmentUrl", "attachmentName", "publishDate", "expiryDate"].forEach((f) => {
    if (b[f] !== undefined) a[f] = b[f];
  });
  if (b.audience !== undefined) a.audience = normaliseAudience(b.audience);
  if (b.published !== undefined) a.published = !!b.published;
  repo.commit();

  audit(req, {
    action: "announcement.updated",
    entityType: "announcement",
    entityId: a.id,
    before,
    after: { ...a },
    summary: `Updated announcement "${a.title}"`,
  });

  // Notify on the transition into published, not on every later edit.
  if (!wasPublished && a.published) fanOut(req, a);
  res.json({ announcement: a });
});

// DELETE /api/announcements/:id  (Admin)
router.delete("/:id", requireRole("Admin"), (req, res) => {
  const a = repo.findById("announcements", req.params.id);
  if (!a) return res.status(404).json({ error: "Announcement not found." });
  repo.remove("announcements", a.id);
  // Leave no orphaned notifications pointing at a row that is gone.
  repo.removeWhere("notifications", { relatedType: "announcement", relatedId: a.id });
  audit(req, {
    action: "announcement.deleted",
    entityType: "announcement",
    entityId: a.id,
    before: a,
    summary: `Deleted announcement "${a.title}"`,
  });
  res.json({ ok: true });
});

/**
 * Notify everyone the announcement is addressed to. Recipients come from the
 * same audienceMatches() used by the read filter, so nobody is ever notified
 * about something they would not be allowed to open.
 */
function fanOut(req, announcement) {
  const db = load();
  const recipients = recipientsFor(announcement, db);
  notifyMany(recipients.map((u) => u.id), {
    title: announcement.title,
    message: (announcement.body || "").slice(0, 160),
    type: "announcement",
    relatedType: "announcement",
    relatedId: announcement.id,
  });
  announcement.notifiedAt = new Date().toISOString();
  repo.commit();
  audit(req, {
    action: "announcement.published",
    entityType: "announcement",
    entityId: announcement.id,
    summary: `Published "${announcement.title}" to ${recipients.length} recipient(s)`,
  });
  return recipients.length;
}

module.exports = router;
