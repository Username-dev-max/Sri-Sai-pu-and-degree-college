import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, CalendarCheck, Award, FileText, ArrowRight } from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import TiltCard from "../components/TiltCard";

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const [notices, setNotices] = useState(null);
  // Teaching assignments are the authority on what a faculty member teaches —
  // the same records the server checks before accepting attendance or marks.
  const [assignments, setAssignments] = useState([]);
  const mySubjects = assignments;

  useEffect(() => {
    client
      .get("/notices")
      .then(({ data }) => setNotices(data.notices.slice(-3).reverse()))
      .catch(() => push("Failed to load recent notices.", "error"));
    client
      .get("/faculty-assignments")
      .then(({ data }) => setAssignments(data.assignments || []))
      .catch(() => setAssignments([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden glass rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="relative z-10">
          <h2 className="text-xl font-bold text-slate-800">Welcome, {user.name} 👋</h2>
          <p className="text-sm text-slate-500 mt-1">
            You have {mySubjects.length} teaching assignment{mySubjects.length !== 1 ? "s" : ""} this academic year.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink to="/faculty/attendance" icon={CalendarCheck} color="#0891b2" label="Mark Attendance" delay={0} />
        <QuickLink to="/faculty/internal-marks" icon={Award} color="#2563eb" label="Internal Marks" delay={0.05} />
        <QuickLink to="/faculty/assignments" icon={FileText} color="#9333ea" label="Assignments" delay={0.1} />
      </div>

      <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
          <BookOpen size={16} className="text-blue-600" /> My Subjects
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mySubjects.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-slate-100 p-3.5">
              <div className="font-medium text-slate-800 text-sm">{a.subjectName}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {a.className || "—"}{a.sectionName ? ` · ${a.sectionName}` : " · whole class"}{a.academicYearLabel ? ` · ${a.academicYearLabel}` : ""}
              </div>
            </motion.div>
          ))}
          {mySubjects.length === 0 && (
            <p className="text-sm text-slate-400 col-span-2">
              No subjects assigned yet. An administrator assigns these under Teaching Assignments.
            </p>
          )}
        </div>
      </TiltCard>

      {notices && (
        <TiltCard intensity={1.5} className="glass rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-slate-800">Recent Notices</span>
            <Link to="/faculty/notices" className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {notices.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-slate-700">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.date}</p>
              </motion.div>
            ))}
          </div>
        </TiltCard>
      )}
    </div>
  );
}

function QuickLink({ to, icon: Icon, color, label, delay }) {
  return (
    <Link to={to}>
      <TiltCard intensity={6}>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
          className="glass rounded-2xl p-5 shadow-sm hover:shadow-xl transition-shadow flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
            <Icon size={20} />
          </div>
          <div className="font-semibold text-slate-800 text-sm">{label}</div>
          <ArrowRight size={16} className="ml-auto text-slate-300" />
        </motion.div>
      </TiltCard>
    </Link>
  );
}
