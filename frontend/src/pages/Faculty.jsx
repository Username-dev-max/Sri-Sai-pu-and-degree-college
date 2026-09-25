import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, KeyRound , Upload, UserRound } from "lucide-react";
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
import { Table, TableHead, TableTh, TableBody, TableTd } from "../components/Table";

const BLANK = { name: "", email: "", phone: "", department: "", designation: "", qualification: "", experience: "", photoUrl: "" };

export default function Faculty() {
  const { departments, deptName, refresh } = useData();
  const { push } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const photoRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /* The photograph is stored in the public bucket, the same place the
     directory reads it from, so a face appears on the card immediately. */
  async function pickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const { data } = await client.post("/uploads", body);
      setForm((fm) => ({ ...fm, photoUrl: data.url }));
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the photograph.", "error");
    } finally {
      setUploadingPhoto(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [creds, setCreds] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get("/faculty");
      setList(data.faculty);
    } catch (e) {
      push(e.response?.data?.error || "Failed to load faculty.", "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query) return list;
    const q = query.toLowerCase();
    return list.filter((f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.email.toLowerCase().includes(q));
  }, [list, query]);

  function openAdd() { setEditing(null); setForm(BLANK); setModalOpen(true); }
  function openEdit(f) { setEditing(f); setForm({ ...f }); setModalOpen(true); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.put(`/faculty/${editing.id}`, form);
        push("Faculty updated.", "success");
        setModalOpen(false);
      } else {
        const { data } = await client.post("/faculty", form);
        push("Faculty enrolled successfully!", "success");
        setModalOpen(false);
        setCreds({ credentials: data.credentials, name: data.faculty.name });
      }
      load();
      refresh();
    } catch (e2) {
      push(e2.response?.data?.error || "Could not save faculty.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmReset() {
    setResetting(true);
    try {
      const { data } = await client.post(`/faculty/${resetTarget.id}/reset-credentials`);
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
      await client.delete(`/faculty/${deleteTarget.id}`);
      push("Faculty removed.", "success");
      setDeleteTarget(null);
      load();
      refresh();
    } catch (e) {
      push(e.response?.data?.error || "Could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID, email…" className="input pl-9" />
        </div>
        <Button icon={Plus} onClick={openAdd} className="sm:ml-auto">
          Enroll Faculty
        </Button>
      </div>

      <TiltCard intensity={2} className="glass rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <Loader label="Loading faculty…" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No faculty found." />
        ) : (
          <Table>
            <TableHead>
              <TableTh>ID</TableTh>
              <TableTh>Name</TableTh>
              <TableTh>Department</TableTh>
              <TableTh>Designation</TableTh>
              <TableTh>Experience</TableTh>
              <TableTh />
            </TableHead>
            <TableBody>
              {filtered.map((f, i) => (
                <motion.tr key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-blue-500/5 transition-colors">
                  <TableTd className="font-mono text-xs" style={{ color: "var(--color-text-muted)" }}>{f.id}</TableTd>
                  <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{f.name}</TableTd>
                  <TableTd>{deptName(f.department)}</TableTd>
                  <TableTd>{f.designation}</TableTd>
                  <TableTd>{f.experience || "—"}</TableTd>
                  <TableTd align="right" className="whitespace-nowrap">
                    <button onClick={() => setResetTarget(f)} title="Reset Credentials" aria-label={`Reset credentials for ${f.name}`} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"><KeyRound size={15} /></button>
                    <button onClick={() => openEdit(f)} title="Edit" aria-label={`Edit ${f.name}`} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTarget(f)} title="Delete" aria-label={`Delete ${f.name}`} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>
                  </TableTd>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        )}
      </TiltCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Faculty" : "Enroll New Faculty"} width="max-w-2xl">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
              aria-label="Upload a photograph"
            >
              {form.photoUrl
                ? <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
                : <Upload size={18} style={{ color: "var(--color-text-muted)" }} />}
            </button>
            <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} className="hidden" />
            <div className="min-w-0">
              <div className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {uploadingPhoto ? "Uploading…" : form.photoUrl ? "Click the photograph to replace it" : "Click to add a photograph"}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                Square, at least 512x512, JPEG under 1 MB.
              </div>
              {form.photoUrl && (
                <button type="button" onClick={() => setForm({ ...form, photoUrl: "" })}
                  className="text-[11px] mt-1 hover:underline" style={{ color: "var(--color-danger)" }}>
                  Remove photograph
                </button>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department *</label>
            <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input">
              <option value="" disabled>Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Designation *</label>
            <select required value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="input">
              <option value="" disabled>Select…</option>
              <option>Assistant Professor</option><option>Associate Professor</option><option>Professor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Qualification</label>
            <input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Experience</label>
            <input placeholder="e.g. 8 years" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} className="input" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving} className="w-full">
              {editing ? "Save Changes" : "Enroll Faculty"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} loading={deleting}
        message="This will permanently remove the faculty member and their login account." />

      <ConfirmDialog open={!!resetTarget} onClose={() => setResetTarget(null)} onConfirm={confirmReset} loading={resetting}
        message={`This will invalidate ${resetTarget?.name || "this faculty member"}'s current password and issue a new one.`} />

      <CredentialsModal open={!!creds} onClose={() => setCreds(null)} credentials={creds?.credentials} personName={creds?.name} mode={creds?.mode} />
    </div>
  );
}
