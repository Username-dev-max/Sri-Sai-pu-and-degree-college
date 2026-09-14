import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";

function barColor(pct) {
  if (pct < 75) return "#dc2626";
  if (pct < 85) return "#d97706";
  return "#16a34a";
}

export default function StudentAttendance() {
  const { user } = useAuth();
  const { subjectName } = useData();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client.get(`/attendance/student/${user.linkedId}`).then(({ data }) => setData(data)).catch(() => setError(true));
  }

  useEffect(load, [user.linkedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState full message="Couldn't load your attendance. Please check your connection and try again." onRetry={load} />;
  if (!data) return <Loader full label="Loading attendance…" />;

  return (
    <div className="max-w-3xl space-y-5">
      <TiltCard intensity={1.5} className="glass rounded-2xl p-6 shadow-sm text-center">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Overall Attendance</p>
        <div className="text-4xl font-extrabold" style={{ color: barColor(data.overallPercentage || 0) }}>
          {data.overallPercentage ?? "—"}%
        </div>
        {data.overallPercentage !== null && data.overallPercentage < 75 && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
            <AlertTriangle size={13} /> Below the required 75% attendance
          </div>
        )}
      </TiltCard>

      <div className="space-y-3">
        {data.subjectSummary.map((s, i) => (
          <motion.div key={s.subject} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
            <TiltCard intensity={1.5} className="glass rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{subjectName(s.subject)}</span>
                <span className="text-sm font-bold" style={{ color: barColor(s.percentage) }}>{s.percentage}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.percentage}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
                  className="h-full rounded-full"
                  style={{ background: barColor(s.percentage) }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-1.5">{s.present} of {s.total} classes attended</div>
            </TiltCard>
          </motion.div>
        ))}
        {data.subjectSummary.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm">No attendance has been recorded yet.</div>
        )}
      </div>
    </div>
  );
}
