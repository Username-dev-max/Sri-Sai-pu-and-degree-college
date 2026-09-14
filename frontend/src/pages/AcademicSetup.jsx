import { useCallback, useEffect, useState } from "react";
import { Layers, Check, X, CalendarDays, Plus, Star } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import Tabs from "../components/Tabs";

export default function AcademicSetup() {
  const { push } = useToast();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("combinations");
  const [busy, setBusy] = useState(null);
  const [subjectsFor, setSubjectsFor] = useState(null);
  const [yearOpen, setYearOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);

  const load = useCallback(() => {
    setError(false);
    client.get("/academic-config?all=1").then(({ data }) => setConfig(data)).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  async function toggle(c) {
    setBusy(c.id);
    try {
      await client.patch(`/academic-config/combinations/${c.id}`, { active: !c.active });
      push(`${c.name} ${c.active ? "disabled" : "enabled"}.`, "success");
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not update.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveSubjects(ids) {
    setBusy(subjectsFor.id);
    try {
      await client.put(`/academic-config/combinations/${subjectsFor.id}/subjects`, { subjects: ids });
      push("Subjects updated.", "success");
      setSubjectsFor(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not update subjects.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function setCurrentYear(y) {
    setBusy(y.id);
    try {
      await client.post(`/academic-config/academic-years/${y.id}/current`);
      push(`${y.label} is now the current academic year.`, "success");
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not update.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the academic setup." onRetry={load} />;
  if (!config) return <Loader full label="Loading academic setup…" />;

  const levelName = (id) => config.levels.find((l) => l.id === id)?.name || "—";
  const streamName = (id) => config.streams.find((s) => s.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        This decides what the enrollment form offers. Only combinations switched on here can be chosen for a student.
      </p>

      <Tabs
        tabs={[
          { key: "combinations", label: "Combinations & Programs" },
          { key: "years", label: "Academic Years" },
          { key: "structure", label: "Classes & Sections" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "combinations" && (
        <div className="space-y-3">
          {config.combinations.map((c) => (
            <div key={c.id} className="glass glow-card rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{c.name}</span>
                  <StatusBadge tone={c.active ? "success" : "neutral"}>{c.active ? "Offered" : "Not offered"}</StatusBadge>
                  <StatusBadge tone="info">{levelName(c.levelId)}</StatusBadge>
                  {c.stream && <StatusBadge tone="accent">{streamName(c.stream)}</StatusBadge>}
                </div>
                {c.fullName && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{c.fullName}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.subjects.length === 0 ? (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>No subjects mapped yet.</span>
                  ) : (
                    c.subjects.map((s) => (
                      <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-lg bg-blue-600/10 text-blue-700">{s.name}</span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setSubjectsFor(c)}>Subjects</Button>
                <Button
                  size="sm"
                  variant={c.active ? "secondary" : "primary"}
                  icon={c.active ? X : Check}
                  loading={busy === c.id}
                  onClick={() => toggle(c)}
                >
                  {c.active ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "years" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button icon={Plus} onClick={() => setYearOpen(true)}>Add Academic Year</Button>
          </div>
          {config.academicYears.map((y) => (
            <div key={y.id} className="glass glow-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <CalendarDays size={16} className="text-blue-600 shrink-0" />
                <span className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{y.label}</span>
                <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{y.startDate} → {y.endDate}</span>
                {y.isCurrent && <StatusBadge tone="success">Current</StatusBadge>}
              </div>
              {!y.isCurrent && (
                <Button size="sm" variant="secondary" icon={Star} loading={busy === y.id} onClick={() => setCurrentYear(y)}>
                  Set current
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "structure" && (
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <h3 className="text-sm font-semibold mb-2.5" style={{ color: "var(--color-text-primary)" }}>Classes</h3>
            <div className="space-y-2">
              {config.classes.map((c) => (
                <div key={c.id} className="glass rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{c.name}</span>
                  <StatusBadge tone="info">{levelName(c.levelId)}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Sections</h3>
              <Button size="sm" icon={Plus} onClick={() => setSectionOpen(true)}>Add</Button>
            </div>
            {config.sections.length === 0 ? (
              <p className="text-sm rounded-xl p-4 text-center" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}>
                No sections configured. Add the sections the college actually runs.
              </p>
            ) : (
              <div className="space-y-2">
                {config.sections.map((s) => (
                  <div key={s.id} className="glass rounded-xl p-3 text-sm" style={{ color: "var(--color-text-primary)" }}>{s.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <SubjectsModal
        combination={subjectsFor}
        allSubjects={config.subjects}
        onClose={() => setSubjectsFor(null)}
        onSave={saveSubjects}
        saving={!!busy}
      />
      <QuickAddModal
        open={yearOpen}
        onClose={() => setYearOpen(false)}
        title="Add Academic Year"
        endpoint="/academic-years"
        fields={[
          { name: "label", label: "Label", placeholder: "e.g. 2026-27", required: true },
          { name: "startDate", label: "Start date", type: "date" },
          { name: "endDate", label: "End date", type: "date" },
        ]}
        onSaved={() => { setYearOpen(false); load(); }}
      />
      <QuickAddModal
        open={sectionOpen}
        onClose={() => setSectionOpen(false)}
        title="Add Section"
        endpoint="/sections"
        fields={[{ name: "name", label: "Section name", placeholder: "e.g. A", required: true }]}
        onSaved={() => { setSectionOpen(false); load(); }}
      />
    </div>
  );
}

function SubjectsModal({ combination, allSubjects, onClose, onSave, saving }) {
  const [selected, setSelected] = useState([]);
  useEffect(() => {
    if (combination) setSelected(combination.subjects.map((s) => s.id));
  }, [combination]);

  return (
    <Modal open={!!combination} onClose={onClose} title={`Subjects — ${combination?.name || ""}`}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          These subjects are stored in the database and shown to students enrolled in this combination.
        </p>
        <div className="rounded-xl border max-h-72 overflow-y-auto" style={{ borderColor: "var(--color-border-default)" }}>
          {allSubjects.map((s) => (
            <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-blue-500/5">
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={(e) => setSelected((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))}
              />
              <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{s.name}</span>
              <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>{s.code}</span>
            </label>
          ))}
        </div>
        <Button className="w-full" loading={saving} onClick={() => onSave(selected)}>Save Subjects</Button>
      </div>
    </Modal>
  );
}

function QuickAddModal({ open, onClose, title, endpoint, fields, onSaved }) {
  const { push } = useToast();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setValues({}); }, [open]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post(endpoint, values);
      push(`${title.replace("Add ", "")} added.`, "success");
      onSaved();
    } catch (err) {
      push(err.response?.data?.error || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {f.label} {f.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={f.type || "text"}
              value={values[f.name] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className="input"
              placeholder={f.placeholder}
              required={f.required}
            />
          </div>
        ))}
        <Button type="submit" loading={saving} className="w-full">Save</Button>
      </form>
    </Modal>
  );
}
