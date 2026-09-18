/* =========================================================================
   internalMarks.js — internal assessment marks.

   Model
     internalExams        configured by an Admin for one academic year, class,
                          optional section and optional combination/program,
                          with a default maximum and per-subject maximums.
     internalMarks        one row per student + exam + subject, with a status:
                          DRAFT -> SUBMITTED -> PUBLISHED.
     internalMarkHistory  every entry, correction, clearance and status change.

   Rules enforced here (never only in the interface)
     - A faculty member works only on subjects assigned to them in that exact
       class and section. A class teacher can read the class, but does not
       gain the right to edit subjects they do not teach.
     - Students and parents see PUBLISHED marks only, and only their own /
       their linked children's.
     - Obtained marks are validated against the exam's configured maximum.
     - Changing marks that were already submitted or published needs a reason.
     - Attendance Staff see no marks unless an Admin allows it (published only).
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify } = require("../services");
const {
  canTouchSubjectInClass,
  canViewStudent,
  studentsInClass,
  studentsForSubject,
  isClassTeacherFor,
  facultyAssignmentRows,
  classTeacherRows,
  rowCoversClass,
} = require("../scope");
const { getSettings, gradeFor, rankRows, round2 } = require("../academics");
const { familyUsers } = require("../attendanceService");
const { renderPdf, renderDocx } = require("../exporters/classResult");
const { sendReport } = require("../exporters/tableReport");

const router = express.Router();
router.use(verifyToken);

const STATUSES = ["DRAFT", "SUBMITTED", "PUBLISHED"];
const byId = (db, coll, id) => (db[coll] || []).find((x) => x.id === id) || null;
const nameOf = (db, coll, id) => (byId(db, coll, id) || {}).name || "";
const blank = (v) => v === null || v === undefined || String(v).trim() === "";
const isoDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const pct = (obtained, max) => (max > 0 ? round2((obtained / max) * 100) : null);
const avg = (list) => (list.length ? round2(list.reduce((a, b) => a + b, 0) / list.length) : null);

function examMax(exam, subjectId) {
  const o = exam.subjectMaxMarks ? exam.subjectMaxMarks[subjectId] : undefined;
  return Number(o !== undefined && o !== null && o !== "" ? o : exam.maxMarks);
}

function expandExam(db, e) {
  return {
    ...e,
    className: nameOf(db, "classes", e.classId),
    sectionName: nameOf(db, "sections", e.sectionId),
    courseName: nameOf(db, "courses", e.courseId),
    academicYearLabel: (byId(db, "academicYears", e.academicYearId) || {}).label || "",
    marksCount: db.internalMarks.filter((m) => m.examId === e.id).length,
  };
}

/** What may this user do with one class/section/subject sheet? */
function access(user, db, settings, classId, sectionId, subjectId) {
  if (user.role === "Admin") {
    return { view: true, edit: true, submit: true, publish: true, unpublish: true, recall: true, publishedOnly: false };
  }
  if (user.role === "Faculty") {
    const assigned = !!subjectId && canTouchSubjectInClass(user, subjectId, classId, sectionId, db);
    const classTeacher = isClassTeacherFor(user, classId, sectionId, db);
    return {
      view: assigned || classTeacher,
      edit: assigned,
      submit: assigned,
      publish: assigned && settings.marks.facultyCanPublish,
      unpublish: false,
      recall: assigned,
      publishedOnly: false,
      classTeacher,
    };
  }
  if (user.role === "Attendance Staff" && settings.marks.staffCanView) {
    return { view: true, edit: false, submit: false, publish: false, unpublish: false, recall: false, publishedOnly: true };
  }
  return { view: false };
}

/** Validate that an exam, class, section and subject form a real sheet. */
function resolveSheet(db, src) {
  const exam = byId(db, "internalExams", src.examId);
  if (!exam) return { status: 404, error: "Exam not found." };
  const classId = src.classId || exam.classId;
  const sectionId = src.sectionId !== undefined && src.sectionId !== null ? String(src.sectionId) : exam.sectionId || "";
  if (classId !== exam.classId) return { status: 400, error: "This exam is not set for that class." };
  if (exam.sectionId && sectionId !== exam.sectionId) return { status: 400, error: "This exam is set for a different section." };
  if (sectionId && !byId(db, "sections", sectionId)) return { status: 404, error: "Section not found." };
  const subject = byId(db, "subjects", src.subjectId);
  if (!subject) return { status: 404, error: "Subject not found." };
  if (subject.classId && subject.classId !== classId) return { status: 400, error: "That subject is not taught in this class." };
  return { exam, classId, sectionId, subjectId: subject.id, subject };
}

function recordHistory(db, { mark, action, oldObtained = null, newObtained = null, oldRemarks = "", newRemarks = "", oldStatus = "", newStatus = "", user, reason = "" }) {
  db.internalMarkHistory = db.internalMarkHistory || [];
  db.seq.markHistory = (db.seq.markHistory || 0) + 1;
  db.internalMarkHistory.push({
    id: `MH${String(db.seq.markHistory).padStart(6, "0")}`,
    markId: mark.id,
    examId: mark.examId,
    subjectId: mark.subjectId,
    studentId: mark.studentId,
    classId: mark.classId,
    sectionId: mark.sectionId || "",
    action,
    oldObtained,
    newObtained,
    oldRemarks,
    newRemarks,
    oldStatus,
    newStatus,
    maxMarks: mark.maxMarks,
    changedBy: user.id,
    changedByName: user.name || user.username || "",
    changedByRole: user.role,
    changedAt: new Date().toISOString(),
    reason,
  });
}

function statusCounts(rows) {
  const c = { DRAFT: 0, SUBMITTED: 0, PUBLISHED: 0 };
  rows.forEach((r) => {
    if (c[r.status] !== undefined) c[r.status] += 1;
  });
  return c;
}

function overallStatus(counts, entered) {
  if (!entered) return "NOT_STARTED";
  const nonZero = STATUSES.filter((s) => counts[s] > 0);
  return nonZero.length === 1 ? nonZero[0] : "MIXED";
}

