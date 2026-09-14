const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { linkedChildIds } = require("../services");

const router = express.Router();
router.use(verifyToken);

/** Fields a creator may set. Anything else in the body (id, submissions,
 *  createdBy) is ignored, so a request cannot forge ownership or pre-fill
 *  another student's submission. */
const WRITABLE = ["title", "description", "subject", "dueDate", "maxMarks", "classId", "sectionId"];

function pick(body) {
  const out = {};
  WRITABLE.forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k];
  });
  return out;
}

/**
 * Who may see which submissions.
 *
 * `submissions` is a list of student ids. Returning it whole to a Student
 * disclosed which classmates had submitted. A Student now sees only their own
 * id (so `submissions.includes(myId)` still works unchanged), a Parent only
 * their linked children's, and staff the full roster they need to mark.
 */
function projectForViewer(item, user, db) {
  if (user.role === "Admin" || user.role === "Faculty") return item;
  const allowed =
    user.role === "Student" ? [user.linkedId]
    : user.role === "Parent" ? linkedChildIds(user, db)
    : [];
  return { ...item, submissions: (item.submissions || []).filter((id) => allowed.includes(id)) };
}

/** A Faculty member may change only assignments they created. */
function canModify(item, user) {
  if (user.role === "Admin") return true;
  if (user.role !== "Faculty") return false;
  // Rows created before ownership was recorded have no owner, so only an
  // Admin may change them rather than every faculty member.
  return !!item.createdBy && item.createdBy === user.linkedId;
}

router.get("/", (req, res) => {
  const db = load();
  res.json({ assignments: db.assignments.map((a) => projectForViewer(a, req.user, db)) });
});

router.post("/", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const body = pick(req.body || {});
  if (!body.title || !String(body.title).trim()) {
    return res.status(400).json({ error: "Title is required." });
  }
  const n = db.assignments.length + 1;
  const item = {
    id: `ASG${String(n).padStart(2, "0")}`,
    ...body,
    submissions: [],
    createdBy: req.user.role === "Faculty" ? req.user.linkedId : null,
    createdByUserId: req.user.id,
    createdAt: new Date().toISOString(),
  };
  // Guard against an id collision after deletions shrank the array.
  while (db.assignments.some((a) => a.id === item.id)) {
    item.id = `ASG${String(Number(item.id.slice(3)) + 1).padStart(2, "0")}`;
  }
  db.assignments.push(item);
  save(db);
  res.status(201).json({ item });
});

router.put("/:id", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const item = db.assignments.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Assignment not found." });
  if (!canModify(item, req.user)) {
    return res.status(403).json({ error: "You can only edit assignments you created." });
  }
  Object.assign(item, pick(req.body || {}));
  save(db);
  res.json({ item });
});

router.delete("/:id", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const idx = db.assignments.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Assignment not found." });
  if (!canModify(db.assignments[idx], req.user)) {
    return res.status(403).json({ error: "You can only delete assignments you created." });
  }
  db.assignments.splice(idx, 1);
  save(db);
  res.json({ ok: true });
});

// POST /api/assignments/:id/submit  (Student) — records THE CALLER's
// submission only; the student id comes from the token, never the body.
router.post("/:id/submit", requireRole("Student"), (req, res) => {
  const db = load();
  const item = db.assignments.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Assignment not found." });
  item.submissions = item.submissions || [];
  if (!item.submissions.includes(req.user.linkedId)) item.submissions.push(req.user.linkedId);
  save(db);
  res.json({ item: projectForViewer(item, req.user, db) });
});

module.exports = router;
