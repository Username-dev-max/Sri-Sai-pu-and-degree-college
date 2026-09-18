import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Send, Globe, Undo2, History, RotateCcw, FileDown, Award, X } from "lucide-react";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { downloadFile, downloadError } from "../../api/download";
import AcademicFilters from "../AcademicFilters";
import Loader from "../Loader";
import ErrorState from "../ErrorState";
import EmptyState from "../EmptyState";
import Button from "../Button";
import Modal from "../Modal";
import StatusBadge from "../StatusBadge";

export const STATUS_TONE = { DRAFT: "neutral", SUBMITTED: "info", PUBLISHED: "success", MIXED: "warning", NOT_STARTED: "neutral", NOT_ENTERED: "neutral" };
const STATUS_LABEL = { DRAFT: "Draft", SUBMITTED: "Submitted", PUBLISHED: "Published", MIXED: "Mixed", NOT_STARTED: "Not started", NOT_ENTERED: "Not entered" };
const pctText = (p) => (p === null || p === undefined ? "—" : `${p}%`);

function gradeFor(p, scale) {
  if (p === null || p === undefined) return "";
  const band = (scale || []).slice().sort((a, b) => b.min - a.min).find((b) => p >= b.min);
  return band ? band.grade : "";
}

/** Client-side check matching the server's rules; returns an error or "". */
function checkMark(raw, max) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return "Enter a number (max 2 decimals)";
  const n = Number(s);
  if (n < 0) return "Cannot be negative";
  if (n > max) return `Max is ${max}`;
  return "";
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      <div className="text-sm font-bold truncate" style={{ color: "var(--color-text-primary)" }}>{value}</div>
    </div>
  );
}

/**
 * Enter, correct, submit and publish marks for one exam + class + section +
 * subject. Every student is on one screen; Enter / ↓ moves to the next
 * student's marks, ↑ to the previous one.
 */
