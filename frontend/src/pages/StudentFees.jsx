import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, Receipt } from "lucide-react";
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

  if (error) return <EmptyState icon={Wallet} title="No fee record found yet." description="Your fee structure hasn't been set up by the college yet. Check back later." />;
  if (!data) return <Loader full label="Loading fee status…" />;

  const { fee, payments } = data;
  const pct = Math.round((fee.paid / fee.total) * 100);

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
