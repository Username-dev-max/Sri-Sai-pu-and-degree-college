import { useCallback, useEffect, useState } from "react";
import { Download, Filter, CalendarCheck } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";
import useMySubjects from "../hooks/useMySubjects";

/**
 * Attendance report with filters and CSV export. Attendance Staff and Admin
 * see every subject; a Faculty member's results are scoped server-side to the
 * subjects they are assigned, whatever they put in the filter.
 */
export default function AttendanceReport({ allSubjects = false }) {
  const { push } = useToast();
  const { subjects: mySubjectsRaw } = useMySubjects({ allSubjects });
  const [config, setConfig] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [subject, setSubject] = useState("");
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    client.get("/academic-config").then(({ data }) => setConfig(data)).catch(() => setConfig({ classes: [] }));
  }, []);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (subject) p.set("subject", subject);
    if (classId) p.set("classId", classId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
  }, [subject, classId, from, to]);

  const load = useCallback(() => {
    setError(false);
    setReport(null);
    client
      .get(`/attendance/report?${params()}`)
      .then(({ data }) => setReport(data.report))
      .catch(() => setError(true));
  }, [params]);

  useEffect(load, [load]);

  async function download() {
    setDownloading(true);
    try {
      const p = params();
      p.set("format", "csv");
      const res = await client.get(`/attendance/report?${p}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      push("Report downloaded.", "success");
    } catch {
      push("Could not download the report.", "error");
    } finally {
      setDownloading(false);
    }
  }

  const subjects = mySubjectsRaw || [];

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          <Filter size={15} className="text-blue-600" /> Filters
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input">
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
              <option value="">All classes</option>
              {(config?.classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button icon={Download} onClick={download} loading={downloading} disabled={!report || report.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState message="Couldn't load the report." onRetry={load} />
      ) : !report ? (
        <Loader label="Building report…" />
      ) : report.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No attendance in this range"
          description="Nothing has been marked for the filters you selected."
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <Table>
            <TableHead>
              <TableTh>Student</TableTh>
              <TableTh>Roll No</TableTh>
              <TableTh>Subject</TableTh>
              <TableTh>Present</TableTh>
              <TableTh>Absent</TableTh>
              <TableTh align="right">Percentage</TableTh>
            </TableHead>
            <TableBody>
              {report.map((r) => (
                <TableRow key={`${r.studentId}-${r.subject}`}>
                  <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {r.studentName}
                    <span className="block text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
                      {r.admissionNumber || r.studentId}
                    </span>
                  </TableTd>
                  <TableTd>{r.rollNumber || "—"}</TableTd>
                  <TableTd>{r.subject}</TableTd>
                  <TableTd>{r.present}</TableTd>
                  <TableTd>{r.absent}</TableTd>
                  <TableTd align="right">
                    <StatusBadge tone={r.percentage >= 75 ? "success" : r.percentage >= 60 ? "warning" : "danger"}>
                      {r.percentage}%
                    </StatusBadge>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
