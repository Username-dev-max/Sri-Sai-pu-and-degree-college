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
const facultyAssignmentRoutes = require("./routes/facultyAssignments");
const timetableRoutes = require("./routes/timetable");
const classTeacherRoutes = require("./routes/classTeachers");
const leaveRequestRoutes = require("./routes/leaveRequests");
const noteRoutes = require("./routes/notes");
const callFollowupRoutes = require("./routes/callFollowups");
const internalMarkRoutes = require("./routes/internalMarks");
const { verifyToken } = require("./middleware/auth");
const path = require("path");

const { UPLOAD_DIR } = require("./storage");

const app = express();

// Behind a reverse proxy / hosting router, take the client IP from the first
// X-Forwarded-For hop so audit logs and sessions record the real address.
app.set("trust proxy", 1);

// CORS. The frontend calls the API through the same origin (/api via the Vite
// proxy locally, or the host's rewrites in production), so no cross-origin
// access is needed and none is granted by default. List extra origins in
// CORS_ORIGINS (comma-separated) only if a different site must call the API.
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (corsOrigins.length) app.use(cors({ origin: corsOrigins }));

app.use(express.json());

// Public uploads. A route handler rather than express.static, which some
// hosts (Vercel Functions) ignore. basename() blocks path traversal.
app.get("/uploads/:file", (req, res) => {
  const file = path.join(UPLOAD_DIR, path.basename(req.params.file));
  res.sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "File not found." });
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true, service: "cms-backend" }));

// Authenticated responses must never be served from a cache: after logout,
// the Back button or a shared proxy could otherwise redisplay the previous
// user's data. The public site's endpoints are left cacheable.
app.use("/api", (req, res, next) => {
  if (!req.path.startsWith("/public")) {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Pragma", "no-cache");
  }
  next();
});

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
app.use("/api/faculty-assignments", facultyAssignmentRoutes);

app.use("/api/students", studentRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/departments", genericCrud("departments", "DEP", ["Admin"]));
app.use("/api/courses", genericCrud("courses", "C", ["Admin"]));
app.use("/api/subjects", genericCrud("subjects", "SUB", ["Admin"]));
app.use("/api/exams", genericCrud("exams", "EX", ["Admin", "Faculty"]));
app.use("/api/timetable", timetableRoutes);
// Task 3 modules. Each router applies its own verifyToken + role/ownership checks.
app.use("/api/class-teachers", classTeacherRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/call-followups", callFollowupRoutes);
app.use("/api/internal-marks", internalMarkRoutes);
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

// Exported so a platform that imports the app (Vercel Functions) can serve it.
module.exports = app;

// Listen only when started directly (`npm start` / `npm run dev`). The port
// comes from the host's PORT variable; 5000 is the local-development default.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n  College Management System API`);
    console.log(`  \u25B8 listening on port ${PORT}`);
    console.log(`  \u25B8 health check: /api/health\n`);
  });
}