/** The mark sheet for one exam + class + section + subject. */
function buildSheet(db, user, settings, r) {
  const acc = access(user, db, settings, r.classId, r.sectionId, r.subjectId);
  const roster = studentsForSubject(db, r.classId, r.sectionId, r.subjectId, r.exam.courseId);
  const ids = new Set(roster.map((s) => s.id));
  let marks = db.internalMarks.filter((m) => m.examId === r.exam.id && m.subjectId === r.subjectId && ids.has(m.studentId));
  if (acc.publishedOnly) marks = marks.filter((m) => m.status === "PUBLISHED");
  const max = examMax(r.exam, r.subjectId);
  const pass = settings.marks.passPercentage;

  const students = roster.map((s) => {
    const m = marks.find((x) => x.studentId === s.id);
    const p = m ? pct(m.obtained, m.maxMarks) : null;
    return {
      studentId: s.id,
      studentName: s.name,
      admissionNumber: s.admissionNumber || "",
      rollNumber: s.rollNumber || "",
      markId: m ? m.id : null,
      obtained: m ? m.obtained : null,
      maxMarks: m ? m.maxMarks : max,
      percentage: p,
      grade: m ? gradeFor(p, settings) : "",
      remarks: m ? m.remarks || "" : "",
      status: m ? m.status : "NOT_ENTERED",
      updatedAt: m ? m.updatedAt || m.enteredAt : null,
      updatedByName: m ? m.updatedByName || m.enteredByName || "" : "",
    };
  });
  const entered = students.filter((s) => s.markId);
  const ranks = new Map(rankRows(entered, "percentage").map((x) => [x.studentId, x.rank]));
  students.forEach((s) => {
    s.rank = ranks.get(s.studentId) || null;
  });
  const highest = entered.length ? Math.max(...entered.map((s) => s.obtained)) : null;
  const counts = statusCounts(marks);

  return {
    exam: expandExam(db, r.exam),
    subject: { id: r.subject.id, name: r.subject.name, code: r.subject.code || "" },
    classId: r.classId,
    sectionId: r.sectionId,
    className: nameOf(db, "classes", r.classId),
    sectionName: nameOf(db, "sections", r.sectionId),
    maxMarks: max,
    passPercentage: pass,
    students,
    stats: {
      students: roster.length,
      entered: entered.length,
      notEntered: roster.length - entered.length,
      average: avg(entered.map((s) => s.percentage)),
      highest,
      lowest: entered.length ? Math.min(...entered.map((s) => s.obtained)) : null,
      toppers: entered.filter((s) => s.obtained === highest).map((s) => s.studentName),
      passCount: entered.filter((s) => s.percentage >= pass).length,
      belowPass: entered.filter((s) => s.percentage < pass).length,
    },
    statusCounts: counts,
    sheetStatus: overallStatus(counts, entered.length),
    historyCount: (db.internalMarkHistory || []).filter(
      (h) => h.examId === r.exam.id && h.subjectId === r.subjectId && ids.has(h.studentId)
    ).length,
    permissions: {
      canEdit: !!acc.edit && (r.exam.status === "ACTIVE" || user.role === "Admin"),
      canSubmit: !!acc.submit && counts.DRAFT > 0,
      canPublish: !!acc.publish && counts.DRAFT + counts.SUBMITTED > 0,
      canUnpublish: !!acc.unpublish && counts.PUBLISHED > 0,
      canRecall: !!acc.recall && counts.SUBMITTED > 0,
      publishedOnly: !!acc.publishedOnly,
      facultyCanPublish: settings.marks.facultyCanPublish,
    },
  };
}

/* --------------------------------- config -------------------------------- */

// GET /api/internal-marks/config
router.get("/config", (req, res) => {
  const s = getSettings(load());
  res.json({
    examTypes: s.marks.examTypes,
    passPercentage: s.marks.passPercentage,
    gradeScale: s.marks.gradeScale,
    facultyCanPublish: s.marks.facultyCanPublish,
  });
});

/* ---------------------------------- exams -------------------------------- */

/** Exams a user may see in the staff screens. */
function visibleExams(db, user, settings) {
  if (user.role === "Admin") return db.internalExams;
  if (user.role === "Faculty") {
    const rows = [...facultyAssignmentRows(user, db), ...classTeacherRows(user, db)];
    return db.internalExams.filter((e) =>
      rows.some((r) => r.classId === e.classId && (!e.sectionId || !r.sectionId || r.sectionId === e.sectionId))
    );
  }
  if (user.role === "Attendance Staff" && settings.marks.staffCanView) return db.internalExams;
  return null;
}

// GET /api/internal-marks/exams?academicYearId=&classId=&sectionId=&status=
router.get("/exams", (req, res) => {
  const db = load();
  const settings = getSettings(db);
  let list = visibleExams(db, req.user, settings);
  if (list === null) return res.status(403).json({ error: "Not authorized." });
  const { academicYearId, classId, sectionId, status, courseId } = req.query;
  if (academicYearId) list = list.filter((e) => e.academicYearId === academicYearId);
  if (classId) list = list.filter((e) => e.classId === classId);
  // A whole-class exam applies to every section of that class.
  if (sectionId) list = list.filter((e) => !e.sectionId || e.sectionId === sectionId);
  if (status) list = list.filter((e) => e.status === status);
  if (courseId) list = list.filter((e) => !e.courseId || e.courseId === courseId);
  res.json({
    exams: list
      .map((e) => expandExam(db, e))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  });
});

