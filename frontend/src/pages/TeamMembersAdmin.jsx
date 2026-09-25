import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, UserRound, FileText, X } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

const BLANK = { team: "", name: "", department: "", year: "", role: "", email: "", photoUrl: "", resumeUrl: "", resumeName: "" };

/** Agreed limit per team; the server enforces the same number. */
const MAX_PER_TEAM = 30;

export default function TeamMembersAdmin() {
  const { push } = useToast();
  const fileRef = useRef(null);
  const resumeRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setError(false);
    Promise.all([
      client.get("/teams").then(({ data }) => setTeams(data.teams)),
      client.get("/departments").then(({ data }) => setDepartments(data.departments)),
      client.get("/team-members").then(({ data }) => setMembers(data.teamMembers)),
    ]).catch(() => setError(true));
  }
  useEffect(load, []);

  const teamName = (id) => teams.find((t) => t.id === id)?.name || id;
  const deptName = (id) => departments.find((d) => d.id === id)?.name || id || "—";

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK, team: teams[0]?.id || "" });
    setPreview(null);
    setModalOpen(true);
  }
  function openEdit(m) {
    setEditing(m);
    setForm({ ...m });
    setPreview(m.photoUrl || null);
    setModalOpen(true);
  }

  async function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const { data } = await client.post("/uploads", body);
      setForm((fm) => ({ ...fm, photoUrl: data.url }));
      setPreview(URL.createObjectURL(f));
    } catch (err) {
      push(err.response?.data?.error || "Could not upload photo.", "error");
    } finally {
      setUploading(false);
    }
  }

  /*
   * A resume goes to the public bucket because the hiring pages have to open
   * it without anyone signing in. That is deliberate, and it is why the
   * server keeps it on its own route rather than widening the image upload.
   */
  async function pickResume(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingResume(true);
    try {
      const body = new FormData();
      body.append("file", f);
      const { data } = await client.post("/uploads/resume", body);
      setForm((fm) => ({ ...fm, resumeUrl: data.url, resumeName: data.originalName || f.name }));
      push("Resume uploaded.", "success");
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the resume.", "error");
    } finally {
      setUploadingResume(false);
      if (resumeRef.current) resumeRef.current.value = "";
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.put(`/team-members/${editing.id}`, form);
        push("Member updated.", "success");
      } else {
        await client.post("/team-members", form);
        push("Member added.", "success");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not save member.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await client.delete(`/team-members/${deleteTarget.id}`);
      push("Member removed.", "success");
      setDeleteTarget(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load team members." onRetry={load} />;
  if (!members) return <Loader full label="Loading team members…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="min-w-0">
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Members shown here appear on each team public page under Developed By, and on
            the hiring pages with their resume.
          </p>
          {teams.length > 0 && members && (
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              {teams
                .map((t) => `${t.name}: ${members.filter((m) => m.team === t.id).length}/${MAX_PER_TEAM}`)
                .join("  ·  ")}
            </p>
          )}
        </div>
        <Button icon={Plus} onClick={openAdd} disabled={teams.length === 0}>Add Member</Button>
      </div>

      <div className="glass rounded-2xl overflow-hidden shadow-sm">
        {members.length === 0 ? (
          <EmptyState icon={UserRound} title="No team members yet" description="Add the first member to a team." />
        ) : (
          <Table>
            <TableHead>
              <TableTh>Photo</TableTh>
              <TableTh>Name</TableTh>
              <TableTh>Team</TableTh>
              <TableTh>Department</TableTh>
              <TableTh>Year</TableTh>
              <TableTh>Role</TableTh>
              <TableTh>Email</TableTh>
              <TableTh>Resume</TableTh>
              <TableTh align="right">Action</TableTh>
            </TableHead>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableTd>
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--color-surface-sunken)" }}>
                        <UserRound size={14} style={{ color: "var(--color-text-muted)" }} />
                      </div>
                    )}
                  </TableTd>
                  <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>{m.name}</TableTd>
                  <TableTd>{teamName(m.team)}</TableTd>
                  <TableTd>{deptName(m.department)}</TableTd>
                  <TableTd>{m.year}</TableTd>
                  <TableTd>{m.role}</TableTd>
                  <TableTd>{m.email}</TableTd>
                  <TableTd>
                    {m.resumeUrl ? (
                      <a href={m.resumeUrl} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                         style={{ color: "var(--color-brand-600)" }}>
                        <FileText size={12} /> View
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </TableTd>
                  <TableTd align="right">
                    <button onClick={() => openEdit(m)} title="Edit" aria-label={`Edit ${m.name}`} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTarget(m)} title="Delete" aria-label={`Delete ${m.name}`} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Member" : "Add Member"} width="max-w-2xl">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex items-center gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer overflow-hidden shrink-0"
              style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
            >
              {preview ? <img src={preview} alt="Preview" className="w-full h-full object-cover" /> : <Upload size={18} style={{ color: "var(--color-text-muted)" }} />}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickFile} className="hidden" />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{uploading ? "Uploading…" : "Click to upload a photo"}</span>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Team *</label>
            <select required value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} className="input">
              <option value="" disabled>Select…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input">
              <option value="">Not specified</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Academic Year</label>
            <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="input" placeholder="e.g. 3rd Year" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Team Role</label>
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input" placeholder="e.g. Frontend Developer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Resume (PDF)</label>
            {form.resumeUrl ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border-subtle)" }}>
                <FileText size={16} className="text-blue-600 shrink-0" />
                <a href={form.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-sm truncate flex-1 hover:underline" style={{ color: "var(--color-text-primary)" }}>
                  {form.resumeName || "Resume.pdf"}
                </a>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, resumeUrl: "", resumeName: "" })}
                  aria-label="Remove resume"
                  className="p-1.5 rounded-lg hover:bg-black/5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => resumeRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)", color: "var(--color-text-secondary)" }}
              >
                <Upload size={15} />
                {uploadingResume ? "Uploading…" : "Upload a resume — PDF, up to 6 MB"}
              </button>
            )}
            <input ref={resumeRef} type="file" accept="application/pdf" onChange={pickResume} className="hidden" />
            <p className="text-[11px] mt-1.5" style={{ color: "var(--color-text-muted)" }}>
              Two to three pages is the usual length. This file is downloadable by anyone
              who opens the member profile, so it should not contain anything private.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" loading={saving} className="w-full">{editing ? "Save Changes" : "Add Member"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        message="This will permanently remove this team member."
      />
    </div>
  );
}
