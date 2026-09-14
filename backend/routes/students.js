const express = require("express");
const { load, save, nextId } = require("../db");
const repo = require("../repo");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createUserAccount, resetUserCredentials } = require("../utils");
const { audit, notify, linkedChildIds } = require("../services");

const router = express.Router();
router.use(verifyToken);

// GET /api/students  (Admin, Faculty)
// Attendance Staff needs the class roster to mark attendance against.
router.get("/", requireRole("Admin", "Faculty", "Attendance Staff"), (req, res) => {
  const db = load();
  const { q, department, course, status, stream, classId, section, academicYear, page, pageSize } = req.query;
  let list = db.students.slice();

  if (q) {
    const s = q.toLowerCase();
    list = list.filter(
      (st) =>
        (st.name || "").toLowerCase().includes(s) ||
        (st.id || "").toLowerCase().includes(s) ||
        (st.admissionNumber || "").toLowerCase().includes(s) ||
        (st.rollNumber || "").toLowerCase().includes(s) ||
        (st.email || "").toLowerCase().includes(s) ||
        (st.phone || "").includes(s)
    );
  }
  if (department) list = list.filter((st) => st.department === department);
  if (course) list = list.filter((st) => st.course === course);
  if (status) list = list.filter((st) => st.status === status);
  if (stream) list = list.filter((st) => st.stream === stream);
  if (classId) list = list.filter((st) => st.classId === classId);
  if (section) list = list.filter((st) => st.section === section);
  if (academicYear) list = list.filter((st) => st.academicYear === academicYear);

  list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Paginate only when asked, so existing callers that expect the whole list
  // (dashboards, attendance rosters) keep working unchanged.
  if (page || pageSize) {
    const paged = repo.paginate(list, { page, pageSize });
    return res.json({ ...paged, students: paged.rows });
  }
  res.json({ students: list, total: list.length });
});

// GET /api/students/:id  (Admin, Faculty, or the student themself)
router.get("/:id", (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });
  const allowed =
    req.user.role === "Admin" ||
    req.user.role === "Faculty" ||
    req.user.role === "Attendance Staff" ||
    (req.user.role === "Student" && req.user.linkedId === student.id) ||
    // A parent may be linked to more than one child.
    (req.user.role === "Parent" && linkedChildIds(req.user, db).includes(student.id));
  if (!allowed) return res.status(403).json({ error: "Not authorized to view this student." });
  res.json({ student });
});

// POST /api/students  (Admin only) — Enroll a new student.
//
// Creates the student profile AND its enrollment row for the academic year.
// The login account is deliberately NOT created here: the spec separates
// enrollment from account activation, so the Admin enrolls first and then
// issues credentials through POST /api/students/:id/account. Pass
// `createAccount: true` to do both in one step.
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};

  const required = ["name", "gender", "dob", "course"];
  for (const f of required) {
    if (!b[f]) return res.status(400).json({ error: `Field '${f}' is required.` });
  }
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  if (b.email && db.students.some((s) => (s.email || "").toLowerCase() === b.email.toLowerCase())) {
    return res.status(409).json({ error: "A student with this email already exists." });
  }

  // The combination must exist and be one the college currently offers.
  const course = db.courses.find((c) => c.id === b.course);
  if (!course) return res.status(404).json({ error: "That course/combination does not exist." });
  if (course.active === false) {
    return res.status(409).json({ error: `${course.name} is not currently offered. Enable it under Academic Setup first.` });
  }

  const academicYear =
    (db.academicYears || []).find((y) => y.id === b.academicYearId) ||
    (db.academicYears || []).find((y) => y.isCurrent);
  if (!academicYear) {
    return res.status(409).json({ error: "No academic year is configured. Add one before enrolling students." });
  }

  if (b.classId && !db.classes.some((c) => c.id === b.classId)) {
    return res.status(404).json({ error: "That class does not exist." });
  }
  if (b.section && !db.sections.some((s) => s.id === b.section)) {
    return res.status(404).json({ error: "That section does not exist." });
  }

  const year = new Date().getFullYear();
  const id = nextId(`S${year}`, "student");
  const admissionNumber = b.admissionNumber ? String(b.admissionNumber).trim() : id;
  if (db.students.some((s) => s.admissionNumber === admissionNumber)) {
    return res.status(409).json({ error: "That admission number is already in use." });
  }

  const student = {
    id,
    admissionNumber,
    name: String(b.name).trim(),
    gender: b.gender,
    dob: b.dob,
    email: b.email || "",
    phone: b.phone || "",
    address: b.address || "",
    photoUrl: b.photoUrl || "",
    bloodGroup: b.bloodGroup || "",
    category: b.category || "",
    // Academic placement, denormalised onto the student for fast filtering;
    // the enrollment row below is the authoritative per-year record.
    department: b.department || course.department || "",
    course: course.id,
    levelId: course.levelId || "",
    stream: course.stream || "",
    classId: b.classId || "",
    section: b.section || "",
    rollNumber: b.rollNumber || "",
    semester: Number(b.semester) || 1,
    academicYear: academicYear.id,
    admissionYear: year,
    status: "Active",
    // Guardian / emergency contact.
    guardian: b.guardian || "",
    guardianPhone: b.guardianPhone || "",
    emergencyContact: b.emergencyContact || "",
  };
  db.students.push(student);

  const enrollment = {
    id: repo.nextId("enrollments", "ENR", "enrollment"),
    studentId: id,
    academicYearId: academicYear.id,
    levelId: course.levelId || "",
    streamId: course.stream || "",
    courseId: course.id,
    classId: b.classId || "",
    sectionId: b.section || "",
    rollNumber: b.rollNumber || "",
    status: "Active",
    enrolledAt: new Date().toISOString(),
    enrolledBy: req.user.id,
  };
  db.enrollments.push(enrollment);

  // Attach any documents uploaded ahead of submission.
  const documents = Array.isArray(b.documents) ? b.documents : [];
  documents.forEach((d) => {
    if (!d || !d.url) return;
    db.documents.push({
      id: repo.nextId("documents", "DOC", "document"),
      ownerType: "student",
      ownerId: id,
      type: d.type || "Other",
      name: d.name || d.type || "Document",
      url: d.url,
      private: true, // student documents are never publicly reachable
      uploadedBy: req.user.id,
      uploadedAt: new Date().toISOString(),
    });
  });

  let credentials = null;
  if (b.createAccount) {
    const { user, plainPassword } = createUserAccount(db, {
      name: student.name,
      role: "Student",
      linkedId: id,
      email: student.email,
    });
    user.status = "Active";
    user.createdAt = new Date().toISOString();
    user.lastLogin = null;
    credentials = { username: user.username, password: plainPassword, role: "Student" };
  }

  save(db);

  audit(req, {
    action: "student.enrolled",
    entityType: "student",
    entityId: id,
    after: student,
    summary: `Enrolled ${student.name} (${admissionNumber}) into ${course.name}`,
  });

  res.status(201).json({ student, enrollment, credentials, documents: documents.length });
});

