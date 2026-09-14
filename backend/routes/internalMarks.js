/* =========================================================================
   internalMarks.js — internal assessment marks.

   One row per student, subject and exam. Faculty enter marks only for a
   subject they teach in that class and section; a student reads only their
   own; the class teacher reads the whole class and gets totals and ranks.
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify } = require("../services");
const {
  canTouchSubjectInClass,
  canViewStudent,
  studentsInClass,
  isClassTeacherFor,
  currentYearId,
} = require("../scope");
const { renderPdf, renderDocx } = require("../exporters/classResult");

const router = express.Router();
router.use(verifyToken);

// The same 40% the existing results module treats as a pass, so the two
// modules never disagree about who needs attention.
const PASS_PERCENT = 40;
const round1 = (n) => Math.round(n * 10) / 10;

/** Standard competition ranking: equal percentages share a rank and the next
 *  rank skips accordingly — 1, 2, 2, 4. */
function rankRows(rows) {
  const sorted = rows
    .slice()
    .sort((a, b) => b.percentage - a.percentage || a.studentName.localeCompare(b.studentName));
  let prevPct = null;
  let prevRank = 0;
  return sorted.map((r, i) => {
    const rank = r.percentage === prevPct ? prevRank : i + 1;
    prevPct = r.percentage;
    prevRank = rank;
    return { ...r, rank };
  });
}

const subjectName = (db, id) => (db.subjects.find((s) => s.id === id) || {}).name || id;
const blank = (v) => v === null || v === undefined || v === "";

// GET /api/internal-marks/exams — exam labels already in use, for pickers.
router.get("/exams", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  res.json({ exams: [...new Set(db.internalMarks.map((m) => m.exam))].filter(Boolean).sort() });
});

// GET /api/internal-marks/roster?classId=&sectionId=&subjectId=&exam=
router.get("/roster", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const { classId, sectionId = "", subjectId, exam = "" } = req.query;
  if (!classId || !subjectId) return res.status(400).json({ error: "classId and subjectId are required." });
  if (!canTouchSubjectInClass(req.user, subjectId, classId, sectionId, db)) {
    return res.status(403).json({ error: "You are not assigned to teach this subject for that class." });
  }
  const existing = db.internalMarks.filter((m) => m.subjectId === subjectId && m.exam === exam);
  res.json({
    students: studentsInClass(db, classId, sectionId).map((s) => {
      const m = existing.find((x) => x.studentId === s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        admissionNumber: s.admissionNumber || "",
        rollNumber: s.rollNumber || "",
        section: s.section || "",
        obtained: m ? m.obtained : null,
        maxMarks: m ? m.maxMarks : null,
        remarks: m ? m.remarks : "",
        markId: m ? m.id : null,
      };
    }),
  });
});

