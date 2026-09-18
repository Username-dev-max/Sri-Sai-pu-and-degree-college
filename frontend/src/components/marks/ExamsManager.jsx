import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Power, Trash2, ClipboardList } from "lucide-react";
import client from "../../api/client";
import { useToast } from "../../context/ToastContext";
import AcademicFilters from "../AcademicFilters";
import { subjectsFor } from "../../lib/academic";
import Loader from "../Loader";
import ErrorState from "../ErrorState";
import EmptyState from "../EmptyState";
import Button from "../Button";
import Modal from "../Modal";
import ConfirmDialog from "../ConfirmDialog";
import StatusBadge from "../StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../Table";

const BLANK = {
  name: "", type: "", academicYearId: "", levelId: "", classId: "", streamId: "", courseId: "", sectionId: "",
  semester: "", startDate: "", endDate: "", maxMarks: 25, subjectMaxMarks: {}, status: "ACTIVE",
};

function Field({ label, id, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

/** Admin: create and manage internal exams. */
export default function ExamsManager({ scope }) {
  const { push } = useToast();
  const [listFilter, setListFilter] = useState({ academicYearId: "", levelId: "", classId: "" });
  const [exams, setExams] = useState(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setError(false);
    client
      .get("/internal-marks/exams", { params: { academicYearId: listFilter.academicYearId || undefined, classId: listFilter.classId || undefined } })
      .then(({ data }) => setExams(data.exams))
      .catch(() => setError(true));
  }, [listFilter.academicYearId, listFilter.classId]);
  useEffect(load, [load]);

  const level = scope.levels.find((l) => l.id === form?.levelId);
  const subjects = useMemo(
    () => (form?.classId ? subjectsFor({ ...scope, teachable: null }, { levelId: form.levelId, streamId: form.streamId, classId: form.classId, courseId: form.courseId }) : []),
    [scope, form?.levelId, form?.streamId, form?.classId, form?.courseId]
  );

  function openNew() {
    setForm({ ...BLANK, academicYearId: listFilter.academicYearId, levelId: listFilter.levelId, classId: listFilter.classId, type: scope.settings.examTypes[0] || "", name: scope.settings.examTypes[0] || "" });
  }
  function openEdit(e) {
    const cls = scope.classes.find((c) => c.id === e.classId);
    const course = scope.courses.find((c) => c.id === e.courseId);
    setForm({ ...BLANK, ...e, levelId: cls?.levelId || "", streamId: course?.stream || "", semester: e.semester ?? "", subjectMaxMarks: e.subjectMaxMarks || {} });
  }

  async function submit(ev) {
    ev.preventDefault();
    setSaving(true);
    const body = {
      name: form.name, type: form.type || form.name, academicYearId: form.academicYearId, classId: form.classId, sectionId: form.sectionId || "",
      courseId: form.courseId || "", semester: form.semester === "" ? "" : Number(form.semester), startDate: form.startDate, endDate: form.endDate,
      maxMarks: Number(form.maxMarks), subjectMaxMarks: form.subjectMaxMarks, status: form.status,
    };
    try {
      if (form.id) await client.put(`/internal-marks/exams/${form.id}`, body);
      else await client.post("/internal-marks/exams", body);
      push(form.id ? "Exam updated." : "Exam created.", "success");
      setForm(null);
      load();
    } catch (e) {
      push(e.response?.data?.error || "Could not save the exam.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(e) {
    try {
      await client.patch(`/internal-marks/exams/${e.id}/status`, { status: e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      push(`${e.name} is now ${e.status === "ACTIVE" ? "inactive" : "active"}.`, "success");
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not change the status.", "error");
    }
  }

  async function remove() {
    try {
      await client.delete(`/internal-marks/exams/${deleteTarget.id}`);
      push("Exam deleted.", "success");
      setDeleteTarget(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not delete the exam.", "error");
      setDeleteTarget(null);
    }
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3">
        <AcademicFilters scope={scope} value={listFilter} onChange={setListFilter} mode="any" show={["academicYearId", "levelId", "classId"]} columns="sm:grid-cols-3" />
        <div className="flex justify-end">
          <Button icon={Plus} onClick={openNew}>Create Exam</Button>
        </div>
      </div>

      {error ? (
        <ErrorState message="Couldn't load exams." onRetry={load} />
      ) : !exams ? (
        <Loader label="Loading exams…" />
      ) : exams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No exams configured" description="Create an exam before faculty can enter internal marks." />
      ) : (
        <div className="glass rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHead>
              <TableTh>Exam</TableTh>
              <TableTh>Year</TableTh>
              <TableTh>Class</TableTh>
              <TableTh>Max</TableTh>
              <TableTh>Dates</TableTh>
              <TableTh>Marks</TableTh>
              <TableTh>Status</TableTh>
              <TableTh align="right">Actions</TableTh>
            </TableHead>
            <TableBody>
              {exams.map((e) => (
                <TableRow key={e.id}>
                  <TableTd className="font-medium">
                    {e.name}
                    <span className="block text-[11px]" style={{ color: "var(--color-text-muted)" }}>{e.id} · by {e.createdByName}</span>
                  </TableTd>
                  <TableTd>{e.academicYearLabel}</TableTd>
                  <TableTd>{e.className}{e.sectionName ? ` ${e.sectionName}` : ""}{e.courseName ? ` · ${e.courseName}` : ""}{e.semester ? ` · Sem ${e.semester}` : ""}</TableTd>
                  <TableTd>{e.maxMarks}{Object.keys(e.subjectMaxMarks || {}).length ? " (+ per subject)" : ""}</TableTd>
                  <TableTd>{e.startDate || "—"}{e.endDate ? ` → ${e.endDate}` : ""}</TableTd>
                  <TableTd>{e.marksCount}</TableTd>
                  <TableTd><StatusBadge tone={e.status === "ACTIVE" ? "success" : "neutral"}>{e.status}</StatusBadge></TableTd>
                  <TableTd align="right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(e)} aria-label={`Edit ${e.name}`} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600"><Pencil size={15} /></button>
                      <button onClick={() => toggle(e)} aria-label={`${e.status === "ACTIVE" ? "Deactivate" : "Activate"} ${e.name}`} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-600"><Power size={15} /></button>
                      {e.marksCount === 0 && (
                        <button onClick={() => setDeleteTarget(e)} aria-label={`Delete ${e.name}`} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-600"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit exam" : "Create exam"} width="max-w-2xl">
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Exam type" id="ex-type">
                <select id="ex-type" className="input" value={form.type} onChange={(e) => set({ type: e.target.value, name: form.name && form.name !== form.type ? form.name : e.target.value })}>
                  {scope.settings.examTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Exam name *" id="ex-name">
                <input id="ex-name" className="input" required maxLength={80} value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
            </div>
            <AcademicFilters
              scope={scope}
              value={form}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
              mode="any"
              show={["academicYearId", "levelId", "classId", "streamId", "courseId", "sectionId"]}
              columns="sm:grid-cols-2"
            />
            <div className="grid sm:grid-cols-4 gap-3">
              {level && !level.hasStreams && (
                <Field label="Semester" id="ex-sem">
                  <select id="ex-sem" className="input" value={form.semester} onChange={(e) => set({ semester: e.target.value })}>
                    <option value="">—</option>
                    {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Start date" id="ex-start"><input id="ex-start" type="date" className="input" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
              <Field label="End date" id="ex-end"><input id="ex-end" type="date" className="input" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
              <Field label="Default max marks *" id="ex-max"><input id="ex-max" type="number" min="1" max="1000" step="0.5" required className="input" value={form.maxMarks} onChange={(e) => set({ maxMarks: e.target.value })} /></Field>
            </div>
            {form.classId && subjects.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Maximum marks per subject (leave blank to use the default)</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}>
                      <span className="flex-1 min-w-0 truncate">{s.name}</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="0.5"
                        className="input w-24"
                        placeholder={String(form.maxMarks || "")}
                        value={form.subjectMaxMarks[s.id] ?? ""}
                        onChange={(e) => set({ subjectMaxMarks: { ...form.subjectMaxMarks, [s.id]: e.target.value } })}
                        aria-label={`Maximum marks for ${s.name}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Field label="Status" id="ex-status">
              <select id="ex-status" className="input sm:max-w-xs" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
            <Button type="submit" loading={saving} className="w-full">{form.id ? "Save Exam" : "Create Exam"}</Button>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={remove} message={`Delete ${deleteTarget?.name}? No marks have been entered for it.`} />
    </div>
  );
}