export default function MarksSheet({ scope }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [filters, setFilters] = useState({ academicYearId: "", levelId: "", classId: "", streamId: "", courseId: "", sectionId: "", subjectId: "" });
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState("");
  const [reasonFor, setReasonFor] = useState(null); // "save" | "unpublish"
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [history, setHistory] = useState(null);
  const inputs = useRef([]);

  useEffect(() => {
    setExamId("");
    setExams([]);
    if (!filters.classId || !filters.academicYearId) return;
    client
      .get("/internal-marks/exams", { params: { academicYearId: filters.academicYearId, classId: filters.classId, sectionId: filters.sectionId || undefined } })
      .then(({ data }) => {
        const list = data.exams.filter((e) => (user.role === "Admin" || e.status === "ACTIVE") && (!e.courseId || !filters.courseId || e.courseId === filters.courseId));
        setExams(list);
        if (list.length === 1) setExamId(list[0].id);
      })
      .catch(() => setExams([]));
  }, [filters.academicYearId, filters.classId, filters.sectionId, filters.courseId, user.role]);

  const ready = !!(examId && filters.subjectId && filters.classId);
  const selection = useMemo(
    () => ({ examId, classId: filters.classId, sectionId: filters.sectionId || "", subjectId: filters.subjectId }),
    [examId, filters.classId, filters.sectionId, filters.subjectId]
  );

  const load = useCallback(() => {
    if (!ready) {
      setSheet(null);
      return;
    }
    setLoading(true);
    setError("");
    client
      .get("/internal-marks/sheet", { params: selection })
      .then(({ data }) => {
        setSheet(data);
        setEdits({});
      })
      .catch((e) => {
        setSheet(null);
        setError(e.response?.data?.error || "Couldn't load the mark sheet.");
      })
      .finally(() => setLoading(false));
  }, [ready, selection]);
  useEffect(load, [load]);

  const scale = scope.settings.gradeScale;
  const rows = useMemo(() => {
    if (!sheet) return [];
    return sheet.students.map((s) => {
      const e = edits[s.studentId];
      const obtained = e && e.obtained !== undefined ? e.obtained : s.obtained === null ? "" : String(s.obtained);
      const remarks = e && e.remarks !== undefined ? e.remarks : s.remarks;
      const err = checkMark(obtained, s.maxMarks);
      const p = obtained !== "" && !err ? Math.round((Number(obtained) / s.maxMarks) * 10000) / 100 : null;
      const dirty = obtained !== (s.obtained === null ? "" : String(s.obtained)) || remarks !== s.remarks;
      const lockedRow = !sheet.permissions.canEdit || (s.status === "PUBLISHED" && user.role !== "Admin");
      return { ...s, obtainedInput: obtained, remarksInput: remarks, err, livePct: p, liveGrade: gradeFor(p, scale), dirty, lockedRow };
    });
  }, [sheet, edits, scale, user.role]);

  const dirtyRows = rows.filter((r) => r.dirty);
  const hasErrors = rows.some((r) => r.err);
  const needsReason = dirtyRows.some((r) => r.status === "SUBMITTED" || r.status === "PUBLISHED");

  function edit(studentId, patch) {
    setEdits((m) => ({ ...m, [studentId]: { ...m[studentId], ...patch } }));
  }

  function onKey(e, i) {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    }
  }

  async function save(withReason = "") {
    if (hasErrors) return push("Fix the highlighted marks first.", "error");
    if (dirtyRows.length === 0) return push("There are no unsaved changes.", "info");
    if (needsReason && !withReason) {
      setReason("");
      setReasonFor("save");
      return;
    }
    setBusy("save");
    try {
      const entries = dirtyRows.map((r) => ({ studentId: r.studentId, obtained: r.obtainedInput, remarks: r.remarksInput }));
      const { data } = await client.put("/internal-marks/sheet", { ...selection, entries, reason: withReason });
      setSheet(data.sheet);
      setEdits({});
      setReasonFor(null);
      push(`Saved — ${data.entered} entered, ${data.updated} updated, ${data.cleared} cleared.`, "success");
    } catch (e) {
      push(e.response?.data?.error || "Could not save marks.", "error");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(action, withReason = "") {
    if (dirtyRows.length) return push("Save your changes first.", "error");
    setBusy(action);
    try {
      const { data } = await client.post("/internal-marks/sheet/status", { ...selection, action, reason: withReason });
      setSheet(data.sheet);
      setConfirm(null);
      setReasonFor(null);
      const verb = { submit: "submitted", publish: "published", unpublish: "unpublished", recall: "recalled to draft" }[action];
      push(`${data.changed} mark${data.changed === 1 ? "" : "s"} ${verb}.${data.notEntered ? ` ${data.notEntered} student(s) still have no marks.` : ""}`, "success");
    } catch (e) {
      push(e.response?.data?.error || "Could not change the status.", "error");
    } finally {
      setBusy("");
    }
  }

  function openHistory() {
    setHistory([]);
    client.get("/internal-marks/history", { params: selection }).then(({ data }) => setHistory(data.history)).catch(() => setHistory([]));
  }

  async function download(format) {
    setBusy(format);
    try {
      await downloadFile("/internal-marks/reports/subject", { ...selection, format }, `subject-report.${format}`);
    } catch (e) {
      push(await downloadError(e, "Could not download the report."), "error");
    } finally {
      setBusy("");
    }
  }

  const exam = exams.find((e) => e.id === examId);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
        <AcademicFilters scope={scope} value={filters} onChange={setFilters} />
        <div className="sm:max-w-md">
          <label htmlFor="marks-exam" className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Exam / Test</label>
          <select id="marks-exam" className="input" value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!filters.classId}>
            <option value="">{!filters.classId ? "Select a class first" : exams.length ? "Select exam…" : "No exams configured for this class"}</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.sectionName ? ` — ${e.sectionName}` : ""}{e.courseName ? ` (${e.courseName})` : ""}{e.status !== "ACTIVE" ? " [inactive]" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!ready ? (
        <EmptyState icon={Award} title="Choose a mark sheet" description="Select the class, subject and exam. Exams are created by an administrator." />
      ) : loading && !sheet ? (
        <Loader label="Loading students…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : sheet ? (
        <>
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {sheet.subject.name} — {sheet.exam.name}
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {sheet.className}{sheet.sectionName ? ` ${sheet.sectionName}` : " (whole class)"} · {sheet.exam.academicYearLabel} · Maximum marks {sheet.maxMarks}
                  {exam?.startDate ? ` · ${exam.startDate}${exam.endDate ? ` to ${exam.endDate}` : ""}` : ""}
                </div>
              </div>
              <StatusBadge tone={STATUS_TONE[sheet.sheetStatus]}>{STATUS_LABEL[sheet.sheetStatus]}</StatusBadge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat label="Entered" value={`${sheet.stats.entered} / ${sheet.stats.students}`} />
              <Stat label="Average" value={pctText(sheet.stats.average)} />
              <Stat label="Highest" value={sheet.stats.highest ?? "—"} />
              <Stat label="Topper" value={sheet.stats.toppers.join(", ") || "—"} />
              <Stat label={`Pass (≥${sheet.passPercentage}%)`} value={sheet.stats.passCount} />
              <Stat label="Below pass" value={sheet.stats.belowPass} />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <StatusBadge tone="neutral">Draft {sheet.statusCounts.DRAFT}</StatusBadge>
              <StatusBadge tone="info">Submitted {sheet.statusCounts.SUBMITTED}</StatusBadge>
              <StatusBadge tone="success">Published {sheet.statusCounts.PUBLISHED}</StatusBadge>
            </div>
            {!sheet.permissions.canEdit && (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {sheet.permissions.publishedOnly ? "Read-only: published marks only." : sheet.exam.status !== "ACTIVE" ? "This exam is inactive — marks are read-only." : "Read-only: you are not assigned to teach this subject here."}
              </p>
            )}
          </div>

          {sheet.students.length === 0 ? (
            <EmptyState icon={Award} title="No students take this subject here." />
          ) : (
            <div className="glass rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left border-b" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                      <th className="px-3 py-2.5 font-semibold">Roll</th>
                      <th className="px-3 py-2.5 font-semibold sticky left-0 z-10" style={{ background: "var(--color-surface-raised)" }}>Student</th>
                      <th className="px-3 py-2.5 font-semibold">Max</th>
                      <th className="px-3 py-2.5 font-semibold">Obtained</th>
                      <th className="px-3 py-2.5 font-semibold">%</th>
                      <th className="px-3 py-2.5 font-semibold">Grade</th>
                      <th className="px-3 py-2.5 font-semibold">Rank</th>
                      <th className="px-3 py-2.5 font-semibold">Remarks</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.studentId} className="border-b last:border-0" style={{ borderColor: "var(--color-border-subtle)", background: r.dirty ? "rgba(59,130,246,0.06)" : undefined }}>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>{r.rollNumber || "—"}</td>
                        <td className="px-3 py-2 sticky left-0 z-10 max-w-[12rem]" style={{ background: "var(--color-surface-raised)" }}>
                          <div className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{r.studentName}</div>
                          <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{r.admissionNumber || r.studentId}</div>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{r.maxMarks}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              ref={(el) => (inputs.current[i] = el)}
                              value={r.obtainedInput}
                              onChange={(e) => edit(r.studentId, { obtained: e.target.value })}
                              onKeyDown={(e) => onKey(e, i)}
                              disabled={r.lockedRow}
                              inputMode="decimal"
                              aria-label={`Marks for ${r.studentName}`}
                              aria-invalid={!!r.err}
                              className="input w-20 text-center"
                              style={r.err ? { borderColor: "var(--color-danger)" } : undefined}
                            />
                            {!r.lockedRow && r.obtainedInput !== "" && (
                              <button type="button" aria-label={`Clear marks for ${r.studentName}`} onClick={() => edit(r.studentId, { obtained: "" })} className="p-1 rounded hover:bg-black/5" style={{ color: "var(--color-text-muted)" }}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                          {r.err && <div className="text-[10px] mt-0.5" style={{ color: "var(--color-danger)" }}>{r.err}</div>}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{pctText(r.livePct)}</td>
                        <td className="px-3 py-2">{r.liveGrade || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{r.dirty ? "…" : r.rank || "—"}</td>
                        <td className="px-3 py-2">
                          <input
                            value={r.remarksInput}
                            onChange={(e) => edit(r.studentId, { remarks: e.target.value })}
                            disabled={r.lockedRow}
                            maxLength={200}
                            aria-label={`Remarks for ${r.studentName}`}
                            className="input min-w-[9rem]"
                          />
                        </td>
                        <td className="px-3 py-2"><StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={History} onClick={openHistory}>History ({sheet.historyCount})</Button>
            <Button variant="secondary" size="sm" icon={FileDown} loading={busy === "pdf"} onClick={() => download("pdf")}>PDF</Button>
            <Button variant="secondary" size="sm" icon={FileDown} loading={busy === "docx"} onClick={() => download("docx")}>DOCX</Button>
            {sheet.permissions.canRecall && <Button variant="secondary" size="sm" icon={Undo2} loading={busy === "recall"} onClick={() => changeStatus("recall")}>Recall to Draft</Button>}
            {sheet.permissions.canUnpublish && <Button variant="danger" size="sm" icon={Undo2} onClick={() => { setReason(""); setReasonFor("unpublish"); }}>Unpublish</Button>}
          </div>

          {sheet.permissions.canEdit || sheet.permissions.canSubmit || sheet.permissions.canPublish ? (
            <div className="fixed sm:static bottom-0 inset-x-0 z-20 p-3 sm:p-0 border-t sm:border-0 flex flex-wrap gap-2 justify-end" style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-subtle)" }}>
              {dirtyRows.length > 0 && <Button variant="ghost" icon={RotateCcw} onClick={() => setEdits({})}>Reset</Button>}
              {sheet.permissions.canEdit && (
                <Button icon={Save} loading={busy === "save"} onClick={() => save()} disabled={dirtyRows.length === 0}>
                  Save {dirtyRows.length ? `(${dirtyRows.length})` : "Draft"}
                </Button>
              )}
              {sheet.permissions.canSubmit && <Button variant="secondary" icon={Send} loading={busy === "submit"} onClick={() => setConfirm("submit")}>Submit</Button>}
              {sheet.permissions.canPublish && <Button variant="secondary" icon={Globe} loading={busy === "publish"} onClick={() => setConfirm("publish")}>Publish</Button>}
            </div>
          ) : null}
        </>
      ) : null}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === "publish" ? "Publish marks?" : "Submit marks?"}>
        {sheet && confirm && (
          <div className="space-y-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <p>
              {confirm === "publish"
                ? "Published marks become visible to students and their parents, who are notified."
                : "Submitted marks are ready for review. You can still recall them to draft until they are published."}
            </p>
            {sheet.stats.notEntered > 0 && (
              <p style={{ color: "var(--color-warning)" }}>{sheet.stats.notEntered} student(s) have no marks entered and will not be included.</p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button className="flex-1" loading={busy === confirm} onClick={() => changeStatus(confirm)}>{confirm === "publish" ? "Publish" : "Submit"}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!reasonFor} onClose={() => setReasonFor(null)} title={reasonFor === "unpublish" ? "Unpublish marks" : "Reason for change"}>
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {reasonFor === "unpublish"
              ? "The marks will be hidden from students and parents and returned to draft."
              : "Some of these marks were already submitted or published. The reason is kept in the history."}
          </p>
          <textarea rows={3} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" aria-label="Reason" />
          <Button
            className="w-full"
            loading={busy === "save" || busy === "unpublish"}
            disabled={reason.trim().length < 3}
            onClick={() => (reasonFor === "unpublish" ? changeStatus("unpublish", reason.trim()) : save(reason.trim()))}
          >
            Confirm
          </Button>
        </div>
      </Modal>

      <Modal open={history !== null} onClose={() => setHistory(null)} title="Marks history" width="max-w-2xl">
        {history && history.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No history yet.</p>
        ) : (
          <div className="space-y-1.5">
            {(history || []).map((h) => (
              <div key={h.id} className="rounded-lg p-2.5 text-xs" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}>
                <div className="flex flex-wrap justify-between gap-2">
                  <strong style={{ color: "var(--color-text-primary)" }}>{h.studentName}</strong>
                  <span>{new Date(h.changedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <div>
                  {h.action.replace("STATUS_", "").toLowerCase()} · {h.oldObtained ?? "—"} → {h.newObtained ?? "—"}
                  {h.oldStatus !== h.newStatus && ` · ${h.oldStatus || "—"} → ${h.newStatus || "removed"}`} · by {h.changedByName} ({h.changedByRole})
                </div>
                {h.reason && <div>Reason: {h.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
