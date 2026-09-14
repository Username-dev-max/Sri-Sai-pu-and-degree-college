import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, IndianRupee, Search } from "lucide-react";
import client from "../api/client";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import TiltCard from "../components/TiltCard";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";

const STATUS_TONE = {
  Paid: "success",
  "Partially Paid": "warning",
  Pending: "danger",
};

export default function Fees() {
  const { push } = useToast();
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  const [planTarget, setPlanTarget] = useState(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Cash");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([client.get("/fees"), client.get("/students")]);
      setFees(f.data.fees);
      setStudents(s.data.students);
    } catch (e) {
      push(e.response?.data?.error || "Failed to load fee records.", "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const studentName = (id) => students.find((s) => s.id === id)?.name || id;

  const filtered = useMemo(() => {
    if (!query) return fees;
    const q = query.toLowerCase();
    return fees.filter((f) => studentName(f.student).toLowerCase().includes(q) || f.student.toLowerCase().includes(q));
  }, [fees, query, students]);

  const totals = useMemo(() => ({
    collected: fees.reduce((a, f) => a + f.paid, 0),
    pending: fees.reduce((a, f) => a + (f.total - f.paid), 0),
    partial: fees.filter((f) => f.status === "Partially Paid").length,
  }), [fees]);

  async function recordPayment(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post(`/fees/${payTarget.student}/payments`, { amount: Number(amount), mode });
      push("Payment recorded.", "success");
      setPayTarget(null);
      setAmount("");
      load();
    } catch (e2) {
      push(e2.response?.data?.error || "Could not record payment.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Total Collected" value={totals.collected} prefix="₹" icon={Wallet} color="#16a34a" />
        <StatCard label="Pending Fees" value={totals.pending} prefix="₹" icon={IndianRupee} color="#dc2626" delay={0.05} />
        <StatCard label="Partially Paid Students" value={totals.partial} icon={Wallet} color="#d97706" delay={0.1} />
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by student name or ID…" className="input pl-9" />
      </div>

      <TiltCard intensity={1.5} className="glass rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <Loader label="Loading fee records…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No fee records found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200/70">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Total Fee</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Pending</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <motion.tr key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40">
                    <td className="px-4 py-3 font-medium text-slate-800">{studentName(f.student)}</td>
                    <td className="px-4 py-3 text-slate-600">₹{f.total.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-slate-600">₹{f.paid.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-slate-600">₹{(f.total - f.paid).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[f.status]}>{f.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setPlanTarget(f)}
                        className="text-xs font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
                      >
                        Installments
                      </button>
                      {f.status !== "Paid" && (
                        <button
                          onClick={() => setPayTarget(f)}
                          className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TiltCard>

      <InstallmentsModal
        fee={planTarget}
        studentName={studentName}
        onClose={() => setPlanTarget(null)}
        onChanged={load}
      />

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title="Record Payment" width="max-w-sm">
        {payTarget && (
          <form onSubmit={recordPayment} className="space-y-4">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{studentName(payTarget.student)}</span> — pending balance{" "}
              <span className="font-semibold text-red-600">₹{(payTarget.total - payTarget.paid).toLocaleString("en-IN")}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹)</label>
              <input
                required type="number" min={1} max={payTarget.total - payTarget.paid}
                value={amount} onChange={(e) => setAmount(e.target.value)} className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="input">
                <option>Cash</option><option>Cheque</option><option>Net Banking</option><option>Online (UPI)</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Record Payment"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

/**
 * Schedule a student's fee across installments. The server refuses a schedule
 * that exceeds the total fee, and refuses to delete an installment a payment
 * has already settled.
 */
function InstallmentsModal({ fee, studentName, onClose, onChanged }) {
  const { push } = useToast();
  const [rows, setRows] = useState(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!fee) return setRows(null);
    setLabel(""); setAmount(""); setDueDate("");
    client
      .get(`/fees/${fee.student}`)
      .then(({ data }) => setRows(data.installments || []))
      .catch(() => setRows([]));
  }, [fee]);

  const scheduled = (rows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const unscheduled = fee ? fee.total - scheduled : 0;

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await client.post(`/fees/${fee.student}/installments`, { label, amount: Number(amount), dueDate });
      push("Installment scheduled.", "success");
      const { data } = await client.get(`/fees/${fee.student}`);
      setRows(data.installments || []);
      setLabel(""); setAmount(""); setDueDate("");
      onChanged();
    } catch (err) {
      push(err.response?.data?.error || "Could not schedule the installment.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    try {
      await client.delete(`/fees/installments/${id}`);
      const { data } = await client.get(`/fees/${fee.student}`);
      setRows(data.installments || []);
      onChanged();
    } catch (err) {
      push(err.response?.data?.error || "Could not remove the installment.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!fee} onClose={onClose} title={fee ? `Installments — ${studentName(fee.student)}` : ""}>
      {fee && (
        <div className="space-y-4">
          <div className="flex justify-between text-sm rounded-xl p-3" style={{ background: "var(--color-surface-sunken)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Total fee</span>
            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
              ₹{fee.total.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between text-sm px-3">
            <span style={{ color: "var(--color-text-muted)" }}>Still unscheduled</span>
            <span className="font-semibold" style={{ color: unscheduled > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
              ₹{unscheduled.toLocaleString("en-IN")}
            </span>
          </div>

          {rows === null ? (
            <Loader label="Loading…" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
              No installments scheduled. The full amount is due in one payment.
            </p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm py-2 border-b last:border-0" style={{ borderColor: "var(--color-border-subtle)" }}>
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: "var(--color-text-primary)" }}>{r.label}</div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{r.dueDate || "No due date"}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                      ₹{Number(r.amount).toLocaleString("en-IN")}
                    </span>
                    <StatusBadge tone={r.status === "Paid" ? "success" : "warning"}>{r.status}</StatusBadge>
                    {r.status !== "Paid" && (
                      <button onClick={() => remove(r.id)} disabled={busy} aria-label={`Remove ${r.label}`} className="text-red-600 text-xs font-semibold px-1.5">
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {unscheduled > 0 && (
            <form onSubmit={add} className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="e.g. Term 1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount *</label>
                  <input type="number" min="1" max={unscheduled} value={amount} onChange={(e) => setAmount(e.target.value)} className="input" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Due date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
              </div>
              <Button type="submit" loading={busy} className="w-full">Add Installment</Button>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
