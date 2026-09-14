import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2, Send, Paperclip, Users2 } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";

const CATEGORIES = ["General", "Academic", "Examination", "Fees", "Event", "Holiday", "Urgent"];
const PRIORITIES = ["Normal", "High", "Urgent"];
const ROLES = ["Student", "Parent", "Faculty", "Attendance Staff"];

const PRIORITY_TONE = { Urgent: "danger", High: "warning", Normal: "neutral" };

const EMPTY = {
  title: "", body: "", category: "General", priority: "Normal",
  publishDate: new Date().toISOString().slice(0, 10), expiryDate: "",
  attachmentUrl: "", attachmentName: "",
  audience: { roles: [], streams: [], departments: [], classes: [] },
  published: true,
};

export default function AnnouncementsAdmin() {
  const { push } = useToast();
  const fileRef = useRef(null);
  const [list, setList] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    Promise.all([
      client.get("/announcements").then(({ data }) => setList(data.announcements)),
      client.get("/academic-config").then(({ data }) => setConfig(data)),
    ]).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  function toggleAudience(group, value) {
    setEditing((e) => {
      const cur = e.audience[group] || [];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...e, audience: { ...e.audience, [group]: next } };
    });
  }

  async function attach(file) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await client.post("/uploads", fd);
      setEditing((e) => ({ ...e, attachmentUrl: data.url, attachmentName: file.name }));
      push("Attachment added.", "success");
    } catch (err) {
      push(err.response?.data?.error || "Could not upload the attachment.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) await client.put(`/announcements/${editing.id}`, editing);
      else await client.post("/announcements", editing);
      push(editing.published ? "Announcement published." : "Draft saved.", "success");
      setEditing(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not save the announcement.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await client.delete(`/announcements/${deleting.id}`);
      push("Announcement deleted.", "success");
      setDeleting(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not delete.", "error");
    } finally {
      setBusy(false);
    }
  }

  function audienceSummary(a) {
    const parts = [];
    const aud = a.audience || {};
    if (aud.roles?.length) parts.push(aud.roles.join(", "));
    if (aud.streams?.length) {
      parts.push(aud.streams.map((s) => config?.streams.find((x) => x.id === s)?.name || s).join(", "));
    }
    if (aud.departments?.length) parts.push(`${aud.departments.length} dept`);
    if (aud.classes?.length) parts.push(`${aud.classes.length} class`);
    return parts.length ? parts.join(" · ") : "Everyone";
  }

  if (error) return <ErrorState full message="Couldn't load announcements." onRetry={load} />;
  if (!list) return <Loader full label="Loading announcements…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Published announcements appear on the dashboards of the audience you choose, and send them a notification.
        </p>
        <Button icon={Plus} onClick={() => setEditing({ ...EMPTY })}>New Announcement</Button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Create the first one to reach students, parents or staff." />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="glass glow-card rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{a.title}</h3>
                    <StatusBadge tone={PRIORITY_TONE[a.priority]}>{a.priority}</StatusBadge>
                    <StatusBadge tone={a.published ? "success" : "neutral"}>{a.published ? "Published" : "Draft"}</StatusBadge>
                    <StatusBadge tone="info">{a.category}</StatusBadge>
                  </div>
                  {a.body && (
                    <p className="text-sm mt-1.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{a.body}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: "var(--color-text-muted)" }}>
                    <span className="inline-flex items-center gap-1"><Users2 size={12} /> {audienceSummary(a)}</span>
                    <span>Publish {a.publishDate}</span>
                    {a.expiryDate && <span>Expires {a.expiryDate}</span>}
                    {a.attachmentUrl && (
                      <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600">
                        <Paperclip size={12} /> {a.attachmentName || "Attachment"}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setEditing({ ...EMPTY, ...a, audience: { ...EMPTY.audience, ...(a.audience || {}) } })}
                    aria-label={`Edit ${a.title}`} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleting(a)} aria-label={`Delete ${a.title}`} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Announcement" : "New Announcement"}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="input" rows={3} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="input">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                <select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} className="input">
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Publish date</label>
                <input type="date" value={editing.publishDate} onChange={(e) => setEditing({ ...editing, publishDate: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Expiry date</label>
                <input type="date" value={editing.expiryDate} onChange={(e) => setEditing({ ...editing, expiryDate: e.target.value })} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Target audience</label>
              <p className="text-[11px] mb-2" style={{ color: "var(--color-text-muted)" }}>
                Select nothing to reach everyone. Any filter you set must match for a person to see it.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleAudience("roles", r)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                    style={{
                      background: editing.audience.roles?.includes(r) ? "var(--color-brand-600)" : "var(--color-surface-raised)",
                      color: editing.audience.roles?.includes(r) ? "#fff" : "var(--color-text-secondary)",
                      borderColor: "var(--color-border-default)",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {config && (
                <div className="flex flex-wrap gap-1.5">
                  {config.streams.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleAudience("streams", s.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                      style={{
                        background: editing.audience.streams?.includes(s.id) ? "var(--color-gold)" : "var(--color-surface-raised)",
                        color: editing.audience.streams?.includes(s.id) ? "#fff" : "var(--color-text-secondary)",
                        borderColor: "var(--color-border-default)",
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Attachment</label>
              <div className="flex items-center gap-2.5">
                <Button type="button" variant="secondary" icon={Paperclip} disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? "Uploading…" : "Attach file"}
                </Button>
                {editing.attachmentName && (
                  <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{editing.attachmentName}</span>
                )}
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} />
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Publish now and notify the audience
              </span>
            </label>

            <Button type="submit" loading={saving} icon={Send} className="w-full">
              {saving ? "Saving…" : editing.published ? "Publish" : "Save Draft"}
            </Button>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        message={`Delete "${deleting?.title}"? Notifications referring to it will also be removed.`}
      />
    </div>
  );
}
