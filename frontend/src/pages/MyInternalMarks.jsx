import { useCallback, useEffect, useState } from "react";
import { Award, FileDown } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import { downloadFile, downloadError } from "../api/download";
import ChildSwitcher, { useLinkedChildren } from "../components/ChildSwitcher";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

/** A student's own published internal marks, or a parent's linked child's. */
export default function MyInternalMarks() {
  const { push } = useToast();
  const linked = useLinkedChildren();
  const studentId = linked.activeId;
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [examId, setExamId] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    if (!studentId) return;
    setError(false);
    setData(null);
    setExamId("");
    client.get(`/internal-marks/student/${studentId}`).then(({ data: d }) => setData(d)).catch(() => setError(true));
  }, [studentId]);
  useEffect(load, [load]);

  async function download(format) {
    setBusy(format);
    try {
      await downloadFile("/internal-marks/reports/student", { studentId, examId: examId || undefined, format }, `marks.${format}`);
    } catch (e) {
      push(await downloadError(e, "Could not download the report."), "error");
    } finally {
      setBusy("");
    }
  }

  if (!studentId) return <EmptyState icon={Award} title="No student is linked to this account." />;
  const exams = data ? data.exams.filter((e) => !examId || e.examId === examId) : [];

  return (
    <div className="space-y-5 max-w-4xl">
      <ChildSwitcher linked={linked} />
      {error ? (
        <ErrorState message="Couldn't load internal marks." onRetry={load} />
      ) : !data ? (
        <Loader label="Loading marks…" />
      ) : data.exams.length === 0 ? (
        <EmptyState icon={Award} title="No marks available yet." description="Marks appear here after the college publishes them." />
      ) : (
        <>
          <div className="glass rounded-2xl p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[12rem]">
              <label htmlFor="my-exam" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Exam</label>
              <select id="my-exam" className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">All exams</option>
                {data.exams.map((e) => <option key={e.examId} value={e.examId}>{e.examName} · {e.academicYearLabel}</option>)}
              </select>
            </div>
            <Button variant="secondary" icon={FileDown} loading={busy === "pdf"} onClick={() => download("pdf")}>PDF</Button>
            <Button variant="secondary" icon={FileDown} loading={busy === "docx"} onClick={() => download("docx")}>DOCX</Button>
          </div>

          {exams.map((e) => (
            <div key={e.examId} className="glass rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                <div>
                  <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{e.examName}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{e.academicYearLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{e.total} / {e.maxMarks}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{e.percentage}%{e.grade ? ` · Grade ${e.grade}` : ""}</div>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
                {e.subjects.map((s) => (
                  <div key={s.markId} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex-1 min-w-[10rem]">
                      <div className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{s.subjectName}</div>
                      {s.remarks && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{s.remarks}</div>}
                    </div>
                    <div className="text-sm tabular-nums font-semibold" style={{ color: "var(--color-text-primary)" }}>{s.obtained} / {s.maxMarks}</div>
                    <div className="text-sm tabular-nums w-16 text-right" style={{ color: "var(--color-text-secondary)" }}>{s.percentage}%</div>
                    <div className="w-10 text-sm text-center font-semibold">{s.grade || "—"}</div>
                    <StatusBadge tone={s.result === "Pass" ? "success" : "warning"}>{s.result}</StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Only published marks are shown. Pass mark: {data.passPercentage}%.</p>
        </>
      )}
    </div>
  );
}
