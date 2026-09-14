/* =========================================================================
   notes.js — study notes, uploaded by faculty for one class/section/subject.

   A faculty member may upload only for a subject they are assigned to teach
   in that class and section. A student sees only notes that target their own
   class and section (or the whole class) — never another class's.
   ========================================================================= */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify, linkedChildIds } = require("../services");
const { canTouchSubjectInClass, currentYearId, rowCoversStudent } = require("../scope");

const router = express.Router();
router.use(verifyToken);

// Stored outside the statically served uploads directory; served only
// through GET /:id/file after an authorisation check.
const DIR = path.join(__dirname, "..", "private-uploads", "notes");
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
// Browsers can display these; Word documents are download-only.
const VIEWABLE = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR),
    filename: (req, file, cb) =>
      cb(null, `note-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    TYPES[path.extname(file.originalname).toLowerCase()]
      ? cb(null, true)
      : cb(new Error("Allowed file types: PDF, JPG, JPEG, PNG, DOC, DOCX.")),
});

/** A note reaches a student when it targets their class and section (or the
 *  whole class) and — if it names a course — their course. */
function noteCoversStudent(note, student) {
  if (!student) return false;
  if (note.courseId && student.course && note.courseId !== student.course) return false;
  return rowCoversStudent(note, student);
}

function canSee(note, user, db) {
  if (user.role === "Admin") return true;
  if (user.role === "Faculty") {
    if (note.uploadedBy && note.uploadedBy === user.linkedId) return true;
    return canTouchSubjectInClass(user, note.subjectId, note.classId, note.sectionId, db);
  }
  const ids =
    user.role === "Student" ? [user.linkedId]
    : user.role === "Parent" ? linkedChildIds(user, db)
    : [];
  return ids.some((id) => noteCoversStudent(note, db.students.find((s) => s.id === id)));
}

function expand(note, db) {
  const by = (coll, id) => (db[coll] || []).find((x) => x.id === id) || {};
  const ext = path.extname(note.originalName || note.storedName || "").toLowerCase();
  const viewable = VIEWABLE.has(ext);
  return {
    id: note.id,
    title: note.title,
    description: note.description,
    academicYearId: note.academicYearId,
    courseId: note.courseId,
    classId: note.classId,
    sectionId: note.sectionId,
    subjectId: note.subjectId,
    semester: note.semester,
    className: by("classes", note.classId).name || "",
    sectionName: by("sections", note.sectionId).name || "",
    subjectName: by("subjects", note.subjectId).name || "",
    courseName: by("courses", note.courseId).name || "",
    facultyName: note.uploadedByName || by("faculty", note.uploadedBy).name || "",
    fileType: ext.replace(".", "").toUpperCase(),
    originalName: note.originalName,
    viewable,
    uploadedAt: note.uploadedAt,
    downloadUrl: `/api/notes/${note.id}/file`,
    viewUrl: viewable ? `/api/notes/${note.id}/file?inline=1` : null,
  };
}

// POST /api/notes/upload (Faculty, Admin) — store the file, return a handle.
router.post("/upload", requireRole("Faculty", "Admin"), (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    res.status(201).json({ storedName: req.file.filename, originalName: req.file.originalname });
  });
});

// POST /api/notes (Faculty, Admin) — register the note against its class.
router.post("/", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  for (const f of ["classId", "subjectId", "title", "storedName"]) {
    if (!b[f] || !String(b[f]).trim()) return res.status(400).json({ error: `Field '${f}' is required.` });
  }
  if (!db.classes.some((c) => c.id === b.classId)) return res.status(404).json({ error: "That class does not exist." });
  if (b.sectionId && !db.sections.some((s) => s.id === b.sectionId)) {
    return res.status(404).json({ error: "That section does not exist." });
  }
  if (!db.subjects.some((s) => s.id === b.subjectId)) {
    return res.status(404).json({ error: "That subject does not exist." });
  }
  if (!canTouchSubjectInClass(req.user, b.subjectId, b.classId, b.sectionId || "", db)) {
    return res.status(403).json({ error: "You are not assigned to teach this subject for that class." });
  }
  if (/[\\/]/.test(b.storedName) || !fs.existsSync(path.join(DIR, b.storedName))) {
    return res.status(400).json({ error: "The uploaded file could not be found. Please upload it again." });
  }

  const fac = req.user.role === "Faculty" ? db.faculty.find((f) => f.id === req.user.linkedId) : null;
  db.seq.note = (db.seq.note || 0) + 1;
  const note = {
    id: `NT${String(db.seq.note).padStart(4, "0")}`,
    academicYearId: b.academicYearId || currentYearId(db),
    courseId: b.courseId || "",
    classId: b.classId,
    sectionId: b.sectionId || "",
    subjectId: b.subjectId,
    semester: b.semester || "",
    department: b.department || "",
    title: String(b.title).trim(),
    description: b.description || "",
    storedName: b.storedName,
    originalName: b.originalName || b.storedName,
    uploadedBy: req.user.role === "Faculty" ? req.user.linkedId : null,
    uploadedByUserId: req.user.id,
    uploadedByName: fac ? fac.name : req.user.name || "College Office",
    uploadedAt: new Date().toISOString(),
  };
  db.notes.push(note);
  save(db);

  const e = expand(note, db);
  audit(req, {
    action: "note.uploaded",
    entityType: "note",
    entityId: note.id,
    summary: `Uploaded "${note.title}" for ${e.subjectName} — ${e.className}${e.sectionName ? ` ${e.sectionName}` : ""}`,
  });

  const studentIds = db.students.filter((s) => noteCoversStudent(note, s)).map((s) => s.id);
  const recipients = db.users.filter((u) => u.role === "Student" && studentIds.includes(u.linkedId));
  recipients.forEach((u) =>
    notify(u.id, {
      title: "New notes uploaded",
      message: `${e.subjectName}: ${note.title}`,
      type: "note",
      relatedType: "note",
      relatedId: note.id,
    })
  );

  res.status(201).json({ note: e, notified: recipients.length });
});

// GET /api/notes?subjectId=&classId=
router.get("/", (req, res) => {
  const db = load();
  let rows = db.notes.filter((n) => canSee(n, req.user, db));
  if (req.query.subjectId) rows = rows.filter((n) => n.subjectId === req.query.subjectId);
  if (req.query.classId) rows = rows.filter((n) => n.classId === req.query.classId);
  rows.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  res.json({ notes: rows.map((n) => expand(n, db)) });
});

// GET /api/notes/:id/file[?inline=1] — authorised view/download.
router.get("/:id/file", (req, res) => {
  const db = load();
  const note = db.notes.find((n) => n.id === req.params.id);
  if (!note || !canSee(note, req.user, db)) return res.status(404).json({ error: "Note not found." });

  const file = path.join(DIR, note.storedName || "");
  if (!note.storedName || !file.startsWith(DIR) || !fs.existsSync(file)) {
    return res.status(404).json({ error: "The stored file is missing." });
  }
  const ext = path.extname(note.storedName).toLowerCase();
  // Strip characters that could break out of the header value.
  const safeName = String(note.originalName || note.storedName).replace(/["\r\n]/g, "");
  const inline = req.query.inline === "1" && VIEWABLE.has(ext);
  res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"`);
  fs.createReadStream(file).pipe(res);
});

// DELETE /api/notes/:id — the uploader, or an Admin.
router.delete("/:id", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const i = db.notes.findIndex((n) => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Note not found." });
  const note = db.notes[i];
  if (req.user.role === "Faculty" && note.uploadedBy !== req.user.linkedId) {
    return res.status(403).json({ error: "You can only delete notes you uploaded." });
  }
  db.notes.splice(i, 1);
  save(db);

  const file = path.join(DIR, note.storedName || "");
  if (note.storedName && file.startsWith(DIR) && fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      console.error("note file delete failed:", e.message);
    }
  }
  audit(req, {
    action: "note.deleted",
    entityType: "note",
    entityId: note.id,
    before: { title: note.title, subjectId: note.subjectId, classId: note.classId },
    summary: `Deleted note "${note.title}"`,
  });
  res.json({ ok: true });
});

module.exports = router;
