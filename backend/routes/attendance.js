const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken);

// POST /api/attendance  (Faculty) — bulk-save attendance for a class/date
// body: { subject, date, records: [{ student, status }] }
router.post("/", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { subject, date, records } = req.body || {};
  if (!subject || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: "subject, date and records[] are required." });
  }
  // remove any existing entries for this subject+date, then re-insert (idempotent save/edit)
  db.attendance = db.attendance.filter((a) => !(a.subject === subject && a.date === date));
  records.forEach((r) => {
    db.attendance.push({ id: `ATT-${subject}-${date}-${r.student}`, subject, date, student: r.student, status: r.status });
  });
  save(db);
  res.json({ ok: true, saved: records.length });
});

function computePercentage(records) {
  if (!records.length) return null;
  const present = records.filter((r) => r.status === "Present").length;
  return Math.round((present / records.length) * 1000) / 10;
}

// GET /api/attendance/subject/:subject?date=YYYY-MM-DD  (Faculty roster for a given date)
router.get("/subject/:subject", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { date } = req.query;
  let list = db.attendance.filter((a) => a.subject === req.params.subject);
  if (date) list = list.filter((a) => a.date === date);
  res.json({ attendance: list });
});

// GET /api/attendance/student/:id  (Admin, Faculty, or the student themself)
router.get("/student/:id", (req, res) => {
  const allowed =
    req.user.role === "Admin" ||
    req.user.role === "Faculty" ||
    req.user.role === "Attendance Staff" ||
    // A Student sees their own record; a Parent sees only the student their
    // account is linked to.
    ((req.user.role === "Student" || req.user.role === "Parent") && req.user.linkedId === req.params.id);
  if (!allowed) return res.status(403).json({ error: "Not authorized." });
  const db = load();
  const records = db.attendance.filter((a) => a.student === req.params.id);
  const bySubject = {};
  records.forEach((r) => {
    bySubject[r.subject] = bySubject[r.subject] || [];
    bySubject[r.subject].push(r);
  });
  const subjectSummary = Object.entries(bySubject).map(([subject, recs]) => ({
    subject, total: recs.length, present: recs.filter((r) => r.status === "Present").length,
    percentage: computePercentage(recs),
  }));
  res.json({
    records,
    overallPercentage: computePercentage(records),
    subjectSummary,
  });
});

module.exports = router;
