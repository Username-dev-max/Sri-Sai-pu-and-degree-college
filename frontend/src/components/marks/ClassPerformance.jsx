import { useEffect, useState } from "react";
import { Trophy, FileDown, BarChart3 } from "lucide-react";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { downloadFile, downloadError } from "../../api/download";
import AcademicFilters from "../AcademicFilters";
import Loader from "../Loader";
import ErrorState from "../ErrorState";
import EmptyState from "../EmptyState";
import Button from "../Button";
import StatusBadge from "../StatusBadge";

const pctText = (p) => (p === null || p === undefined ? "—" : `${p}%`);

function Stat({ label, value }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      <div className="text-base font-bold truncate" style={{ color: "var(--color-text-primary)" }}>{value}</div>
    </div>
  );
}

/** Class teacher / Admin: whole-class results for one exam. */
export default function ClassPerformance({ scope }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [filters, setFilters] = useState({ academicYearId: "", levelId: "", classId: "", sectionId: "" });
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setExamId("");
    setExams([]);
    if (!filters.classId) return;
    client
      .get("/internal-marks/exams", { params: { academicYearId: filters.academicYearId, classId: filters.classId, sectionId: filters.sectionId || undefined } })
      .then(({ data }) => {
        setExams(data.exams);
        if (data.exams.length === 1) setExamId(data.exams[0].id);
      })
      .catch(() => setExams([]));
  }, [filters.academicYearId, filters.classId, filters.sectionId]);

  const exam = exams.find((e) => e.id === examId);
  const sectionId = exam?.sectionId || filters.sectionId || "";

  useEffect(() => {
    setSummary(null);
    setError("");
    if (!examId) return;
    client
      .get("/internal-marks/class-summary", { params: { examId, classId: filters.classId, sectionId, publishedOnly: publishedOnly ? "1" : undefined } })
      .then(({ data }) => setSummary(data))
      .catch((e) => setError(e.response?.data?.error || "Couldn't load class performance."));
  }, [examId, filters.classId, sectionId, publishedOnly]);

  async function download(type, format) {
    setBusy(`${type}-${format}`);
    try {
      await downloadFile(`/internal-marks/reports/${type}`, { examId, classId: filters.classId, sectionId, format, publishedOnly: publishedOnly ? "1" : undefined }, `${type}-report.${format}`);
    } catch (e) {
      push(await downloadError(e, "Could not download the report."), "error");
    } finally {
      setBusy("");
    }
  }

  const mode = user.role === "Faculty" ? "classTeacher" : "any";
  if (mode === "classTeacher" && scope.classTeacherOf.length === 0) {
    return <EmptyState icon={BarChart3} title="You are not a class teacher" description="Class performance is available to the class teacher of a class and to administrators." />;
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
        <AcademicFilters scope={scope} value={filters} onChange={setFilters} mode={mode} show={["academicYearId", "levelId", "classId", "sectionId"]} />
        <div className="grid sm:grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="cp-exam" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Exam</label>
            <select id="cp-exam" className="input" value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!filters.classId}>
              <option value="">{exams.length ? "Select exam…" : "No exams for this class"}</option>
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}{e.sectionName ? ` — ${e.sectionName}` : ""}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2.5" style={{ color: "var(--color-text-secondary)" }}>
            <input type="checkbox" checked={publishedOnly} onChange={(e) => setPublishedOnly(e.target.checked)} />
            Published marks only
          </label>
        </div>
      </div>

      {!examId ? (
        <EmptyState icon={BarChart3} title="Select a class and exam" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !summary ? (
        <Loader label="Calculating…" />
      ) : summary.performanceList.length === 0 ? (
        <EmptyState icon={BarChart3} title="No marks available yet." description="Results appear once faculty enter marks for this exam." />
      ) : (
        <>
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat label="Students" value={summary.stats.students} />
              <Stat label="With marks" value={summary.stats.withMarks} />
              <Stat label="Class average" value={pctText(summary.stats.average)} />
              <Stat label="Highest" value={pctText(summary.stats.highest)} />
              <Stat label="Pass" value={summary.stats.passCount} />
              <Stat label="Needs improvement" value={summary.stats.needsImprovement} />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: "var(--color-text-primary)" }}>
              <Trophy size={16} style={{ color: "var(--color-gold)" }} />
              Class topper{summary.classToppers.length > 1 ? "s" : ""}: <strong>{summary.classToppers.map((t) => `${t.studentName} (${t.percentage}%)`).join(", ")}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              {["pdf", "docx"].map((f) => (
                <Button key={`c${f}`} size="sm" variant="secondary" icon={FileDown} loading={busy === `class-${f}`} onClick={() => download("class", f)}>Class report {f.toUpperCase()}</Button>
              ))}
              {["pdf", "docx"].map((f) => (
                <Button key={`e${f}`} size="sm" variant="secondary" icon={FileDown} loading={busy === `exam-${f}`} onClick={() => download("exam", f)}>Exam report {f.toUpperCase()}</Button>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-primary)" }}>Subject performance</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                    {["Subject", "Entered", "Average", "Highest", "Subject topper", "Pass", "Below pass", "Status"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {summary.subjectStats.map((s) => (
                    <tr key={s.subjectId} className="border-b last:border-0" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-secondary)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--color-text-primary)" }}>{s.subjectName}</td>
                      <td className="px-3 py-2">{s.entered}</td>
                      <td className="px-3 py-2">{pctText(s.average)}</td>
                      <td className="px-3 py-2">{s.highest}/{s.maxMarks}</td>
                      <td className="px-3 py-2">{s.toppers.join(", ")}</td>
                      <td className="px-3 py-2">{s.passCount}</td>
                      <td className="px-3 py-2">{s.belowPass}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                        {s.statusCounts.PUBLISHED ? `${s.statusCounts.PUBLISHED} published ` : ""}{s.statusCounts.SUBMITTED ? `${s.statusCounts.SUBMITTED} submitted ` : ""}{s.statusCounts.DRAFT ? `${s.statusCounts.DRAFT} draft` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b text-sm font-semibold" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-primary)" }}>Student ranking</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: `${520 + summary.subjects.length * 90}px` }}>
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                    <th className="px-3 py-2.5 font-semibold">Rank</th>
                    <th className="px-3 py-2.5 font-semibold sticky left-0 z-10" style={{ background: "var(--color-surface-raised)" }}>Student</th>
                    {summary.subjects.map((s) => <th key={s.id} className="px-3 py-2.5 font-semibold whitespace-nowrap">{s.name}</th>)}
                    <th className="px-3 py-2.5 font-semibold">Total</th>
                    <th className="px-3 py-2.5 font-semibold">%</th>
                    <th className="px-3 py-2.5 font-semibold">Grade</th>
                    <th className="px-3 py-2.5 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.performanceList.map((r) => (
                    <tr key={r.studentId} className="border-b last:border-0" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-secondary)" }}>
                      <td className="px-3 py-2 font-bold tabular-nums" style={{ color: r.rank === 1 ? "var(--color-gold)" : "var(--color-text-primary)" }}>{r.rank}</td>
                      <td className="px-3 py-2 sticky left-0 z-10" style={{ background: "var(--color-surface-raised)" }}>
                        <div className="font-medium whitespace-nowrap" style={{ color: "var(--color-text-primary)" }}>{r.studentName}</div>
                        <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{r.admissionNumber || r.studentId}</div>
                      </td>
                      {summary.subjects.map((s) => {
                        const m = r.marks[s.id];
                        return (
                          <td key={s.id} className="px-3 py-2 tabular-nums whitespace-nowrap" style={m && m.percentage < summary.passPercent ? { color: "var(--color-danger)" } : undefined}>
                            {m ? `${m.obtained}/${m.maxMarks}` : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{r.total}/{r.maxMarks}</td>
                      <td className="px-3 py-2 tabular-nums">{r.percentage}%</td>
                      <td className="px-3 py-2">{r.grade}</td>
                      <td className="px-3 py-2"><StatusBadge tone={r.result === "Pass" ? "success" : "warning"}>{r.result}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.notEntered.length > 0 && (
              <p className="px-4 py-3 text-xs border-t" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                No marks yet (not ranked): {summary.notEntered.map((n) => n.studentName).join(", ")}
              </p>
            )}
          </div>
          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Equal percentages share a rank and the next rank is skipped (1, 2, 2, 4). Marks below the {summary.passPercent}% pass mark are shown in red.
          </p>
        </>
      )}
    </div>
  );
}
