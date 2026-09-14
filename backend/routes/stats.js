/* =========================================================================
   stats.js — Admin dashboard analytics.

   Every number here is derived by counting real rows. There is no seeded,
   sample or placeholder figure anywhere in this file: an empty database
   returns zeros and empty arrays, and the UI renders its empty states.
   ========================================================================= */
const express = require("express");
const { load } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audienceMatches, isLive } = require("../services");

const router = express.Router();
router.use(verifyToken, requireRole("Admin"));

const ROLES = ["Admin", "Faculty", "Attendance Staff", "Student", "Parent"];

/** Group rows by a key function into [{ key, label, value }] sorted by value. */
function tally(rows, keyFn, labelFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (k === undefined || k === null || k === "") return;
    map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: labelFn ? labelFn(key) : String(key), value }))
    .sort((a, b) => b.value - a.value);
}

router.get("/", (req, res) => {
  const db = load();
  const today = new Date().toISOString().slice(0, 10);

  const students = db.students || [];
  const faculty = db.faculty || [];
  const users = db.users || [];
  const fees = db.fees || [];
  const courses = db.courses || [];
  const enrollments = db.enrollments || [];

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const deptById = new Map((db.departments || []).map((d) => [d.id, d]));
  const streamById = new Map((db.streams || []).map((s) => [s.id, s]));
  const classById = new Map((db.classes || []).map((c) => [c.id, c]));

  /* ------------------------------- headline ------------------------------ */
  const accounts = {};
  ROLES.forEach((r) => {
    accounts[r] = users.filter((u) => u.role === r).length;
  });

  // A student's level/stream is read from their enrollment where one exists,
  // falling back to the fields on the student record itself.
  const levelOf = (s) => {
    const c = courseById.get(s.course);
    return s.levelId || (c ? c.levelId : "");
  };
  const streamOf = (s) => {
    const c = courseById.get(s.course);
    return s.stream || (c ? c.stream : "");
  };

  const pucStudents = students.filter((s) => levelOf(s) === "LVL_PUC");
  const degStudents = students.filter((s) => levelOf(s) === "LVL_DEG");

  // I PUC / II PUC split comes from the enrollment's class, which is the only
  // place the year-of-study is actually recorded.
  const classOfStudent = (s) => {
    const e = enrollments.find((x) => x.studentId === s.id);
    return e ? e.classId : s.classId || "";
  };

  /* --------------------------------- fees -------------------------------- */
  // Fee rows carry `total` (billed) and `paid`; "pending" is the difference.
  // Note the field is `total`, not `amount` — reading the wrong one silently
  // reports ₹0 across the whole dashboard.
  const feeTotals = fees.reduce(
    (acc, f) => {
      const amount = Number(f.total) || 0;
      const paid = Number(f.paid) || 0;
      acc.billed += amount;
      acc.collected += Math.min(paid, amount);
      acc.pending += Math.max(0, amount - paid);
      if (paid >= amount && amount > 0) acc.settledCount += 1;
      else if (amount > 0) acc.pendingCount += 1;
      return acc;
    },
    { billed: 0, collected: 0, pending: 0, settledCount: 0, pendingCount: 0 }
  );

  /* ------------------------------ attendance ----------------------------- */
  const todayRows = (db.attendance || []).filter((a) => a.date === today);
  const attendanceToday = {
    marked: todayRows.length,
    present: todayRows.filter((a) => a.status === "Present").length,
    absent: todayRows.filter((a) => a.status === "Absent").length,
  };
  attendanceToday.percentage = attendanceToday.marked
    ? Math.round((attendanceToday.present / attendanceToday.marked) * 100)
    : 0;

  /* ---------------------------- announcements ---------------------------- */
  const announcements = db.announcements || [];
  const liveAnnouncements = announcements.filter((a) => isLive(a));
  const unreadNotifications = (db.notifications || []).filter(
    (n) => n.userId === req.user.id && !n.read
  ).length;

  /* --------------------------------- charts ------------------------------ */
  // Admissions per academic year, oldest first so the line reads left to right.
  const admissionsByYear = tally(students, (s) => String(s.admissionYear || "")).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  res.json({
    generatedAt: new Date().toISOString(),
    cards: {
      totalStudents: students.length,
      totalFaculty: faculty.length,
      totalAttendanceStaff: accounts["Attendance Staff"],
      totalParents: accounts.Parent,
      activeUsers: users.filter((u) => (u.status || "Active") === "Active").length,
      inactiveUsers: users.filter((u) => u.status === "Inactive").length,
      newAdmissions: students.filter((s) => String(s.admissionYear) === String(new Date().getFullYear())).length,
      pendingFees: feeTotals.pending,
      collectedFees: feeTotals.collected,
      billedFees: feeTotals.billed,
      pendingFeeStudents: feeTotals.pendingCount,
      settledFeeStudents: feeTotals.settledCount,
      announcements: liveAnnouncements.length,
      draftAnnouncements: announcements.filter((a) => !a.published).length,
      unreadNotifications,
    },
    admissions: {
      total: students.length,
      puc: pucStudents.length,
      degree: degStudents.length,
      iPuc: students.filter((s) => classOfStudent(s) === "CLS01").length,
      iiPuc: students.filter((s) => classOfStudent(s) === "CLS02").length,
    },
    accounts,
    attendanceToday,
    charts: {
      admissionsByYear,
      byStream: tally(students, streamOf, (k) => (streamById.get(k) || {}).name || k),
      byCombination: tally(students, (s) => s.course, (k) => (courseById.get(k) || {}).name || k),
      byDepartment: tally(students, (s) => s.department, (k) => (deptById.get(k) || {}).name || k),
      byClass: tally(students, classOfStudent, (k) => (classById.get(k) || {}).name || k),
      facultyByDepartment: tally(faculty, (f) => f.department, (k) => (deptById.get(k) || {}).name || k),
      fees: [
        { key: "collected", label: "Collected", value: feeTotals.collected },
        { key: "pending", label: "Pending", value: feeTotals.pending },
      ],
      attendanceSummary: [
        { key: "present", label: "Present", value: attendanceToday.present },
        { key: "absent", label: "Absent", value: attendanceToday.absent },
      ],
    },
  });
});

module.exports = router;
