import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CalendarCheck, Award, Wallet, Megaphone, ArrowRight } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import TiltCard from "../components/TiltCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { subjectName } = useData();
  const [attendance, setAttendance] = useState(null);
  const [results, setResults] = useState(null);
  const [fee, setFee] = useState(null);
  const [notices, setNotices] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client.get(`/attendance/student/${user.linkedId}`).then(({ data }) => setAttendance(data)).catch(() => setError(true));
    client.get(`/results/${user.linkedId}`).then(({ data }) => setResults(data)).catch(() => setError(true));
    client.get(`/fees/${user.linkedId}`).then(({ data }) => setFee(data.fee)).catch(() => setFee(false));
    client.get("/notices").then(({ data }) => setNotices(data.notices.slice(-3).reverse())).catch(() => setError(true));
  }

  useEffect(load, [user.linkedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState full message="Couldn't load your dashboard. Please check your connection and try again." onRetry={load} />;
  if (!attendance || !results || fee === undefined || !notices) return <Loader full label="Loading your dashboard…" />;

  const attColor = (attendance.overallPercentage ?? 100) < 75 ? "#dc2626" : "#16a34a";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden glass rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="relative z-10">
          <h2 className="text-xl font-bold text-slate-800">Welcome back, {user.name.split(" ")[0]} 👋</h2>
          <p className="text-sm text-slate-500 mt-1">Here's a snapshot of your academic progress.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Widget to="/student/attendance" icon={CalendarCheck} color="#0891b2" label="Attendance" value={`${attendance.overallPercentage ?? "—"}%`} valueColor={attColor} delay={0} />
        <Widget to="/student/results" icon={Award} color="#2563eb" label="Overall Result" value={results.overallResult || "Pending"} delay={0.05} />
        <Widget to="/student/fees" icon={Wallet} color={fee ? (fee.status === "Paid" ? "#16a34a" : "#dc2626") : "#94a3b8"} label="Fee Status" value={fee ? fee.status : "—"} delay={0.1} />
        <Widget to="/student/notices" icon={Megaphone} color="#9333ea" label="New Notices" value={notices.length} delay={0.15} />
      </div>

      <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <Megaphone size={16} className="text-blue-600" /> Latest Notices
          </div>
          <Link to="/student/notices" className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="space-y-3">
          {notices.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-slate-700">{n.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{n.date} · {n.category}</p>
            </motion.div>
          ))}
        </div>
      </TiltCard>

      {results.records.length > 0 && (
        <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
          <div className="font-semibold text-slate-800 mb-4">Subject-wise Performance</div>
          <div className="space-y-3">
            {results.records.map((r, i) => (
              <div key={r.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{subjectName(r.subject)}</span>
                  <span className="font-semibold text-slate-700">{r.percentage}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${r.percentage}%` }} transition={{ duration: 0.8, delay: i * 0.05 }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                </div>
              </div>
            ))}
          </div>
        </TiltCard>
      )}
    </div>
  );
}

function Widget({ to, icon: Icon, color, label, value, valueColor, delay }) {
  return (
    <Link to={to}>
      <TiltCard intensity={6}>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
          className="glass rounded-2xl p-4 shadow-sm hover:shadow-xl transition-shadow">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}1a`, color }}>
            <Icon size={17} />
          </div>
          <div className="text-xs text-slate-500 mb-0.5">{label}</div>
          <div className="text-lg font-bold" style={{ color: valueColor || "var(--color-text-primary)" }}>{value}</div>
        </motion.div>
      </TiltCard>
    </Link>
  );
}
