/* =========================================================================
   attendance.js — marking, correcting, reviewing and reporting attendance.

   A REGISTER is one academic year + class + section + subject + date +
   period. Its students are those who actually take the subject in that class
   (scope.studentsForSubject), so the same roster is used everywhere.

   Statuses are Present, Absent and Leave. "Not marked" is the absence of a
   record, never a stored value.

   Rules enforced here:
     - A register is recorded once. A second submission is refused (409) and
       must go through PUT /register as a correction with a reason, which is
       written to attendanceHistory. No record is silently overwritten.
     - Faculty mark only subjects assigned to them in that exact class and
       section, and — when a timetable exists for that day — only in a period
       the timetable gives that subject.
     - Attendance Staff mark / correct only as far as the Admin policy allows.
     - Approved leave wins over Absent/Present unless an Admin overrides it.
     - Percentages follow the college's configured leave policy.
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  canTouchSubject,
  canTouchSubjectInClass,
  canViewStudent,
  studentsForSubject,
  isClassTeacherFor,
  currentYearId,
  facultySubjectIds,
} = require("../scope");
const { audit, notify } = require("../services");
const { getSettings, attendancePercentage, countStatuses, round2 } = require("../academics");
const { familyUsers, recordAttendanceHistory, refreshLowAttendance } = require("../attendanceService");
const { sendReport } = require("../exporters/tableReport");

const router = express.Router();
router.use(verifyToken);

const STATUSES = ["Present", "Absent", "Leave"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const isoDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const byId = (db, coll, id) => (db[coll] || []).find((x) => x.id === id) || null;
const nameOf = (db, coll, id) => (byId(db, coll, id) || {}).name || "";
const displayDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const COLLEGE_TZ = "Asia/Kolkata";

/** Today's date where the college is, so "future date" is judged in IST
 *  even when the server runs in UTC. */
function collegeToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COLLEGE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Read the register identity from a query string or body. */
function registerQuery(src, db) {
  return {
    academicYearId: String(src.academicYearId || currentYearId(db) || ""),
    classId: String(src.classId || ""),
    sectionId: String(src.sectionId || ""),
    subject: String(src.subject || src.subjectId || ""),
    date: String(src.date || ""),
    period: src.period === undefined || src.period === null ? "" : String(src.period),
    courseId: String(src.courseId || ""),
  };
}

function sameRegister(a, q) {
  return (
    a.subject === q.subject &&
    a.date === q.date &&
    (a.classId || "") === q.classId &&
    (a.sectionId || "") === q.sectionId &&
    String(a.period || "") === q.period &&
    (a.academicYearId || "") === q.academicYearId
  );
}

function validateRegister(db, q, settings, { requirePeriod = true } = {}) {
  const year = byId(db, "academicYears", q.academicYearId);
  if (!year) return "Select a valid academic year.";
  if (!byId(db, "classes", q.classId)) return "Select a valid class.";
  if (q.sectionId && !byId(db, "sections", q.sectionId)) return "Select a valid section.";
  const subject = byId(db, "subjects", q.subject);
  if (!subject) return "Select a valid subject.";
  if (subject.classId && subject.classId !== q.classId) return "That subject is not taught in this class.";
  if (!isoDay(q.date)) return "Select a valid date.";
  if (q.date > collegeToday()) return "Attendance cannot be recorded for a future date.";
  if (year.startDate && q.date < year.startDate) return `That date is before the ${year.label} academic year.`;
  if (year.endDate && q.date > year.endDate) return `That date is after the ${year.label} academic year.`;
  if (requirePeriod || q.period) {
    const n = Number(q.period);
    if (!Number.isInteger(n) || n < 1 || n > settings.attendance.periodsPerDay) {
      return `Select a period from 1 to ${settings.attendance.periodsPerDay}.`;
    }
  }
  if (q.courseId && !byId(db, "courses", q.courseId)) return "Select a valid combination or program.";
  return null;
}

/** When a timetable exists for this class on this weekday, a faculty member
 *  may only take the register in a period the timetable gives this subject. */
function timetableProblem(db, q) {
  const day = DAYS[new Date(`${q.date}T12:00:00Z`).getUTCDay()];
  const rows = (db.timetable || []).filter(
    (t) =>
      t.classId === q.classId &&
      (!t.sectionId || !q.sectionId || t.sectionId === q.sectionId) &&
      t.day === day &&
      (!t.academicYearId || t.academicYearId === q.academicYearId)
  );
  if (rows.length === 0) return null;
  const ok = rows.some((t) => String(t.period) === q.period && t.subject === q.subject);
  return ok ? null : `The ${day} timetable does not have ${nameOf(db, "subjects", q.subject)} in period ${q.period}.`;
}

function canView(user, db, q) {
  if (user.role === "Admin" || user.role === "Attendance Staff") return true;
  if (user.role !== "Faculty") return false;
  return canTouchSubjectInClass(user, q.subject, q.classId, q.sectionId, db) || isClassTeacherFor(user, q.classId, q.sectionId, db);
}

function markPermission(user, db, q, settings) {
  if (user.role === "Admin") return null;
  if (user.role === "Attendance Staff") {
    return settings.attendance.staffCanMark ? null : "Attendance Staff are not currently permitted to mark attendance.";
  }
  if (user.role === "Faculty") {
    if (!canTouchSubjectInClass(user, q.subject, q.classId, q.sectionId, db)) {
      return "You are not assigned to this subject for that class and section.";
    }
    return timetableProblem(db, q);
  }
  return "Not authorized.";
}

