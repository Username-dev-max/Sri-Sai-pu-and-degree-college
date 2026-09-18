import { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{label}</span>
        {hint && <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>{hint}</span>}
      </span>
    </label>
  );
}

function Num({ label, id, value, onChange, min, max, step = 1 }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      <input id={id} type="number" className="input" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
    </div>
  );
}

/** Admin: the college's attendance and marks policy. */
export default function AcademicPolicies() {
  const { push } = useToast();
  const [s, setS] = useState(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState("");

  function load() {
    setError(false);
    client.get("/settings/academic").then(({ data }) => setS(data.settings)).catch(() => setError(true));
  }
  useEffect(load, []);

  const att = (patch) => setS((x) => ({ ...x, attendance: { ...x.attendance, ...patch } }));
  const mk = (patch) => setS((x) => ({ ...x, marks: { ...x.marks, ...patch } }));

  async function save() {
    setSaving(true);
    try {
      const { data } = await client.put("/settings/academic", s);
      setS(data.settings);
      push("Policy saved.", "success");
    } catch (e) {
      push(e.response?.data?.error || "Could not save the policy.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the policy." onRetry={load} />;
  if (!s) return <Loader full label="Loading…" />;

  return (
    <div className="space-y-5 max-w-3xl pb-6">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
        These rules drive every attendance percentage, low-attendance alert, grade and permission in the system. Starting
        values are suggestions — set them to match the college's own regulations. Every change is recorded in the audit log.
      </p>

      <section className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Attendance</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Num label="Low-attendance threshold (%)" id="p-thr" value={s.attendance.lowThreshold} min={0} max={100} onChange={(v) => att({ lowThreshold: v })} />
          <Num label="Periods per day" id="p-per" value={s.attendance.periodsPerDay} min={1} max={12} onChange={(v) => att({ periodsPerDay: v })} />
        </div>
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Approved leave in the percentage</legend>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <input type="radio" name="leave" checked={s.attendance.leaveInDenominator} onChange={() => att({ leaveInDenominator: true })} />
            Count leave as a class held: Present ÷ (Present + Absent + Leave)
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <input type="radio" name="leave" checked={!s.attendance.leaveInDenominator} onChange={() => att({ leaveInDenominator: false })} />
            Exclude approved leave: Present ÷ (Present + Absent)
          </label>
        </fieldset>
        <Toggle label="Attendance Staff can mark attendance" checked={s.attendance.staffCanMark} onChange={(v) => att({ staffCanMark: v })} />
        <Toggle label="Attendance Staff can correct recorded attendance" checked={s.attendance.staffCanEdit} onChange={(v) => att({ staffCanEdit: v })} />
        <Toggle label="Faculty can correct attendance for their assigned classes" hint="Corrections always need a reason and are kept in history." checked={s.attendance.facultyCanEdit} onChange={(v) => att({ facultyCanEdit: v })} />
      </section>

      <section className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Internal marks</h3>
        <div className="sm:max-w-xs">
          <Num label="Pass percentage" id="p-pass" value={s.marks.passPercentage} min={0} max={100} onChange={(v) => mk({ passPercentage: v })} />
        </div>
        <Toggle label="Faculty can publish marks" hint="When off, only an administrator publishes marks to students and parents." checked={s.marks.facultyCanPublish} onChange={(v) => mk({ facultyCanPublish: v })} />
        <Toggle label="Attendance Staff can view published marks" checked={s.marks.staffCanView} onChange={(v) => mk({ staffCanView: v })} />

        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Grade scale (lowest percentage for each grade)</div>
          <div className="space-y-2">
            {s.marks.gradeScale.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input w-24" aria-label="Grade" value={b.grade} onChange={(e) => mk({ gradeScale: s.marks.gradeScale.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)) })} />
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>from</span>
                <input className="input w-24" type="number" min={0} max={100} aria-label="Minimum percentage" value={b.min} onChange={(e) => mk({ gradeScale: s.marks.gradeScale.map((x, j) => (j === i ? { ...x, min: e.target.value === "" ? "" : Number(e.target.value) } : x)) })} />
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>%</span>
                <button aria-label="Remove band" onClick={() => mk({ gradeScale: s.marks.gradeScale.filter((_, j) => j !== i) })} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-600"><Trash2 size={15} /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => mk({ gradeScale: [...s.marks.gradeScale, { grade: "", min: 0 }] })}>Add band</Button>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>Exam types</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {s.marks.examTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-secondary)" }}>
                {t}
                <button aria-label={`Remove ${t}`} onClick={() => mk({ examTypes: s.marks.examTypes.filter((x) => x !== t) })}><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 sm:max-w-md">
            <input className="input" value={newType} placeholder="Add exam type" onChange={(e) => setNewType(e.target.value)} aria-label="New exam type" />
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => { if (newType.trim()) { mk({ examTypes: [...new Set([...s.marks.examTypes, newType.trim()])] }); setNewType(""); } }}>Add</Button>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button icon={Save} loading={saving} onClick={save}>Save Policy</Button>
      </div>
    </div>
  );
}
