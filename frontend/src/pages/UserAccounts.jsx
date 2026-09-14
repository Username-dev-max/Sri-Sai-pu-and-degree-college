import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, KeyRound, ShieldCheck, ShieldOff, Users2, X } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CredentialsModal from "../components/CredentialsModal";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import { Table, TableHead, TableTh, TableBody, TableRow, TableTd } from "../components/Table";

const ROLES = ["Admin", "Faculty", "Attendance Staff", "Student", "Parent"];

/** Roles that must be attached to an existing profile record. */
const NEEDS_PROFILE = { Student: "students", Faculty: "faculty" };

export default function UserAccounts() {
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    Promise.all([
      client.get(`/users?${params}`).then(({ data: d }) => setData(d)),
      client.get("/users/stats").then(({ data: d }) => setStats(d)),
    ]).catch(() => setError(true));
  }, [q, role, status, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // debounce typing only
    return () => clearTimeout(t);
  }, [load, q]);

  async function toggleStatus(u) {
    const next = u.status === "Active" ? "Inactive" : "Active";
    setBusy(true);
    try {
      await client.patch(`/users/${u.id}/status`, { status: next });
      push(`${u.username} is now ${next.toLowerCase()}.`, "success");
      setConfirm(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not change the account status.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u) {
    setBusy(true);
    try {
      const { data: d } = await client.post(`/users/${u.id}/reset-password`);
      setCredentials(d.credentials);
      setConfirm(null);
      load();
    } catch (err) {
      push(err.response?.data?.error || "Could not reset the password.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState full message="Couldn't load accounts." onRetry={load} />;
  if (!data) return <Loader full label="Loading accounts…" />;

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-4">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Only an administrator can create login accounts. Nobody can register themselves — students, faculty,
          attendance staff and parents all sign in with credentials issued here.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {ROLES.map((r) => (
            <div key={r} className="glow-card rounded-xl p-3" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{r}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{stats.byRole[r]}</div>
            </div>
          ))}
          <div className="glow-card rounded-xl p-3" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Active</div>
            <div className="text-lg font-bold tabular-nums text-emerald-600">{stats.active}</div>
          </div>
          <div className="glow-card rounded-xl p-3" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Inactive</div>
            <div className="text-lg font-bold tabular-nums text-red-600">{stats.inactive}</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by name, username, email or linked ID…"
            className="input pl-9"
          />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input w-auto">
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <Button icon={Plus} onClick={() => setAddOpen(true)}>Create Account</Button>
      </div>

      {data.users.length === 0 ? (
        <EmptyState icon={Users2} title="No accounts match" description="Try a different search or filter." />
      ) : (
        <>
          <div className="glass rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <Table>
              <TableHead>
                <TableTh>Username</TableTh>
                <TableTh>Name</TableTh>
                <TableTh>Role</TableTh>
                <TableTh>Linked To</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Last Login</TableTh>
                <TableTh align="right">Actions</TableTh>
              </TableHead>
              <TableBody>
                {data.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableTd className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {u.username}
                      {u.mustReset && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-gold-soft)", color: "#8a651d" }}>
                          must reset
                        </span>
                      )}
                    </TableTd>
                    <TableTd>{u.name || "—"}</TableTd>
                    <TableTd>{u.role}</TableTd>
                    <TableTd className="text-xs">{u.linkedName || u.linkedId || "—"}</TableTd>
                    <TableTd>
                      <StatusBadge tone={u.status === "Active" ? "success" : "danger"}>{u.status}</StatusBadge>
                    </TableTd>
                    <TableTd className="text-xs">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never"}
                    </TableTd>
                    <TableTd align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setConfirm({ kind: "reset", user: u })}
                          title="Issue a new temporary password"
                          aria-label={`Reset password for ${u.username}`}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => setConfirm({ kind: "status", user: u })}
                          title={u.status === "Active" ? "Deactivate" : "Activate"}
                          aria-label={`${u.status === "Active" ? "Deactivate" : "Activate"} ${u.username}`}
                          className={`p-1.5 rounded-lg ${u.status === "Active" ? "hover:bg-red-500/10 text-red-600" : "hover:bg-emerald-500/10 text-emerald-600"}`}
                        >
                          {u.status === "Active" ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        </button>
                      </div>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--color-text-muted)" }}>
                {data.total} account{data.total === 1 ? "" : "s"} · page {data.page} of {data.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <AddAccountModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(creds) => { setAddOpen(false); setCredentials(creds); load(); }}
      />

      <CredentialsModal
        open={!!credentials}
        credentials={credentials}
        personName={credentials?.username || ""}
        mode="reset"
        onClose={() => setCredentials(null)}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        loading={busy}
        onConfirm={() => (confirm.kind === "reset" ? resetPassword(confirm.user) : toggleStatus(confirm.user))}
        message={
          !confirm ? "" :
          confirm.kind === "reset"
            ? `Issue a new temporary password for '${confirm.user.username}'? Their current password will stop working immediately.`
            : confirm.user.status === "Active"
              ? `Deactivate '${confirm.user.username}'? They will be signed out and cannot log in until reactivated.`
              : `Reactivate '${confirm.user.username}'? They will be able to log in again.`
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function AddAccountModal({ open, onClose, onCreated }) {
  const { push } = useToast();
  const [role, setRole] = useState("Student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedId, setLinkedId] = useState("");
  const [linkedIds, setLinkedIds] = useState([]);
  const [options, setOptions] = useState({ students: [], faculty: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRole("Student"); setName(""); setEmail(""); setLinkedId(""); setLinkedIds([]);
    Promise.all([
      client.get("/students").then(({ data }) => data.students || []).catch(() => []),
      client.get("/faculty").then(({ data }) => data.faculty || []).catch(() => []),
    ]).then(([students, faculty]) => setOptions({ students, faculty }));
  }, [open]);

  // Selecting a profile fills the name, so the account matches the record.
  function pickProfile(id) {
    setLinkedId(id);
    const src = role === "Student" ? options.students : options.faculty;
    const rec = src.find((r) => r.id === id);
    if (rec) {
      setName(rec.name);
      if (rec.email) setEmail(rec.email);
    }
  }

  const withoutAccount = (list, r) => list; // server rejects duplicates authoritatively

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { role, name, email };
      if (NEEDS_PROFILE[role]) body.linkedId = linkedId;
      if (role === "Parent") body.linkedIds = linkedIds;
      const { data } = await client.post("/users", body);
      push(`Account created for ${data.user.username}.`, "success");
      onCreated(data.credentials);
    } catch (err) {
      push(err.response?.data?.error || "Could not create the account.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Login Account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Role *</label>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setLinkedId(""); setLinkedIds([]); setName(""); }}
            className="input"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {NEEDS_PROFILE[role] && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {role} record * <span className="font-normal">(the account is linked to this profile)</span>
            </label>
            <select value={linkedId} onChange={(e) => pickProfile(e.target.value)} className="input" required>
              <option value="">Select a {role.toLowerCase()}…</option>
              {withoutAccount(role === "Student" ? options.students : options.faculty, role).map((r) => (
                <option key={r.id} value={r.id}>{r.id} — {r.name}</option>
              ))}
            </select>
            {role === "Student" && options.students.length === 0 && (
              <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
                No students are enrolled yet. Enroll one first, then create their account.
              </p>
            )}
          </div>
        )}

        {role === "Parent" && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Linked children * <span className="font-normal">(a parent may be linked to several)</span>
            </label>
            <div className="rounded-xl border max-h-44 overflow-y-auto" style={{ borderColor: "var(--color-border-default)" }}>
              {options.students.length === 0 ? (
                <p className="text-xs p-3" style={{ color: "var(--color-text-muted)" }}>No students are enrolled yet.</p>
              ) : (
                options.students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-blue-500/5">
                    <input
                      type="checkbox"
                      checked={linkedIds.includes(s.id)}
                      onChange={(e) =>
                        setLinkedIds((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                      }
                    />
                    <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{s.name}</span>
                    <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>{s.id}</span>
                  </label>
                ))
              )}
            </div>
            {linkedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {linkedIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-blue-600/10 text-blue-700">
                    {id}
                    <button type="button" onClick={() => setLinkedIds((p) => p.filter((x) => x !== id))} aria-label={`Remove ${id}`}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Full name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="Optional" />
        </div>

        <p className="text-xs rounded-lg p-2.5" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}>
          A username and a temporary password are generated automatically. The password is shown once, immediately
          after creation — it is hashed and cannot be retrieved again.
        </p>

        <Button type="submit" loading={saving} className="w-full">
          {saving ? "Creating…" : "Create Account"}
        </Button>
      </form>
    </Modal>
  );
}
