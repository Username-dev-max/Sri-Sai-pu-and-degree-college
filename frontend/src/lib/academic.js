/* =========================================================================
   academic.js — helpers shared by the academic pickers.

   Kept out of the component file so both AcademicFilters and the screens
   that build their own subject lists can use them.
   ========================================================================= */

/** Does an assignment row (empty section = whole class) cover class+section? */
export function covers(row, classId, sectionId) {
  return row.classId === classId && (!row.sectionId || row.sectionId === (sectionId || ""));
}

/**
 * Subjects offered for a class, optionally narrowed to one program.
 *
 * A subject belongs to the class when it is mapped to one of the class's
 * combinations/programs, or when it is taught to the class without belonging
 * to any program (a language, say). A subject tied to another class is never
 * offered. With `scope.teachable` set (Faculty), only assigned subjects remain.
 */
export function subjectsFor(scope, { levelId, streamId, classId, courseId, sectionId, department }) {
  if (!scope || !classId) return [];
  const level = scope.levels.find((l) => l.id === levelId);
  const programs = courseId
    ? scope.courses.filter((c) => c.id === courseId)
    : scope.courses.filter((c) => c.levelId === levelId && (!level?.hasStreams || !streamId || c.stream === streamId));
  const mapped = new Set(programs.flatMap((c) => c.subjects));
  const allMapped = new Set(scope.courses.flatMap((c) => c.subjects));
  const assignedToClass = new Set(scope.classSubjects.filter((a) => a.classId === classId).map((a) => a.subjectId));

  let list = scope.subjects.filter((s) => {
    if (s.classId && s.classId !== classId) return false;
    if (mapped.has(s.id)) return true;
    return assignedToClass.has(s.id) && !allMapped.has(s.id);
  });
  if (department) list = list.filter((s) => s.department === department);
  if (scope.teachable) {
    list = list.filter((s) => scope.teachable.some((t) => t.subjectId === s.id && covers(t, classId, sectionId)));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}
