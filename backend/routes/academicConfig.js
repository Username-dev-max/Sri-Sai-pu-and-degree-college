/* =========================================================================
   academicConfig.js — the academic structure the enrollment form cascades
   through: level -> stream -> combination -> class -> section.

   The frontend renders whatever this returns. Nothing about which
   combinations exist, or which subjects they carry, is hard-coded in the UI.
   ========================================================================= */
const express = require("express");
const { load } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit } = require("../services");
const repo = require("../repo");

const router = express.Router();
router.use(verifyToken);

// GET /api/academic-config
// ?all=1 (Admin only) also returns combinations the college has switched off,
// so they can be managed; everyone else only ever sees active ones.
router.get("/", (req, res) => {
  const db = load();
  const includeInactive = req.query.all === "1" && req.user.role === "Admin";
  const subjectById = new Map((db.subjects || []).map((s) => [s.id, s]));

  const combinations = (db.courses || [])
    .filter((c) => includeInactive || c.active !== false)
    .map((c) => ({
      id: c.id,
      name: c.name,
      fullName: c.fullName || "",
      levelId: c.levelId || "",
      stream: c.stream || "",
      department: c.department || "",
      duration: c.duration || "",
      semesters: c.semesters || 0,
      active: c.active !== false,
      subjects: (c.subjects || []).map((id) => {
        const s = subjectById.get(id);
        return s ? { id: s.id, name: s.name, code: s.code } : { id, name: id, code: "" };
      }),
    }));

  res.json({
    levels: (db.courseLevels || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    streams: (db.streams || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    classes: (db.classes || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    sections: db.sections || [],
    academicYears: (db.academicYears || []).slice().sort((a, b) => String(b.label).localeCompare(String(a.label))),
    combinations,
    subjects: db.subjects || [],
    departments: (db.departments || []).map((d) => ({ id: d.id, name: d.name, code: d.code })),
  });
});

// PATCH /api/academic-config/combinations/:id  (Admin) — switch a combination
// on or off for this college without deleting it and losing its history.
router.patch("/combinations/:id", requireRole("Admin"), (req, res) => {
  const course = repo.findById("courses", req.params.id);
  if (!course) return res.status(404).json({ error: "Combination not found." });
  if (typeof req.body?.active !== "boolean") {
    return res.status(400).json({ error: "`active` must be true or false." });
  }

  // Refuse to switch off something students are currently enrolled in —
  // that would silently orphan their records.
  if (req.body.active === false) {
    const db = load();
    const inUse = (db.students || []).filter((s) => s.course === course.id).length;
    if (inUse > 0) {
      return res.status(409).json({
        error: `${inUse} student(s) are enrolled in ${course.name}. Move them before switching it off.`,
      });
    }
  }

  const before = course.active !== false;
  repo.update("courses", course.id, { active: req.body.active });
  audit(req, {
    action: "combination.toggled",
    entityType: "course",
    entityId: course.id,
    before: { active: before },
    after: { active: req.body.active },
    summary: `${req.body.active ? "Enabled" : "Disabled"} combination ${course.name}`,
  });
  res.json({ combination: repo.findById("courses", course.id) });
});

// PUT /api/academic-config/combinations/:id/subjects  (Admin)
router.put("/combinations/:id/subjects", requireRole("Admin"), (req, res) => {
  const course = repo.findById("courses", req.params.id);
  if (!course) return res.status(404).json({ error: "Combination not found." });
  const ids = Array.isArray(req.body?.subjects) ? req.body.subjects : null;
  if (!ids) return res.status(400).json({ error: "`subjects` must be an array of subject ids." });

  const db = load();
  const unknown = ids.filter((id) => !db.subjects.some((s) => s.id === id));
  if (unknown.length) return res.status(404).json({ error: `Unknown subject(s): ${unknown.join(", ")}` });

  const before = [...(course.subjects || [])];
  repo.update("courses", course.id, { subjects: ids });
  audit(req, {
    action: "combination.subjects_updated",
    entityType: "course",
    entityId: course.id,
    before: { subjects: before },
    after: { subjects: ids },
    summary: `Updated subjects for ${course.name}`,
  });
  res.json({ combination: repo.findById("courses", course.id) });
});

// POST /api/academic-config/academic-years/:id/current  (Admin)
router.post("/academic-years/:id/current", requireRole("Admin"), (req, res) => {
  const db = load();
  const year = (db.academicYears || []).find((y) => y.id === req.params.id);
  if (!year) return res.status(404).json({ error: "Academic year not found." });
  db.academicYears.forEach((y) => {
    y.isCurrent = y.id === year.id;
  });
  repo.commit();
  audit(req, {
    action: "academic_year.set_current",
    entityType: "academicYear",
    entityId: year.id,
    summary: `Set ${year.label} as the current academic year`,
  });
  res.json({ academicYears: db.academicYears });
});

module.exports = router;
