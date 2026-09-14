import Attendance from "./Attendance";

/**
 * Attendance Staff work the same marking screen Faculty use, but across every
 * subject rather than only their own assigned ones.
 */
export default function AttendanceStaffDashboard() {
  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Select a subject and date, then mark each student present or absent. Saved attendance is visible to Admin,
        Faculty, the student, and their parent.
      </p>
      <Attendance allSubjects />
    </div>
  );
}