function editPermission(user, db, q, settings) {
  if (user.role === "Admin") return null;
  if (user.role === "Attendance Staff") {
    return settings.attendance.staffCanEdit ? null : "Attendance Staff are not currently permitted to correct attendance.";
  }
  if (user.role === "Faculty") {
    if (!settings.attendance.facultyCanEdit) return "Faculty are not currently permitted to correct attendance. Ask an administrator.";
    if (!canTouchSubjectInClass(user, q.subject, q.classId, q.sectionId, db)) {
      return "You are not assigned to this subject for that class and section.";
    }
    return null;
  }
  return "Not authorized.";
}

function approvedLeaveFor(db, studentId, date, subjectId) {
  return (db.leaveRequests || []).find(
    (l) =>
      l.studentId === studentId &&
      l.status === "APPROVED" &&
      date >= l.fromDate &&
      date <= l.toDate &&
      (!l.subjectId || l.subjectId === subjectId)
  );
}

function actorName(db, user) {
  const fac = user.role === "Faculty" ? byId(db, "faculty", user.linkedId) : null;
  return { name: fac ? fac.name : user.name || user.username, facultyId: fac ? fac.id : null };
}

function notifyAbsent(db, rows, q) {
  const subjectName = nameOf(db, "subjects", q.subject) || "class";
  rows.forEach((r) => {
    const s = byId(db, "students", r.student) || {};
    familyUsers(db, r.student).forEach((u) =>
      notify(u.id, {
        title: u.role === "Parent" ? "Your ward was marked absent" : "You were marked absent",
        message:
          u.role === "Parent"
            ? `${s.name || "Your ward"} was marked absent for ${subjectName} on ${displayDate(q.date)}${q.period ? ` (period ${q.period})` : ""}.`
            : `You were marked absent for ${subjectName} on ${displayDate(q.date)}${q.period ? ` (period ${q.period})` : ""}.`,
        type: "attendance",
        relatedType: "attendance",
        relatedId: `${q.subject}-${q.date}-${q.period}`,
      })
    );
  });
}

/* ------------------------------ the register ----------------------------- */

