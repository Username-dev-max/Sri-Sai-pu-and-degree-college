/* =========================================================================
   callFollowups.js — parent contact and call follow-ups for absent students.

   HONESTY NOTE: nothing in this file places a phone call, sends an SMS or a
   WhatsApp message, or performs any AI calling. It records that an authorised
   staff member handled a follow-up and what they learned. The capability
   flags returned by /contact say so explicitly, so the UI never implies
   otherwise.

   The 30-second rule is enforced HERE. The disabled button in the interface
   is a convenience; a request that skips it is still refused.
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit } = require("../services");
const { canViewStudent } = require("../scope");

const router = express.Router();
// Parent contact numbers are never exposed to Students or Parents.
router.use(verifyToken, requireRole("Admin", "Attendance Staff", "Faculty"));

const MIN_CALL_SECONDS = 30;
const TYPES = ["AI_CALL", "CALL", "SMS", "WHATSAPP"];

function guardianOf(db, student) {
  const parents = db.users.filter(
    (u) => u.role === "Parent" && (u.linkedIds || [u.linkedId]).includes(student.id)
  );
  return {
    guardianName: student.guardian || (parents[0] ? parents[0].name : ""),
    guardianPhone: student.guardianPhone || "",
    parentAccounts: parents.map((p) => ({ id: p.id, name: p.name })),
  };
}

function absenceMessage(studentName, subjectName, isoDate) {
  const date = isoDate ? isoDate.split("-").reverse().join("/") : "";
  return `Dear Parent, your ward ${studentName} was absent for ${subjectName || "class"}${
    date ? ` on ${date}` : ""
  }. Please contact the college if necessary.`;
}

// GET /api/call-followups/contact/:studentId?date=&subjectId=
router.get("/contact/:studentId", (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.studentId);
  // Faculty reach only students they teach; outside that, indistinguishable
  // from a student who does not exist.
  if (!student || !canViewStudent(req.user, student.id, db)) {
    return res.status(404).json({ error: "Student not found." });
  }
  const subjectName = (db.subjects.find((s) => s.id === req.query.subjectId) || {}).name || "";
  const g = guardianOf(db, student);

  // Viewing a parent's phone number is itself worth a trail.
  audit(req, {
    action: "parentContact.viewed",
    entityType: "student",
    entityId: student.id,
    summary: `Viewed parent contact for ${student.name}`,
  });

  res.json({
    studentId: student.id,
    studentName: student.name,
    ...g,
    hasPhone: !!g.guardianPhone,
    message: absenceMessage(student.name, subjectName, req.query.date),
    capabilities: { aiCalling: false, smsGateway: false, whatsappApi: false },
  });
});

// POST /api/call-followups/start — open a follow-up; the server stamps the time.
router.post("/start", (req, res) => {
  const db = load();
  const b = req.body || {};
  const student = db.students.find((s) => s.id === b.studentId);
  if (!student || !canViewStudent(req.user, student.id, db)) {
    return res.status(404).json({ error: "Student not found." });
  }
  const type = TYPES.includes(b.type) ? b.type : "CALL";
  const g = guardianOf(db, student);

  db.seq.followup = (db.seq.followup || 0) + 1;
  const row = {
    id: `CF${String(db.seq.followup).padStart(5, "0")}`,
    studentId: student.id,
    studentName: student.name,
    guardianName: g.guardianName,
    guardianPhone: g.guardianPhone,
    attendanceDate: b.attendanceDate || "",
    subjectId: b.subjectId || "",
    type,
    status: "IN_PROGRESS",
    callerUserId: req.user.id,
    callerName: req.user.name || req.user.username,
    callerRole: req.user.role,
    // Server time, not a client-supplied one, so the 30 seconds cannot be
    // shortened by sending an earlier timestamp.
    startedAt: new Date().toISOString(),
    completedAt: null,
    comment: "",
  };
  db.callFollowups.push(row);
  save(db);

  audit(req, {
    action: "followup.started",
    entityType: "callFollowup",
    entityId: row.id,
    summary: `Started ${type} follow-up for ${student.name}`,
  });
  res.status(201).json({ followup: row, minSeconds: MIN_CALL_SECONDS });
});

// PATCH /api/call-followups/:id/comment
router.patch("/:id/comment", (req, res) => {
  const db = load();
  const row = db.callFollowups.find((f) => f.id === req.params.id);
  if (!row || !canViewStudent(req.user, row.studentId, db)) {
    return res.status(404).json({ error: "Follow-up not found." });
  }
  if (row.callerUserId !== req.user.id && req.user.role !== "Admin") {
    return res.status(403).json({ error: "Only the staff member who started this follow-up can add its comment." });
  }
  // Append-only: a recorded comment is never overwritten. Another call gets
  // its own follow-up record.
  if (row.comment) {
    return res.status(409).json({ error: "This follow-up already has a comment. Start a new follow-up to record another call." });
  }
  const elapsed = (Date.now() - new Date(row.startedAt).getTime()) / 1000;
  if (elapsed < MIN_CALL_SECONDS) {
    const remaining = Math.ceil(MIN_CALL_SECONDS - elapsed);
    return res.status(409).json({
      error: `A comment can be added in ${remaining} second${remaining === 1 ? "" : "s"}.`,
      secondsRemaining: remaining,
    });
  }
  const comment = String(req.body?.comment || "").trim();
  if (!comment) return res.status(400).json({ error: "Please describe what was discussed." });

  row.comment = comment;
  row.parentResponse = String(req.body?.parentResponse || "").trim();
  row.absenceReason = String(req.body?.absenceReason || "").trim();
  row.followUpRequired = !!req.body?.followUpRequired;
  row.status = "COMPLETED";
  row.completedAt = new Date().toISOString();
  save(db);

  audit(req, {
    action: "followup.completed",
    entityType: "callFollowup",
    entityId: row.id,
    summary: `Recorded a follow-up comment for ${row.studentName}`,
  });
  res.json({ followup: row });
});

// GET /api/call-followups?studentId=
router.get("/", (req, res) => {
  const db = load();
  let rows = db.callFollowups.filter((f) => canViewStudent(req.user, f.studentId, db));
  if (req.query.studentId) rows = rows.filter((f) => f.studentId === req.query.studentId);
  rows.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  res.json({ followups: rows, minSeconds: MIN_CALL_SECONDS });
});

module.exports = router;
