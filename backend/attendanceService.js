/* =========================================================================
   attendanceService.js — attendance side-effects shared by several routes:
   correction history and low-attendance alerts.

   Used by routes/attendance.js (marking and correcting registers) and
   routes/leaveRequests.js (approved leave turns absences into leave), so a
   status change is recorded and alerted the same way whichever path made it.
   ========================================================================= */
const { notify } = require("./services");
const { getSettings, attendancePercentage, countStatuses } = require("./academics");

function currentYear(db) {
  return (db.academicYears || []).find((y) => y.isCurrent) || (db.academicYears || [])[0] || null;
}

/** Student and parent accounts for one student. */
function familyUsers(db, studentId) {
  return (db.users || []).filter(
    (u) =>
      u.status !== "Inactive" &&
      ((u.role === "Student" && u.linkedId === studentId) ||
        (u.role === "Parent" && (u.linkedIds || [u.linkedId]).includes(studentId)))
  );
}

/** Append one correction to attendanceHistory. The caller saves. */
function recordAttendanceHistory(db, { row, oldStatus, newStatus, user, reason, source = "correction" }) {
  db.attendanceHistory = db.attendanceHistory || [];
  db.seq.attendanceHistory = (db.seq.attendanceHistory || 0) + 1;
  const entry = {
    id: `AH${String(db.seq.attendanceHistory).padStart(6, "0")}`,
    attendanceId: row.id,
    student: row.student,
    subject: row.subject,
    classId: row.classId || "",
    sectionId: row.sectionId || "",
    date: row.date,
    period: row.period || "",
    academicYearId: row.academicYearId || "",
    oldStatus,
    newStatus,
    changedBy: user ? user.id : null,
    changedByName: user ? user.name || user.username || "" : "system",
    changedByRole: user ? user.role : "system",
    changedAt: new Date().toISOString(),
    reason: reason || "",
    source,
  };
  db.attendanceHistory.push(entry);
  return entry;
}

/** A student's attendance in one academic year, under the college policy. */
function studentYearSummary(db, studentId, academicYearId, settings = getSettings(db)) {
  const rows = (db.attendance || []).filter(
    (a) => a.student === studentId && (!academicYearId || (a.academicYearId || "") === academicYearId)
  );
  const counts = countStatuses(rows);
  return { ...counts, percentage: attendancePercentage(counts, settings) };
}

/**
 * Re-evaluate low-attendance alerts for these students in the current year.
 * A student is notified once when they fall below the threshold; the alert
 * closes (silently) when they climb back above it. The caller saves.
 */
function refreshLowAttendance(db, studentIds) {
  const settings = getSettings(db);
  const year = currentYear(db);
  const yearId = year ? year.id : "";
  const threshold = settings.attendance.lowThreshold;
  db.attendanceAlerts = db.attendanceAlerts || [];
  const now = new Date().toISOString();

  [...new Set(studentIds)].forEach((studentId) => {
    const summary = studentYearSummary(db, studentId, yearId, settings);
    const active = db.attendanceAlerts.find((a) => a.studentId === studentId && a.academicYearId === yearId && a.active);
    const below = summary.percentage !== null && summary.percentage < threshold;

    if (below && !active) {
      db.seq.attendanceAlert = (db.seq.attendanceAlert || 0) + 1;
      db.attendanceAlerts.push({
        id: `AA${String(db.seq.attendanceAlert).padStart(5, "0")}`,
        studentId,
        academicYearId: yearId,
        active: true,
        percentage: summary.percentage,
        threshold,
        triggeredAt: now,
        resolvedAt: null,
      });
      const student = (db.students || []).find((s) => s.id === studentId) || {};
      familyUsers(db, studentId).forEach((u) =>
        notify(u.id, {
          title: "Low attendance",
          message:
            u.role === "Parent"
              ? `${student.name || "Your ward"}'s attendance is ${summary.percentage}%, below the required ${threshold}%.`
              : `Your attendance is ${summary.percentage}%, below the required ${threshold}%.`,
          type: "attendance",
          relatedType: "attendanceAlert",
          relatedId: studentId,
        })
      );
    } else if (below && active) {
      active.percentage = summary.percentage;
    } else if (!below && active) {
      active.active = false;
      active.percentage = summary.percentage;
      active.resolvedAt = now;
    }
  });
}

module.exports = { familyUsers, recordAttendanceHistory, studentYearSummary, refreshLowAttendance, currentYear };
