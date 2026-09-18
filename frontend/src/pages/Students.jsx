import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, KeyRound } from "lucide-react";
import client from "../api/client";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CredentialsModal from "../components/CredentialsModal";
import Loader from "../components/Loader";
import TiltCard from "../components/TiltCard";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableTd } from "../components/Table";

const BLANK = { name: "", gender: "Male", dob: "", email: "", phone: "", address: "", department: "", course: "", semester: 1, guardian: "", guardianPhone: "" };

export default function Students() {
  const { departments, courses, deptName, courseName } = useData();
  const { push } = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [creds, setCreds] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get("/students");
      setStudents(data.students);
    } catch (e) {
      push(e.response?.data?.error || "Failed to load students.", "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query) return students;
    const q = query.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [students, query]);

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setModalOpen(true);
  }
  function openEdit(s) {
    setEditing(s);
    setForm({ ...s });
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.put(`/students/${editing.id}`, form);
        push("Student updated.", "success");
        setModalOpen(false);
      } else {
        const { data } = await client.post("/students", form);
        push("Student enrolled successfully!", "success");
        setModalOpen(false);
        setCreds({ credentials: data.credentials, name: data.student.name });
      }
      load();
    } catch (e2) {
      push(e2.response?.data?.error || "Could not save student.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmReset() {
    setResetting(true);
    try {
      const { data } = await client.post(`/students/${resetTarget.id}/reset-credentials`);
      push("Credentials reset.", "success");
      setCreds({ credentials: data.credentials, name: resetTarget.name, mode: "reset" });
      setResetTarget(null);
    } catch (e) {
      push(e.response?.data?.error || "Could not reset credentials.", "error");
    } finally {
      setResetting(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await client.delete(`/students/${deleteTarget.id}`);
      push("Student removed.", "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      push(e.response?.data?.error || "Could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const courseOptions = courses.filter((c) => !form.department || c.department === form.department);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, email…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[var(--color-surface-raised)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
        </div>
        <Button icon={Plus} onClick={openAdd} className="sm:ml-auto">
          Enroll Student
        </Button>
      </div>

      <TiltCard intensity={2} className="glass rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <Loader label="Loading students…" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No students found." />
        ) : (
          <Table>
            <TableHead>
              <TableTh>ID</TableTh>
              <TableTh>Name</TableTh>
              <TableTh>Department</TableTh>
              <TableTh>Course</TableTh>
              <TableTh>Sem</TableTh>
              <TableTh>Status</TableTh>
              <TableTh />
            </TableHead>
            <TableBody>
              {filtered.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-blue-500/5 cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:-outline-offset-2"
                  onClick={() => setViewing(s)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View profile for ${s.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setViewing(s);
                    }
                  }}
                >
                  <TableTd className="font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>{s.id}</TableTd>
                  <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{s.name}</TableTd>
                  <TableTd>{deptName(s.department)}</TableTd>
                  <TableTd>{courseName(s.course)}</TableTd>
                  <TableTd>{s.semester}</TableTd>
                  <TableTd>
                    <StatusBadge tone={s.status === "Active" ? "success" : "danger"}>{s.status}</StatusBadge>
                  </TableTd>
                  <TableTd align="right" className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setResetTarget(s)} title="Reset Credentials" aria-label={`Reset credentials for ${s.name}`} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                      <KeyRound size={15} />
                    </button>
                    <button onClick={() => openEdit(s)} title="Edit" aria-label={`Edit ${s.name}`} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(s)} title="Delete" aria-label={`Delete ${s.name}`} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </TableTd>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </TiltCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Student" : "Enroll New Student"} width="max-w-2xl">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" required><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <Field label="Gender" required>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input">
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </Field>
          <Field label="Date of Birth" required><input required type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="input" /></Field>
          <Field label="Email" required><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
          <Field label="Phone" required><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          <Field label="Admission Status">
            <select value={form.status || "Active"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
              <option>Active</option><option>Inactive</option>
            </select>
          </Field>
          <Field label="Department" required>
            <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, course: "" })} className="input">
              <option value="" disabled>Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Course" required>
            <select required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className="input">
              <option value="" disabled>Select…</option>
              {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Semester" required>
            <select required value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} className="input">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Guardian Name"><input value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} className="input" /></Field>
          <Field label="Guardian Phone"><input value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} className="input" /></Field>
          <div className="sm:col-span-2">
            <Field label="Address"><textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving} className="w-full">
              {editing ? "Save Changes" : "Enroll Student"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Student Profile">
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xl font-bold">
                {viewing.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800">{viewing.name}</div>
                <div className="text-xs text-slate-500 font-mono">{viewing.id}</div>
              </div>
              <button
                onClick={() => { setResetTarget(viewing); setViewing(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 shrink-0"
              >
                <KeyRound size={13} /> Reset Credentials
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Email" value={viewing.email} />
              <Info label="Phone" value={viewing.phone} />
              <Info label="Gender" value={viewing.gender} />
              <Info label="Date of Birth" value={viewing.dob} />
              <Info label="Department" value={deptName(viewing.department)} />
              <Info label="Course" value={courseName(viewing.course)} />
              <Info label="Semester" value={viewing.semester} />
              <Info label="Admission Year" value={viewing.admissionYear} />
              <Info label="Guardian" value={viewing.guardian || "—"} />
              <Info label="Guardian Phone" value={viewing.guardianPhone || "—"} />
            </div>
            <Info label="Address" value={viewing.address || "—"} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        message="This will permanently remove the student and their login account."
      />

      <ConfirmDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={confirmReset}
        loading={resetting}
        message={`This will invalidate ${resetTarget?.name || "this student"}'s current password and issue a new one.`}
      />

      <CredentialsModal open={!!creds} onClose={() => setCreds(null)} credentials={creds?.credentials} personName={creds?.name} mode={creds?.mode} />
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}{required && " *"}</label>
      {children}
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-700 font-medium">{value}</div>
    </div>
  );
}