function validateExamBody(db, b, existing) {
  const name = String(b.name ?? existing?.name ?? "").trim();
  if (!name) return { error: "Exam name is required." };
  if (name.length > 80) return { error: "Exam name is too long." };
  const academicYearId = b.academicYearId ?? existing?.academicYearId;
  if (!byId(db, "academicYears", academicYearId)) return { error: "Select a valid academic year." };
  const classId = b.classId ?? existing?.classId;
  if (!byId(db, "classes", classId)) return { error: "Select a valid class." };
  const sectionId = String(b.sectionId ?? existing?.sectionId ?? "");
  if (sectionId && !byId(db, "sections", sectionId)) return { error: "Select a valid section." };
  const courseId = String(b.courseId ?? existing?.courseId ?? "");
  const course = courseId ? byId(db, "courses", courseId) : null;
  if (courseId && !course) return { error: "Select a valid combination or program." };
  const cls = byId(db, "classes", classId);
  if (course && course.levelId && cls.levelId && course.levelId !== cls.levelId) {
    return { error: `${course.name} is not offered in ${cls.name}.` };
  }
  const maxMarks = Number(b.maxMarks ?? existing?.maxMarks);
  if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 1000) return { error: "Maximum marks must be a number between 1 and 1000." };
  const rawOverrides = b.subjectMaxMarks ?? existing?.subjectMaxMarks ?? {};
  if (typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) return { error: "Subject maximum marks are invalid." };
  const subjectMaxMarks = {};
  for (const [sid, v] of Object.entries(rawOverrides)) {
    if (blank(v)) continue;
    if (!byId(db, "subjects", sid)) return { error: `Unknown subject in maximum marks: ${sid}.` };
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 1000) return { error: "Each subject's maximum marks must be between 1 and 1000." };
    subjectMaxMarks[sid] = n;
  }
  const startDate = String(b.startDate ?? existing?.startDate ?? "");
  const endDate = String(b.endDate ?? existing?.endDate ?? "");
  if (startDate && !isoDay(startDate)) return { error: "Start date is invalid." };
  if (endDate && !isoDay(endDate)) return { error: "End date is invalid." };
  if (startDate && endDate && endDate < startDate) return { error: "The end date cannot be before the start date." };
  const semester = b.semester ?? existing?.semester ?? "";
  if (!blank(semester) && (!Number.isInteger(Number(semester)) || Number(semester) < 1 || Number(semester) > 12)) {
    return { error: "Semester must be a whole number from 1 to 12." };
  }
  const status = b.status ?? existing?.status ?? "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(status)) return { error: "Status must be ACTIVE or INACTIVE." };
  const type = String(b.type ?? existing?.type ?? name).trim() || name;
  return {
    value: {
      name, type, academicYearId, classId, sectionId, courseId, maxMarks, subjectMaxMarks,
      startDate, endDate, semester: blank(semester) ? "" : Number(semester), status,
    },
  };
}

// POST /api/internal-marks/exams  (Admin)
router.post("/exams", requireRole("Admin"), (req, res) => {
  const db = load();
  const v = validateExamBody(db, req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const dup = db.internalExams.find(
    (e) =>
      e.name.toLowerCase() === v.value.name.toLowerCase() &&
      e.academicYearId === v.value.academicYearId &&
      e.classId === v.value.classId &&
      (e.sectionId || "") === v.value.sectionId &&
      (e.courseId || "") === v.value.courseId
  );
  if (dup) return res.status(409).json({ error: "An exam with this name already exists for that class, section and year." });

  db.seq.exam = (db.seq.exam || 0) + 1;
  const exam = {
    id: `EXM${String(db.seq.exam).padStart(4, "0")}`,
    ...v.value,
    createdBy: req.user.id,
    createdByName: req.user.name || req.user.username,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  db.internalExams.push(exam);
  save(db);
  audit(req, { action: "exam.created", entityType: "internalExam", entityId: exam.id, after: exam, summary: `Created exam ${exam.name}` });
  res.status(201).json({ exam: expandExam(db, exam) });
});

// PUT /api/internal-marks/exams/:id  (Admin)
router.put("/exams/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const exam = byId(db, "internalExams", req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const v = validateExamBody(db, req.body || {}, exam);
  if (v.error) return res.status(400).json({ error: v.error });

  const marks = db.internalMarks.filter((m) => m.examId === exam.id);
  if (marks.length) {
    if (v.value.classId !== exam.classId || v.value.sectionId !== (exam.sectionId || "") || v.value.courseId !== (exam.courseId || "") || v.value.academicYearId !== exam.academicYearId) {
      return res.status(409).json({ error: "Marks already exist for this exam, so its year, class, section and program cannot change." });
    }
    // A lower maximum must still hold every mark already entered.
    const next = { ...exam, ...v.value };
    const broken = marks.filter((m) => m.obtained > examMax(next, m.subjectId));
    if (broken.length) {
      return res.status(409).json({
        error: `${broken.length} entered mark${broken.length === 1 ? " is" : "s are"} higher than the new maximum. Correct those marks first.`,
      });
    }
  }

  const before = { ...exam };
  Object.assign(exam, v.value, { updatedAt: new Date().toISOString() });
  marks.forEach((m) => {
    m.maxMarks = examMax(exam, m.subjectId);
  });
  save(db);
  audit(req, { action: "exam.updated", entityType: "internalExam", entityId: exam.id, before, after: exam, summary: `Updated exam ${exam.name}` });
  res.json({ exam: expandExam(db, exam) });
});

// PATCH /api/internal-marks/exams/:id/status  (Admin) — { status: ACTIVE|INACTIVE }
router.patch("/exams/:id/status", requireRole("Admin"), (req, res) => {
  const db = load();
  const exam = byId(db, "internalExams", req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const status = req.body?.status;
  if (!["ACTIVE", "INACTIVE"].includes(status)) return res.status(400).json({ error: "Status must be ACTIVE or INACTIVE." });
  const before = exam.status;
  exam.status = status;
  exam.updatedAt = new Date().toISOString();
  save(db);
  audit(req, {
    action: status === "ACTIVE" ? "exam.activated" : "exam.deactivated",
    entityType: "internalExam",
    entityId: exam.id,
    before: { status: before },
    after: { status },
    summary: `${status === "ACTIVE" ? "Activated" : "Deactivated"} exam ${exam.name}`,
  });
  res.json({ exam: expandExam(db, exam) });
});

// DELETE /api/internal-marks/exams/:id  (Admin) — only when no marks exist.
router.delete("/exams/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const i = db.internalExams.findIndex((e) => e.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Exam not found." });
  const exam = db.internalExams[i];
  if (db.internalMarks.some((m) => m.examId === exam.id)) {
    return res.status(409).json({ error: "Marks have been entered for this exam. Deactivate it instead of deleting it." });
  }
  db.internalExams.splice(i, 1);
  save(db);
  audit(req, { action: "exam.deleted", entityType: "internalExam", entityId: exam.id, before: exam, summary: `Deleted exam ${exam.name}` });
  res.json({ ok: true });
});

