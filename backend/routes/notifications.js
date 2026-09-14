/* =========================================================================
   notifications.js — per-user in-app notifications.

   Every route scopes to req.user.id. A user can only ever read or modify
   their OWN notifications; there is no route that accepts a target user id,
   so one account cannot read another's notification feed.
   ========================================================================= */
const express = require("express");
const repo = require("../repo");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken);

function mine(userId) {
  return repo
    .findAll("notifications", { userId })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// GET /api/notifications?unreadOnly=1&limit=20
router.get("/", (req, res) => {
  let list = mine(req.user.id);
  const unreadCount = list.filter((n) => !n.read).length;
  if (req.query.unreadOnly === "1") list = list.filter((n) => !n.read);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({ notifications: list.slice(0, limit), unreadCount, total: list.length });
});

// GET /api/notifications/unread-count — cheap poll for the bell badge.
router.get("/unread-count", (req, res) => {
  res.json({ unreadCount: mine(req.user.id).filter((n) => !n.read).length });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", (req, res) => {
  const n = repo.findById("notifications", req.params.id);
  // Same 404 whether it is missing or someone else's — never confirm that
  // another user's notification id exists.
  if (!n || n.userId !== req.user.id) return res.status(404).json({ error: "Notification not found." });
  repo.update("notifications", n.id, { read: true });
  res.json({ ok: true });
});

// POST /api/notifications/read-all
router.post("/read-all", (req, res) => {
  const list = mine(req.user.id).filter((n) => !n.read);
  list.forEach((n) => {
    n.read = true;
  });
  repo.commit();
  res.json({ ok: true, marked: list.length });
});

// DELETE /api/notifications/:id
router.delete("/:id", (req, res) => {
  const n = repo.findById("notifications", req.params.id);
  if (!n || n.userId !== req.user.id) return res.status(404).json({ error: "Notification not found." });
  repo.remove("notifications", n.id);
  res.json({ ok: true });
});

module.exports = router;
