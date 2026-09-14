import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, Receipt, CalendarClock, FileText, Printer } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

const STATUS_TONE = {
  Paid: "success",
  "Partially Paid": "warning",
  Pending: "danger",
};

export default function StudentFees() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    client.get(`/fees/${user.linkedId}`).then(({ data }) => setData(data)).catch(() => setError(true));
  }, [user.linkedId]);

  /**
   * Open a single receipt in its own window for printing. Built from the
   * authoritative server copy rather than scraping the table, so what prints
   * is the record, not the rendering — and it escapes every field, since a
   * student's own name ends up inside this markup.
   */
  async function printReceipt(id) {
    let r;
    try {
      ({ data: { receipt: r } } = await client.get(`/fees/receipts/${id}`));
    } catch {
      return; // the server refuses anything not belonging to this student
    }
    const esc = (v) =>
      String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const row = (k, v) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`;
    const win = window.open("", "_blank", "width=680,height=800");
    if (!win) return; // pop-up blocked
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.receiptNo)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#14213d;padding:36px;max-width:620px;margin:0 auto}
  h1{font-size:19px;margin:0}
  .sub{font-size:12px;color:#64748b;margin:4px 0 0}
  .no{margin:22px 0 14px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;vertical-align:top}
  .k{color:#64748b;width:42%}
  .v{text-align:right;font-weight:600}
  .amt{font-size:22px;font-weight:700;margin-top:20px;text-align:right}
  .foot{margin-top:28px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  @media print{body{padding:0}}
</style></head><body>
<h1>${esc(r.college || "Fee Receipt")}</h1>
<p class="sub">${esc(r.collegeAddress || "")}</p>
<div class="no">Receipt ${esc(r.receiptNo)}</div>
<table>
  ${row("Student", r.studentName)}
  ${row("Admission No.", r.admissionNumber || "—")}
  ${row("Date", r.date)}
  ${row("Payment mode", r.mode)}
  ${row("Towards", r.towards)}
  ${row("Issued by", r.issuedByName)}
</table>
<div class="amt">₹${Number(r.amount).toLocaleString("en-IN")}</div>
<p class="foot">Computer-generated receipt. No signature required.</p>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  if (error) return <EmptyState icon={Wallet} title="No fee record found yet." description="Your fee structure hasn't been set up by the college yet. Check back later." />;
  if (!data) return <Loader full label="Loading fee status…" />;

  const { fee, payments, installments = [], receipts = [] } = data;
  const pct = fee.total ? Math.round((fee.paid / fee.total) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-5">
      <TiltCard intensity={1.5} className="glass rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Wallet size={18} className="text-blue-600" /> Fee Summary
          </div>
          <StatusBadge tone={STATUS_TONE[fee.status]}>{fee.status}</StatusBadge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div>
            <div className="text-xs text-slate-400">Total Fee</div>
            <div className="font-bold text-slate-800">₹{fee.total.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Paid</div>
            <div className="font-bold text-green-600">₹{fee.paid.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Pending</div>
            <div className="font-bold text-red-600">₹{(fee.total - fee.paid).toLocaleString("en-IN")}</div>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500"
          />
        </div>
      </TiltCard>

      {installments.length > 0 && (
        <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            <CalendarClock size={16} className="text-blue-600" /> Installment Schedule
          </div>
          <div className="space-y-2">
            {installments.map((ins) => {
              // "Overdue" is only meaningful for something still unpaid.
              const overdue = ins.status !== "Paid" && ins.dueDate && ins.dueDate < new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={ins.id}
                  className="flex items-center justify-between gap-3 text-sm py-2 border-b last:border-0"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: "var(--color-text-primary)" }}>{ins.label}</div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {ins.dueDate ? `Due ${ins.dueDate}` : "No due date"}
                      {ins.receiptNo && ` · ${ins.receiptNo}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                      ₹{Number(ins.amount).toLocaleString("en-IN")}
                    </span>
                    <StatusBadge tone={ins.status === "Paid" ? "success" : overdue ? "danger" : "warning"}>
                      {ins.status === "Paid" ? "Paid" : overdue ? "Overdue" : "Pending"}
                    </StatusBadge>
                  </div>
                </div>
              );
            })}
          </div>
        </TiltCard>
      )}

      {receipts.length > 0 && (
        <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            <FileText size={16} className="text-blue-600" /> Fee Receipts
          </div>
          <div className="space-y-2">
            {receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 text-sm py-2 border-b last:border-0"
                style={{ borderColor: "var(--color-border-subtle)" }}
              >
                <div className="min-w-0">
                  <div className="font-medium" style={{ color: "var(--color-text-primary)" }}>{r.receiptNo}</div>
                  <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    {r.date} · {r.towards}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                    ₹{Number(r.amount).toLocaleString("en-IN")}
                  </span>
                  <button
                    onClick={() => printReceipt(r.id)}
                    aria-label={`Print receipt ${r.receiptNo}`}
                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-600"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TiltCard>
      )}

      <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-800 mb-3">
          <Receipt size={16} className="text-blue-600" /> Payment History
        </div>
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments recorded yet." />
        ) : (
          <div className="space-y-2">
            {payments.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="font-medium text-slate-700">₹{p.amount.toLocaleString("en-IN")} · {p.mode}</div>
                  <div className="text-xs text-slate-400">{p.date} · {p.receipt}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </TiltCard>
    </div>
  );
}