/* ---------------------------------- sheet -------------------------------- */

// GET /api/internal-marks/sheet?examId=&classId=&sectionId=&subjectId=
router.get("/sheet", (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const r = resolveSheet(db, req.query);
  if (r.error) return res.status(r.status).json({ error: r.error });
  if (!access(req.user, db, settings, r.classId, r.sectionId, r.subjectId).view) {
    return res.status(403).json({ error: "You are not assigned to this subject for that class and section." });
  }
  res.json(buildSheet(db, req.user, settings, r));
});

// PUT /api/internal-marks/sheet — save marks (drafts or corrections).
// body: { examId, classId, sectionId, subjectId, entries:[{studentId, obtained, remarks}], reason? }
router.put("/sheet", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const b = req.body || {};
  const r = resolveSheet(db, b);
  if (r.error) return res.status(r.status).json({ error: r.error });
  const acc = access(req.user, db, settings, r.classId, r.sectionId, r.subjectId);
  if (!acc.edit) return res.status(403).json({ error: "You are not assigned to this subject for that class and section." });
  if (r.exam.status !== "ACTIVE" && req.user.role !== "Admin") {
    return res.status(409).json({ error: "This exam is inactive. Ask an administrator to reactivate it." });
  }
  if (!Array.isArray(b.entries) || b.entries.length === 0) return res.status(400).json({ error: "No marks were sent." });

  const isAdmin = req.user.role === "Admin";
  const reason = String(b.reason || "").trim();
  const max = examMax(r.exam, r.subjectId);
  const roster = new Map(studentsForSubject(db, r.classId, r.sectionId, r.subjectId, r.exam.courseId).map((s) => [s.id, s]));

  // Validate every row before changing anything.
  const problems = [];
  const plan = [];
  const seen = new Set();
  b.entries.forEach((e, i) => {
    const label = roster.get(e && e.studentId)?.name || `Row ${i + 1}`;
    if (!e || !roster.has(e.studentId)) return problems.push(`Row ${i + 1}: that student does not take this subject in this class.`);
    if (seen.has(e.studentId)) return problems.push(`${label}: listed twice.`);
    seen.add(e.studentId);
    const remarks = String(e.remarks || "").trim();
    if (remarks.length > 200) return problems.push(`${label}: remarks must be 200 characters or fewer.`);
    const row = db.internalMarks.find((m) => m.examId === r.exam.id && m.subjectId === r.subjectId && m.studentId === e.studentId);

    let obtained = null;
    if (!blank(e.obtained)) {
      const raw = String(e.obtained).trim();
      if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return problems.push(`${label}: marks must be a number with at most 2 decimal places.`);
      obtained = Number(raw);
      if (obtained < 0) return problems.push(`${label}: marks cannot be negative.`);
      if (obtained > max) return problems.push(`${label}: marks cannot exceed the maximum of ${max}.`);
    }

    if (!row) {
      if (obtained === null) return; // still not entered — nothing to do
      plan.push({ kind: "enter", studentId: e.studentId, obtained, remarks });
      return;
    }
    const changed = obtained === null || row.obtained !== obtained || (row.remarks || "") !== remarks;
    if (!changed) return;
    if (row.status === "PUBLISHED" && !isAdmin) {
      return problems.push(`${label}: marks are published. Ask an administrator to change them.`);
    }
    if (row.status !== "DRAFT" && !reason) {
      return problems.push(`${label}: these marks were already ${row.status.toLowerCase()} — give a reason for the change.`);
    }
    plan.push({ kind: obtained === null ? "clear" : "update", row, obtained, remarks });
  });
  if (problems.length) return res.status(400).json({ error: problems[0], problems });
  if (plan.length === 0) return res.json({ saved: 0, entered: 0, updated: 0, cleared: 0, sheet: buildSheet(db, req.user, settings, r) });

  const now = new Date().toISOString();
  const who = { by: req.user.id, name: req.user.name || req.user.username || "" };
  const republished = new Set();
  let entered = 0;
  let updated = 0;
  let cleared = 0;

  plan.forEach((p) => {
    if (p.kind === "enter") {
      db.seq.internalMark = (db.seq.internalMark || 0) + 1;
      const mark = {
        id: `IM${String(db.seq.internalMark).padStart(5, "0")}`,
        examId: r.exam.id,
        exam: r.exam.name,
        academicYearId: r.exam.academicYearId,
        courseId: r.exam.courseId || roster.get(p.studentId).course || "",
        classId: r.classId,
        sectionId: r.sectionId,
        subjectId: r.subjectId,
        studentId: p.studentId,
        maxMarks: max,
        obtained: p.obtained,
        remarks: p.remarks,
        status: "DRAFT",
        enteredBy: who.by,
        enteredByName: who.name,
        enteredAt: now,
        updatedBy: null,
        updatedByName: "",
        updatedAt: null,
        submittedBy: null,
        submittedAt: null,
        publishedBy: null,
        publishedAt: null,
      };
      db.internalMarks.push(mark);
      recordHistory(db, { mark, action: "ENTERED", newObtained: p.obtained, newRemarks: p.remarks, newStatus: "DRAFT", user: req.user, reason });
      entered += 1;
    } else if (p.kind === "update") {
      recordHistory(db, {
        mark: p.row,
        action: "UPDATED",
        oldObtained: p.row.obtained,
        newObtained: p.obtained,
        oldRemarks: p.row.remarks || "",
        newRemarks: p.remarks,
        oldStatus: p.row.status,
        newStatus: p.row.status,
        user: req.user,
        reason,
      });
      if (p.row.status === "PUBLISHED") republished.add(p.row.studentId);
      Object.assign(p.row, { obtained: p.obtained, remarks: p.remarks, maxMarks: max, updatedBy: who.by, updatedByName: who.name, updatedAt: now });
      updated += 1;
    } else {
      recordHistory(db, {
        mark: p.row,
        action: "CLEARED",
        oldObtained: p.row.obtained,
        oldRemarks: p.row.remarks || "",
        oldStatus: p.row.status,
        user: req.user,
        reason,
      });
      db.internalMarks = db.internalMarks.filter((m) => m.id !== p.row.id);
      cleared += 1;
    }
  });
  save(db);

  audit(req, {
    action: "internalMarks.saved",
    entityType: "internalMarks",
    entityId: `${r.exam.id}-${r.subjectId}-${r.classId}-${r.sectionId || "all"}`,
    after: { entered, updated, cleared, reason: reason || undefined },
    summary: `Saved ${r.exam.name} marks for ${r.subject.name}: ${entered} entered, ${updated} updated, ${cleared} cleared`,
  });

  // A correction to marks families can already see is announced to them.
  republished.forEach((studentId) =>
    familyUsers(db, studentId).forEach((u) =>
      notify(u.id, {
        title: "Internal marks updated",
        message: `${r.subject.name} — ${r.exam.name} marks were corrected.`,
        type: "marks",
        relatedType: "internalMark",
        relatedId: r.exam.id,
      })
    )
  );

  res.json({ saved: entered + updated + cleared, entered, updated, cleared, sheet: buildSheet(db, req.user, settings, r) });
});

