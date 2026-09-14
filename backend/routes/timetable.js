/* =========================================================================
   timetable.js — timetable entries plus published official timetables.

   Two things live here:
     1. Individual period rows (day/period/subject/faculty/room/times),
        scoped to an academic year + class + section.
     2. Published timetable documents (the official PDF), which students,
        parents and faculty may download once an Admin publishes them.

   Draft entries are Admin-only. Nothing reaches a student until the
   timetable for their class is published.
   ========================================================================= */
const express = require("express");
const repo = require("../repo");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify, linkedChildIds } = require("../services");

const router = express.Router();
router.use(verifyToken);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Every class id the caller is entitled to see a timetable for. */
function visibleClassIds(user, db) {
  if (user.role === "Admin" || user.role === "Attendance Staff") return null; // no restriction
  if (user.role === "Faculty") {
    const own = (db.facultyAssignments || []).filter((a) => a.facultyId === user.linkedId);
    return [...new Set(own.map((a) => a.classId).filter(Boolean))];
  }
  const studentIds =
    user.role === "Student" ? [user.linkedId] : user.role === "Parent" ? linkedChildIds(user, db) : [];
  return [
    ...new Set(
      studentIds
        .map((id) => (db.students || []).find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => s.classId)
        .filter(Boolean)
    ),
  ];
}

/** Is this class's timetable published for the current academic year? */
function isPublished(db, classId, sectionId, academicYearId) {
  return (db.timetablePublications || []).some(
    (p) =>
      p.classId === classId &&
      (p.sectionId || "") === (sectionId || "") &&
      (!academicYearId || p.academicYearId === academicYearId) &&
      p.published
  );
}

function expand(row, db) {
  const by = (coll, id) => (db[coll] || []).find((x) => x.id === id) || {};
  return {
    ...row,
    subjectName: by("subjects", row.subject).name || row.subject || "",
    facultyName: by("faculty", row.faculty).name || "",
    className: by("classes", row.classId).name || "",
    sectionName: by("sections", row.sectionId).name || "",
    academicYearLabel: by("academicYears", row.academicYearId).label || "",
  };
}

/* ------------------------------- entries -------------------------------- */

// GET /api/timetable — Admin sees everything; everyone else sees only the
// PUBLISHED timetable for classes they belong to or teach.
router.get("/", (req, res) => {
  const db = load();
  let list = repo.findAll("timetable");

  const { classId, sectionId, academicYearId, facultyId } = req.query;
  if (classId) list = list.filter((r) => r.classId === classId);
  if (sectionId) list = list.filter((r) => (r.sectionId || "") === sectionId);
  if (academicYearId) list = list.filter((r) => r.academicYearId === academicYearId);
  if (facultyId) list = list.filter((r) => r.faculty === facultyId);

  if (req.user.role !== "Admin") {
    const allowed = visibleClassIds(req.user, db);
    if (allowed !== null) {
      list = list.filter((r) => allowed.includes(r.classId));
      // A draft timetable must not leak before it is published.
      list = list.filter((r) => isPublished(db, r.classId, r.sectionId, r.academicYearId));
    }
    // A Faculty member also sees every period they personally teach, even in
    // a class they are not otherwise attached to.
    if (req.user.role === "Faculty") {
      const own = repo
        .findAll("timetable")
        .filter((r) => r.faculty === req.user.linkedId)
        .filter((r) => isPublished(db, r.classId, r.sectionId, r.academicYearId));
      const seen = new Set(list.map((r) => r.id));
      own.forEach((r) => {
        if (!seen.has(r.id)) list.push(r);
      });
    }
  }

  const order = (r) => DAYS.indexOf(r.day) * 100 + (Number(r.period) || 0);
  list.sort((a, b) => order(a) - order(b));
  res.json({ timetable: list.map((r) => expand(r, db)) });
});