function registerHandler(req, res) {
  const db = load();
  const settings = getSettings(db);
  const q = registerQuery(req.query, db);
  const problem = validateRegister(db, q, settings, { requirePeriod: false });
  if (problem) return res.status(400).json({ error: problem });
  if (!canView(req.user, db, q)) return res.status(403).json({ error: "You are not assigned to this subject for that class and section." });

  const roster = studentsForSubject(db, q.classId, q.sectionId, q.subject, q.courseId);
  const rosterIds = new Set(roster.map((s) => s.id));
  const existing = db.attendance.filter((a) => sameRegister(a, q));
  // The same students already recorded for this subject/date/period under a
  // different class or section register (e.g. whole class vs one section).
  const elsewhere = db.attendance.filter(
    (a) =>
      !sameRegister(a, q) &&
      a.subject === q.subject &&
      a.date === q.date &&
      String(a.period || "") === q.period &&
      (a.academicYearId || "") === q.academicYearId &&
      rosterIds.has(a.student)
  );
  const isAdmin = req.user.role === "Admin";
  const students = roster.map((s) => {
    const rec = existing.find((a) => a.student === s.id);
    const leave = approvedLeaveFor(db, s.id, q.date, q.subject);
    return {
      studentId: s.id,
      studentName: s.name,
      admissionNumber: s.admissionNumber || "",
      rollNumber: s.rollNumber || "",
      recordId: rec ? rec.id : null,
      status: rec ? rec.status : leave ? "Leave" : null,
      onApprovedLeave: !!leave,
      leaveRequestId: leave ? leave.id : null,
      locked: !!leave && !isAdmin,
      hasGuardianPhone: !!s.guardianPhone,
    };
  });
  const first = existing[0] || null;
  const lastEdit = existing.filter((a) => a.updatedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const markError = q.period ? markPermission(req.user, db, q, settings) : null;
  const editError = editPermission(req.user, db, q, settings);

  res.json({
    exists: existing.length > 0,
    conflict: elsewhere.length > 0 && existing.length === 0,
    students,
    meta: {
      academicYearLabel: (byId(db, "academicYears", q.academicYearId) || {}).label || "",
      className: nameOf(db, "classes", q.classId),
      sectionName: nameOf(db, "sections", q.sectionId),
      subjectName: nameOf(db, "subjects", q.subject),
      date: q.date,
      period: q.period,
      takenByName: first ? first.takenByName : "",
      takenByRole: first ? first.takenByRole : "",
      takenAt: first ? first.takenAt : null,
      updatedByName: lastEdit ? lastEdit.updatedByName : "",
      updatedAt: lastEdit ? lastEdit.updatedAt : null,
    },
    counts: countStatuses(existing),
    permissions: {
      canMark: !markError && existing.length === 0,
      markError: existing.length ? "" : markError || "",
      canEdit: existing.length > 0 && !editError,
      editError: editError || "",
      canOverrideLeave: isAdmin,
    },
    periodsPerDay: settings.attendance.periodsPerDay,
  });
}

// GET /api/attendance/register?academicYearId=&classId=&sectionId=&subject=&date=&period=&courseId=
router.get("/register", requireRole("Faculty", "Admin", "Attendance Staff"), registerHandler);
// Older name for the same data.
router.get("/roster", requireRole("Faculty", "Admin", "Attendance Staff"), registerHandler);

// POST /api/attendance — record a NEW register.
// body: { academicYearId?, classId, sectionId?, subject, date, period, courseId?, records:[{student,status}], overrideLeave? }
router.post("/", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const b = req.body || {};
  const q = registerQuery(b, db);
  const problem = validateRegister(db, q, settings);
  if (problem) return res.status(400).json({ error: problem });
  const denied = markPermission(req.user, db, q, settings);
  if (denied) return res.status(403).json({ error: denied });
  if (!Array.isArray(b.records)) return res.status(400).json({ error: "records[] is required." });

  const roster = studentsForSubject(db, q.classId, q.sectionId, q.subject, q.courseId);
  if (roster.length === 0) return res.status(400).json({ error: "No students take this subject in the selected class and section." });
  const rosterIds = new Set(roster.map((s) => s.id));

  // Validate EVERY row first, so a bad register is rejected whole.
  const seen = new Set();
  for (const [i, r] of b.records.entries()) {
    if (!r || !r.student) return res.status(400).json({ error: `Row ${i + 1}: a student is required.` });
    if (!STATUSES.includes(r.status)) return res.status(400).json({ error: `Row ${i + 1}: status must be Present, Absent or Leave.` });
    if (seen.has(r.student)) return res.status(400).json({ error: `Row ${i + 1}: that student appears twice.` });
    seen.add(r.student);
    if (!rosterIds.has(r.student)) return res.status(400).json({ error: `Row ${i + 1}: that student does not take this subject in this class or section.` });
  }
  const missing = [...rosterIds].filter((id) => !seen.has(id));
  if (missing.length) {
    return res.status(400).json({
      error: `${missing.length} student${missing.length === 1 ? " has" : "s have"} no status. Mark every student before saving.`,
      missing,
    });
  }

  // Duplicate protection — per student, so a section register cannot repeat
  // a whole-class register for the same subject, date and period either.
  const duplicate = db.attendance.some(
    (a) =>
      a.subject === q.subject &&
      a.date === q.date &&
      String(a.period || "") === q.period &&
      (a.academicYearId || "") === q.academicYearId &&
      rosterIds.has(a.student)
  );
  if (duplicate) {
    return res.status(409).json({ error: "Attendance already recorded for this class, subject, date and period.", exists: true });
  }

  const adminOverride = req.user.role === "Admin" && b.overrideLeave === true;
  const leaveForced = [];
  const actor = actorName(db, req.user);
  const subj = byId(db, "subjects", q.subject) || {};
  const now = new Date().toISOString();
  const created = b.records.map((r) => {
    const leave = approvedLeaveFor(db, r.student, q.date, q.subject);
    let status = r.status;
    if (leave && status !== "Leave" && !adminOverride) {
      leaveForced.push(r.student);
      status = "Leave";
    }
    db.seq.attendance = (db.seq.attendance || 0) + 1;
    return {
      id: `ATT${String(db.seq.attendance).padStart(7, "0")}`,
      academicYearId: q.academicYearId,
      subject: q.subject,
      date: q.date,
      period: q.period,
      student: r.student,
      status,
      classId: q.classId,
      sectionId: q.sectionId,
      courseId: q.courseId || (byId(db, "students", r.student) || {}).course || "",
      department: subj.department || "",
      takenBy: req.user.id,
      takenByName: actor.name,
      takenByRole: req.user.role,
      facultyId: actor.facultyId,
      takenAt: now,
      leaveRequestId: leave ? leave.id : null,
      updatedBy: null,
      updatedByName: "",
      updatedAt: null,
    };
  });
  db.attendance.push(...created);
  save(db);

  const counts = countStatuses(created);
  audit(req, {
    action: "attendance.submitted",
    entityType: "attendance",
    entityId: `${q.academicYearId}-${q.classId}-${q.sectionId || "all"}-${q.subject}-${q.date}-P${q.period}`,
    after: { ...counts, leaveForced: leaveForced.length },
    summary: `Recorded attendance for ${subj.name || q.subject} — ${nameOf(db, "classes", q.classId)}${
      q.sectionId ? ` ${nameOf(db, "sections", q.sectionId)}` : ""
    } on ${displayDate(q.date)}, period ${q.period}: ${counts.present} present, ${counts.absent} absent, ${counts.leave} leave`,
  });

  notifyAbsent(db, created.filter((r) => r.status === "Absent"), q);
  refreshLowAttendance(db, created.map((r) => r.student));
  save(db);

  res.status(201).json({ ok: true, saved: created.length, ...counts, leaveForced, takenAt: now, takenByName: actor.name });
});

