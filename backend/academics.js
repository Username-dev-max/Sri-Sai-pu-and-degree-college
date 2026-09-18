/* =========================================================================
   academics.js — college academic policy and the calculations that use it.

   Pure functions only (no database access), so the attendance and marks
   modules, their reports and their exports all compute percentages, grades
   and ranks in exactly one way.

   Every number that is a POLICY decision — the low-attendance threshold,
   whether approved leave counts in the attendance denominator, the pass mark,
   the grade scale — lives in `settings` and is editable by an Admin. The
   defaults below are starting values for the college to confirm, not facts.
   ========================================================================= */

const DEFAULT_SETTINGS = {
  attendance: {
    // Students below this overall percentage appear in Low Attendance and are
    // notified once when they fall below it.
    lowThreshold: 75,
    // true: Present / (Present + Absent + Leave) — leave lowers the percentage.
    // false: Present / (Present + Absent) — approved leave is excluded.
    leaveInDenominator: true,
    periodsPerDay: 8,
    // Attendance Staff permissions, granted by Admin.
    staffCanMark: true,
    staffCanEdit: false,
    // Faculty may correct registers for classes they are assigned to.
    facultyCanEdit: true,
  },
  marks: {
    passPercentage: 40,
    // When false, only an Admin can publish marks to students and parents.
    facultyCanPublish: false,
    // Attendance Staff see no marks unless an Admin allows it.
    staffCanView: false,
    // Highest band first. `min` is the lowest percentage for that grade.
    gradeScale: [
      { min: 90, grade: "A+" },
      { min: 80, grade: "A" },
      { min: 70, grade: "B+" },
      { min: 60, grade: "B" },
      { min: 50, grade: "C" },
      { min: 40, grade: "D" },
      { min: 0, grade: "F" },
    ],
    examTypes: [
      "Internal Assessment 1",
      "Internal Assessment 2",
      "Internal Assessment 3",
      "Class Test",
      "Model Exam",
      "Assignment",
      "Practical / Internal",
      "Project / Viva",
    ],
  },
};

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Stored settings merged over the defaults, so a newly added policy key
 *  always has a value even in an older data.json. */
function getSettings(db) {
  const stored = (db && db.settings) || {};
  const out = clone(DEFAULT_SETTINGS);
  for (const section of Object.keys(out)) {
    Object.assign(out[section], stored[section] || {});
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Attendance counts -> percentage under the configured leave policy.
 *  Returns null when there is nothing to divide by (never a made-up 0 or 100). */
function attendancePercentage({ present = 0, absent = 0, leave = 0 }, settings) {
  const s = settings.attendance || settings;
  const denominator = present + absent + (s.leaveInDenominator ? leave : 0);
  return denominator ? round2((present / denominator) * 100) : null;
}

function countStatuses(rows) {
  const c = { total: rows.length, present: 0, absent: 0, leave: 0 };
  rows.forEach((r) => {
    if (r.status === "Present") c.present += 1;
    else if (r.status === "Absent") c.absent += 1;
    else if (r.status === "Leave") c.leave += 1;
  });
  return c;
}

/** Grade for a percentage from the configured scale; "" when no scale matches. */
function gradeFor(percentage, settings) {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return "";
  const scale = (settings.marks || settings).gradeScale || [];
  const band = scale.slice().sort((a, b) => b.min - a.min).find((b) => percentage >= b.min);
  return band ? band.grade : "";
}

/**
 * Standard competition ranking: equal values share a rank and the next rank
 * skips — 90, 85, 85, 80 ranks 1, 2, 2, 4. Rows without a value are not ranked.
 */
function rankRows(rows, key = "percentage", tieBreak = (a, b) => String(a.studentName).localeCompare(String(b.studentName))) {
  const sorted = rows.slice().sort((a, b) => b[key] - a[key] || tieBreak(a, b));
  let prev = null;
  let prevRank = 0;
  return sorted.map((r, i) => {
    const rank = r[key] === prev ? prevRank : i + 1;
    prev = r[key];
    prevRank = rank;
    return { ...r, rank };
  });
}

/** Validate an Admin's settings update. Returns an error string or null. */
function validateSettings(next) {
  const a = next.attendance || {};
  const m = next.marks || {};
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  if (a.lowThreshold !== undefined && (!num(a.lowThreshold) || a.lowThreshold < 0 || a.lowThreshold > 100)) {
    return "The low-attendance threshold must be a number from 0 to 100.";
  }
  if (a.periodsPerDay !== undefined && (!Number.isInteger(a.periodsPerDay) || a.periodsPerDay < 1 || a.periodsPerDay > 12)) {
    return "Periods per day must be a whole number from 1 to 12.";
  }
  for (const k of ["leaveInDenominator", "staffCanMark", "staffCanEdit", "facultyCanEdit"]) {
    if (a[k] !== undefined && typeof a[k] !== "boolean") return `attendance.${k} must be true or false.`;
  }
  if (m.passPercentage !== undefined && (!num(m.passPercentage) || m.passPercentage < 0 || m.passPercentage > 100)) {
    return "The pass percentage must be a number from 0 to 100.";
  }
  for (const k of ["facultyCanPublish", "staffCanView"]) {
    if (m[k] !== undefined && typeof m[k] !== "boolean") return `marks.${k} must be true or false.`;
  }
  if (m.gradeScale !== undefined) {
    if (!Array.isArray(m.gradeScale) || m.gradeScale.length === 0) return "The grade scale needs at least one band.";
    const seen = new Set();
    for (const b of m.gradeScale) {
      if (!b || !num(b.min) || b.min < 0 || b.min > 100 || !String(b.grade || "").trim()) {
        return "Each grade band needs a grade name and a minimum percentage from 0 to 100.";
      }
      if (seen.has(b.min)) return "Two grade bands cannot start at the same percentage.";
      seen.add(b.min);
    }
    if (!m.gradeScale.some((b) => b.min === 0)) return "The grade scale must include a band starting at 0%.";
  }
  if (m.examTypes !== undefined) {
    if (!Array.isArray(m.examTypes) || m.examTypes.some((t) => !String(t || "").trim())) {
      return "Exam types must be a list of names.";
    }
  }
  return null;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  attendancePercentage,
  countStatuses,
  gradeFor,
  rankRows,
  round2,
  validateSettings,
};
