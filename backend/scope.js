/* =========================================================================
   scope.js — "what is this user allowed to touch?"

   Central answers to the scoping questions many routes ask. A Faculty
   member's reach, a class teacher's reach, and a parent's reach are each
   defined ONCE here, not re-derived (and re-bugged) per route.

   Section semantics used throughout: an assignment or class-teacher row
   with an empty sectionId covers the WHOLE class; a non-empty sectionId
   covers only that section. A student matches when their classId is equal
   and either the row has no section or the sections are equal.
   ========================================================================= */
const { load } = require("./db");

/* ------------------------------ primitives ------------------------------- */

/** The current academic year's id, or "" if none is configured. */
function currentYearId(db = load()) {
  const y = (db.academicYears || []).find((a) => a.isCurrent) || (db.academicYears || [])[0];
  return y ? y.id : "";
}

/** Does a class/section row (assignment or class teacher) cover a student? */
function rowCoversStudent(row, student) {
  if (!row || !student) return false;
  if (row.classId !== student.classId) return false;
  return !row.sectionId || row.sectionId === (student.section || "");
}

/**
 * Does a class/section row cover the requested class + section?
 *
 * A whole-class row (empty sectionId) covers every section AND a request for
 * the whole class. A section row covers ONLY its exact section — never a
 * request for the whole class. The earlier version also accepted an empty
 * requested section, so the class teacher of the AI section could read the
 * General section's marks simply by leaving the section blank.
 */
function rowCoversClass(row, classId, sectionId) {
  if (!row || row.classId !== classId) return false;
  return !row.sectionId || row.sectionId === (sectionId || "");
}

/** Students enrolled in a class, optionally narrowed to one section. */
function studentsInClass(db, classId, sectionId = "") {
  return (db.students || [])
    .filter((s) => s.classId === classId)
    .filter((s) => !sectionId || (s.section || "") === sectionId)
    .filter((s) => s.status !== "Inactive");
}

/* ------------------------------- faculty --------------------------------- */

/** This faculty member's teaching-assignment rows. */
function facultyAssignmentRows(user, db = load()) {
  if (!user || user.role !== "Faculty" || !user.linkedId) return [];
  return (db.facultyAssignments || []).filter((a) => a.facultyId === user.linkedId);
}

/**
 * Subject ids a faculty member is assigned to teach.
 *
 * Deliberately STRICT: a faculty member with no assignments gets an empty
 * list and can therefore mark nothing. The permissive alternative — "no
 * assignments means everything" — would silently hand a new or
 * mis-configured account the whole college.
 */
function facultySubjectIds(user, db = load()) {
  if (!user || user.role !== "Faculty" || !user.linkedId) return [];
  const fromAssignments = facultyAssignmentRows(user, db).map((a) => a.subjectId);
  const fac = (db.faculty || []).find((f) => f.id === user.linkedId);
  const fromRecord = Array.isArray(fac?.subjects) ? fac.subjects : [];
  return [...new Set([...fromAssignments, ...fromRecord])].filter(Boolean);
}

/** Class ids a faculty member teaches in. */
function facultyClassIds(user, db = load()) {
  return [...new Set(facultyAssignmentRows(user, db).map((a) => a.classId).filter(Boolean))];
}

/* ---------------------------- class teacher ------------------------------ */

/** Class-teacher rows held by this faculty member in the current year. */
function classTeacherRows(user, db = load()) {
  if (!user || user.role !== "Faculty" || !user.linkedId) return [];
  const yearId = currentYearId(db);
  return (db.classTeachers || []).filter(
    (t) => t.facultyId === user.linkedId && (!yearId || !t.academicYearId || t.academicYearId === yearId)
  );
}

/** Is this user the class teacher for the given class + section? */
function isClassTeacherFor(user, classId, sectionId, db = load()) {
  return classTeacherRows(user, db).some((t) => rowCoversClass(t, classId, sectionId));
}

/** The class teacher (faculty id) responsible for a student, or null. */
function classTeacherForStudent(student, db = load()) {
  if (!student) return null;
  const yearId = currentYearId(db);
  // Prefer an exact section match over a whole-class row.
  const rows = (db.classTeachers || [])
    .filter((t) => !yearId || !t.academicYearId || t.academicYearId === yearId)
    .filter((t) => rowCoversStudent(t, student))
    .sort((a, b) => (b.sectionId ? 1 : 0) - (a.sectionId ? 1 : 0));
  return rows[0] ? rows[0].facultyId : null;
}

/* ------------------------------- subjects -------------------------------- */

/**
 * May this user read/write attendance and marks for this subject?
 * Admin and Attendance Staff are college-wide by role; Faculty are not.
 * Kept for existing callers that do not pass a class.
 */
function canTouchSubject(user, subjectId, db = load()) {
  if (!user) return false;
  if (user.role === "Admin" || user.role === "Attendance Staff") return true;
  if (user.role !== "Faculty") return false;
  return facultySubjectIds(user, db).includes(subjectId);
}

/**
 * Section-aware version: may this user work with THIS subject in THIS class
 * and section? A faculty member assigned FOC for 1st Year AI must not reach
 * the 1st Year General register for the same subject.
 */
function canTouchSubjectInClass(user, subjectId, classId, sectionId, db = load()) {
  if (!user) return false;
  if (user.role === "Admin" || user.role === "Attendance Staff") return true;
  if (user.role !== "Faculty") return false;
  return facultyAssignmentRows(user, db).some(
    (a) => a.subjectId === subjectId && rowCoversClass(a, classId, sectionId)
  );
}

/* ------------------------------- students -------------------------------- */

/**
 * Every student id this user may see records for.
 * Returns null to mean "no restriction" (Admin / Attendance Staff).
 */
function visibleStudentIds(user, db = load()) {
  if (user.role === "Admin" || user.role === "Attendance Staff") return null;
  if (user.role === "Student") return user.linkedId ? [user.linkedId] : [];
  if (user.role === "Parent") {
    return user.linkedIds?.length ? user.linkedIds : user.linkedId ? [user.linkedId] : [];
  }
  if (user.role === "Faculty") {
    // A faculty member sees students in the class/sections they teach, plus
    // every student in a class they are class teacher of. Nothing else.
    const rows = [...facultyAssignmentRows(user, db), ...classTeacherRows(user, db)];
    if (rows.length === 0) return [];
    return (db.students || []).filter((s) => rows.some((r) => rowCoversStudent(r, s))).map((s) => s.id);
  }
  return [];
}

/** Can this user view the given student's records? */
function canViewStudent(user, studentId, db = load()) {
  const allowed = visibleStudentIds(user, db);
  return allowed === null || allowed.includes(studentId);
}

module.exports = {
  currentYearId,
  rowCoversStudent,
  rowCoversClass,
  studentsInClass,
  facultyAssignmentRows,
  facultySubjectIds,
  facultyClassIds,
  classTeacherRows,
  isClassTeacherFor,
  classTeacherForStudent,
  canTouchSubject,
  canTouchSubjectInClass,
  visibleStudentIds,
  canViewStudent,
};