// POST /api/timetable  (Admin)
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  for (const f of ["day", "subject", "classId"]) {
    if (!b[f]) return res.status(400).json({ error: `Field '${f}' is required.` });
  }
  if (!DAYS.includes(b.day)) return res.status(400).json({ error: `Day must be one of: ${DAYS.join(", ")}` });
  if (!db.subjects.some((s) => s.id === b.subject)) return res.status(404).json({ error: "That subject does not exist." });
  if (!db.classes.some((c) => c.id === b.classId)) return res.status(404).json({ error: "That class does not exist." });
  if (b.faculty && !db.faculty.some((f) => f.id === b.faculty)) {
    return res.status(404).json({ error: "That faculty member does not exist." });
  }
  if (b.startTime && b.endTime && b.startTime >= b.endTime) {
    return res.status(400).json({ error: "The end time must be after the start time." });
  }

  const academicYearId = b.academicYearId || (db.academicYears.find((y) => y.isCurrent) || {}).id || "";

  // Two lessons cannot occupy the same class at the same time.
  const clash = db.timetable.find(
    (r) =>
      r.classId === b.classId &&
      (r.sectionId || "") === (b.sectionId || "") &&
      r.academicYearId === academicYearId &&
      r.day === b.day &&
      String(r.period) === String(b.period)
  );
  if (clash) {
    return res.status(409).json({ error: `That class already has a lesson in period ${b.period} on ${b.day}.` });
  }

  // Nor can one teacher be in two rooms at once.
  if (b.faculty) {
    const busy = db.timetable.find(
      (r) =>
        r.faculty === b.faculty &&
        r.academicYearId === academicYearId &&
        r.day === b.day &&
        String(r.period) === String(b.period) &&
        !(r.classId === b.classId && (r.sectionId || "") === (b.sectionId || ""))
    );
    if (busy) {
      const name = (db.faculty.find((f) => f.id === b.faculty) || {}).name || b.faculty;
      return res.status(409).json({ error: `${name} is already teaching another class in period ${b.period} on ${b.day}.` });
    }
  }

  const row = {
    id: repo.nextId("timetable", "TT", "timetable"),
    academicYearId,
    classId: b.classId,
    sectionId: b.sectionId || "",
    day: b.day,
    period: Number(b.period) || 1,
    subject: b.subject,
    faculty: b.faculty || "",
    room: b.room || "",
    startTime: b.startTime || "",
    endTime: b.endTime || "",
    // Kept for the legacy grid, which renders a single "time" column.
    time: b.startTime && b.endTime ? `${b.startTime} - ${b.endTime}` : b.time || "",
  };
  db.timetable.push(row);
  save(db);

  const e = expand(row, db);
  audit(req, {
    action: "timetable.entry_added",
    entityType: "timetable",
    entityId: row.id,
    after: row,
    summary: `Added ${e.subjectName} to ${e.className}${e.sectionName ? ` ${e.sectionName}` : ""} — ${row.day} period ${row.period}`,
  });
  res.status(201).json({ entry: e });
});

// PUT /api/timetable/:id  (Admin)
router.put("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const row = db.timetable.find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: "Entry not found." });
  const before = { ...row };

  ["day", "period", "subject", "faculty", "room", "startTime", "endTime", "classId", "sectionId", "academicYearId"].forEach((f) => {
    if (req.body[f] !== undefined) row[f] = f === "period" ? Number(req.body[f]) : req.body[f];
  });
  if (row.startTime && row.endTime) row.time = `${row.startTime} - ${row.endTime}`;
  save(db);

  audit(req, {
    action: "timetable.entry_updated",
    entityType: "timetable",
    entityId: row.id,
    before,
    after: { ...row },
    summary: `Updated timetable entry ${row.id}`,
  });
  res.json({ entry: expand(row, db) });
});

// DELETE /api/timetable/:id  (Admin)
router.delete("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const i = db.timetable.findIndex((r) => r.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Entry not found." });
  const row = db.timetable[i];
  db.timetable.splice(i, 1);
  save(db);
  audit(req, {
    action: "timetable.entry_deleted",
    entityType: "timetable",
    entityId: row.id,
    before: row,
    summary: `Deleted timetable entry ${row.id}`,
  });
  res.json({ ok: true });
});

/* ----------------------------- publications ------------------------------ */