// PUT /api/attendance/register — correct an existing register.
// body: { academicYearId?, classId, sectionId?, subject, date, period, changes:[{student,status}], reason, overrideLeave? }
router.put("/register", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const b = req.body || {};
  const q = registerQuery(b, db);
  const problem = validateRegister(db, q, settings);
  if (problem) return res.status(400).json({ error: problem });
  const denied = editPermission(req.user, db, q, settings);
  if (denied) return res.status(403).json({ error: denied });
  const reason = String(b.reason || "").trim();
  if (reason.length < 3) return res.status(400).json({ error: "Give a reason for the correction." });
  if (!Array.isArray(b.changes) || b.changes.length === 0) return res.status(400).json({ error: "No changes were sent." });

  const rows = db.attendance.filter((a) => sameRegister(a, q));
  if (rows.length === 0) return res.status(404).json({ error: "No attendance has been recorded for this register yet." });
  const adminOverride = req.user.role === "Admin" && b.overrideLeave === true;
  // Students who joined the class after the register was taken can be added
  // to it as part of a correction — they are on the roster but have no row.
  const rosterIds = new Set(studentsForSubject(db, q.classId, q.sectionId, q.subject, q.courseId).map((s) => s.id));

  const plan = [];
  for (const [i, c] of b.changes.entries()) {
    if (!c || !STATUSES.includes(c.status)) return res.status(400).json({ error: `Change ${i + 1}: status must be Present, Absent or Leave.` });
    const row = rows.find((a) => a.student === c.student) || null;
    if (!row) {
      if (!rosterIds.has(c.student)) return res.status(404).json({ error: `Change ${i + 1}: that student does not take this subject in this class.` });
      const elsewhere = db.attendance.some(
        (a) => a.student === c.student && a.subject === q.subject && a.date === q.date && String(a.period || "") === q.period && (a.academicYearId || "") === q.academicYearId
      );
      if (elsewhere) return res.status(409).json({ error: `${nameOf(db, "students", c.student)} is already marked for this subject and period on another register.` });
    } else if (row.status === c.status) {
      continue;
    }
    const leave = approvedLeaveFor(db, c.student, q.date, q.subject);
    if (leave && c.status !== "Leave" && !adminOverride) {
      return res.status(409).json({ error: `${nameOf(db, "students", c.student)} is on approved leave. Only an administrator can override it.` });
    }
    plan.push({ row, student: c.student, status: c.status, leave });
  }
  if (plan.length === 0) return res.status(400).json({ error: "Nothing changed — every status is the same as before." });

  const actor = actorName(db, req.user);
  const now = new Date().toISOString();
  const newlyAbsent = [];
  const template = rows[0];
  plan.forEach((p) => {
    let row = p.row;
    if (!row) {
      db.seq.attendance = (db.seq.attendance || 0) + 1;
      row = {
        ...template,
        id: `ATT${String(db.seq.attendance).padStart(7, "0")}`,
        student: p.student,
        status: p.status,
        courseId: (byId(db, "students", p.student) || {}).course || "",
        leaveRequestId: p.leave ? p.leave.id : null,
      };
      db.attendance.push(row);
      recordAttendanceHistory(db, { row, oldStatus: "Not marked", newStatus: p.status, user: { ...req.user, name: actor.name }, reason });
    } else {
      recordAttendanceHistory(db, { row, oldStatus: row.status, newStatus: p.status, user: { ...req.user, name: actor.name }, reason });
      row.status = p.status;
    }
    if (p.status === "Absent") newlyAbsent.push(row);
    row.updatedBy = req.user.id;
    row.updatedByName = actor.name;
    row.updatedAt = now;
  });
  save(db);

  audit(req, {
    action: "attendance.corrected",
    entityType: "attendance",
    entityId: `${q.academicYearId}-${q.classId}-${q.sectionId || "all"}-${q.subject}-${q.date}-P${q.period}`,
    after: { changed: plan.length, reason },
    summary: `Corrected ${plan.length} attendance mark(s) for ${nameOf(db, "subjects", q.subject)} on ${displayDate(q.date)}, period ${q.period}: ${reason}`,
  });
  notifyAbsent(db, newlyAbsent, q);
  refreshLowAttendance(db, plan.map((p) => p.row.student));
  save(db);

  res.json({ ok: true, changed: plan.length, counts: countStatuses(db.attendance.filter((a) => sameRegister(a, q))) });
});

/* ------------------------------ staff views ------------------------------ */

// GET /api/attendance/session — one register split into present/absent/leave.
router.get("/session", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const q = registerQuery(req.query, db);
  const problem = validateRegister(db, q, settings, { requirePeriod: false });
  if (problem) return res.status(400).json({ error: problem });
  if (!canView(req.user, db, q)) return res.status(403).json({ error: "You are not assigned to this subject for that class and section." });

  const rows = db.attendance.filter((a) => sameRegister(a, q));
  // Guardian phone numbers are NOT included — only whether one exists. The
  // number is released through /api/call-followups/contact, which is audited.
  const item = (a) => {
    const s = byId(db, "students", a.student) || {};
    return {
      studentId: a.student,
      studentName: s.name || a.student,
      admissionNumber: s.admissionNumber || "",
      rollNumber: s.rollNumber || "",
      guardianName: s.guardian || "",
      hasGuardianPhone: !!s.guardianPhone,
    };
  };
  const byRoll = (x, y) => String(x.rollNumber).localeCompare(String(y.rollNumber), undefined, { numeric: true }) || x.studentName.localeCompare(y.studentName);
  const counts = countStatuses(rows);
  res.json({
    submitted: rows.length > 0,
    ...q,
    className: nameOf(db, "classes", q.classId),
    sectionName: nameOf(db, "sections", q.sectionId),
    subjectName: nameOf(db, "subjects", q.subject),
    takenByName: rows[0] ? rows[0].takenByName : "",
    takenAt: rows[0] ? rows[0].takenAt : null,
    totals: { ...counts, percentage: attendancePercentage(counts, settings) },
    present: rows.filter((a) => a.status === "Present").map(item).sort(byRoll),
    absent: rows.filter((a) => a.status === "Absent").map(item).sort(byRoll),
    leave: rows.filter((a) => a.status === "Leave").map(item).sort(byRoll),
  });
});

/** Attendance rows this user may see in staff lists and reports. */
function scopedRows(db, user) {
  if (user.role === "Admin" || user.role === "Attendance Staff") return db.attendance;
  return db.attendance.filter(
    (a) =>
      canTouchSubjectInClass(user, a.subject, a.classId || "", a.sectionId || "", db) ||
      (a.classId && isClassTeacherFor(user, a.classId, a.sectionId || "", db))
  );
}

