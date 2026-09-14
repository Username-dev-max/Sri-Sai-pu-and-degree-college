const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const facultyRoutes = require("./routes/faculty");
const genericCrud = require("./routes/genericCrud");
const attendanceRoutes = require("./routes/attendance");
const { router: marksRoutes, resultsHandler } = require("./routes/marks");
const feeRoutes = require("./routes/fees");
const assignmentRoutes = require("./routes/assignments");
const reportRoutes = require("./routes/reports");
const publicRoutes = require("./routes/public");
const collegeProfileRoutes = require("./routes/collegeProfile");
const uploadRoutes = require("./routes/uploads");
const userRoutes = require("./routes/users");
const notificationRoutes = require("./routes/notifications");
const announcementRoutes = require("./routes/announcements");
const statsRoutes = require("./routes/stats");
const searchRoutes = require("./routes/search");
const academicConfigRoutes = require("./routes/academicConfig");
const documentRoutes = require("./routes/documents");
const { verifyToken } = require("./middleware/auth");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "cms-backend" }));

app.use("/api/public", publicRoutes);
app.use("/api/admissions-inquiries", genericCrud("admissionInquiries", "INQ", ["Admin"], ["Admin"]));
app.use("/api/college-profile", collegeProfileRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/sports-achievements", genericCrud("sportsAchievements", "SPT", ["Admin"]));
app.use("/api/academic-merit", genericCrud("academicMerit", "MER", ["Admin"]));
app.use("/api/gallery", genericCrud("galleryItems", "GAL", ["Admin"]));
app.use("/api/teams", genericCrud("teams", "TEAM", ["Admin"]));
app.use("/api/team-members", genericCrud("teamMembers", "MEM", ["Admin"]));

app.use("/api/auth", authRoutes);

/* Admin management surface. Every one of these routers applies
   verifyToken + requireRole internally — mounting order is not the control. */
app.use("/api/users", userRoutes);
app.use("/api/admin", searchRoutes);
app.use("/api/admin/stats", statsRoutes);
app.use("/api/academic-config", academicConfigRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/documents", documentRoutes);
// Academic structure the enrollment cascade reads. Any authenticated user may
// read these (they carry no personal data); only Admin may change them.
app.use("/api/academic-years", genericCrud("academicYears", "AY", ["Admin"]));
app.use("/api/sections", genericCrud("sections", "SEC", ["Admin"]));
app.use("/api/classes", genericCrud("classes", "CLS", ["Admin"]));
app.use("/api/streams", genericCrud("streams", "STR", ["Admin"]));
app.use("/api/faculty-assignments", genericCrud("facultyAssignments", "FA", ["Admin"]));

app.use("/api/students", studentRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/departments", genericCrud("departments", "DEP", ["Admin"]));
app.use("/api/courses", genericCrud("courses", "C", ["Admin"]));
app.use("/api/subjects", genericCrud("subjects", "SUB", ["Admin"]));
app.use("/api/exams", genericCrud("exams", "EX", ["Admin", "Faculty"]));
app.use("/api/timetable", genericCrud("timetable", "TT", ["Admin"]));
app.use("/api/notices", genericCrud("notices", "N", ["Admin", "Faculty"]));
app.use("/api/attendance", attendanceRoutes);
app.use("/api/marks", marksRoutes);
app.get("/api/results/:studentId", verifyToken, resultsHandler);
app.use("/api/fees", feeRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/reports", reportRoutes);

app.use((req, res) => res.status(404).json({ error: "Endpoint not found." }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n  College Management System API`);
  console.log(`  \u25B8 running on http://localhost:${PORT}`);
  console.log(`  \u25B8 health check: http://localhost:${PORT}/api/health\n`);
});