// GET /api/timetable/publications
router.get("/publications", (req, res) => {
  const db = load();
  let list = repo.findAll("timetablePublications");
  if (req.user.role !== "Admin") {
    const allowed = visibleClassIds(req.user, db);
    if (allowed !== null) list = list.filter((p) => allowed.includes(p.classId));
    list = list.filter((p) => p.published);
  }
  res.json({
    publications: list.map((p) => ({
      ...p,
      className: (db.classes.find((c) => c.id === p.classId) || {}).name || "",
      sectionName: (db.sections.find((s) => s.id === p.sectionId) || {}).name || "",
      academicYearLabel: (db.academicYears.find((y) => y.id === p.academicYearId) || {}).label || "",
      downloadUrl: p.documentId ? `/api/documents/${p.documentId}/file` : null,
    })),
  });
});

// POST /api/timetable/publish  (Admin) — publish a class's timetable, with an
// optional official PDF, and notify everyone it affects.
router.post("/publish", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.classId) return res.status(400).json({ error: "A class is required." });
  if (!db.classes.some((c) => c.id === b.classId)) return res.status(404).json({ error: "That class does not exist." });

  const academicYearId = b.academicYearId || (db.academicYears.find((y) => y.isCurrent) || {}).id || "";
  const sectionId = b.sectionId || "";

  // An uploaded PDF becomes a document row readable by the affected roles.
  let documentId = null;
  if (b.storedName) {
    const doc = {
      id: repo.nextId("documents", "DOC", "document"),
      ownerType: "college",
      ownerId: b.classId,
      type: "Timetable",
      name: b.fileName || "Timetable.pdf",
      storedName: b.storedName,
      private: true,
      audience: "all", // any authenticated user who can see this class
      uploadedBy: req.user.id,
      uploadedAt: new Date().toISOString(),
    };
    db.documents.push(doc);
    documentId = doc.id;
  }

  let pub = db.timetablePublications.find(
    (p) => p.classId === b.classId && (p.sectionId || "") === sectionId && p.academicYearId === academicYearId
  );
  if (pub) {
    pub.published = true;
    pub.publishedAt = new Date().toISOString();
    pub.publishedBy = req.user.id;
    if (documentId) pub.documentId = documentId;
  } else {
    pub = {
      id: repo.nextId("timetablePublications", "TTP", "timetable"),
      classId: b.classId,
      sectionId,
      academicYearId,
      documentId,
      published: true,
      publishedAt: new Date().toISOString(),
      publishedBy: req.user.id,
    };
    db.timetablePublications.push(pub);
  }
  save(db);

  const className = (db.classes.find((c) => c.id === b.classId) || {}).name || b.classId;

  // Notify the students in that class, their parents, and the faculty teaching it.
  const studentIds = db.students.filter((s) => s.classId === b.classId).map((s) => s.id);
  const facultyIds = [
    ...new Set(db.timetable.filter((r) => r.classId === b.classId).map((r) => r.faculty).filter(Boolean)),
  ];
  const targets = db.users.filter(
    (u) =>
      (u.role === "Student" && studentIds.includes(u.linkedId)) ||
      (u.role === "Parent" && (u.linkedIds || [u.linkedId]).some((id) => studentIds.includes(id))) ||
      (u.role === "Faculty" && facultyIds.includes(u.linkedId))
  );
  targets.forEach((u) =>
    notify(u.id, {
      title: "Timetable published",
      message: `The timetable for ${className} is now available.`,
      type: "info",
      relatedType: "timetable",
      relatedId: pub.id,
    })
  );

  audit(req, {
    action: "timetable.published",
    entityType: "timetable",
    entityId: pub.id,
    summary: `Published the ${className} timetable to ${targets.length} recipient(s)${documentId ? " with an official PDF" : ""}`,
  });

  res.status(201).json({ publication: pub, notified: targets.length });
});

// POST /api/timetable/unpublish  (Admin)
router.post("/unpublish", requireRole("Admin"), (req, res) => {
  const db = load();
  const pub = db.timetablePublications.find((p) => p.id === req.body?.id);
  if (!pub) return res.status(404).json({ error: "Publication not found." });
  pub.published = false;
  save(db);
  audit(req, {
    action: "timetable.unpublished",
    entityType: "timetable",
    entityId: pub.id,
    summary: `Withdrew the published timetable ${pub.id}`,
  });
  res.json({ ok: true });
});

module.exports = router;
