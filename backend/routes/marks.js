const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { gradeFor } = require("../utils");

const router = express.Router();
router.use(verifyToken);

const MAX = { internal: 25, assignment: 10, practical: 20, exam: 45 };

function validateComponents(b) {
  for (const key of Object.keys(MAX)) {
    const v = Number(b[key] ?? 0);
    if (v < 0) return `${key} cannot be negative.`;
    if (v > MAX[key]) return `${key} cannot exceed the maximum of ${MAX[key]}.`;
  }
  return null;
}

// POST /api/marks  (Faculty) — enter/update marks for a student+subject
router.post("/", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.student || !b.subject) return res.status(400).json({ error: "student and subject are required." });
  const err = validateComponents(b);
  if (err) return res.status(400).json({ error: err });

  const total = Number(b.internal || 0) + Number(b.assignment || 0) + Number(b.practical || 0) + Number(b.exam || 0);
  const maxTotal = MAX.internal + MAX.assignment + MAX.practical + MAX.exam;
  const percentage = Math.round((total / maxTotal) * 1000) / 10;
  const grade = gradeFor(percentage);
  const result = percentage >= 40 ? "Pass" : "Fail"; // aggregate pass mark

  const id = `MK-${b.subject}-${b.student}`;
  let record = db.marks.find((m) => m.id === id);
  const payload = {
    id, student: b.student, subject: b.subject,
    internal: Number(b.internal || 0), internalMax: MAX.internal,
    assignment: Number(b.assignment || 0), assignmentMax: MAX.assignment,
    practical: Number(b.practical || 0), practicalMax: MAX.practical,
    exam: Number(b.exam || 0), examMax: MAX.exam,
    total, maxTotal, percentage, grade, result,
  };
  if (record) Object.assign(record, payload);
  else db.marks.push(payload);
  save(db);
  res.status(201).json({ marks: payload });
});

// GET /api/marks/subject/:subject  (Faculty roster of marks for a subject)
router.get("/subject/:subject", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  res.json({ marks: db.marks.filter((m) => m.subject === req.params.subject) });
});

// GET /api/results/:studentId  (Admin, Faculty, or the student themself) — mounted separately, see server.js
function resultsHandler(req, res) {
  const allowed =
    req.user.role === "Admin" ||
    req.user.role === "Faculty" ||
    ((req.user.role === "Student" || req.user.role === "Parent") && req.user.linkedId === req.params.studentId);
  if (!allowed) return res.status(403).json({ error: "Not authorized." });
  const db = load();
  const records = db.marks.filter((m) => m.student === req.params.studentId);
  const totalMax = records.reduce((a, r) => a + r.maxTotal, 0);
  const totalObtained = records.reduce((a, r) => a + r.total, 0);
  const overallPercentage = totalMax ? Math.round((totalObtained / totalMax) * 1000) / 10 : null;
  const overallResult = records.length && records.every((r) => r.result === "Pass") ? "Pass" : (records.length ? "Fail" : null);
  res.json({ records, overallPercentage, overallResult });
}

module.exports = { router, resultsHandler };