// POST /api/internal-marks/sheet/status
// body: { examId, classId, sectionId, subjectId, action: submit|publish|unpublish|recall, reason? }
router.post("/sheet/status", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const b = req.body || {};
  const r = resolveSheet(db, b);
  if (r.error) return res.status(r.status).json({ error: r.error });
  const acc = access(req.user, db, settings, r.classId, r.sectionId, r.subjectId);
  if (!acc.view) return res.status(403).json({ error: "You are not assigned to this subject for that class and section." });

  const reason = String(b.reason || "").trim();
  const ids = new Set(studentsForSubject(db, r.classId, r.sectionId, r.subjectId, r.exam.courseId).map((s) => s.id));
  const rows = db.internalMarks.filter((m) => m.examId === r.exam.id && m.subjectId === r.subjectId && ids.has(m.studentId));
  if (rows.length === 0) return res.status(400).json({ error: "No marks have been entered for this sheet yet." });

  const RULES = {
    submit: { allowed: acc.submit, from: ["DRAFT"], to: "SUBMITTED", needsReason: false, deny: "You cannot submit these marks." },
    publish: {
      allowed: acc.publish,
      from: ["DRAFT", "SUBMITTED"],
      to: "PUBLISHED",
      needsReason: false,
      deny: settings.marks.facultyCanPublish ? "You cannot publish these marks." : "Only an administrator can publish marks.",
    },
    unpublish: { allowed: acc.unpublish, from: ["PUBLISHED", "SUBMITTED"], to: "DRAFT", needsReason: true, deny: "Only an administrator can unpublish marks." },
    recall: { allowed: acc.recall, from: ["SUBMITTED"], to: "DRAFT", needsReason: false, deny: "You cannot recall these marks." },
  };
  const rule = RULES[b.action];
  if (!rule) return res.status(400).json({ error: "Action must be submit, publish, unpublish or recall." });
  if (!rule.allowed) return res.status(403).json({ error: rule.deny });
  if (rule.needsReason && !reason) return res.status(400).json({ error: "Give a reason for this change." });
  if (b.action === "publish" && r.exam.status !== "ACTIVE" && req.user.role !== "Admin") {
    return res.status(409).json({ error: "This exam is inactive." });
  }

  const targets = rows.filter((m) => rule.from.includes(m.status));
  if (targets.length === 0) return res.status(409).json({ error: `There are no marks in a state that can be ${b.action === "recall" ? "recalled" : `${b.action}ed`}.` });

  const now = new Date().toISOString();
  targets.forEach((m) => {
    recordHistory(db, { mark: m, action: `STATUS_${b.action.toUpperCase()}`, oldObtained: m.obtained, newObtained: m.obtained, oldStatus: m.status, newStatus: rule.to, user: req.user, reason });
    m.status = rule.to;
    if (rule.to === "SUBMITTED") Object.assign(m, { submittedBy: req.user.id, submittedAt: now });
    if (rule.to === "PUBLISHED") Object.assign(m, { publishedBy: req.user.id, publishedAt: now });
    if (rule.to === "DRAFT") Object.assign(m, { publishedBy: null, publishedAt: null });
  });
  save(db);

  const notEntered = ids.size - rows.length;
  audit(req, {
    action: `internalMarks.${b.action === "recall" ? "recalled" : `${b.action}ed`}`,
    entityType: "internalMarks",
    entityId: `${r.exam.id}-${r.subjectId}-${r.classId}-${r.sectionId || "all"}`,
    after: { count: targets.length, to: rule.to, reason: reason || undefined },
    summary: `${b.action[0].toUpperCase()}${b.action.slice(1)} ${targets.length} ${r.exam.name} mark(s) for ${r.subject.name}`,
  });

  if (rule.to === "PUBLISHED") {
    targets.forEach((m) =>
      familyUsers(db, m.studentId).forEach((u) =>
        notify(u.id, {
          title: "Internal marks published",
          message: `${r.subject.name} — ${r.exam.name}: ${m.obtained}/${m.maxMarks}`,
          type: "marks",
          relatedType: "internalMark",
          relatedId: m.id,
        })
      )
    );
  }

  res.json({ changed: targets.length, notEntered, sheet: buildSheet(db, req.user, settings, r) });
});

// GET /api/internal-marks/history?examId=&classId=&sectionId=&subjectId=&studentId=
router.get("/history", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const r = resolveSheet(db, req.query);
  if (r.error) return res.status(r.status).json({ error: r.error });
  if (!access(req.user, db, settings, r.classId, r.sectionId, r.subjectId).view) {
    return res.status(403).json({ error: "Not authorized." });
  }
  const ids = new Set(studentsForSubject(db, r.classId, r.sectionId, r.subjectId, r.exam.courseId).map((s) => s.id));
  let rows = (db.internalMarkHistory || []).filter((h) => h.examId === r.exam.id && h.subjectId === r.subjectId && ids.has(h.studentId));
  if (req.query.studentId) rows = rows.filter((h) => h.studentId === req.query.studentId);
  res.json({
    history: rows
      .map((h) => ({ ...h, studentName: nameOf(db, "students", h.studentId) }))
      .sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt))),
  });
});