// POST /api/internal-marks/bulk (Faculty, Admin)
router.post("/bulk", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  const sectionId = b.sectionId || "";
  const exam = String(b.exam || "").trim();
  if (!b.classId || !b.subjectId || !exam) {
    return res.status(400).json({ error: "Class, subject and exam are required." });
  }
  const maxMarks = Number(b.maxMarks);
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    return res.status(400).json({ error: "Maximum marks must be a positive number." });
  }
  if (!Array.isArray(b.entries) || b.entries.length === 0) {
    return res.status(400).json({ error: "Enter marks for at least one student." });
  }
  if (!canTouchSubjectInClass(req.user, b.subjectId, b.classId, sectionId, db)) {
    return res.status(403).json({ error: "You are not assigned to teach this subject for that class." });
  }

  // Validate every row BEFORE writing any, so one bad entry can never leave a
  // class half-saved.
  const roster = new Set(studentsInClass(db, b.classId, sectionId).map((s) => s.id));
  const problems = [];
  b.entries.forEach((e, i) => {
    if (!roster.has(e.studentId)) problems.push(`Row ${i + 1}: that student is not in this class or section.`);
    if (blank(e.obtained)) return; // left blank = not entered yet
    const v = Number(e.obtained);
    if (!Number.isFinite(v) || v < 0 || v > maxMarks) {
      problems.push(`Row ${i + 1}: marks must be between 0 and ${maxMarks}.`);
    }
  });
  if (problems.length) return res.status(400).json({ error: problems[0], problems });

  const now = new Date().toISOString();
  const touched = [];
  b.entries.forEach((e) => {
    if (blank(e.obtained)) return;
    const obtained = Number(e.obtained);
    const remarks = String(e.remarks || "");
    const row = db.internalMarks.find(
      (m) => m.studentId === e.studentId && m.subjectId === b.subjectId && m.exam === exam
    );
    if (row) {
      if (row.obtained === obtained && row.maxMarks === maxMarks && (row.remarks || "") === remarks) return;
      // Keep what the mark was before, so a correction never erases history.
      row.history = row.history || [];
      row.history.push({
        obtained: row.obtained,
        maxMarks: row.maxMarks,
        remarks: row.remarks,
        changedBy: row.updatedBy || row.enteredBy,
        changedAt: row.updatedAt || row.enteredAt,
      });
      Object.assign(row, { obtained, maxMarks, remarks, updatedBy: req.user.id, updatedByName: req.user.name || "", updatedAt: now });
      touched.push({ row, kind: "updated" });
    } else {
      db.seq.internalMark = (db.seq.internalMark || 0) + 1;
      const created = {
        id: `IM${String(db.seq.internalMark).padStart(5, "0")}`,
        academicYearId: b.academicYearId || currentYearId(db),
        courseId: b.courseId || "",
        classId: b.classId,
        sectionId,
        subjectId: b.subjectId,
        exam,
        studentId: e.studentId,
        maxMarks,
        obtained,
        remarks,
        enteredBy: req.user.id,
        enteredByName: req.user.name || "",
        enteredAt: now,
        updatedBy: null,
        updatedAt: null,
        history: [],
      };
      db.internalMarks.push(created);
      touched.push({ row: created, kind: "entered" });
    }
  });
  save(db);

  const subj = subjectName(db, b.subjectId);
  const entered = touched.filter((t) => t.kind === "entered").length;
  const updated = touched.filter((t) => t.kind === "updated").length;
  audit(req, {
    action: "internalMarks.saved",
    entityType: "internalMarks",
    entityId: `${b.classId}-${sectionId || "all"}-${b.subjectId}-${exam}`,
    after: { entered, updated },
    summary: `Saved ${exam} marks for ${subj}: ${entered} entered, ${updated} updated`,
  });

  // Notify only students whose marks actually changed — and their parents.
  touched.forEach(({ row, kind }) => {
    db.users
      .filter(
        (u) =>
          (u.role === "Student" && u.linkedId === row.studentId) ||
          (u.role === "Parent" && (u.linkedIds || [u.linkedId]).includes(row.studentId))
      )
      .forEach((u) =>
        notify(u.id, {
          title: kind === "entered" ? "Internal marks published" : "Internal marks updated",
          message: `${subj} — ${exam}: ${row.obtained}/${row.maxMarks}`,
          type: "marks",
          relatedType: "internalMark",
          relatedId: row.id,
        })
      );
  });

  res.status(201).json({ saved: touched.length, entered, updated });
});

// GET /api/internal-marks/student/:studentId
router.get("/student/:studentId", (req, res) => {
  const db = load();
  if (!canViewStudent(req.user, req.params.studentId, db)) {
    return res.status(403).json({ error: "Not authorized." });
  }
  const rows = db.internalMarks.filter((m) => m.studentId === req.params.studentId);
  const records = rows
    .map((m) => ({
      id: m.id,
      subjectId: m.subjectId,
      subjectName: subjectName(db, m.subjectId),
      exam: m.exam,
      maxMarks: m.maxMarks,
      obtained: m.obtained,
      percentage: round1((m.obtained / m.maxMarks) * 100),
      remarks: m.remarks,
      updatedAt: m.updatedAt || m.enteredAt,
    }))
    .sort((a, b) => a.exam.localeCompare(b.exam) || a.subjectName.localeCompare(b.subjectName));
  const total = rows.reduce((s, m) => s + m.obtained, 0);
  const max = rows.reduce((s, m) => s + m.maxMarks, 0);
  res.json({
    records,
    overall: { total, maxMarks: max, percentage: max ? round1((total / max) * 100) : null },
    passPercent: PASS_PERCENT,
  });
});