function applyFilters(rows, f) {
  let out = rows;
  if (f.academicYearId) out = out.filter((a) => (a.academicYearId || "") === f.academicYearId);
  if (f.classId) out = out.filter((a) => (a.classId || "") === f.classId);
  if (f.sectionId) out = out.filter((a) => (a.sectionId || "") === f.sectionId);
  if (f.subject) out = out.filter((a) => a.subject === f.subject);
  if (f.courseId) out = out.filter((a) => (a.courseId || "") === f.courseId);
  if (f.department) out = out.filter((a) => a.department === f.department);
  if (f.date) out = out.filter((a) => a.date === f.date);
  if (f.month) out = out.filter((a) => a.date.startsWith(f.month));
  if (f.from) out = out.filter((a) => a.date >= f.from);
  if (f.to) out = out.filter((a) => a.date <= f.to);
  if (f.studentId) out = out.filter((a) => a.student === f.studentId);
  if (f.period) out = out.filter((a) => String(a.period || "") === String(f.period));
  if (f.takenBy) out = out.filter((a) => String(a.takenBy) === String(f.takenBy));
  if (f.facultyId) out = out.filter((a) => a.facultyId === f.facultyId);
  return out;
}

function readFilters(src) {
  const pick = ["academicYearId", "classId", "sectionId", "subject", "courseId", "department", "date", "month", "from", "to", "studentId", "period", "takenBy", "facultyId"];
  const f = {};
  pick.forEach((k) => {
    if (src[k] !== undefined && src[k] !== "") f[k] = String(src[k]);
  });
  if (!f.subject && src.subjectId) f.subject = String(src.subjectId);
  return f;
}

// GET /api/attendance/sessions — one row per recorded register.
router.get("/sessions", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const rows = applyFilters(scopedRows(db, req.user), readFilters(req.query));
  const groups = new Map();
  rows.forEach((a) => {
    const key = [a.academicYearId || "", a.classId || "", a.sectionId || "", a.subject, a.date, a.period || ""].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        academicYearId: a.academicYearId || "",
        classId: a.classId || "",
        sectionId: a.sectionId || "",
        subjectId: a.subject,
        date: a.date,
        period: a.period || "",
        department: a.department || "",
        takenByName: a.takenByName || "",
        takenByRole: a.takenByRole || "",
        facultyId: a.facultyId || null,
        takenAt: a.takenAt || null,
        corrected: false,
        rows: [],
      });
    }
    const g = groups.get(key);
    g.rows.push(a);
    if (a.updatedAt) g.corrected = true;
  });
  const sessions = [...groups.values()]
    .map(({ rows: list, ...g }) => {
      const counts = countStatuses(list);
      return {
        ...g,
        ...counts,
        percentage: attendancePercentage(counts, settings),
        subjectName: nameOf(db, "subjects", g.subjectId),
        className: nameOf(db, "classes", g.classId),
        sectionName: nameOf(db, "sections", g.sectionId),
        departmentName: nameOf(db, "departments", g.department),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.period).localeCompare(String(a.period), undefined, { numeric: true }));
  res.json({ sessions });
});

// GET /api/attendance/history — attendance corrections.
router.get("/history", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const f = readFilters(req.query);
  let rows = (db.attendanceHistory || []).slice();
  if (req.user.role === "Faculty") {
    rows = rows.filter(
      (h) =>
        canTouchSubjectInClass(req.user, h.subject, h.classId || "", h.sectionId || "", db) ||
        (h.classId && isClassTeacherFor(req.user, h.classId, h.sectionId || "", db))
    );
  }
  rows = applyFilters(rows.map((h) => ({ ...h, takenBy: h.changedBy })), f);
  res.json({
    history: rows
      .map((h) => ({
        ...h,
        studentName: nameOf(db, "students", h.student),
        subjectName: nameOf(db, "subjects", h.subject),
        className: nameOf(db, "classes", h.classId),
        sectionName: nameOf(db, "sections", h.sectionId),
      }))
      .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt))),
  });
});

// GET /api/attendance/subject/:subject — kept for older callers.
router.get("/subject/:subject", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { date, classId, sectionId } = req.query;
  const allowed = classId
    ? canTouchSubjectInClass(req.user, req.params.subject, classId, sectionId || "", db)
    : canTouchSubject(req.user, req.params.subject, db);
  if (!allowed) return res.status(403).json({ error: "You are not assigned to this subject." });
  let list = db.attendance.filter((a) => a.subject === req.params.subject);
  if (date) list = list.filter((a) => a.date === date);
  if (classId) list = list.filter((a) => (a.classId || "") === classId);
  if (sectionId) list = list.filter((a) => (a.sectionId || "") === sectionId);
  res.json({ attendance: list });
});

/* ---------------------------- student / parent --------------------------- */