/* ------------------------------ student view ----------------------------- */

function studentMarks(db, settings, studentId, { publishedOnly, academicYearId, examId }) {
  let rows = db.internalMarks.filter((m) => m.studentId === studentId);
  if (publishedOnly) rows = rows.filter((m) => m.status === "PUBLISHED");
  if (academicYearId) rows = rows.filter((m) => m.academicYearId === academicYearId);
  if (examId) rows = rows.filter((m) => m.examId === examId);
  const pass = settings.marks.passPercentage;
  const groups = new Map();
  rows.forEach((m) => {
    if (!groups.has(m.examId)) groups.set(m.examId, []);
    groups.get(m.examId).push(m);
  });
  const exams = [...groups.entries()].map(([id, list]) => {
    const exam = byId(db, "internalExams", id) || { id, name: list[0].exam || "Exam" };
    const subjects = list
      .map((m) => {
        const p = pct(m.obtained, m.maxMarks);
        return {
          markId: m.id,
          subjectId: m.subjectId,
          subjectName: nameOf(db, "subjects", m.subjectId),
          obtained: m.obtained,
          maxMarks: m.maxMarks,
          percentage: p,
          grade: gradeFor(p, settings),
          remarks: m.remarks || "",
          status: m.status,
          result: p >= pass ? "Pass" : "Below pass mark",
        };
      })
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    const total = round2(subjects.reduce((a, s) => a + s.obtained, 0));
    const max = round2(subjects.reduce((a, s) => a + s.maxMarks, 0));
    const p = pct(total, max);
    return {
      examId: id,
      examName: exam.name,
      academicYearId: exam.academicYearId || list[0].academicYearId,
      academicYearLabel: (byId(db, "academicYears", exam.academicYearId) || {}).label || "",
      startDate: exam.startDate || "",
      subjects,
      total,
      maxMarks: max,
      percentage: p,
      grade: gradeFor(p, settings),
    };
  });
  exams.sort((a, b) => String(a.startDate || a.examName).localeCompare(String(b.startDate || b.examName)));
  return exams;
}

// GET /api/internal-marks/student/:studentId?academicYearId=&examId=
router.get("/student/:studentId", (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const { studentId } = req.params;
  if (req.user.role === "Attendance Staff" && !settings.marks.staffCanView) {
    return res.status(403).json({ error: "Not authorized." });
  }
  // Student: own id only. Parent: linked children only. Faculty: students they
  // teach. Any mismatch is refused here, whatever id the browser asked for.
  if (!canViewStudent(req.user, studentId, db)) return res.status(403).json({ error: "Not authorized." });
  const student = byId(db, "students", studentId);
  if (!student) return res.status(404).json({ error: "Student not found." });
  const publishedOnly = ["Student", "Parent", "Attendance Staff"].includes(req.user.role);
  const exams = studentMarks(db, settings, studentId, { publishedOnly, academicYearId: req.query.academicYearId, examId: req.query.examId });
  res.json({
    student: { id: student.id, name: student.name, admissionNumber: student.admissionNumber || "", className: nameOf(db, "classes", student.classId), sectionName: nameOf(db, "sections", student.section) },
    exams,
    publishedOnly,
    passPercentage: settings.marks.passPercentage,
    gradeScale: settings.marks.gradeScale,
  });
});

/* ----------------------------- class performance ------------------------- */