/** Whole-class marks for one exam: matrix, totals, ranks and lists. */
function buildSummary(db, classId, sectionId, exam) {
  const students = studentsInClass(db, classId, sectionId);
  const ids = new Set(students.map((s) => s.id));
  const marks = db.internalMarks.filter((m) => ids.has(m.studentId) && m.exam === exam);
  const subjects = [...new Set(marks.map((m) => m.subjectId))]
    .map((id) => ({ id, name: subjectName(db, id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = students.map((s) => {
    const mine = marks.filter((m) => m.studentId === s.id);
    const bySubject = {};
    mine.forEach((m) => {
      bySubject[m.subjectId] = { obtained: m.obtained, maxMarks: m.maxMarks };
    });
    const total = mine.reduce((sum, m) => sum + m.obtained, 0);
    const max = mine.reduce((sum, m) => sum + m.maxMarks, 0);
    return {
      studentId: s.id,
      studentName: s.name,
      admissionNumber: s.admissionNumber || "",
      rollNumber: s.rollNumber || "",
      marks: bySubject,
      total,
      maxMarks: max,
      percentage: max ? round1((total / max) * 100) : 0,
      subjectsEntered: mine.length,
    };
  });

  // Students with no marks are listed, but never ranked against those who sat
  // the exam — a blank is not a zero.
  const withMarks = rows.filter((r) => r.maxMarks > 0);
  const ranked = rankRows(withMarks);
  const topRank = ranked.length ? ranked[0].rank : null;
  const cls = db.classes.find((c) => c.id === classId) || {};
  const sec = db.sections.find((x) => x.id === sectionId) || {};
  const year = db.academicYears.find((y) => y.isCurrent) || {};

  return {
    classId,
    sectionId,
    exam,
    className: cls.name || "",
    sectionName: sec.name || "",
    academicYearLabel: year.label || "",
    college: db.collegeProfile?.name || "",
    subjects,
    performanceList: ranked,
    topperList: ranked.filter((r) => r.rank <= 3),
    toppers: ranked.filter((r) => r.rank === topRank),
    needsAttention: ranked.filter((r) => r.percentage < PASS_PERCENT),
    notEntered: rows.filter((r) => r.maxMarks === 0).map(({ studentId, studentName }) => ({ studentId, studentName })),
    passPercent: PASS_PERCENT,
    stats: {
      students: rows.length,
      withMarks: withMarks.length,
      average: withMarks.length ? round1(withMarks.reduce((s, r) => s + r.percentage, 0) / withMarks.length) : null,
    },
  };
}

// GET /api/internal-marks/class-summary?classId=&sectionId=&exam=
router.get("/class-summary", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const { classId, sectionId = "", exam } = req.query;
  if (!classId || !exam) return res.status(400).json({ error: "classId and exam are required." });
  if (req.user.role !== "Admin" && !isClassTeacherFor(req.user, classId, sectionId, db)) {
    return res.status(403).json({ error: "Only the class teacher of this class can view its marks summary." });
  }
  res.json(buildSummary(db, classId, sectionId, exam));
});

// GET /api/internal-marks/class-summary/export?classId=&sectionId=&exam=&format=pdf|docx
// A4 class result for download. Same authorization as the summary itself:
// the class teacher of that exact class/section, or an Admin.
router.get("/class-summary/export", requireRole("Faculty", "Admin"), async (req, res) => {
  // Async handler: Express 4 does not catch a rejected promise, so every
  // failure path is handled explicitly here.
  try {
    const db = load();
    const { classId, sectionId = "", exam, format = "pdf" } = req.query;
    if (!classId || !exam) return res.status(400).json({ error: "classId and exam are required." });
    if (!["pdf", "docx"].includes(format)) return res.status(400).json({ error: "format must be pdf or docx." });
    if (req.user.role !== "Admin" && !isClassTeacherFor(req.user, classId, sectionId, db)) {
      return res.status(403).json({ error: "Only the class teacher of this class can download its result." });
    }

    const summary = buildSummary(db, classId, sectionId, exam);
    if (summary.performanceList.length === 0) {
      return res.status(404).json({ error: "No marks have been entered for this class and exam yet, so there is no result to download." });
    }

    // The course comes from the class-teacher assignment, falling back to the
    // students' own course.
    const ct = (db.classTeachers || []).find((t) => t.classId === classId && (t.sectionId || "") === sectionId);
    const courseId = (ct && ct.courseId) || (studentsInClass(db, classId, sectionId)[0] || {}).course || "";
    const courseName = (db.courses.find((c) => c.id === courseId) || {}).name || "";
    const input = { ...summary, courseName, generatedBy: req.user.name || req.user.username };

    const out = format === "pdf" ? await renderPdf(input) : await renderDocx(input);

    audit(req, {
      action: "classResult.downloaded",
      entityType: "internalMarks",
      entityId: `${classId}-${sectionId || "all"}-${exam}`,
      summary: `Downloaded ${exam} class result for ${summary.className}${summary.sectionName ? ` ${summary.sectionName}` : ""} as ${format.toUpperCase()}`,
    });

    res.setHeader("Content-Type", out.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(out.buffer);
  } catch (e) {
    console.error("class result export failed:", e);
    if (!res.headersSent) res.status(500).json({ error: "Could not generate the document." });
  }
});

module.exports = router;
module.exports.buildSummary = buildSummary;
