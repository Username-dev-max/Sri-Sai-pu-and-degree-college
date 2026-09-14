/* =========================================================================
   attendance.js — marking, reviewing and reporting attendance.

   Statuses are Present, Absent and Leave. "Not marked" is the ABSENCE of a
   record, never a stored value: a day nobody took a register stays blank
   rather than being invented as present or absent.

   Percentage = present / total. Leave counts toward the total but not as
   present — matching the college's own convention (35 present of 40 classes
   with 1 leave = 87.5%).
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  canTouchSubject,
  canTouchSubjectInClass,
  canViewStudent,
  studentsInClass,
  facultySubjectIds,
} = require("../scope");
const { audit, notify } = require("../services");

const router = express.Router();
router.use(verifyToken);

const STATUSES = ["Present", "Absent", "Leave"];
const isoDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const round1 = (n) => Math.round(n * 10) / 10;
const nameOf = (db, coll, id) => ((db[coll] || []).find((x) => x.id === id) || {}).name || "";
const displayDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

function computePercentage(records) {
  if (!records.length) return null;
  const present = records.filter((r) => r.status === "Present").length;
  return round1((present / records.length) * 100);
}

/** One register = one subject, on one date, for one class and section. */
function sameRegister(a, subject, date, classId, sectionId) {
  return (
    a.subject === subject &&
    a.date === date &&
    (a.classId || "") === (classId || "") &&
    (a.sectionId || "") === (sectionId || "")
  );
}

/** Approved leave covering this student on this date (and subject, if the
 *  leave named one). */
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

/** Class-scoped requests are checked against the exact class and section;
 *  older callers that send no class fall back to the subject-level check. */
function mayUseRegister(user, subject, classId, sectionId, db) {
  return classId
    ? canTouchSubjectInClass(user, subject, classId, sectionId || "", db)
    : canTouchSubject(user, subject, db);
}

/* ------------------------------ submission ------------------------------- */

