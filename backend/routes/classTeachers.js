/* =========================================================================
   classTeachers.js — one class teacher per academic year + class + section.

   Being a class teacher widens a faculty member's reach over THAT class only
   (see scope.js). Assignments are Admin-managed and scoped to a year, so next
   year's arrangement never inherits this year's by accident.
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify } = require("../services");
const { currentYearId, studentsInClass } = require("../scope");

const router = express.Router();
router.use(verifyToken);

function expand(row, db) {
  const by = (coll, id) => (db[coll] || []).find((x) => x.id === id) || {};
  return {
    ...row,
    facultyName: by("faculty", row.facultyId).name || "",
    className: by("classes", row.classId).name || "",
    sectionName: by("sections", row.sectionId).name || "",
    courseName: by("courses", row.courseId).name || "",
    academicYearLabel: by("academicYears", row.academicYearId).label || "",
    studentCount: studentsInClass(db, row.classId, row.sectionId).length,
  };
}

function facultyAccount(db, facultyId) {
  return db.users.find((u) => u.role === "Faculty" && u.linkedId === facultyId);
}

function describe(e) {
  return `${e.courseName ? `${e.courseName} ` : ""}${e.className}${e.sectionName ? ` (${e.sectionName})` : ""}`;
}

// GET /api/class-teachers — Admin: all. Faculty: only the classes they lead.
router.get("/", requireRole("Admin", "Faculty"), (req, res) => {
  const db = load();
  let rows = db.classTeachers || [];
  if (req.user.role === "Faculty") rows = rows.filter((t) => t.facultyId === req.user.linkedId);
  if (req.query.academicYearId) rows = rows.filter((t) => t.academicYearId === req.query.academicYearId);
  res.json({ classTeachers: rows.map((r) => expand(r, db)) });
});

// POST /api/class-teachers (Admin)
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.classId || !b.facultyId) {
    return res.status(400).json({ error: "A class and a faculty member are required." });
  }
  if (!db.classes.some((c) => c.id === b.classId)) return res.status(404).json({ error: "That class does not exist." });
  if (b.sectionId && !db.sections.some((s) => s.id === b.sectionId)) {
    return res.status(404).json({ error: "That section does not exist." });
  }
  if (!db.faculty.some((f) => f.id === b.facultyId)) {
    return res.status(404).json({ error: "That faculty member does not exist." });
  }
  if (b.courseId && !db.courses.some((c) => c.id === b.courseId)) {
    return res.status(404).json({ error: "That course does not exist." });
  }

  const academicYearId = b.academicYearId || currentYearId(db);
  const sectionId = b.sectionId || "";
  const clash = db.classTeachers.find(
    (t) => t.classId === b.classId && (t.sectionId || "") === sectionId && t.academicYearId === academicYearId
  );
  if (clash) {
    const who = (db.faculty.find((f) => f.id === clash.facultyId) || {}).name || clash.facultyId;
    return res.status(409).json({
      error: `This class already has a class teacher (${who}). Change or remove that assignment first.`,
    });
  }

  db.seq.classTeacher = (db.seq.classTeacher || 0) + 1;
  const row = {
    id: `CT${String(db.seq.classTeacher).padStart(4, "0")}`,
    academicYearId,
    courseId: b.courseId || "",
    classId: b.classId,
    sectionId,
    facultyId: b.facultyId,
    label: b.label || "",
    assignedBy: req.user.id,
    assignedAt: new Date().toISOString(),
  };
  db.classTeachers.push(row);
  save(db);

  const e = expand(row, db);
  audit(req, {
    action: "classTeacher.assigned",
    entityType: "classTeacher",
    entityId: row.id,
    after: row,
    summary: `Assigned ${e.facultyName} as class teacher of ${describe(e)}`,
  });
  const acct = facultyAccount(db, b.facultyId);
  if (acct) {
    notify(acct.id, {
      title: "Class teacher assignment",
      message: `You are now class teacher of ${describe(e)}.`,
      type: "info",
      relatedType: "classTeacher",
      relatedId: row.id,
    });
  }
  res.status(201).json({ classTeacher: e });
});

// PUT /api/class-teachers/:id (Admin) — reassign to another faculty member.
router.put("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const row = db.classTeachers.find((t) => t.id === req.params.id);
  if (!row) return res.status(404).json({ error: "Class teacher assignment not found." });
  const before = { ...row };

  if (req.body.facultyId !== undefined) {
    if (!db.faculty.some((f) => f.id === req.body.facultyId)) {
      return res.status(404).json({ error: "That faculty member does not exist." });
    }
    row.facultyId = req.body.facultyId;
  }
  if (req.body.label !== undefined) row.label = req.body.label;
  save(db);

  const e = expand(row, db);
  audit(req, {
    action: "classTeacher.updated",
    entityType: "classTeacher",
    entityId: row.id,
    before,
    after: { ...row },
    summary: `Updated the class teacher of ${describe(e)}`,
  });
  if (before.facultyId !== row.facultyId) {
    const acct = facultyAccount(db, row.facultyId);
    if (acct) {
      notify(acct.id, {
        title: "Class teacher assignment",
        message: `You are now class teacher of ${describe(e)}.`,
        type: "info",
        relatedType: "classTeacher",
        relatedId: row.id,
      });
    }
  }
  res.json({ classTeacher: e });
});

// DELETE /api/class-teachers/:id (Admin)
router.delete("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const i = db.classTeachers.findIndex((t) => t.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Class teacher assignment not found." });
  const row = db.classTeachers[i];
  const e = expand(row, db);
  db.classTeachers.splice(i, 1);
  save(db);
  audit(req, {
    action: "classTeacher.removed",
    entityType: "classTeacher",
    entityId: row.id,
    before: row,
    summary: `Removed ${e.facultyName} as class teacher of ${describe(e)}`,
  });
  res.json({ ok: true });
});

module.exports = router;
