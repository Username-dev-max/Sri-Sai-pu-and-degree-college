import Attendance from "./Attendance";

/**
 * Attendance Staff mark attendance on the same screen Faculty use. What they
 * may do is decided by the Admin's Academic Policies and enforced by the
 * server — this page adds no permissions of its own.
 */
export default function AttendanceStaffDashboard() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Choose the class, section, subject, date and period, mark each student Present, Absent or Leave, then review the
        summary and save. Saved attendance is visible to Admin, the class's faculty, the student and their parents.
      </p>
      <Attendance />
    </div>
  );
}