// POST /api/attendance — submit (or correct) a register.
// body: { subject, date, records:[{student,status}], classId?, sectionId?,
//         period?, overrideLeave? }
router.post("/", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const b = req.body || {};
  const { subject, date, records } = b;
  const classId = b.classId || "";
  const sectionId = b.sectionId || "";

  if (!subject || !isoDay(date) || !Array.isArray(records)) {
    return res.status(400).json({ error: "subject, date and records[] are required." });
  }
  if (!db.subjects.some((s) => s.id === subject)) {
    return res.status(404).json({ error: "That subject does not exist." });
  }
  if (!mayUseRegister(req.user, subject, classId, sectionId, db)) {
    return res.status(403).json({ error: "You are not assigned to this subject." });
  }

  // Validate EVERY row before saving anything, so a bad register is rejected
  // whole instead of being half-written.
  const seen = new Set();
  const roster = classId ? new Set(studentsInClass(db, classId, sectionId).map((s) => s.id)) : null;
  for (const [i, r] of records.entries()) {
    if (!r || !r.student) return res.status(400).json({ error: `Row ${i + 1}: a student is required.` });
    if (!STATUSES.includes(r.status)) {
      return res.status(400).json({ error: `Row ${i + 1}: status must be Present, Absent or Leave.` });
    }
    if (seen.has(r.student)) return res.status(400).json({ error: `Row ${i + 1}: that student appears twice.` });
    seen.add(r.student);
    if (!db.students.some((s) => s.id === r.student)) {
      return res.status(404).json({ error: `Row ${i + 1}: that student does not exist.` });
    }
    if (roster && !roster.has(r.student)) {
      return res.status(400).json({ error: `Row ${i + 1}: that student is not in this class or section.` });
    }
  }
  // A class register must account for every student in it.
  if (roster) {
    const missing = [...roster].filter((id) => !seen.has(id));
    if (missing.length) {
      return res.status(400).json({
        error: `${missing.length} student${missing.length === 1 ? " has" : "s have"} no status. Mark every student before submitting.`,
        missing,
      });
    }
  }

  // Approved leave wins. Faculty and staff cannot overwrite it; an Admin can,
  // but only by explicitly asking to.
  const adminOverride = req.user.role === "Admin" && b.overrideLeave === true;
  const leaveForced = [];
  const finalRecords = records.map((r) => {
    const leave = approvedLeaveFor(db, r.student, date, subject);
    if (leave && r.status !== "Leave" && !adminOverride) {
      leaveForced.push(r.student);
      return { student: r.student, status: "Leave", leaveRequestId: leave.id };
    }
    return { student: r.student, status: r.status, leaveRequestId: leave ? leave.id : null };
  });

  const fac = req.user.role === "Faculty" ? db.faculty.find((f) => f.id === req.user.linkedId) : null;
  const subj = db.subjects.find((s) => s.id === subject) || {};
  const now = new Date().toISOString();

  // Resubmitting the same register replaces it, so a correction never
  // leaves duplicate marks behind.
  const before = db.attendance.filter((a) => sameRegister(a, subject, date, classId, sectionId));
  const prevStatus = new Map(before.map((a) => [a.student, a.status]));
  db.attendance = db.attendance.filter((a) => !sameRegister(a, subject, date, classId, sectionId));

  finalRecords.forEach((r) => {
    db.attendance.push({
      id: `ATT-${subject}-${date}-${classId || "x"}-${sectionId || "x"}-${r.student}`,
      subject,
      date,
      student: r.student,
      status: r.status,
      classId,
      sectionId,
      period: b.period || "",
      department: subj.department || "",
      takenBy: req.user.id,
      takenByName: fac ? fac.name : req.user.name || req.user.username,
      takenByRole: req.user.role,
      facultyId: fac ? fac.id : null,
      takenAt: now,
      leaveRequestId: r.leaveRequestId,
    });
  });
  save(db);

  const counts = {
    present: finalRecords.filter((r) => r.status === "Present").length,
    absent: finalRecords.filter((r) => r.status === "Absent").length,
    leave: finalRecords.filter((r) => r.status === "Leave").length,
  };
  audit(req, {
    action: before.length ? "attendance.updated" : "attendance.submitted",
    entityType: "attendance",
    entityId: `${subject}-${date}-${classId || "all"}-${sectionId || "all"}`,
    after: { ...counts, leaveForced: leaveForced.length },
    summary: `${before.length ? "Updated" : "Submitted"} attendance for ${subj.name || subject}${
      classId ? ` — ${nameOf(db, "classes", classId)}${sectionId ? ` ${nameOf(db, "sections", sectionId)}` : ""}` : ""
    } on ${displayDate(date)}: ${counts.present} present, ${counts.absent} absent, ${counts.leave} leave`,
  });

  // Tell the family when a child is NEWLY marked absent — not again when an
  // unchanged register is resubmitted.
  finalRecords
    .filter((r) => r.status === "Absent" && prevStatus.get(r.student) !== "Absent")
    .forEach((r) => {
      const s = db.students.find((x) => x.id === r.student) || {};
      db.users
        .filter(
          (u) =>
            (u.role === "Parent" && (u.linkedIds || [u.linkedId]).includes(r.student)) ||
            (u.role === "Student" && u.linkedId === r.student)
        )
        .forEach((u) =>
          notify(u.id, {
            title: u.role === "Parent" ? "Your ward was marked absent" : "You were marked absent",
            message: `${s.name || "Student"} was absent for ${subj.name || "class"} on ${displayDate(date)}.`,
            type: "attendance",
            relatedType: "attendance",
            relatedId: `${subject}-${date}`,
          })
        );
    });

  res.json({ ok: true, saved: finalRecords.length, ...counts, leaveForced, takenAt: now });
});

/* ------------------------------ staff views ------------------------------ */

