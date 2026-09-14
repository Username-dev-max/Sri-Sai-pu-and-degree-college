const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken);

router.get("/", (req, res) => {
  const db = load();
  res.json({ assignments: db.assignments });
});

router.post("/", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const n = db.assignments.length + 1;
  const item = { id: `ASG${String(n).padStart(2, "0")}`, submissions: [], ...req.body };
  db.assignments.push(item);
  save(db);
  res.status(201).json({ item });
});

router.put("/:id", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const item = db.assignments.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Assignment not found." });
  Object.assign(item, req.body);
  save(db);
  res.json({ item });
});

router.delete("/:id", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const idx = db.assignments.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Assignment not found." });
  db.assignments.splice(idx, 1);
  save(db);
  res.json({ ok: true });
});

// POST /api/assignments/:id/submit  (Student)
router.post("/:id/submit", requireRole("Student"), (req, res) => {
  const db = load();
  const item = db.assignments.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Assignment not found." });
  if (!item.submissions.includes(req.user.linkedId)) item.submissions.push(req.user.linkedId);
  save(db);
  res.json({ item });
});

module.exports = router;