// GET /api/attendance/student/:id?academicYearId= — subject-wise and overall.
router.get("/student/:id", (req, res) => {
  const db = load();
  const settings = getSettings(db);
  // Student: themself. Parent: linked children. Faculty: students they teach.
  if (!canViewStudent(req.user, req.params.id, db)) return res.status(403).json({ error: "Not authorized." });
  let records = db.attendance.filter((a) => a.student === req.params.id);
  if (req.query.academicYearId) records = records.filter((a) => (a.academicYearId || "") === req.query.academicYearId);

  const bySubject = new Map();
  records.forEach((r) => {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, []);
    bySubject.get(r.subject).push(r);
  });
  const subjectSummary = [...bySubject.entries()]
    .map(([subject, recs]) => {
      const counts = countStatuses(recs);
      return { subject, subjectName: nameOf(db, "subjects", subject), ...counts, percentage: attendancePercentage(counts, settings) };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  const totals = countStatuses(records);
  const overallPercentage = attendancePercentage(totals, settings);

  res.json({
    records: records.map((r) => ({ id: r.id, subject: r.subject, date: r.date, period: r.period, status: r.status })),
    overallPercentage,
    totals,
    subjectSummary,
    policy: {
      lowThreshold: settings.attendance.lowThreshold,
      leaveInDenominator: settings.attendance.leaveInDenominator,
      formula: settings.attendance.leaveInDenominator
        ? "Present ÷ (Present + Absent + Leave)"
        : "Present ÷ (Present + Absent) — approved leave is not counted",
    },
    belowThreshold: overallPercentage !== null && overallPercentage < settings.attendance.lowThreshold,
  });
});

// GET /api/attendance/student/:id/calendar?month=YYYY-MM&subjectId=
router.get("/student/:id/calendar", (req, res) => {
  const db = load();
  if (!canViewStudent(req.user, req.params.id, db)) return res.status(403).json({ error: "Not authorized." });
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || "")) ? req.query.month : collegeToday().slice(0, 7);
  const mine = db.attendance.filter((a) => a.student === req.params.id);
  let rows = mine.filter((a) => a.date.startsWith(month));
  if (req.query.subjectId) rows = rows.filter((a) => a.subject === req.query.subjectId);

  const days = {};
  rows
    .slice()
    .sort((a, b) => String(a.period).localeCompare(String(b.period), undefined, { numeric: true }))
    .forEach((a) => {
      (days[a.date] = days[a.date] || []).push({
        subjectId: a.subject,
        subjectName: nameOf(db, "subjects", a.subject),
        className: nameOf(db, "classes", a.classId),
        sectionName: nameOf(db, "sections", a.sectionId),
        facultyName: a.takenByName || "",
        status: a.status,
        period: a.period || "",
        takenAt: a.takenAt || null,
      });
    });
  const summary = Object.fromEntries(
    Object.entries(days).map(([d, list]) => [
      d,
      list.some((x) => x.status === "Absent") ? "Absent" : list.some((x) => x.status === "Leave") ? "Leave" : "Present",
    ])
  );
  const subjects = [...new Set(mine.map((a) => a.subject))]
    .map((id) => ({ id, name: nameOf(db, "subjects", id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ month, today: collegeToday(), days, summary, subjects });
});

/* -------------------------------- reports -------------------------------- */

const REPORTS = {
  daily: "Daily Attendance Report",
  monthly: "Monthly Attendance Report",
  subject: "Subject-wise Attendance Report",
  class: "Class-wise Attendance Report",
  section: "Section-wise Attendance Report",
  student: "Student Attendance Report",
  faculty: "Attendance Taken — Faculty-wise Report",
  absent: "Absent Students Report",
  low: "Low Attendance Report",
};

function buildReport(db, settings, type, f, rows) {
  const pctOf = (list) => attendancePercentage(countStatuses(list), settings);
  const group = (keyFn) => {
    const m = new Map();
    rows.forEach((a) => {
      const k = keyFn(a);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    });
    return [...m.entries()];
  };
  const pctCell = (p) => (p === null ? "—" : `${p}%`);
  const studentInfo = (id) => byId(db, "students", id) || {};

  if (type === "daily") {
    const columns = [
      { key: "className", label: "Class", weight: 1 },
      { key: "sectionName", label: "Section", weight: 0.8 },
      { key: "subjectName", label: "Subject", weight: 1.6 },
      { key: "period", label: "Period", weight: 0.6, align: "center" },
      { key: "takenByName", label: "Taken By", weight: 1.4 },
      { key: "takenAt", label: "Recorded At", weight: 1.1 },
      { key: "total", label: "Total", weight: 0.6, align: "center" },
      { key: "present", label: "Present", weight: 0.7, align: "center" },
      { key: "absent", label: "Absent", weight: 0.7, align: "center" },
      { key: "leave", label: "Leave", weight: 0.6, align: "center" },
      { key: "percentage", label: "%", weight: 0.7, align: "center" },
    ];
    const out = group((a) => [a.date, a.classId, a.sectionId, a.subject, a.period].join("|"))
      .map(([, list]) => {
        const a = list[0];
        const c = countStatuses(list);
        return {
          date: a.date,
          className: nameOf(db, "classes", a.classId),
          sectionName: nameOf(db, "sections", a.sectionId) || "Whole class",
          subjectName: nameOf(db, "subjects", a.subject),
          period: a.period || "—",
          takenByName: a.takenByName || "",
          takenAt: a.takenAt ? new Date(a.takenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: COLLEGE_TZ }) : "",
          ...c,
          percentage: pctCell(pctOf(list)),
        };
      })
      .sort((x, y) => String(x.period).localeCompare(String(y.period), undefined, { numeric: true }) || x.className.localeCompare(y.className));
    return { columns, rows: out };
  }

  if (type === "monthly" || type === "low") {
    const columns = [
      { key: "admissionNumber", label: "Student ID", weight: 1.2 },
      { key: "studentName", label: "Student", weight: 1.8 },
      { key: "className", label: "Class", weight: 1 },
      { key: "sectionName", label: "Section", weight: 0.8 },
      { key: "total", label: "Total", weight: 0.6, align: "center" },
      { key: "present", label: "Present", weight: 0.7, align: "center" },
      { key: "absent", label: "Absent", weight: 0.7, align: "center" },
      { key: "leave", label: "Leave", weight: 0.6, align: "center" },
      { key: "percentage", label: "%", weight: 0.7, align: "center" },
    ];
    if (type === "low") columns.push({ key: "status", label: "Status", weight: 1.2 });
    let out = group((a) => a.student).map(([id, list]) => {
      const s = studentInfo(id);
      const p = pctOf(list);
      return {
        studentId: id,
        admissionNumber: s.admissionNumber || id,
        studentName: s.name || id,
        rollNumber: s.rollNumber || "",
        className: nameOf(db, "classes", s.classId),
        sectionName: nameOf(db, "sections", s.section) || "—",
        ...countStatuses(list),
        pct: p,
        percentage: pctCell(p),
        status: p !== null && p < settings.attendance.lowThreshold ? `Below ${settings.attendance.lowThreshold}%` : "",
      };
    });
    if (type === "low") out = out.filter((r) => r.pct !== null && r.pct < settings.attendance.lowThreshold).sort((a, b) => a.pct - b.pct);
    else out.sort((a, b) => a.className.localeCompare(b.className) || String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }) || a.studentName.localeCompare(b.studentName));
    return { columns, rows: out };
  }

  if (type === "subject" || type === "student") {
    const columns = [
      { key: "subjectName", label: "Subject", weight: 1.8 },
      { key: "className", label: "Class", weight: 1 },
      { key: "sectionName", label: "Section", weight: 0.8 },
      { key: "total", label: "Total Classes", weight: 0.9, align: "center" },
      { key: "present", label: "Present", weight: 0.7, align: "center" },
      { key: "absent", label: "Absent", weight: 0.7, align: "center" },
      { key: "leave", label: "Leave", weight: 0.6, align: "center" },
      { key: "percentage", label: "%", weight: 0.7, align: "center" },
    ];
    if (type === "subject") columns.splice(3, 0, { key: "registers", label: "Registers", weight: 0.8, align: "center" });
    const keyFn = type === "subject" ? (a) => [a.subject, a.classId, a.sectionId].join("|") : (a) => a.subject;
    const out = group(keyFn)
      .map(([, list]) => {
        const a = list[0];
        return {
          subjectName: nameOf(db, "subjects", a.subject),
          className: nameOf(db, "classes", a.classId),
          sectionName: type === "subject" ? nameOf(db, "sections", a.sectionId) || "Whole class" : nameOf(db, "sections", a.sectionId) || "—",
          registers: new Set(list.map((x) => `${x.date}|${x.period}`)).size,
          ...countStatuses(list),
          percentage: pctCell(pctOf(list)),
        };
      })
      .sort((x, y) => x.subjectName.localeCompare(y.subjectName));
    return { columns, rows: out };
  }

  if (type === "class" || type === "section") {
    const columns = [
      { key: "className", label: "Class", weight: 1.2 },
      ...(type === "section" ? [{ key: "sectionName", label: "Section", weight: 1 }] : []),
      { key: "registers", label: "Registers", weight: 0.8, align: "center" },
      { key: "students", label: "Students", weight: 0.8, align: "center" },
      { key: "total", label: "Records", weight: 0.8, align: "center" },
      { key: "present", label: "Present", weight: 0.7, align: "center" },
      { key: "absent", label: "Absent", weight: 0.7, align: "center" },
      { key: "leave", label: "Leave", weight: 0.6, align: "center" },
      { key: "percentage", label: "%", weight: 0.7, align: "center" },
    ];
    const keyFn = type === "section" ? (a) => `${a.classId}|${a.sectionId}` : (a) => a.classId;
    const out = group(keyFn)
      .map(([, list]) => ({
        className: nameOf(db, "classes", list[0].classId) || "—",
        sectionName: nameOf(db, "sections", list[0].sectionId) || "Whole class",
        registers: new Set(list.map((x) => [x.subject, x.date, x.period, x.sectionId].join("|"))).size,
        students: new Set(list.map((x) => x.student)).size,
        ...countStatuses(list),
        percentage: pctCell(pctOf(list)),
      }))
      .sort((x, y) => x.className.localeCompare(y.className) || x.sectionName.localeCompare(y.sectionName));
    return { columns, rows: out };
  }

  if (type === "faculty") {
    const columns = [
      { key: "takenByName", label: "Taken By", weight: 1.6 },
      { key: "takenByRole", label: "Role", weight: 1 },
      { key: "registers", label: "Registers", weight: 0.8, align: "center" },
      { key: "records", label: "Students Marked", weight: 1, align: "center" },
      { key: "subjects", label: "Subjects", weight: 2 },
      { key: "first", label: "First", weight: 0.9 },
      { key: "last", label: "Last", weight: 0.9 },
    ];
    const out = group((a) => String(a.takenBy))
      .map(([, list]) => {
        const dates = list.map((x) => x.date).sort();
        return {
          takenByName: list[0].takenByName || "",
          takenByRole: list[0].takenByRole || "",
          registers: new Set(list.map((x) => [x.classId, x.sectionId, x.subject, x.date, x.period].join("|"))).size,
          records: list.length,
          subjects: [...new Set(list.map((x) => nameOf(db, "subjects", x.subject)))].join(", "),
          first: displayDate(dates[0]),
          last: displayDate(dates[dates.length - 1]),
        };
      })
      .sort((x, y) => y.registers - x.registers);
    return { columns, rows: out };
  }

  if (type === "absent") {
    const columns = [
      { key: "date", label: "Date", weight: 0.9 },
      { key: "period", label: "Period", weight: 0.6, align: "center" },
      { key: "admissionNumber", label: "Student ID", weight: 1.2 },
      { key: "studentName", label: "Student", weight: 1.6 },
      { key: "className", label: "Class", weight: 0.9 },
      { key: "sectionName", label: "Section", weight: 0.8 },
      { key: "subjectName", label: "Subject", weight: 1.5 },
      { key: "takenByName", label: "Taken By", weight: 1.3 },
    ];
    const out = rows
      .filter((a) => a.status === "Absent")
      .map((a) => {
        const s = studentInfo(a.student);
        return {
          date: displayDate(a.date),
          iso: a.date,
          period: a.period || "—",
          studentId: a.student,
          admissionNumber: s.admissionNumber || a.student,
          studentName: s.name || a.student,
          className: nameOf(db, "classes", a.classId),
          sectionName: nameOf(db, "sections", a.sectionId) || "—",
          subjectName: nameOf(db, "subjects", a.subject),
          takenByName: a.takenByName || "",
        };
      })
      .sort((x, y) => y.iso.localeCompare(x.iso) || x.studentName.localeCompare(y.studentName));
    return { columns, rows: out };
  }
  return null;
}

