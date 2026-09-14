import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, GraduationCap, Search, AlertTriangle } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

/**
 * Admin page for teaching assignments. These rows are what gate a Faculty
 * member's access: without one they cannot mark attendance or enter marks for
 * a subject, so this page is the difference between a working and a
 * locked-out faculty account.
 */
export default function FacultyAssignments() {
  const { push } = useToast();
  const [assignments, setAssignments] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    Promise.all([
      client.get("/faculty-assignments").then(({ data }) => setAssignments(data.assignments)),
      client.get("/faculty").then(({ data }) => setFaculty(data.faculty || [])),
      client.get("/academic-config").then(({ data }) => setConfig(data)),
    ]).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  // Group by faculty member so it reads as "who teaches what".
  const grouped = useMemo(() => {
    if (!assignments) return [];
    const term = q.trim().toLowerCase();
    const map = new Map();
    faculty.forEach((f) => map.set(f.id, { faculty: f, rows: [] }));
    assignments.forEach((a) => {
      if (!map.has(a.facultyId)) return;
      map.get(a.facultyId).rows.push(a);
    });
    return [...map.values()]
      .filter((g) => !term || g.faculty.name.toLowerCase().includes(term) || g.rows.some((r) => r.subjectName.toLowerCase().includes(term)))
      .sort((a, b) => b.rows.length - a.rows.length || a.faculty.name.localeCompare(b.faculty.name));
  }, [assignments, faculty, q]);

  const unassignedCount = grouped.filter((g) => g.rows.length === 0).length;

  async function remove() {
    setBusy(true);
    try {
      await client.delete(`/faculty-assignments/${deleting.id}`);
      push("Assignment removed.", "success");
      setDeleting(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not remove the assignment.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load teaching assignments." onRetry={load} />;
  if (!assignments || !config) return <Loader full label="Loading assignments…" />;

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-4">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          A faculty member can only mark attendance and enter marks for the subjects assigned here. This is enforced
          on the server, not just hidden in their interface.
        </p>
      </div>

      {unassignedCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl p-3.5" style={{ background: "var(--color-warning-subtle)" }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <strong>{unassignedCount}</strong> faculty {unassignedCount === 1 ? "member has" : "members have"} no
            subjects assigned. They can sign in, but cannot mark attendance or enter marks until you assign them.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search faculty or subject…" className="input pl-9" />
        </div>
        <Button icon={Plus} onClick={() => setAddOpen(true)}>Assign Subject</Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No faculty match" description="Try a different search." />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ faculty: f, rows }) => (
            <div key={f.id} className="glass glow-card rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
                <div className="min-w-0">
                  <span className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{f.name}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--color-text-muted)" }}>{f.id}</span>
                </div>
                <StatusBadge tone={rows.length ? "success" : "warning"}>
                  {rows.length ? `${rows.length} subject${rows.length === 1 ? "" : "s"}` : "Not assigned"}
                </StatusBadge>
              </div>
              {rows.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  No teaching assignments yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rows.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-2 text-xs pl-2.5 pr-1.5 py-1.5 rounded-lg"
                      style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-primary)" }}
                    >
                      <span>
                        {a.subjectName}
                        {a.className && <span style={{ color: "var(--color-text-muted)" }}> · {a.className}</span>}
                        {a.sectionName && <span style={{ color: "var(--color-text-muted)" }}> · {a.sectionName}</span>}
                      </span>
                      <button
                        onClick={() => setDeleting(a)}
                        aria-label={`Remove ${a.subjectName} from ${f.name}`}
                        className="p-1 rounded hover:bg-red-500/10 text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AssignModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        faculty={faculty}
        config={config}
        onSaved={() => { setAddOpen(false); load(); }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        message={
          deleting
            ? `Remove ${deleting.subjectName} from ${deleting.facultyName}? They will immediately lose access to mark attendance and enter marks for it.`
            : ""
        }
      />
    </div>
  );
}

function AssignModal({ open, onClose, faculty, config, onSaved }) {
  const { push } = useToast();
  const [facultyId, setFacultyId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setFacultyId(""); setSubjectId(""); setClassId(""); setSectionId(""); }
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post("/faculty-assignments", { facultyId, subjectId, classId, sectionId });
      push("Subject assigned.", "success");
      onSaved();
    } catch (err) {
      push(err.response?.data?.error || "Could not assign the subject.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Subject to Faculty">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Faculty member *</label>
          <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} className="input" required>
            <option value="">Select…</option>
            {faculty.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Subject *</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input" required>
            <option value="">Select…</option>
            {config.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input">
              <option value="">All classes</option>
              {config.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input">
              <option value="">All sections</option>
              {config.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs rounded-lg p-2.5" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}>
          Leaving class blank assigns the subject across all classes. Assigning a class is also what decides which
          students this faculty member can see.
        </p>
        <Button type="submit" loading={saving} className="w-full">Assign</Button>
      </form>
    </Modal>
  );
}
