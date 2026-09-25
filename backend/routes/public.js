const express = require("express");
const { load, save, nextId } = require("../db");

/**
 * Unauthenticated, read-only-plus-write-only public surface for the marketing
 * homepage. GET exposes only non-sensitive aggregate/directory data (no
 * student records, fees, marks, or attendance). POST accepts admissions
 * inquiries but never reads them back here — that happens only through the
 * authenticated Admin route in server.js (genericCrud on admissionInquiries).
 */
const router = express.Router();

router.get("/overview", (req, res) => {
  const db = load();

  const subjectName = (id) => db.subjects.find((s) => s.id === id)?.name || id;

  res.json({
    // Real, admin-editable record (see routes/collegeProfile.js). Fields the
    // Admin hasn't filled in yet come back as empty strings — the frontend
    // must treat those as "not provided" and omit, never invent a value.
    college: db.collegeProfile || { name: "St. Joseph College" },
    stats: {
      students: db.students.length,
      faculty: db.faculty.length,
      departments: db.departments.length,
      courses: db.courses.length,
    },
    departments: db.departments.map((d) => ({ id: d.id, name: d.name, code: d.code, hod: d.hod, vision: d.vision || "", mission: d.mission || "" })),
    courses: db.courses.map((c) => ({ id: c.id, name: c.name, department: c.department, duration: c.duration, semesters: c.semesters })),
    faculty: db.faculty.map((f) => ({ id: f.id, name: f.name, department: f.department, designation: f.designation, qualification: f.qualification, experience: f.experience, photoUrl: f.photoUrl || "" })),
    notices: db.notices
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6)
      .map((n) => ({ id: n.id, title: n.title, category: n.category, date: n.date, postedBy: n.postedBy })),
    exams: db.exams
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5)
      .map((e) => ({ id: e.id, type: e.type, subject: subjectName(e.subject), date: e.date })),
    sportsAchievements: (db.sportsAchievements || []).map((s) => ({ id: s.id, year: s.year, sport: s.sport, category: s.category, level: s.level })),
    academicMerit: (db.academicMerit || []).map((m) => ({ id: m.id, name: m.name, marks: m.marks, examLabel: m.examLabel, detail: m.detail })),
  });
});

// GET /public/faculty — real search (?q=) and department filter (?department=)
// for the public faculty directory. Public-safe fields only: no email/phone.
router.get("/faculty", (req, res) => {
  const db = load();
  const { q, department } = req.query;
  let list = db.faculty;
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((f) => f.name.toLowerCase().includes(s));
  }
  if (department) list = list.filter((f) => f.department === department);
  res.json({
    faculty: list.map((f) => ({ id: f.id, name: f.name, department: f.department, designation: f.designation, qualification: f.qualification, experience: f.experience, photoUrl: f.photoUrl || "" })),
  });
});

router.get("/faculty/:id", (req, res) => {
  const db = load();
  const f = db.faculty.find((x) => x.id === req.params.id);
  if (!f) return res.status(404).json({ error: "Faculty not found." });
  const dept = db.departments.find((d) => d.id === f.department);
  res.json({
    faculty: { id: f.id, name: f.name, department: f.department, departmentName: dept?.name || "", designation: f.designation, qualification: f.qualification, experience: f.experience, photoUrl: f.photoUrl || "" },
  });
});

router.get("/gallery", (req, res) => {
  const db = load();
  res.json({ gallery: db.galleryItems || [] });
});

router.get("/teams", (req, res) => {
  const db = load();
  const counts = db.teams.map((t) => ({
    ...t,
    memberCount: db.teamMembers.filter((m) => m.team === t.id).length,
  }));
  res.json({ teams: counts });
});

router.get("/teams/:id", (req, res) => {
  const db = load();
  const team = db.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found." });
  const members = db.teamMembers
    .filter((m) => m.team === team.id)
    .map((m) => {
      const dept = db.departments.find((d) => d.id === m.department);
      return { ...m, departmentName: dept ? dept.name : m.department };
    });
  res.json({ team, members });
});

/*
 * One team member, for the public hiring profile. Only the fields that are
 * meant to be seen are returned, and the department id is resolved to its
 * name so the page does not have to know the academic structure.
 */
router.get("/team-members/:id", (req, res) => {
  const db = load();
  const m = (db.teamMembers || []).find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: "Member not found." });
  const team = db.teams.find((t) => t.id === m.team) || null;
  const dept = db.departments.find((d) => d.id === m.department);
  res.json({
    member: {
      id: m.id, name: m.name, role: m.role, year: m.year, email: m.email,
      photoUrl: m.photoUrl, resumeUrl: m.resumeUrl, resumeName: m.resumeName,
      department: m.department, departmentName: dept ? dept.name : m.department,
    },
    team: team ? { id: team.id, name: team.name, description: team.description } : null,
  });
});

router.post("/admissions-inquiry", (req, res) => {
  const { name, email, phone, program, message } = req.body || {};
  if (!name || !email || !phone || !program) {
    return res.status(400).json({ error: "Name, email, phone and program are required." });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return res.status(400).json({ error: "Please enter a valid email address." });

  const db = load();
  if (!db.admissionInquiries) db.admissionInquiries = [];
  const id = nextId("INQ", "admissionInquiry");
  const inquiry = {
    id,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    program: String(program).trim(),
    message: message ? String(message).trim() : "",
    submittedAt: new Date().toISOString(),
    status: "New",
  };
  db.admissionInquiries.push(inquiry);
  save(db);
  res.status(201).json({ ok: true, id });
});

module.exports = router;
