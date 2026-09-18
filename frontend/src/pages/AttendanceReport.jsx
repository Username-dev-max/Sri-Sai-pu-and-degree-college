import { useEffect, useState } from "react";
import { FileDown, Filter, CalendarCheck, History, AlertTriangle, BarChart3 } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { downloadFile, downloadError } from "../api/download";
import useAcademicScope from "../hooks/useAcademicScope";
import AcademicFilters from "../components/AcademicFilters";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";
import Tabs from "../components/Tabs";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

const TYPES = [
  { key: "daily", label: "Daily", needs: "date" },
  { key: "monthly", label: "Monthly", needs: "month" },
  { key: "subject", label: "Subject-wise", needs: "range" },
  { key: "class", label: "Class-wise", needs: "range" },
  { key: "section", label: "Section-wise", needs: "range" },
  { key: "student", label: "Student-wise", needs: "student" },
  { key: "faculty", label: "Attendance taken (faculty-wise)", needs: "range" },
  { key: "absent", label: "Absent students", needs: "range" },
  { key: "low", label: "Low attendance", needs: "range" },
];
const today = () => new Date().toLocaleDateString("en-CA");
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

function Field({ label, id, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function ReportTable({ columns, rows }) {
  return (
    <div className="glass rounded-2xl overflow-hidden shadow-sm">
      <Table>
        <TableHead>
          {columns.map((c) => <TableTh key={c.key} align={c.align === "right" ? "right" : "left"}>{c.label}</TableTh>)}
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {columns.map((c) => <TableTd key={c.key}>{r[c.key] === "" || r[c.key] === null || r[c.key] === undefined ? "—" : String(r[c.key])}</TableTd>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Attendance reports, low attendance and correction history. */
export default function AttendanceReport() {
  const { user } = useAuth();
  const { push } = useToast();
  const { scope, error: scopeError, reload } = useAcademicScope();
  const [tab, setTab] = useState("reports");
  const [type, setType] = useState("monthly");
  const [filters, setFilters] = useState({ academicYearId: "", levelId: "", classId: "", streamId: "", courseId: "", sectionId: "", subjectId: "" });
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [studentId, setStudentId] = useState("");
  const [students, setStudents] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [history, setHistory] = useState(null);

  const activeType = tab === "low" ? "low" : type;
  const needs = TYPES.find((t) => t.key === activeType)?.needs;

  useEffect(() => {
    if (!filters.classId) {
      setStudents([]);
      return;
    }
    client
      .get("/students", { params: { classId: filters.classId, section: filters.sectionId || undefined } })
      .then(({ data }) => setStudents(data.students || []))
      .catch(() => setStudents([]));
  }, [filters.classId, filters.sectionId]);

  function params() {
    const p = { type: activeType, academicYearId: filters.academicYearId, classId: filters.classId, sectionId: filters.sectionId, subject: filters.subjectId, courseId: filters.courseId };
    if (needs === "date") p.date = date;
    if (needs === "month") p.month = month;
    if (needs === "range" || needs === "student") {
      if (from) p.from = from;
      if (to) p.to = to;
    }
    if (studentId) p.studentId = studentId;
    Object.keys(p).forEach((k) => (p[k] === "" || p[k] === undefined) && delete p[k]);
    return p;
  }

  function run() {
    setLoading(true);
    setError("");
    client
      .get("/attendance/reports", { params: params() })
      .then(({ data }) => setReport(data))
      .catch((e) => {
        setReport(null);
        setError(e.response?.data?.error || "Couldn't build the report.");
      })
      .finally(() => setLoading(false));
  }

  async function exportAs(format) {
    setDownloading(format);
    try {
      await downloadFile("/attendance/reports", { ...params(), format }, `attendance-report.${format}`);
    } catch (e) {
      push(await downloadError(e, "Could not download the report."), "error");
    } finally {
      setDownloading("");
    }
  }

  function loadHistory() {
    setHistory(null);
    client
      .get("/attendance/history", { params: { academicYearId: filters.academicYearId || undefined, classId: filters.classId || undefined, subject: filters.subjectId || undefined, from: from || undefined, to: to || undefined } })
      .then(({ data }) => setHistory(data.history))
      .catch(() => setHistory([]));
  }

  useEffect(() => {
    if (tab === "history" && scope) loadHistory();
    setReport(null);
  }, [tab, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  if (scopeError) return <ErrorState full message="Couldn't load the academic structure." onRetry={reload} />;
  if (!scope) return <Loader full label="Loading…" />;

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { key: "reports", label: "Reports" },
          { key: "low", label: "Low Attendance" },
          { key: "history", label: "Correction History" },
        ]}
        active={tab}
        onChange={setTab}
        layoutId="att-report-tabs"
      />

      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          <Filter size={15} className="text-blue-600" /> Filters
        </div>
        {tab === "reports" && (
          <div className="sm:max-w-sm">
            <Field label="Report" id="rep-type">
              <select id="rep-type" className="input" value={type} onChange={(e) => { setType(e.target.value); setReport(null); }}>
                {TYPES.filter((t) => t.key !== "low").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        <AcademicFilters
          scope={scope}
          value={filters}
          onChange={setFilters}
          mode={user.role === "Faculty" ? "teach" : "any"}
          show={["academicYearId", "levelId", "classId", "streamId", "courseId", "sectionId", "subjectId"]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tab !== "history" && needs === "date" && (
            <Field label="Date" id="rep-date"><input id="rep-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          )}
          {tab !== "history" && needs === "month" && (
            <Field label="Month" id="rep-month"><input id="rep-month" type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          )}
          {(tab === "history" || needs === "range" || needs === "student") && (
            <>
              <Field label="From" id="rep-from"><input id="rep-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="To" id="rep-to"><input id="rep-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </>
          )}
          {tab !== "history" && (needs === "student" || needs === "month") && (
            <Field label={needs === "student" ? "Student" : "Student (optional)"} id="rep-student">
              <select id="rep-student" className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!filters.classId}>
                <option value="">{filters.classId ? "All students" : "Select a class first"}</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.rollNumber ? `${s.rollNumber} · ` : ""}{s.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {tab === "history" ? (
            <Button icon={History} onClick={loadHistory}>Show History</Button>
          ) : (
            <>
              <Button icon={BarChart3} onClick={run} loading={loading}>Show Report</Button>
              {["csv", "pdf", "docx"].map((f) => (
                <Button key={f} variant="secondary" icon={FileDown} loading={downloading === f} onClick={() => exportAs(f)}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </>
          )}
        </div>
      </div>

      {tab === "history" ? (
        history === null ? (
          <Loader label="Loading history…" />
        ) : history.length === 0 ? (
          <EmptyState icon={History} title="No corrections recorded." description="Attendance corrections appear here with who made them and why." />
        ) : (
          <ReportTable
            columns={[
              { key: "when", label: "Changed At" },
              { key: "studentName", label: "Student" },
              { key: "register", label: "Register" },
              { key: "change", label: "Change" },
              { key: "changedByName", label: "Changed By" },
              { key: "reason", label: "Reason" },
            ]}
            rows={history.map((h) => ({
              ...h,
              when: fmtTime(h.changedAt),
              register: `${h.subjectName} · ${h.className}${h.sectionName ? ` ${h.sectionName}` : ""} · ${h.date} P${h.period || "—"}`,
              change: `${h.oldStatus} → ${h.newStatus}`,
            }))}
          />
        )
      ) : error ? (
        <ErrorState message={error} onRetry={run} />
      ) : loading ? (
        <Loader label="Building report…" />
      ) : !report ? (
        <EmptyState
          icon={tab === "low" ? AlertTriangle : CalendarCheck}
          title={tab === "low" ? "Low attendance" : "Choose filters and show the report"}
          description={tab === "low" ? `Students whose attendance is below the college threshold of ${scope.settings.lowThreshold}%.` : "Reports are built from recorded attendance only."}
        />
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{report.title}</div>
          {report.rows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={tab === "low" ? "No students are below the threshold." : "No attendance records available."} />
          ) : (
            <ReportTable columns={report.columns} rows={report.rows} />
          )}
          {report.notes.map((n) => <p key={n} className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{n}</p>)}
        </div>
      )}
    </div>
  );
}