// GET /api/attendance/roster?classId=&sectionId=&subjectId=&date=
// The students to mark, with any existing status and any approved leave.
router.get("/roster", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { classId, sectionId = "", subjectId, date } = req.query;
  if (!classId || !subjectId || !isoDay(date)) {
    return res.status(400).json({ error: "classId, subjectId and date are required." });
  }
  if (!canTouchSubjectInClass(req.user, subjectId, classId, sectionId, db)) {
    return res.status(403).json({ error: "You are not assigned to this subject for that class." });
  }
  const existing = db.attendance.filter((a) => sameRegister(a, subjectId, date, classId, sectionId));
  const students = studentsInClass(db, classId, sectionId)
    .map((s) => {
      const rec = existing.find((a) => a.student === s.id);
      const leave = approvedLeaveFor(db, s.id, date, subjectId);
      return {
        studentId: s.id,
        studentName: s.name,
        admissionNumber: s.admissionNumber || "",
        rollNumber: s.rollNumber || "",
        section: s.section || "",
        status: rec ? rec.status : leave ? "Leave" : null,
        onApprovedLeave: !!leave,
        leaveRequestId: leave ? leave.id : null,
        // A UI hint only — POST enforces this regardless.
        locked: !!leave && req.user.role !== "Admin",
      };
    })
    .sort(
      (a, b) =>
        String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }) ||
        a.studentName.localeCompare(b.studentName)
    );
  const taken = existing[0] || null;
  res.json({
    students,
    alreadySubmitted: existing.length > 0,
    takenByName: taken ? taken.takenByName : "",
    takenAt: taken ? taken.takenAt : null,
  });
});

// GET /api/attendance/session?classId=&sectionId=&subjectId=&date=
// One submitted register, split into present / absent / leave groups.
router.get("/session", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { classId, sectionId = "", subjectId, date } = req.query;
  if (!classId || !subjectId || !isoDay(date)) {
    return res.status(400).json({ error: "classId, subjectId and date are required." });
  }
  if (!canTouchSubjectInClass(req.user, subjectId, classId, sectionId, db)) {
    return res.status(403).json({ error: "You are not assigned to this subject for that class." });
  }
  const rows = db.attendance.filter((a) => sameRegister(a, subjectId, date, classId, sectionId));
  // Guardian phone numbers are NOT included — only whether one exists. The
  // number is released through /api/call-followups/contact, which is audited.
  const item = (a) => {
    const s = db.students.find((x) => x.id === a.student) || {};
    return {
      studentId: a.student,
      studentName: s.name || a.student,
      admissionNumber: s.admissionNumber || "",
      rollNumber: s.rollNumber || "",
      hasGuardianPhone: !!s.guardianPhone,
    };
  };
  const byName = (x, y) => x.studentName.localeCompare(y.studentName);
  const present = rows.filter((a) => a.status === "Present").map(item).sort(byName);
  const absent = rows.filter((a) => a.status === "Absent").map(item).sort(byName);
  const leave = rows.filter((a) => a.status === "Leave").map(item).sort(byName);
  const total = rows.length;

  res.json({
    submitted: total > 0,
    date,
    classId,
    sectionId,
    subjectId,
    className: nameOf(db, "classes", classId),
    sectionName: nameOf(db, "sections", sectionId),
    subjectName: nameOf(db, "subjects", subjectId),
    takenByName: rows[0] ? rows[0].takenByName : "",
    takenAt: rows[0] ? rows[0].takenAt : null,
    totals: {
      total,
      present: present.length,
      absent: absent.length,
      leave: leave.length,
      percentage: total ? round1((present.length / total) * 100) : null,
    },
    present,
    absent,
    leave,
  });
});

