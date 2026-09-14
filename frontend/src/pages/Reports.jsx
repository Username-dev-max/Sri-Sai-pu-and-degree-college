import { useEffect, useState } from "react";
import { Printer, FileBarChart } from "lucide-react";
import client from "../api/client";
import { useData } from "../context/DataContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import Tabs from "../components/Tabs";
import { Table as SharedTable, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

const TABS = ["Students", "Fees", "Attendance Summary"].map((t) => ({ key: t, label: t }));

export default function Reports() {
  const { deptName, courseName, subjectName } = useData();
  const [tab, setTab] = useState("Students");
  const [students, setStudents] = useState(null);
  const [fees, setFees] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subjectsError, setSubjectsError] = useState(false);

  function loadBase() {
    setStudents(null);
    setFees(null);
    client.get("/students").then(({ data }) => setStudents(data.students)).catch(() => setStudents(false));
    client.get("/fees").then(({ data }) => setFees(data.fees)).catch(() => setFees(false));
    setSubjectsError(false);
    client.get("/subjects").then(({ data }) => setSubjects(data.subjects)).catch(() => setSubjectsError(true));
  }

  useEffect(loadBase, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadAttendance() {
    if (!subjects.length) return;
    setAttendance(null);
    Promise.all(subjects.map((s) => client.get(`/attendance/subject/${s.id}`)))
      .then((results) => {
        const summary = subjects.map((s, i) => {
          const records = results[i].data.attendance;
          const present = records.filter((r) => r.status === "Present").length;
          const pct = records.length ? Math.round((present / records.length) * 1000) / 10 : null;
          return { subject: s.id, total: records.length, present, pct };
        });
        setAttendance(summary);
      })
      .catch(() => setAttendance(false));
  }

  useEffect(() => {
    if (tab !== "Attendance Summary" || !subjects.length) return;
    loadAttendance();
  }, [tab, subjects]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <Tabs tabs={TABS} active={tab} onChange={setTab} layoutId="report-tab" />
        <Button variant="secondary" icon={Printer} onClick={() => window.print()} className="sm:ml-auto">
          Print / Export
        </Button>
      </div>

      <TiltCard intensity={1} className="glass rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
          <FileBarChart size={16} className="text-blue-600" />
          <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{tab} Report</h3>
        </div>

        {tab === "Students" && (
          students === false ? (
            <ErrorState message="Couldn't load the students report." onRetry={loadBase} />
          ) : students ? (
            <ReportTable
              cols={["ID", "Name", "Department", "Course", "Sem", "Status"]}
              rows={students.map((s) => [s.id, s.name, deptName(s.department), courseName(s.course), s.semester, s.status])}
            />
          ) : <Loader />
        )}

        {tab === "Fees" && (
          fees === false ? (
            <ErrorState message="Couldn't load the fees report." onRetry={loadBase} />
          ) : fees ? (
            <ReportTable
              cols={["Student ID", "Total", "Paid", "Pending", "Status"]}
              rows={fees.map((f) => [f.student, `₹${f.total.toLocaleString("en-IN")}`, `₹${f.paid.toLocaleString("en-IN")}`, `₹${(f.total - f.paid).toLocaleString("en-IN")}`, f.status])}
            />
          ) : <Loader />
        )}

        {tab === "Attendance Summary" && (
          subjectsError || attendance === false ? (
            <ErrorState message="Couldn't load the attendance summary." onRetry={subjectsError ? loadBase : loadAttendance} />
          ) : attendance ? (
            <ReportTable
              cols={["Subject", "Classes Held", "Avg. Present", "Attendance %"]}
              rows={attendance.map((a) => [subjectName(a.subject), a.total, a.present, a.pct !== null ? `${a.pct}%` : "—"])}
            />
          ) : <Loader />
        )}
      </TiltCard>
    </div>
  );
}

function ReportTable({ cols, rows }) {
  if (rows.length === 0) return <EmptyState title="No data available." />;
  return (
    <SharedTable>
      <TableHead>
        {cols.map((c) => <TableTh key={c}>{c}</TableTh>)}
      </TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => <TableTd key={j}>{cell}</TableTd>)}
          </TableRow>
        ))}
      </TableBody>
    </SharedTable>
  );
}