function buildClassSummary(db, settings, exam, classId, sectionId, publishedOnly) {
  const pass = settings.marks.passPercentage;
  const students = studentsInClass(db, classId, sectionId)
    .filter((s) => !exam.courseId || s.course === exam.courseId)
    .sort((a, b) => String(a.rollNumber || "").localeCompare(String(b.rollNumber || ""), undefined, { numeric: true }) || a.name.localeCompare(b.name));
  const ids = new Set(students.map((s) => s.id));
  let marks = db.internalMarks.filter((m) => m.examId === exam.id && ids.has(m.studentId));
  if (publishedOnly) marks = marks.filter((m) => m.status === "PUBLISHED");
  const subjects = [...new Set(marks.map((m) => m.subjectId))]
    .map((id) => ({ id, name: nameOf(db, "subjects", id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = students.map((s) => {
    const mine = marks.filter((m) => m.studentId === s.id);
    const bySubject = {};
    let low = 0;
    mine.forEach((m) => {
      const p = pct(m.obtained, m.maxMarks);
      if (p < pass) low += 1;
      bySubject[m.subjectId] = { obtained: m.obtained, maxMarks: m.maxMarks, percentage: p, grade: gradeFor(p, settings), status: m.status };
    });
    const total = round2(mine.reduce((a, m) => a + m.obtained, 0));
    const max = round2(mine.reduce((a, m) => a + m.maxMarks, 0));
    const p = pct(total, max);
    return {
      studentId: s.id,
      studentName: s.name,
      admissionNumber: s.admissionNumber || "",
      rollNumber: s.rollNumber || "",
      marks: bySubject,
      total,
      maxMarks: max,
      percentage: p === null ? 0 : p,
      grade: gradeFor(p, settings),
      subjectsEntered: mine.length,
      lowSubjects: low,
      result: max ? (p >= pass && low === 0 ? "Pass" : "Needs improvement") : "",
    };
  });
  const withMarks = rows.filter((r) => r.maxMarks > 0);
  const ranked = rankRows(withMarks, "percentage");

  const subjectStats = subjects.map((sub) => {
    const list = marks.filter((m) => m.subjectId === sub.id);
    const highest = list.length ? Math.max(...list.map((m) => m.obtained)) : null;
    const percents = list.map((m) => pct(m.obtained, m.maxMarks));
    return {
      subjectId: sub.id,
      subjectName: sub.name,
      entered: list.length,
      maxMarks: list[0] ? list[0].maxMarks : examMax(exam, sub.id),
      average: avg(percents),
      highest,
      lowest: list.length ? Math.min(...list.map((m) => m.obtained)) : null,
      toppers: list.filter((m) => m.obtained === highest).map((m) => nameOf(db, "students", m.studentId)),
      passCount: percents.filter((p) => p >= pass).length,
      belowPass: percents.filter((p) => p < pass).length,
      statusCounts: statusCounts(list),
    };
  });

  const year = byId(db, "academicYears", exam.academicYearId) || {};
  const course = byId(db, "courses", exam.courseId) || byId(db, "courses", (students[0] || {}).course) || {};
  return {
    college: (db.collegeProfile && db.collegeProfile.name) || "",
    examId: exam.id,
    exam: exam.name,
    classId,
    sectionId,
    className: nameOf(db, "classes", classId),
    sectionName: nameOf(db, "sections", sectionId),
    courseName: course.name || "",
    academicYearLabel: year.label || "",
    subjects,
    performanceList: ranked,
    classToppers: ranked.filter((r) => r.rank === 1),
    topperList: ranked.filter((r) => r.rank <= 3),
    notEntered: rows.filter((r) => r.maxMarks === 0).map(({ studentId, studentName }) => ({ studentId, studentName })),
    subjectStats,
    passPercent: pass,
    publishedOnly: !!publishedOnly,
    stats: {
      students: rows.length,
      withMarks: withMarks.length,
      average: avg(withMarks.map((r) => r.percentage)),
      highest: withMarks.length ? Math.max(...withMarks.map((r) => r.percentage)) : null,
      passCount: withMarks.filter((r) => r.result === "Pass").length,
      needsImprovement: withMarks.filter((r) => r.result !== "Pass").length,
    },
  };
}

function classSummaryAccess(db, user, exam, classId, sectionId) {
  if (exam.classId !== classId) return "This exam is not set for that class.";
  if (exam.sectionId && exam.sectionId !== sectionId) return "This exam is set for a different section.";
  if (user.role === "Admin") return null;
  if (user.role === "Faculty" && isClassTeacherFor(user, classId, sectionId, db)) return null;
  return false;
}

// GET /api/internal-marks/class-summary?examId=&classId=&sectionId=&publishedOnly=1
router.get("/class-summary", requireRole("Faculty", "Admin"), (req, res) => {
  const db = load();
  const settings = getSettings(db);
  const exam = byId(db, "internalExams", req.query.examId);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const classId = req.query.classId || exam.classId;
  const sectionId = String(req.query.sectionId ?? exam.sectionId ?? "");
  const denied = classSummaryAccess(db, req.user, exam, classId, sectionId);
  if (denied === false) return res.status(403).json({ error: "Only the class teacher of this class and section can view its performance." });
  if (denied) return res.status(400).json({ error: denied });
  res.json(buildClassSummary(db, settings, exam, classId, sectionId, req.query.publishedOnly === "1"));
});

/* --------------------------------- reports ------------------------------- */

// GET /api/internal-marks/reports/:type?format=pdf|docx&...
//   class   examId, classId, sectionId            class teacher / Admin
//   subject examId, classId, sectionId, subjectId  assigned faculty / class teacher / Admin
//   student studentId, examId?                     Admin, class teacher, faculty (teaching), the student, parent
//   exam    examId                                 Admin / class teacher of the exam's class
router.get("/reports/:type", async (req, res) => {
  try {
    const db = load();
    const settings = getSettings(db);
    const format = req.query.format || "pdf";
    if (!["pdf", "docx"].includes(format)) return res.status(400).json({ error: "format must be pdf or docx." });
    const college = (db.collegeProfile && db.collegeProfile.name) || "";
    const generatedBy = req.user.name || req.user.username;
    const signatures = ["Class Teacher", "Head of Department", "Principal"];
    const { type } = req.params;

    if (type === "class") {
      if (!["Faculty", "Admin"].includes(req.user.role)) return res.status(403).json({ error: "Not authorized." });
      const exam = byId(db, "internalExams", req.query.examId);
      if (!exam) return res.status(404).json({ error: "Exam not found." });
      const classId = req.query.classId || exam.classId;
      const sectionId = String(req.query.sectionId ?? exam.sectionId ?? "");
      const denied = classSummaryAccess(db, req.user, exam, classId, sectionId);
      if (denied === false) return res.status(403).json({ error: "Only the class teacher of this class and section can download its report." });
      if (denied) return res.status(400).json({ error: denied });
      const summary = buildClassSummary(db, settings, exam, classId, sectionId, req.query.publishedOnly === "1");
      if (summary.performanceList.length === 0) return res.status(404).json({ error: "No marks available for this class and exam yet." });
      const out = format === "pdf" ? await renderPdf({ ...summary, generatedBy }) : await renderDocx({ ...summary, generatedBy });
      audit(req, { action: "marksReport.downloaded", entityType: "internalMarks", entityId: exam.id, summary: `Downloaded class report for ${exam.name} (${format.toUpperCase()})` });
      res.setHeader("Content-Type", out.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(out.buffer);
    }

    if (type === "subject") {
      const r = resolveSheet(db, req.query);
      if (r.error) return res.status(r.status).json({ error: r.error });
      if (!access(req.user, db, settings, r.classId, r.sectionId, r.subjectId).view) return res.status(403).json({ error: "Not authorized." });
      const sheet = buildSheet(db, req.user, settings, r);
      const rows = sheet.students.filter((s) => s.markId);
      if (rows.length === 0) return res.status(404).json({ error: "No marks available for this subject yet." });
      await sendReport(res, format, {
        college,
        title: "Subject Marks Report",
        subtitle: `${sheet.subject.name} — ${sheet.exam.name}`,
        meta: [
          ["Academic Year", sheet.exam.academicYearLabel],
          ["Class", sheet.className],
          ["Section", sheet.sectionName || "Whole class"],
          ["Subject", sheet.subject.name],
          ["Maximum", sheet.maxMarks],
        ],
        columns: [
          { key: "rollNumber", label: "Roll", weight: 0.6, align: "center" },
          { key: "id", label: "Student ID", weight: 1.2 },
          { key: "studentName", label: "Student Name", weight: 2.2 },
          { key: "obtained", label: "Obtained", weight: 0.9, align: "center" },
          { key: "percentage", label: "%", weight: 0.8, align: "center" },
          { key: "grade", label: "Grade", weight: 0.7, align: "center" },
          { key: "rank", label: "Rank", weight: 0.6, align: "center" },
          { key: "status", label: "Status", weight: 1 },
        ],
        rows: sheet.students.map((s) => ({ ...s, id: s.admissionNumber || s.studentId, obtained: s.markId ? `${s.obtained}/${s.maxMarks}` : "Not entered", status: s.status === "NOT_ENTERED" ? "" : s.status })),
        notes: [
          `Entered: ${sheet.stats.entered} of ${sheet.stats.students}. Average: ${sheet.stats.average ?? "—"}%. Highest: ${sheet.stats.highest ?? "—"}. Pass mark: ${sheet.passPercentage}%.`,
          "Equal percentages share a rank and the next rank is skipped (1, 2, 2, 4).",
        ],
        signatures,
        generatedBy,
        filename: `subject-report-${sheet.subject.name}-${sheet.exam.name}`,
      });
      return;
    }

    if (type === "student") {
      const studentId = req.query.studentId;
      if (req.user.role === "Attendance Staff" && !settings.marks.staffCanView) return res.status(403).json({ error: "Not authorized." });
      if (!studentId || !canViewStudent(req.user, studentId, db)) return res.status(403).json({ error: "Not authorized." });
      const student = byId(db, "students", studentId);
      if (!student) return res.status(404).json({ error: "Student not found." });
      const publishedOnly = ["Student", "Parent", "Attendance Staff"].includes(req.user.role);
      const exams = studentMarks(db, settings, studentId, { publishedOnly, examId: req.query.examId, academicYearId: req.query.academicYearId });
      if (exams.length === 0) return res.status(404).json({ error: "No marks available yet." });
      const rows = [];
      exams.forEach((e) => {
        e.subjects.forEach((s) => rows.push({ exam: e.examName, subject: s.subjectName, marks: `${s.obtained}/${s.maxMarks}`, percentage: s.percentage, grade: s.grade, remarks: s.remarks }));
        rows.push({ __bold: true, exam: e.examName, subject: "Total", marks: `${e.total}/${e.maxMarks}`, percentage: e.percentage, grade: e.grade, remarks: "" });
      });
      await sendReport(res, format, {
        college,
        title: "Student Internal Marks Report",
        subtitle: student.name,
        meta: [
          ["Student ID", student.admissionNumber || student.id],
          ["Name", student.name],
          ["Class", nameOf(db, "classes", student.classId)],
          ["Section", nameOf(db, "sections", student.section) || "—"],
          ["Program", nameOf(db, "courses", student.course)],
        ],
        columns: [
          { key: "exam", label: "Exam", weight: 1.6 },
          { key: "subject", label: "Subject", weight: 2 },
          { key: "marks", label: "Marks", weight: 1, align: "center" },
          { key: "percentage", label: "%", weight: 0.8, align: "center" },
          { key: "grade", label: "Grade", weight: 0.7, align: "center" },
          { key: "remarks", label: "Remarks", weight: 1.8 },
        ],
        rows,
        notes: [publishedOnly ? "Only published marks are included." : "Includes marks that are not yet published.", `Pass mark: ${settings.marks.passPercentage}%.`],
        generatedBy,
        filename: `marks-${student.admissionNumber || student.id}`,
      });
      return;
    }

    if (type === "exam") {
      if (!["Faculty", "Admin"].includes(req.user.role)) return res.status(403).json({ error: "Not authorized." });
      const exam = byId(db, "internalExams", req.query.examId);
      if (!exam) return res.status(404).json({ error: "Exam not found." });
      const sectionId = exam.sectionId || String(req.query.sectionId || "");
      const denied = classSummaryAccess(db, req.user, exam, exam.classId, sectionId);
      if (denied === false) return res.status(403).json({ error: "Not authorized." });
      if (denied) return res.status(400).json({ error: denied });
      const summary = buildClassSummary(db, settings, exam, exam.classId, sectionId, req.query.publishedOnly === "1");
      if (summary.subjectStats.length === 0) return res.status(404).json({ error: "No marks available for this exam yet." });
      await sendReport(res, format, {
        college,
        title: "Exam Report",
        subtitle: exam.name,
        meta: [
          ["Academic Year", summary.academicYearLabel],
          ["Class", summary.className],
          ["Section", summary.sectionName || "Whole class"],
          ["Program", summary.courseName || "—"],
          ["Class average", summary.stats.average === null ? "—" : `${summary.stats.average}%`],
        ],
        columns: [
          { key: "subjectName", label: "Subject", weight: 2 },
          { key: "entered", label: "Entered", weight: 0.8, align: "center" },
          { key: "maxMarks", label: "Max", weight: 0.6, align: "center" },
          { key: "average", label: "Avg %", weight: 0.8, align: "center" },
          { key: "highest", label: "Highest", weight: 0.8, align: "center" },
          { key: "toppers", label: "Subject topper", weight: 2 },
          { key: "passCount", label: "Pass", weight: 0.6, align: "center" },
          { key: "belowPass", label: "Below pass", weight: 0.8, align: "center" },
        ],
        rows: summary.subjectStats.map((s) => ({ ...s, toppers: s.toppers.join(", ") })),
        notes: [
          `Class topper(s): ${summary.classToppers.map((t) => `${t.studentName} (${t.percentage}%)`).join(", ") || "—"}.`,
          `Students with marks: ${summary.stats.withMarks} of ${summary.stats.students}. Pass mark: ${summary.passPercent}%.`,
        ],
        signatures,
        generatedBy,
        filename: `exam-report-${exam.name}-${summary.className}`,
      });
      return;
    }

    res.status(400).json({ error: "Report type must be class, subject, student or exam." });
  } catch (e) {
    console.error("marks report failed:", e);
    if (!res.headersSent) res.status(500).json({ error: "Could not generate the document." });
  }
});

module.exports = router;
module.exports.buildClassSummary = buildClassSummary;
module.exports.rowCoversClass = rowCoversClass;
