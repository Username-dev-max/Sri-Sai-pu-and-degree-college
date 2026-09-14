/* =========================================================================
   facultyAssignments.js — which faculty teaches which subject, to which
   class, in which academic year.

   This is what scope.js reads to decide whether a Faculty member may mark
   attendance or enter marks, so it replaces the bare genericCrud mount:
   these rows need real validation and an audit trail, not blind writes.
   ========================================================================= */
const express = require("express");
const repo = require("../repo");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify } = require("../services");

const router = express.Router();
router.use(verifyToken);

/** Keep faculty.subjects / faculty.classes in step with the assignment rows. */
function resync(db, facultyId) {
  const fac = db.faculty.find((f) => f.id === facultyId);
  if (!fac) return;
  const rows = db.facultyAssignments.filter((a) => a.facultyId === facultyId);
  fac.subjects = [...new Set(rows.map((a) => a.subjectId).filter(Boolean))];
  fac.classes = [...new Set(rows.map((a) => a.classId).filter(Boolean))];
}

function expand(a, db) {
  const by = (coll, id) => (db[coll] || []).find((x) => x.id === id) || {};
  return {
    ...a,
    facultyName: by("faculty", a.facultyId).name || "",
    subjectName: by("subjects", a.subjectId).name || "",
    className: by("classes", a.classId).name || "",
    sectionName: by("sections", a.sectionId).name || "",
    academicYearLabel: by("academicYears", a.academicYearId).label || "",
  };
}

// GET /api/faculty-assignments
// Admin sees everything; a Faculty member sees only their own assignments.
router.get("/", (req, res) => {
  const db = load();
  let list = repo.findAll("facultyAssignments");
  if (req.user.role === "Faculty") {
    list = list.filter((a) => a.facultyId === req.user.linkedId);
  } else if (req.user.role !== "Admin") {
    return res.status(403).json({ error: "Not authorized." });
  }
  if (req.query.facultyId && req.user.role === "Admin") {
    list = list.filter((a) => a.facultyId === req.query.facultyId);
  }
  res.json({ assignments: list.map((a) => expand(a, db)) });
});

// GET /api/faculty-assignments/my-subjects — what the signed-in Faculty
// member may actually teach. The Faculty UI builds its subject picker from
// this rather than from the full subject list.
router.get("/my-subjects", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  if (req.user.role === "Admin") {
    return res.json({ subjects: db.subjects, classes: db.classes, unrestricted: true });
  }
  const rows = db.facultyAssignments.filter((a) => a.facultyId === req.user.linkedId);
  const subjectIds = [...new Set(rows.map((a) => a.subjectId))];
  const classIds = [...new Set(rows.map((a) => a.classId).filter(Boolean))];
  res.json({
    subjects: db.subjects.filter((s) => subjectIds.includes(s.id)),
    classes: db.classes.filter((c) => classIds.includes(c.id)),
    unrestricted: false,
  });
});

// POST /api/faculty-assignments  (Admin)
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.facultyId || !b.subjectId) {
    return res.status(400).json({ error: "A faculty member and a subject are required." });
  }
  if (!db.faculty.some((f) => f.id === b.facultyId)) {
    return res.status(404).json({ error: "That faculty record does not exist." });
  }
  if (!db.subjects.some((s) => s.id === b.subjectId)) {
    return res.status(404).json({ error: "That subject does not exist." });
  }
  if (b.classId && !db.classes.some((c) => c.id === b.classId)) {
    return res.status(404).json({ error: "That class does not exist." });
  }

  const academicYearId = b.academicYearId || (db.academicYears.find((y) => y.isCurrent) || {}).id || "";

  // The same person teaching the same subject to the same class in the same
  // year is one assignment, not two.
  const duplicate = db.facultyAssignments.find(
    (a) =>
      a.facultyId === b.facultyId &&
      a.subjectId === b.subjectId &&
      (a.classId || "") === (b.classId || "") &&
      (a.sectionId || "") === (b.sectionId || "") &&
      a.academicYearId === academicYearId
  );
  if (duplicate) return res.status(409).json({ error: "This assignment already exists." });

  const row = {
    id: repo.nextId("facultyAssignments", "FA", "assignment"),
    facultyId: b.facultyId,
    subjectId: b.subjectId,
    classId: b.classId || "",
    sectionId: b.sectionId || "",
    academicYearId,
    assignedBy: req.user.id,
    assignedAt: new Date().toISOString(),
  };
  db.facultyAssignments.push(row);
  resync(db, b.facultyId);
  save(db);

  const expanded = expand(row, db);
  audit(req, {
    action: "faculty.assigned",
    entityType: "facultyAssignment",
    entityId: row.id,
    after: row,
    summary: `Assigned ${expanded.subjectName}${expanded.className ? ` (${expanded.className})` : ""} to ${expanded.facultyName}`,
  });

  const account = db.users.find((u) => u.role === "Faculty" && u.linkedId === b.facultyId);
  if (account) {
    notify(account.id, {
      title: "New teaching assignment",
      message: `You have been assigned ${expanded.subjectName}${expanded.className ? ` for ${expanded.className}` : ""}.`,
      type: "info",
    });
  }

  res.status(201).json({ assignment: expanded });
});

// DELETE /api/faculty-assignments/:id  (Admin)
router.delete("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const idx = db.facultyAssignments.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Assignment not found." });
  const row = db.facultyAssignments[idx];
  const expanded = expand(row, db);

  db.facultyAssignments.splice(idx, 1);
  resync(db, row.facultyId);
  save(db);

  audit(req, {
    action: "faculty.unassigned",
    entityType: "facultyAssignment",
    entityId: row.id,
    before: row,
    summary: `Removed ${expanded.subjectName} from ${expanded.facultyName}`,
  });
  res.json({ ok: true });
});

module.exports = router;
