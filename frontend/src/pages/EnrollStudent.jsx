import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, UserRound, GraduationCap, FileText,
  Upload, X, ShieldCheck, Loader2,
} from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import Button from "../components/Button";
import CredentialsModal from "../components/CredentialsModal";

const STEPS = [
  { id: 1, label: "Personal", icon: UserRound },
  { id: 2, label: "Academic", icon: GraduationCap },
  { id: 3, label: "Documents", icon: FileText },
  { id: 4, label: "Review", icon: ShieldCheck },
];

const DOC_TYPES = [
  "Student Photo",
  "SSLC / 10th Marks Card",
  "Transfer Certificate",
  "Aadhaar",
  "ID Proof",
  "Caste / Income Certificate",
  "Other",
];

/**
 * Labelled form field. The label is bound to its control with htmlFor/id so
 * screen readers announce it and clicking the label focuses the input — the
 * control is cloned to receive the generated id.
 */
function Field({ label, required, children, hint }) {
  const id = useId();
  const control = isValidElement(children) ? cloneElement(children, { id }) : children;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {control}
      {hint && <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
    </div>
  );
}

export default function EnrollStudent() {
  const { push } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [config, setConfig] = useState(null);
  const [error, setError] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);

  const [form, setForm] = useState({
    admissionNumber: "", name: "", dob: "", gender: "", phone: "", email: "", address: "",
    bloodGroup: "", category: "", guardian: "", guardianPhone: "", emergencyContact: "",
    academicYearId: "", levelId: "", stream: "", course: "", classId: "", section: "",
    rollNumber: "", department: "", createAccount: true,
  });
  const [documents, setDocuments] = useState([]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    client
      .get("/academic-config")
      .then(({ data }) => {
        setConfig(data);
        const current = data.academicYears.find((y) => y.isCurrent) || data.academicYears[0];
        if (current) set("academicYearId", current.id);
      })
      .catch(() => setError(true));
  }, []);

  /* ------------------- the cascade: level -> stream -> combination ------- */
  const level = useMemo(
    () => config?.levels.find((l) => l.id === form.levelId) || null,
    [config, form.levelId]
  );
  const streams = useMemo(
    () => (config && level?.hasStreams ? config.streams.filter((s) => s.levelId === level.id) : []),
    [config, level]
  );
  const combinations = useMemo(() => {
    if (!config || !form.levelId) return [];
    return config.combinations.filter(
      (c) => c.levelId === form.levelId && (!level?.hasStreams || c.stream === form.stream)
    );
  }, [config, form.levelId, form.stream, level]);
  const classes = useMemo(
    () => (config && form.levelId ? config.classes.filter((c) => c.levelId === form.levelId) : []),
    [config, form.levelId]
  );
  const chosenCombination = combinations.find((c) => c.id === form.course) || null;

  async function uploadDoc(file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await client.post("/uploads/private", fd);
      setDocuments((d) => [...d, { type: docType, name: file.name, storedName: data.storedName }]);
      push(`${docType} attached.`, "success");
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the document.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function validate(target) {
    if (target > 1) {
      if (!form.name.trim()) return "Student name is required.";
      if (!form.dob) return "Date of birth is required.";
      if (!form.gender) return "Gender is required.";
    }
    if (target > 2) {
      if (!form.levelId) return "Select a course.";
      if (level?.hasStreams && !form.stream) return "Select a stream.";
      if (!form.course) return "Select a combination or program.";
    }
    return null;
  }

  function go(target) {
    const problem = validate(target);
    if (problem) return push(problem, "error");
    setStep(target);
  }

  async function submit() {
    const problem = validate(3);
    if (problem) return push(problem, "error");
    setSaving(true);
    try {
      // Enrollment and account creation are two deliberate steps. Strip
      // `createAccount` from the enroll call so the server does not also
      // create the account — this page issues it explicitly below.
      const { createAccount, ...enrollment } = form;
      const { data } = await client.post("/students", { ...enrollment, documents: [] });
      // Documents are registered against the student once it has an id.
      for (const d of documents) {
        await client.post("/documents", {
          ownerType: "student",
          ownerId: data.student.id,
          type: d.type,
          name: d.name,
          storedName: d.storedName,
        });
      }
      if (createAccount) {
        const acc = await client.post(`/students/${data.student.id}/account`);
        setCredentials({ ...acc.data.credentials, personName: data.student.name });
      } else {
        push(`${data.student.name} enrolled. Create their login account when ready.`, "success");
        navigate("/admin/students");
      }
    } catch (err) {
      push(err.response?.data?.error || "Could not complete the enrollment.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load the academic setup." onRetry={() => window.location.reload()} />;
  if (!config) return <Loader full label="Loading academic setup…" />;

  if (config.academicYears.length === 0) {
    return (
      <ErrorState
        full
        message="No academic year is configured. Add one under Academic Setup before enrolling students."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* stepper */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between gap-1">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none min-w-0">
                <button
                  onClick={() => (s.id < step ? setStep(s.id) : go(s.id))}
                  className="flex items-center gap-2 min-w-0"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors"
                    style={{
                      background: done ? "var(--color-success)" : active ? "var(--color-brand-600)" : "var(--color-surface-sunken)",
                      color: done || active ? "#fff" : "var(--color-text-muted)",
                    }}
                  >
                    {done ? <Check size={14} /> : <s.icon size={14} />}
                  </span>
                  <span
                    className="text-xs font-semibold hidden sm:block truncate"
                    style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-2" style={{ background: done ? "var(--color-success)" : "var(--color-border-default)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22 }}
          className="glass rounded-2xl p-5 sm:p-6 space-y-4"
        >
          {step === 1 && (
            <>
              <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Personal Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Admission Number" hint="Leave blank to auto-generate from the student ID.">
                  <input value={form.admissionNumber} onChange={(e) => set("admissionNumber", e.target.value)} className="input" />
                </Field>
                <Field label="Student Name" required>
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" required />
                </Field>
                <Field label="Date of Birth" required>
                  <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className="input" required />
                </Field>
                <Field label="Gender" required>
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="input" required>
                    <option value="">Select…</option>
                    <option>Female</option><option>Male</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Mobile Number">
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" inputMode="tel" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input" />
                </Field>
                <Field label="Blood Group">
                  <input value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} className="input" />
                </Field>
                <Field label="Category">
                  <input value={form.category} onChange={(e) => set("category", e.target.value)} className="input" placeholder="e.g. General, SC, ST, OBC" />
                </Field>
              </div>
              <Field label="Address">
                <textarea value={form.address} onChange={(e) => set("address", e.target.value)} className="input" rows={2} />
              </Field>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Parent / Guardian Name">
                  <input value={form.guardian} onChange={(e) => set("guardian", e.target.value)} className="input" />
                </Field>
                <Field label="Parent Mobile">
                  <input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} className="input" inputMode="tel" />
                </Field>
                <Field label="Emergency Contact">
                  <input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} className="input" inputMode="tel" />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Academic Placement</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Academic Year" required>
                  <select value={form.academicYearId} onChange={(e) => set("academicYearId", e.target.value)} className="input">
                    {config.academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.label}{y.isCurrent ? " (current)" : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Course" required>
                  <select
                    value={form.levelId}
                    onChange={(e) => { set("levelId", e.target.value); set("stream", ""); set("course", ""); set("classId", ""); }}
                    className="input"
                  >
                    <option value="">Select a course…</option>
                    {config.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </Field>

                {level?.hasStreams && (
                  <Field label="Stream" required>
                    <select value={form.stream} onChange={(e) => { set("stream", e.target.value); set("course", ""); }} className="input">
                      <option value="">Select a stream…</option>
                      {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                )}

                {form.levelId && (!level?.hasStreams || form.stream) && (
                  <Field
                    label={level?.hasStreams ? "Combination" : "Program"}
                    required
                    hint={combinations.length === 0 ? "None are enabled for this selection. Turn one on under Academic Setup." : undefined}
                  >
                    <select value={form.course} onChange={(e) => set("course", e.target.value)} className="input">
                      <option value="">Select…</option>
                      {combinations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                )}

                <Field label="Year / Class">
                  <select value={form.classId} onChange={(e) => set("classId", e.target.value)} className="input">
                    <option value="">Select…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Section" hint={config.sections.length === 0 ? "No sections configured yet." : undefined}>
                  <select value={form.section} onChange={(e) => set("section", e.target.value)} className="input">
                    <option value="">Select…</option>
                    {config.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Roll Number">
                  <input value={form.rollNumber} onChange={(e) => set("rollNumber", e.target.value)} className="input" />
                </Field>
                <Field label="Department" hint="Defaults to the combination's department if left blank.">
                  <select value={form.department} onChange={(e) => set("department", e.target.value)} className="input">
                    <option value="">Use default</option>
                    {config.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
              </div>

              {chosenCombination && (
                <div className="rounded-xl p-3.5" style={{ background: "var(--color-surface-sunken)" }}>
                  <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                    Subjects in {chosenCombination.name}
                  </div>
                  {chosenCombination.subjects.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      No subjects are mapped to this program yet. Add them under Academic Setup.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {chosenCombination.subjects.map((s) => (
                        <span key={s.id} className="text-[11px] px-2 py-1 rounded-lg bg-blue-600/10 text-blue-700">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Documents</h3>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Uploaded documents are stored privately. They are never served from a public URL — only the
                student, their linked parent and administrators can download them.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Document type">
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-auto">
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  icon={uploading ? Loader2 : Upload}
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Choose file"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => uploadDoc(e.target.files?.[0])}
                />
              </div>

              {documents.length === 0 ? (
                <p className="text-sm py-6 text-center rounded-xl" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}>
                  No documents attached yet. This step is optional — you can add them later.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((d, i) => (
                    <div key={d.storedName} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--color-surface-sunken)" }}>
                      <FileText size={15} className="text-blue-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{d.type}</div>
                        <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{d.name}</div>
                      </div>
                      <button
                        onClick={() => setDocuments((prev) => prev.filter((_, x) => x !== i))}
                        aria-label={`Remove ${d.type}`}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-600 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Review &amp; Confirm</h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {[
                  ["Name", form.name],
                  ["Admission No.", form.admissionNumber || "auto-generated"],
                  ["Date of Birth", form.dob],
                  ["Gender", form.gender],
                  ["Mobile", form.phone || "—"],
                  ["Email", form.email || "—"],
                  ["Academic Year", config.academicYears.find((y) => y.id === form.academicYearId)?.label || "—"],
                  ["Course", level?.name || "—"],
                  ["Stream", streams.find((s) => s.id === form.stream)?.name || "—"],
                  ["Combination", chosenCombination?.name || "—"],
                  ["Class", classes.find((c) => c.id === form.classId)?.name || "—"],
                  ["Section", config.sections.find((s) => s.id === form.section)?.name || "—"],
                  ["Roll Number", form.rollNumber || "—"],
                  ["Guardian", form.guardian || "—"],
                  ["Documents", `${documents.length} attached`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b pb-1.5" style={{ borderColor: "var(--color-border-subtle)" }}>
                    <dt style={{ color: "var(--color-text-muted)" }}>{k}</dt>
                    <dd className="font-medium text-right truncate" style={{ color: "var(--color-text-primary)" }}>{v}</dd>
                  </div>
                ))}
              </dl>

              <label className="flex items-start gap-2.5 rounded-xl p-3.5 cursor-pointer" style={{ background: "var(--color-surface-sunken)" }}>
                <input
                  type="checkbox"
                  checked={form.createAccount}
                  onChange={(e) => set("createAccount", e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Create the student's login account now and show me the temporary credentials.
                  <span className="block text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Leave this unticked to enroll only — you can issue credentials later from Accounts.
                  </span>
                </span>
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" icon={ArrowLeft} disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < 4 ? (
          <Button onClick={() => go(step + 1)}>
            Continue <ArrowRight size={15} />
          </Button>
        ) : (
          <Button onClick={submit} loading={saving} icon={Check}>
            {saving ? "Enrolling…" : "Complete Enrollment"}
          </Button>
        )}
      </div>

      <CredentialsModal
        open={!!credentials}
        credentials={credentials}
        personName={credentials?.personName || ""}
        mode="enroll"
        onClose={() => navigate("/admin/students")}
      />
    </div>
  );
}
