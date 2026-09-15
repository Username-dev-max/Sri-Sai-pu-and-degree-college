/* =========================================================================
   leaveRequests.js — student absence/leave requests.

   Flow: a Student submits → it is routed to the class teacher for their
   class/section → the class teacher (or an Admin) approves or rejects →
   the student and their parents are notified.

   The student id always comes from the token, never the request body, so a
   student cannot file or read a request on anyone else's behalf.
   ========================================================================= */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify, linkedChildIds } = require("../services");
const { classTeacherForStudent, isClassTeacherFor } = require("../scope");

const router = express.Router();
router.use(verifyToken);

// Supporting documents (a medical certificate, say) are private: they live
// outside the statically served uploads directory and are streamed only
// through GET /:id/document after an authorisation check.
const { PRIVATE_DIR, ensureDir } = require("../storage");
const DIR = path.join(PRIVATE_DIR, "leave");
ensureDir(DIR);
const ALLOWED = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR),
    filename: (req, file, cb) =>
      cb(null, `leave-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED.has(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error("Only PDF or image documents are allowed.")),
});

const isoDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

/** May this user read this request? */
function canSee(row, user, db) {
  if (user.role === "Admin") return true;
  if (user.role === "Student") return user.linkedId === row.studentId;
  if (user.role === "Parent") return linkedChildIds(user, db).includes(row.studentId);
  if (user.role === "Faculty") {
    // Only the class teacher of that student's exact class and section.
    const s = db.students.find((x) => x.id === row.studentId);
    return !!s && isClassTeacherFor(user, s.classId, s.section || "", db);
  }
  return false;
}

function expand(row, db) {
  const s = db.students.find((x) => x.id === row.studentId) || {};
  const by = (coll, id) => (db[coll] || []).find((x) => x.id === id) || {};
  const { storedName, ...rest } = row; // the on-disk name is never sent
  return {
    ...rest,
    hasDocument: !!storedName,
    documentUrl: storedName ? `/api/leave-requests/${row.id}/document` : null,
    studentName: s.name || row.studentId,
    admissionNumber: s.admissionNumber || "",
    className: by("classes", row.classId).name || "",
    sectionName: by("sections", row.sectionId).name || "",
    subjectName: row.subjectId ? by("subjects", row.subjectId).name || "" : "",
    classTeacherName: by("faculty", row.classTeacherId).name || "",
  };
}

function familyAccounts(db, studentId) {
  return db.users.filter(
    (u) =>
      (u.role === "Student" && u.linkedId === studentId) ||
      (u.role === "Parent" && (u.linkedIds || [u.linkedId]).includes(studentId))
  );
}

// POST /api/leave-requests/upload (Student) — attach a supporting document.
router.post("/upload", requireRole("Student"), (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    res.status(201).json({ storedName: req.file.filename, originalName: req.file.originalname });
  });
});

// POST /api/leave-requests (Student)
router.post("/", requireRole("Student"), (req, res) => {
  const db = load();
  const b = req.body || {};
  const student = db.students.find((s) => s.id === req.user.linkedId);
  if (!student) return res.status(404).json({ error: "Your student record could not be found." });

  if (!isoDay(b.fromDate) || !isoDay(b.toDate)) {
    return res.status(400).json({ error: "From and To dates are required." });
  }
  if (b.toDate < b.fromDate) return res.status(400).json({ error: "The To date cannot be before the From date." });
  if (!b.reason || !String(b.reason).trim()) return res.status(400).json({ error: "A reason is required." });
  if (b.subjectId && !db.subjects.some((s) => s.id === b.subjectId)) {
    return res.status(404).json({ error: "That subject does not exist." });
  }
  // The attachment must be one this route actually stored — never a path.
  if (b.storedName && (/[\\/]/.test(b.storedName) || !fs.existsSync(path.join(DIR, b.storedName)))) {
    return res.status(400).json({ error: "The attached document could not be found. Please upload it again." });
  }
  const overlap = db.leaveRequests.find(
    (r) => r.studentId === student.id && r.status === "PENDING" && !(b.toDate < r.fromDate || b.fromDate > r.toDate)
  );
  if (overlap) {
    return res.status(409).json({ error: "You already have a pending request covering some of these dates." });
  }

  const classTeacherId = classTeacherForStudent(student, db);
  db.seq.leave = (db.seq.leave || 0) + 1;
  const row = {
    id: `LV${String(db.seq.leave).padStart(4, "0")}`,
    studentId: student.id,
    classId: student.classId || "",
    sectionId: student.section || "",
    fromDate: b.fromDate,
    toDate: b.toDate,
    subjectId: b.subjectId || "",
    reason: String(b.reason).trim(),
    description: b.description || "",
    storedName: b.storedName || "",
    originalName: b.originalName || "",
    status: "PENDING",
    classTeacherId: classTeacherId || "",
    submittedAt: new Date().toISOString(),
    decidedBy: null,
    decidedByName: "",
    decidedAt: null,
    decisionComment: "",
  };
  db.leaveRequests.push(row);
  save(db);

  audit(req, {
    action: "leave.submitted",
    entityType: "leaveRequest",
    entityId: row.id,
    summary: `${student.name} requested leave from ${row.fromDate} to ${row.toDate}`,
  });

  // Route to the class teacher. With none assigned, Admins are told instead,
  // so a request is never silently parked with nobody able to act on it.
  const targets = classTeacherId
    ? db.users.filter((u) => u.role === "Faculty" && u.linkedId === classTeacherId)
    : db.users.filter((u) => u.role === "Admin");
  targets.forEach((u) =>
    notify(u.id, {
      title: "New leave request",
      message: `${student.name}: ${row.fromDate} to ${row.toDate} — ${row.reason}`,
      type: "leave",
      relatedType: "leaveRequest",
      relatedId: row.id,
    })
  );

  res.status(201).json({ leaveRequest: expand(row, db), routedTo: classTeacherId ? "classTeacher" : "admin" });
});

// GET /api/leave-requests?status=PENDING
router.get("/", (req, res) => {
  const db = load();
  let rows = db.leaveRequests.filter((r) => canSee(r, req.user, db));
  if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
  rows.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json({ leaveRequests: rows.map((r) => expand(r, db)) });
});

// PATCH /api/leave-requests/:id/decision (class teacher or Admin)
router.patch("/:id/decision", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const row = db.leaveRequests.find((r) => r.id === req.params.id);
  // A faculty member who is not this student's class teacher gets the same
  // 404 as a missing request — never confirmation that it exists.
  if (!row || !canSee(row, req.user, db)) return res.status(404).json({ error: "Leave request not found." });

  const decision = req.body?.decision;
  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be APPROVED or REJECTED." });
  }
  if (row.status !== "PENDING") {
    return res.status(409).json({ error: `This request has already been ${row.status.toLowerCase()}.` });
  }

  row.status = decision;
  row.decidedBy = req.user.id;
  row.decidedByName = req.user.name || "";
  row.decidedAt = new Date().toISOString();
  row.decisionComment = String(req.body?.comment || "").trim();

  // Approval turns any ABSENT mark already recorded in the range into LEAVE.
  // It never overwrites a PRESENT mark and never creates attendance for
  // future days — those show as LEAVE when their register is taken.
  let converted = 0;
  if (decision === "APPROVED") {
    db.attendance.forEach((a) => {
      if (
        a.student === row.studentId &&
        a.date >= row.fromDate &&
        a.date <= row.toDate &&
        a.status === "Absent" &&
        (!row.subjectId || a.subject === row.subjectId)
      ) {
        a.status = "Leave";
        a.leaveRequestId = row.id;
        converted += 1;
      }
    });
  }
  save(db);

  audit(req, {
    action: decision === "APPROVED" ? "leave.approved" : "leave.rejected",
    entityType: "leaveRequest",
    entityId: row.id,
    before: { status: "PENDING" },
    after: { status: decision, comment: row.decisionComment },
    summary: `${decision === "APPROVED" ? "Approved" : "Rejected"} leave ${row.id}${
      converted ? ` (${converted} absence${converted === 1 ? "" : "s"} marked as leave)` : ""
    }`,
  });

  const s = db.students.find((x) => x.id === row.studentId) || {};
  familyAccounts(db, row.studentId).forEach((u) =>
    notify(u.id, {
      title: decision === "APPROVED" ? "Leave approved" : "Leave rejected",
      message: `Leave for ${s.name || "the student"} (${row.fromDate} to ${row.toDate}) was ${decision.toLowerCase()}${
        row.decisionComment ? `: ${row.decisionComment}` : "."
      }`,
      type: "leave",
      relatedType: "leaveRequest",
      relatedId: row.id,
    })
  );

  res.json({ leaveRequest: expand(row, db), attendanceConverted: converted });
});

// GET /api/leave-requests/:id/document — authorised download.
router.get("/:id/document", (req, res) => {
  const db = load();
  const row = db.leaveRequests.find((r) => r.id === req.params.id);
  if (!row || !canSee(row, req.user, db) || !row.storedName) {
    return res.status(404).json({ error: "Document not found." });
  }
  const file = path.join(DIR, row.storedName);
  if (!file.startsWith(DIR) || !fs.existsSync(file)) {
    return res.status(404).json({ error: "The stored file is missing." });
  }
  res.download(file, row.originalName || row.storedName);
});

// DELETE /api/leave-requests/:id — a Student may withdraw their own PENDING
// request; an Admin may remove any.
router.delete("/:id", requireRole("Student", "Admin"), (req, res) => {
  const db = load();
  const i = db.leaveRequests.findIndex((r) => r.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Leave request not found." });
  const row = db.leaveRequests[i];
  if (req.user.role === "Student") {
    if (row.studentId !== req.user.linkedId) return res.status(404).json({ error: "Leave request not found." });
    if (row.status !== "PENDING") return res.status(409).json({ error: "Only a pending request can be withdrawn." });
  }
  db.leaveRequests.splice(i, 1);
  save(db);
  audit(req, {
    action: "leave.withdrawn",
    entityType: "leaveRequest",
    entityId: row.id,
    summary: `Removed leave request ${row.id}`,
  });
  res.json({ ok: true });
});

module.exports = router;
