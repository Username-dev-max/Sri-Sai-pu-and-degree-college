const express = require("express");
const { load } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken);

// GET /api/reports/dashboard  (Admin) — headline stats for the admin dashboard
router.get("/dashboard", requireRole("Admin"), (req, res) => {
  const db = load();
  const totalStudents = db.students.length;
  const totalFaculty = db.faculty.length;
  const totalDepartments = db.departments.length;
  const totalCourses = db.courses.length;

  const present = db.attendance.filter((a) => a.status === "Present").length;
  const avgAttendance = db.attendance.length ? Math.round((present / db.attendance.length) * 1000) / 10 : 0;

  const pendingFees = db.fees.reduce((sum, f) => sum + (f.total - f.paid), 0);
  const totalCollected = db.fees.reduce((sum, f) => sum + f.paid, 0);

  const deptWise = db.departments.map((d) => ({
    department: d.code,
    students: db.students.filter((s) => s.department === d.id).length,
  }));

  res.json({
    totalStudents, totalFaculty, totalDepartments, totalCourses,
    avgAttendance, pendingFees, totalCollected,
    deptWise,
    upcomingExams: db.exams.slice(0, 5),
    recentNotices: db.notices.slice(0, 5),
  });
});

module.exports = router;
