import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Award, Wallet, UserRound } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

/**
 * A Parent account is linked (via linkedId) to exactly one student and can see
 * only that student's record — the backend enforces this on every endpoint
 * used here.
 */
export default function ParentDashboard() {
  const { user } = useAuth();
  const { subjectName, courseName } = useData();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [results, setResults] = useState(null);
  const [fee, setFee] = useState(undefined); // undefined = loading, null = no record
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    const id = user.linkedId;
    if (!id) return setError(true);

    client.get(`/students/${id}`).then(({ data }) => setStudent(data.student)).catch(() => setError(true));
    client.get(`/attendance/student/${id}`).then(({ data }) => setAttendance(data)).catch(() => setAttendance({ records: [], overallPercentage: null, subjectSummary: [] }));
    client.get(`/results/${id}`).then(({ data }) => setResults(data)).catch(() => setResults({ records: [], overallPercentage: null }));
    // A missing fee record is a normal state, not an error.
    client.get(`/fees/${id}`).then(({ data }) => setFee(data.fee)).catch(() => setFee(null));
  }

  useEffect(load, [user.linkedId]);

  if (error) return <ErrorState full message="Couldn't load your child's record." onRetry={load} />;
  if (!student || !attendance || !results || fee === undefined) return <Loader full label="Loading…" />;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-surface-sunken)" }}>
            <UserRound size={22} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>{student.name}</h2>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {courseName(student.course)} · Semester {student.semester} · {student.id}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Attendance"
          value={attendance.overallPercentage ?? 0}
          suffix="%"
          icon={CalendarCheck}
          color="#0891b2"
        />
        <StatCard
          label="Overall Result"
          value={results.overallPercentage ?? 0}
          suffix="%"
          icon={Award}
          color="#16a34a"
          delay={0.05}
        />
        <StatCard
          label="Fees Pending"
          value={fee ? fee.total - fee.paid : 0}
          prefix="₹"
          icon={Wallet}
          color="#dc2626"
          delay={0.1}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="glass rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Attendance by subject</h3>
          </div>
          {attendance.subjectSummary.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance recorded yet" description="Attendance will appear here once staff begin marking it." />
          ) : (
            <Table>
              <TableHead>
                <TableTh>Subject</TableTh>
                <TableTh>Present</TableTh>
                <TableTh align="right">Percentage</TableTh>
              </TableHead>
              <TableBody>
                {attendance.subjectSummary.map((s) => (
                  <TableRow key={s.subject}>
                    <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{subjectName(s.subject)}</TableTd>
                    <TableTd>{s.present} / {s.total}</TableTd>
                    <TableTd align="right">
                      <StatusBadge tone={s.percentage >= 75 ? "success" : s.percentage >= 60 ? "warning" : "danger"}>
                        {s.percentage}%
                      </StatusBadge>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="glass rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
            <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Marks &amp; results</h3>
          </div>
          {results.records.length === 0 ? (
            <EmptyState icon={Award} title="No marks published yet" description="Results appear here once faculty enter them." />
          ) : (
            <Table>
              <TableHead>
                <TableTh>Subject</TableTh>
                <TableTh>Total</TableTh>
                <TableTh align="right">Grade</TableTh>
              </TableHead>
              <TableBody>
                {results.records.map((r) => (
                  <TableRow key={r.id}>
                    <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{subjectName(r.subject)}</TableTd>
                    <TableTd>{r.total} / {r.maxTotal}</TableTd>
                    <TableTd align="right">
                      <StatusBadge tone={r.result === "Pass" ? "success" : "danger"}>{r.grade}</StatusBadge>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {!fee && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          No fee record has been set up for this student yet.
        </p>
      )}
    </div>
  );
}