// POST /api/students/:id/account  (Admin only) — create the login account for
// an already-enrolled student. Separate from enrollment by design.
router.post("/:id/account", requireRole("Admin"), (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });
  if (db.users.some((u) => u.role === "Student" && u.linkedId === student.id)) {
    return res.status(409).json({ error: "This student already has a login account." });
  }

  const { user, plainPassword } = createUserAccount(db, {
    name: student.name,
    role: "Student",
    linkedId: student.id,
    email: student.email,
  });
  user.status = "Active";
  user.createdAt = new Date().toISOString();
  user.lastLogin = null;
  save(db);

  audit(req, {
    action: "account.created",
    entityType: "user",
    entityId: user.id,
    summary: `Created Student account '${user.username}' for ${student.name}`,
  });
  notify(user.id, {
    title: "Your student account is ready",
    message: "An administrator created your account. Please change your temporary password after signing in.",
    type: "account",
  });

  res.status(201).json({ credentials: { username: user.username, password: plainPassword, role: "Student" } });
});

// POST /api/students/:id/reset-credentials  (Admin only) — issue a fresh
// random password for the student's linked login account.
router.post("/:id/reset-credentials", requireRole("Admin"), (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });
  const result = resetUserCredentials(db, student.id);
  if (!result) return res.status(404).json({ error: "No linked login account found for this student." });
  save(db);
  res.json({ credentials: { username: result.user.username, password: result.plainPassword, role: "Student" } });
});

// PUT /api/students/:id  (Admin only)
router.put("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found." });
  const before = { ...student };
  const editable = [
    "name", "gender", "dob", "email", "phone", "address", "photoUrl", "bloodGroup", "category",
    "department", "course", "levelId", "stream", "classId", "section", "rollNumber", "semester",
    "status", "guardian", "guardianPhone", "emergencyContact", "admissionNumber",
  ];
  editable.forEach((f) => {
    if (req.body[f] !== undefined) student[f] = f === "semester" ? Number(req.body[f]) : req.body[f];
  });
  save(db);

  audit(req, {
    action: "student.updated",
    entityType: "student",
    entityId: student.id,
    before,
    after: { ...student },
    summary: `Updated student ${student.name}`,
  });
  res.json({ student });
});

// DELETE /api/students/:id  (Admin only)
// Removes the student and everything that hangs off them, so no orphaned
// attendance/marks/fee rows are left pointing at an id that no longer exists.
router.delete("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const id = req.params.id;
  const idx = db.students.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Student not found." });
  const student = db.students[idx];

  db.students.splice(idx, 1);
  db.users = db.users.filter((u) => !(u.role === "Student" && u.linkedId === id));
  db.enrollments = (db.enrollments || []).filter((e) => e.studentId !== id);
  db.documents = (db.documents || []).filter((d) => !(d.ownerType === "student" && d.ownerId === id));
  db.attendance = (db.attendance || []).filter((a) => a.studentId !== id);
  db.marks = (db.marks || []).filter((m) => m.studentId !== id);
  db.fees = (db.fees || []).filter((f) => f.studentId !== id);

  // Unlink, rather than delete, any parent account that pointed at them —
  // the parent may still have other children enrolled.
  db.users.forEach((u) => {
    if (u.role === "Parent" && Array.isArray(u.linkedIds)) {
      u.linkedIds = u.linkedIds.filter((x) => x !== id);
      u.linkedId = u.linkedIds[0] || null;
    }
  });

  save(db);
  audit(req, {
    action: "student.deleted",
    entityType: "student",
    entityId: id,
    before: student,
    summary: `Deleted student ${student.name} (${student.admissionNumber || id}) and their related records`,
  });
  res.json({ ok: true });
});

module.exports = router;