// GET /api/attendance/reports?type=&format=json|csv|pdf|docx&<filters>
router.get("/reports", requireRole("Admin", "Attendance Staff", "Faculty"), async (req, res) => {
  try {
    const db = load();
    const settings = getSettings(db);
    const type = String(req.query.type || "monthly");
    if (!REPORTS[type]) return res.status(400).json({ error: `Report type must be one of: ${Object.keys(REPORTS).join(", ")}.` });
    const f = readFilters(req.query);
    if (type === "daily" && !f.date) return res.status(400).json({ error: "Select a date for the daily report." });
    if (type === "monthly" && !f.month && !f.from && !f.to) return res.status(400).json({ error: "Select a month for the monthly report." });
    if (type === "student" && !f.studentId) return res.status(400).json({ error: "Select a student for the student report." });
    if (f.studentId && !canViewStudent(req.user, f.studentId, db)) return res.status(403).json({ error: "Not authorized." });

    const rows = applyFilters(scopedRows(db, req.user), f);
    const built = buildReport(db, settings, type, f, rows);
    const meta = [
      ["Academic Year", (byId(db, "academicYears", f.academicYearId) || {}).label || "All"],
      ["Class", nameOf(db, "classes", f.classId) || "All"],
      ["Section", nameOf(db, "sections", f.sectionId) || "All"],
      ["Subject", nameOf(db, "subjects", f.subject) || "All"],
      ["Period", f.date ? displayDate(f.date) : f.month || (f.from || f.to ? `${displayDate(f.from) || "…"} – ${displayDate(f.to) || "…"}` : "All dates")],
    ];
    if (f.studentId) meta.push(["Student", nameOf(db, "students", f.studentId)]);
    const notes = [
      `Attendance % = ${settings.attendance.leaveInDenominator ? "Present ÷ (Present + Absent + Leave)" : "Present ÷ (Present + Absent); approved leave is excluded"}. Low-attendance threshold: ${settings.attendance.lowThreshold}%.`,
    ];

    const format = String(req.query.format || "json");
    if (format !== "json") {
      if (built.rows.length === 0) return res.status(404).json({ error: "No attendance records available for these filters." });
      audit(req, { action: "attendanceReport.downloaded", entityType: "attendance", entityId: type, summary: `Downloaded ${REPORTS[type]} (${format.toUpperCase()})` });
      const handled = await sendReport(res, format, {
        college: (db.collegeProfile && db.collegeProfile.name) || "",
        title: REPORTS[type],
        meta,
        columns: built.columns,
        rows: built.rows,
        notes,
        generatedBy: req.user.name || req.user.username,
        filename: `attendance-${type}-${f.date || f.month || collegeToday()}`,
      });
      if (!handled) res.status(400).json({ error: "format must be json, csv, pdf or docx." });
      return;
    }
    res.json({
      type,
      title: REPORTS[type],
      columns: built.columns,
      rows: built.rows,
      meta,
      notes,
      policy: { lowThreshold: settings.attendance.lowThreshold, leaveInDenominator: settings.attendance.leaveInDenominator },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("attendance report failed:", e);
    if (!res.headersSent) res.status(500).json({ error: "Could not build the report." });
  }
});

// GET /api/attendance/report?subject=&from=&to=&classId=&format=csv — older
// student-by-subject report, kept for existing callers; uses the same policy.
router.get("/report", requireRole("Admin", "Attendance Staff", "Faculty"), async (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const { subject, from, to, classId, format } = req.query;
  let rows = scopedRows(db, req.user);
  if (subject) {
    if (req.user.role === "Faculty" && !facultySubjectIds(req.user, db).includes(subject)) {
      return res.status(403).json({ error: "You are not assigned to this subject." });
    }
    rows = rows.filter((a) => a.subject === subject);
  }
  rows = applyFilters(rows, { from, to, classId });
  const grouped = new Map();
  rows.forEach((a) => {
    const key = `${a.student}|${a.subject}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(a);
  });
  const report = [...grouped.values()]
    .map((list) => {
      const s = byId(db, "students", list[0].student) || {};
      const c = countStatuses(list);
      const p = attendancePercentage(c, settings);
      return {
        studentId: list[0].student,
        studentName: s.name || list[0].student,
        admissionNumber: s.admissionNumber || "",
        rollNumber: s.rollNumber || "",
        subject: nameOf(db, "subjects", list[0].subject) || list[0].subject,
        ...c,
        percentage: p === null ? 0 : round2(p),
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subject.localeCompare(b.subject));
  if (format === "csv") {
    await sendReport(res, "csv", {
      title: "attendance-report",
      columns: [
        { key: "studentId", label: "Student ID" },
        { key: "studentName", label: "Name" },
        { key: "admissionNumber", label: "Admission No" },
        { key: "rollNumber", label: "Roll No" },
        { key: "subject", label: "Subject" },
        { key: "present", label: "Present" },
        { key: "absent", label: "Absent" },
        { key: "leave", label: "Leave" },
        { key: "total", label: "Total" },
        { key: "percentage", label: "Percentage" },
      ],
      rows: report,
      filename: `attendance-report-${collegeToday()}`,
    });
    return;
  }
  res.json({ report, generatedAt: new Date().toISOString(), filters: { subject, from, to, classId } });
});

module.exports = router;
