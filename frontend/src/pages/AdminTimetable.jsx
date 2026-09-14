import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Plus, Trash2, Send, Upload, FileText, Undo2, AlertTriangle } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AdminTimetable() {
  const { push } = useToast();
  const fileRef = useRef(null);

  const [config, setConfig] = useState(null);
  const [entries, setEntries] = useState(null);
  const [publications, setPublications] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [error, setError] = useState(false);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingPdf, setPendingPdf] = useState(null);

  const load = useCallback(() => {
    setError(false);
    Promise.all([
      client.get("/academic-config").then(({ data }) => setConfig(data)),
      client.get("/timetable").then(({ data }) => setEntries(data.timetable)),
      client.get("/timetable/publications").then(({ data }) => setPublications(data.publications)),
      client.get("/faculty").then(({ data }) => setFaculty(data.faculty || [])),
    ]).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (config && !classId && config.classes.length) setClassId(config.classes[0].id);
  }, [config, classId]);

  const shown = useMemo(
    () => (entries || []).filter((e) => e.classId === classId && (e.sectionId || "") === sectionId),
    [entries, classId, sectionId]
  );

  const publication = publications.find((p) => p.classId === classId && (p.sectionId || "") === sectionId);

  async function remove() {
    setBusy(true);
    try {
      await client.delete(`/timetable/${deleting.id}`);
      push("Entry removed.", "success");
      setDeleting(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not remove the entry.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function pickPdf(file) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await client.post("/uploads/private", fd);
      setPendingPdf({ storedName: data.storedName, fileName: file.name });
      push(`${file.name} ready to publish.`, "success");
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the PDF.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const { data } = await client.post("/timetable/publish", {
        classId,
        sectionId,
        storedName: pendingPdf?.storedName,
        fileName: pendingPdf?.fileName,
      });
      push(`Published. ${data.notified} ${data.notified === 1 ? "person was" : "people were"} notified.`, "success");
      setPendingPdf(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not publish.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      await client.post("/timetable/unpublish", { id: publication.id });
      push("Timetable withdrawn. Students can no longer see it.", "success");
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not withdraw.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the timetable." onRetry={load} />;
  if (!config || !entries) return <Loader full label="Loading timetable…" />;

  const className = config.classes.find((c) => c.id === classId)?.name || "";

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-4">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Entries you add here are a draft. Students, parents and faculty see nothing until you publish the timetable
          for that class.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input w-auto" aria-label="Class">
          {config.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input w-auto" aria-label="Section">
          <option value="">All sections</option>
          {config.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <StatusBadge tone={publication?.published ? "success" : "neutral"}>
          {publication?.published ? "Published" : "Draft"}
        </StatusBadge>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button variant="secondary" icon={Upload} disabled={busy} onClick={() => fileRef.current?.click()}>
            {pendingPdf ? "PDF attached" : "Attach PDF"}
          </Button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => pickPdf(e.target.files?.[0])} />
          <Button icon={Plus} onClick={() => setAddOpen(true)}>Add Period</Button>
          {publication?.published ? (
            <Button variant="secondary" icon={Undo2} loading={busy} onClick={unpublish}>Withdraw</Button>
          ) : (
            <Button icon={Send} loading={busy} onClick={publish} disabled={shown.length === 0 && !pendingPdf}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {pendingPdf && (
        <div className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: "var(--color-surface-sunken)" }}>
          <FileText size={15} className="text-blue-600" />
          <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{pendingPdf.fileName}</span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>will be attached when you publish</span>
          <button onClick={() => setPendingPdf(null)} className="ml-auto text-xs text-red-600 font-medium">Remove</button>
        </div>
      )}

      {publication?.published && publication.downloadUrl && (
        <div className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: "var(--color-success-subtle)" }}>
          <FileText size={15} style={{ color: "var(--color-success)" }} />
          <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
            An official PDF is attached to the published {className} timetable.
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`No periods for ${className} yet`}
          description="Add periods to build the weekly grid, or publish a PDF on its own."
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-white bg-blue-600 w-20">Period</th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-3 py-2.5 text-left font-semibold text-white bg-blue-600">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => {
                  const row = DAYS.map((d) => shown.find((e) => e.day === d && Number(e.period) === p));
                  if (row.every((c) => !c)) return null;
                  return (
                    <tr key={p} className="border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
                      <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--color-text-primary)" }}>{p}</td>
                      {row.map((cell, i) => (
                        <td key={DAYS[i]} className="px-3 py-2.5 align-top">
                          {cell ? (
                            <div className="group">
                              <div className="font-medium" style={{ color: "var(--color-text-primary)" }}>{cell.subjectName}</div>
                              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                {cell.facultyName || "—"}
                                {cell.room && ` · ${cell.room}`}
                              </div>
                              {(cell.startTime || cell.endTime) && (
                                <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                                  {cell.startTime}–{cell.endTime}
                                </div>
                              )}
                              <button
                                onClick={() => setDeleting(cell)}
                                aria-label={`Remove ${cell.subjectName} on ${cell.day} period ${cell.period}`}
                                className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-red-600"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "var(--color-text-muted)" }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddPeriodModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        config={config}
        faculty={faculty}
        classId={classId}
        sectionId={sectionId}
        onSaved={() => { setAddOpen(false); load(); }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        message={deleting ? `Remove ${deleting.subjectName} from ${deleting.day} period ${deleting.period}?` : ""}
      />
    </div>
  );
}

function AddPeriodModal({ open, onClose, config, faculty, classId, sectionId, onSaved }) {
  const { push } = useToast();
  const [form, setForm] = useState({ day: "Monday", period: 1, subject: "", faculty: "", room: "", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm({ day: "Monday", period: 1, subject: "", faculty: "", room: "", startTime: "", endTime: "" });
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post("/timetable", { ...form, classId, sectionId });
      push("Period added.", "success");
      onSaved();
    } catch (err) {
      push(err.response?.data?.error || "Could not add the period.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Period">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Day *</label>
            <select value={form.day} onChange={(e) => set("day", e.target.value)} className="input">
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Period *</label>
            <select value={form.period} onChange={(e) => set("period", Number(e.target.value))} className="input">
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject *</label>
            <select value={form.subject} onChange={(e) => set("subject", e.target.value)} className="input" required>
              <option value="">Select…</option>
              {config.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Faculty</label>
            <select value={form.faculty} onChange={(e) => set("faculty", e.target.value)} className="input">
              <option value="">Not assigned</option>
              {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start time</label>
            <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End time</label>
            <input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Room</label>
            <input value={form.room} onChange={(e) => set("room", e.target.value)} className="input" />
          </div>
        </div>
        <p className="flex items-start gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <AlertTriangle size={13} className="shrink-0 mt-px" />
          Double-bookings are rejected: one class cannot have two lessons in a period, and one teacher cannot be in
          two classes at once.
        </p>
        <Button type="submit" loading={saving} className="w-full">Add Period</Button>
      </form>
    </Modal>
  );
}
