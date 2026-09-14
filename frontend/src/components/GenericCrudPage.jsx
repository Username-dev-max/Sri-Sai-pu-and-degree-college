import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import client from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import Loader from "./Loader";
import TiltCard from "./TiltCard";
import Button from "./Button";
import EmptyState from "./EmptyState";

/**
 * Config-driven CRUD list + modal form. Used for the simpler master-data
 * modules so each one doesn't need its own hand-written table/form.
 *
 * columns: [{ key, label, render?: (row) => node }]
 * fields:  [{ name, label, type: 'text'|'number'|'date'|'select'|'textarea', options?: [{value,label}], required? }]
 */
export default function GenericCrudPage({ title, endpoint, collectionKey, columns, fields, canWrite = true, searchKeys = [] }) {
  const { push } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await client.get(endpoint);
      setItems(data[collectionKey] || []);
    } catch (e) {
      push(e.response?.data?.error || "Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
    return items.filter((it) => keys.some((k) => String(it[k] ?? "").toLowerCase().includes(q)));
  }, [items, query, searchKeys, columns]);

  function openAdd() {
    setEditing(null);
    const initial = {};
    fields.forEach((f) => { initial[f.name] = f.default ?? ""; });
    setForm(initial);
    setModalOpen(true);
  }
  function openEdit(item) {
    setEditing(item);
    setForm({ ...item });
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await client.put(`${endpoint}/${editing.id}`, form);
        push("Updated successfully.", "success");
      } else {
        await client.post(endpoint, form);
        push("Added successfully.", "success");
      }
      setModalOpen(false);
      load();
    } catch (e2) {
      push(e2.response?.data?.error || "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await client.delete(`${endpoint}/${deleteTarget.id}`);
      push("Deleted.", "success");
      setDeleteTarget(null);
      load();
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
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[var(--color-surface-raised)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
        </div>
        {canWrite && (
          <Button icon={Plus} onClick={openAdd} className="sm:ml-auto">
            Add {title.replace(/s$/, "")}
          </Button>
        )}
      </div>

      <TiltCard intensity={2} className="glass rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <Loader label={`Loading ${title.toLowerCase()}…`} />
        ) : filtered.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} found.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200/70">
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-semibold whitespace-nowrap">{c.label}</th>
                  ))}
                  {canWrite && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors"
                  >
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                    {canWrite && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(row)} title="Edit" aria-label={`Edit ${title.replace(/s$/, "")} ${row.id}`} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(row)} title="Delete" aria-label={`Delete ${title.replace(/s$/, "")} ${row.id}`} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TiltCard>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${title.replace(/s$/, "")}` : `Add ${title.replace(/s$/, "")}`}>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}{f.required && " *"}</label>
              {f.type === "select" ? (
                <select
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="" disabled>Select…</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              ) : (
                <input
                  required={f.required}
                  type={f.type || "text"}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              )}
            </div>
          ))}
          <Button type="submit" loading={saving} className="w-full">
            {editing ? "Save Changes" : "Add"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        message={`This will permanently delete this ${title.toLowerCase().replace(/s$/, "")}. This cannot be undone.`}
      />
    </div>
  );
}