// GET /api/attendance/sessions?department=&classId=&sectionId=&subjectId=&date=&from=&to=&facultyId=
// Attendance Management: one row per submitted register.
router.get("/sessions", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { department, classId, sectionId, subjectId, date, from, to, facultyId } = req.query;
  let rows = db.attendance;

  // A faculty member lists only registers for subjects/classes they teach.
  if (req.user.role === "Faculty") {
    rows = rows.filter((a) => mayUseRegister(req.user, a.subject, a.classId, a.sectionId, db));
  }
  if (department) rows = rows.filter((a) => a.department === department);
  if (classId) rows = rows.filter((a) => (a.classId || "") === classId);
  if (sectionId !== undefined && sectionId !== "") rows = rows.filter((a) => (a.sectionId || "") === sectionId);
  if (subjectId) rows = rows.filter((a) => a.subject === subjectId);
  if (date) rows = rows.filter((a) => a.date === date);
  if (from) rows = rows.filter((a) => a.date >= from);
  if (to) rows = rows.filter((a) => a.date <= to);
  if (facultyId) rows = rows.filter((a) => a.facultyId === facultyId);

  const groups = new Map();
  rows.forEach((a) => {
    const key = `${a.subject}|${a.date}|${a.classId || ""}|${a.sectionId || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        subjectId: a.subject,
        date: a.date,
        classId: a.classId || "",
        sectionId: a.sectionId || "",
        department: a.department || "",
        takenByName: a.takenByName || "",
        facultyId: a.facultyId || null,
        takenAt: a.takenAt || null,
        period: a.period || "",
        total: 0,
        present: 0,
        absent: 0,
        leave: 0,
      });
    }
    const g = groups.get(key);
    g.total += 1;
    if (a.status === "Present") g.present += 1;
    else if (a.status === "Absent") g.absent += 1;
    else if (a.status === "Leave") g.leave += 1;
  });

  const sessions = [...groups.values()]
    .map((g) => ({
      ...g,
      subjectName: nameOf(db, "subjects", g.subjectId),
      className: nameOf(db, "classes", g.classId),
      sectionName: nameOf(db, "sections", g.sectionId),
      departmentName: nameOf(db, "departments", g.department),
      percentage: g.total ? round1((g.present / g.total) * 100) : null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.takenAt).localeCompare(String(a.takenAt)));

  res.json({ sessions });
});

// GET /api/attendance/subject/:subject?date=&classId=&sectionId=
router.get("/subject/:subject", requireRole("Faculty", "Admin", "Attendance Staff"), (req, res) => {
  const db = load();
  const { date, classId, sectionId } = req.query;
  if (!mayUseRegister(req.user, req.params.subject, classId, sectionId, db)) {
    return res.status(403).json({ error: "You are not assigned to this subject." });
  }
  let list = db.attendance.filter((a) => a.subject === req.params.subject);
  if (date) list = list.filter((a) => a.date === date);
  if (classId) list = list.filter((a) => (a.classId || "") === classId);
  if (sectionId) list = list.filter((a) => (a.sectionId || "") === sectionId);
  res.json({ attendance: list });
});

/* ---------------------------- student / parent --------------------------- */

// GET /api/attendance/student/:id — subject-wise summary.
router.get("/student/:id", (req, res) => {
  const db = load();
  // Admin/Attendance Staff are college-wide; a Faculty member sees only
  // students they teach; a Student sees themself; a Parent their children.
  if (!canViewStudent(req.user, req.params.id, db)) {
    return res.status(403).json({ error: "Not authorized." });
  }
  const records = db.attendance.filter((a) => a.student === req.params.id);
  const bySubject = {};
  records.forEach((r) => {
    (bySubject[r.subject] = bySubject[r.subject] || []).push(r);
  });
  const subjectSummary = Object.entries(bySubject)
    .map(([subject, recs]) => ({
      subject,
      subjectName: nameOf(db, "subjects", subject),
      total: recs.length,
      present: recs.filter((r) => r.status === "Present").length,
      absent: recs.filter((r) => r.status === "Absent").length,
      leave: recs.filter((r) => r.status === "Leave").length,
      percentage: computePercentage(recs),
    }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  res.json({
    records,
    overallPercentage: computePercentage(records),
    totals: {
      total: records.length,
      present: records.filter((r) => r.status === "Present").length,
      absent: records.filter((r) => r.status === "Absent").length,
      leave: records.filter((r) => r.status === "Leave").length,
    },
    subjectSummary,
  });
});

// GET /api/attendance/student/:id/calendar?month=YYYY-MM&subjectId=
// Built only from real records; a day with no record is "not marked".
router.get("/student/:id/calendar", (req, res) => {
  const db = load();
  if (!canViewStudent(req.user, req.params.id, db)) {
    return res.status(403).json({ error: "Not authorized." });
  }
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || ""))
    ? req.query.month
    : new Date().toISOString().slice(0, 7);

  const mine = db.attendance.filter((a) => a.student === req.params.id);
  let rows = mine.filter((a) => a.date.startsWith(month));
  if (req.query.subjectId) rows = rows.filter((a) => a.subject === req.query.subjectId);

  // A day can hold several subjects and periods.
  const days = {};
  rows.forEach((a) => {
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

  // A day's headline status: Absent if any class that day was missed, else
  // Leave if any was on leave, else Present.
  const summary = Object.fromEntries(
    Object.entries(days).map(([d, list]) => [
      d,
      list.some((x) => x.status === "Absent") ? "Absent" : list.some((x) => x.status === "Leave") ? "Leave" : "Present",
    ])
  );

  const subjects = [...new Set(mine.map((a) => a.subject))]
    .map((id) => ({ id, name: nameOf(db, "subjects", id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ month, days, summary, subjects });
});

/* -------------------------------- reports -------------------------------- */

// GET /api/attendance/report?subject=&from=&to=&classId=&format=csv
router.get("/report", requireRole("Admin", "Attendance Staff", "Faculty"), (req, res) => {
  const db = load();
  const { subject, from, to, classId, format } = req.query;

  let rows = db.attendance;
  if (subject) {
    if (!canTouchSubject(req.user, subject, db)) {
      return res.status(403).json({ error: "You are not assigned to this subject." });
    }
    rows = rows.filter((a) => a.subject === subject);
  } else if (req.user.role === "Faculty") {
    // No subject named: a Faculty member still only gets their own.
    const mine = facultySubjectIds(req.user, db);
    rows = rows.filter((a) => mine.includes(a.subject));
  }
  if (from) rows = rows.filter((a) => a.date >= from);
  if (to) rows = rows.filter((a) => a.date <= to);

  const studentById = new Map(db.students.map((s) => [s.id, s]));
  if (classId) {
    rows = rows.filter((a) => (a.classId || (studentById.get(a.student) || {}).classId) === classId);
  }

  const grouped = new Map();
  rows.forEach((a) => {
    const key = `${a.student}|${a.subject}`;
    if (!grouped.has(key)) {
      grouped.set(key, { student: a.student, subject: a.subject, total: 0, present: 0, absent: 0, leave: 0 });
    }
    const g = grouped.get(key);
    g.total += 1;
    if (a.status === "Present") g.present += 1;
    else if (a.status === "Absent") g.absent += 1;
    else if (a.status === "Leave") g.leave += 1;
  });

  const report = [...grouped.values()]
    .map((g) => {
      const s = studentById.get(g.student) || {};
      return {
        studentId: g.student,
        studentName: s.name || g.student,
        admissionNumber: s.admissionNumber || "",
        rollNumber: s.rollNumber || "",
        subject: nameOf(db, "subjects", g.subject) || g.subject,
        present: g.present,
        absent: g.absent,
        leave: g.leave,
        total: g.total,
        percentage: g.total ? round1((g.present / g.total) * 100) : 0,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subject.localeCompare(b.subject));

  if (format === "csv") {
    const header = ["Student ID", "Name", "Admission No", "Roll No", "Subject", "Present", "Absent", "Leave", "Total", "Percentage"];
    // Quote every field and double embedded quotes, so a name containing a
    // comma cannot shift the columns.
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.map(esc).join(","),
      ...report.map((r) =>
        [r.studentId, r.studentName, r.admissionNumber, r.rollNumber, r.subject, r.present, r.absent, r.leave, r.total, `${r.percentage}%`]
          .map(esc)
          .join(",")
      ),
    ].join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-report-${stamp}.csv"`);
    // Byte-order mark so Excel reads UTF-8 names correctly.
    return res.send("﻿" + csv);
  }

  res.json({ report, generatedAt: new Date().toISOString(), filters: { subject, from, to, classId } });
});

module.exports = router;
