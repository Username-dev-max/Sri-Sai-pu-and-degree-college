import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users, GraduationCap, UserCheck, Users2, ShieldCheck, ShieldOff,
  UserPlus, Wallet, CheckCircle2, Megaphone, Bell, CalendarCheck, ArrowRight,
} from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import { BarList, Donut, Trend } from "../components/Charts";

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** A small labelled figure used in the admissions breakdown strip. */
function Figure({ label, value, to }) {
  const body = (
    <div className="glow-card rounded-xl p-3.5 h-full" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
      <div className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      <div className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: "var(--color-text-primary)" }}>
        {Number(value || 0).toLocaleString("en-IN")}
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client
      .get("/admin/stats")
      .then(({ data }) => setStats(data))
      .catch(() => setError(true));
  }
  useEffect(load, []);

  if (error) return <ErrorState full message="Couldn't load the dashboard." onRetry={load} />;
  if (!stats) return <Loader full label="Loading dashboard…" />;

  const { cards, admissions, charts, attendanceToday, accounts } = stats;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass glow-soft rounded-2xl p-5 sm:p-6 shadow-sm"
      >
        <h2 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Welcome back, {(user.name || "Admin").split(" ")[0]}
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
          Every figure below is counted from live records. Empty sections mean no data has been entered yet.
        </p>
      </motion.div>

      {/* ---------------------------- people ---------------------------- */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
          People &amp; Accounts
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <StatCard label="Total Students" value={cards.totalStudents} icon={Users} color="#2563eb" delay={0} />
          <StatCard label="Total Faculty" value={cards.totalFaculty} icon={GraduationCap} color="#16a34a" delay={0.04} />
          <StatCard label="Attendance Staff" value={cards.totalAttendanceStaff} icon={UserCheck} color="#0ea5e9" delay={0.08} />
          <StatCard label="Parents" value={cards.totalParents} icon={Users2} color="#7c3aed" delay={0.12} />
          <StatCard label="Active Accounts" value={cards.activeUsers} icon={ShieldCheck} color="#059669" delay={0.16} />
          <StatCard label="Inactive Accounts" value={cards.inactiveUsers} icon={ShieldOff} color="#dc2626" delay={0.2} />
        </div>
      </section>

      {/* --------------------------- operations -------------------------- */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--color-text-muted)" }}>
          This Year &amp; Today
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <StatCard label="New Admissions" value={cards.newAdmissions} icon={UserPlus} color="#c99a3b" delay={0} />
          <StatCard label="Pending Fees" value={cards.pendingFees} icon={Wallet} color="#dc2626" prefix="₹" delay={0.04} />
          <StatCard label="Fees Collected" value={cards.collectedFees} icon={CheckCircle2} color="#059669" prefix="₹" delay={0.08} />
          <StatCard label="Attendance Today" value={attendanceToday.percentage} icon={CalendarCheck} color="#0ea5e9" suffix="%" delay={0.12} />
          <StatCard label="Live Announcements" value={cards.announcements} icon={Megaphone} color="#7c3aed" delay={0.16} />
          <StatCard label="My Unread Alerts" value={cards.unreadNotifications} icon={Bell} color="#ea580c" delay={0.2} />
        </div>
        {attendanceToday.marked === 0 && (
          <p className="text-xs mt-2.5" style={{ color: "var(--color-text-muted)" }}>
            No attendance has been marked today, so the attendance figure reads 0%.
          </p>
        )}
      </section>

      {/* --------------------------- admissions -------------------------- */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
            Admissions Breakdown
          </h3>
          <Link to="/admin/students" className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1">
            Manage students <ArrowRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Figure label="Total Admissions" value={admissions.total} to="/admin/students" />
          <Figure label="I PUC" value={admissions.iPuc} />
          <Figure label="II PUC" value={admissions.iiPuc} />
          <Figure label="PUC (all)" value={admissions.puc} />
          <Figure label="Degree" value={admissions.degree} />
        </div>
      </section>

      {/* ----------------------------- charts ---------------------------- */}
      <section className="grid lg:grid-cols-2 gap-4">
        <Trend
          title="Admissions by academic year"
          subtitle="Students grouped by the year they were admitted"
          data={charts.admissionsByYear}
        />
        <Donut
          title="Students by stream"
          subtitle="Science vs Commerce across PUC"
          data={charts.byStream}
          centerLabel={`${cards.totalStudents} total`}
        />
        <BarList
          title="Students by combination"
          subtitle="Per PUC combination and degree program"
          data={charts.byCombination}
        />
        <BarList
          title="Students by department"
          subtitle="Based on each student's assigned department"
          data={charts.byDepartment}
        />
        <Donut
          title="Fee collection"
          subtitle="Collected against outstanding, across all fee records"
          data={charts.fees}
          centerLabel={rupees(cards.billedFees)}
          formatValue={rupees}
        />
        <Donut
          title="Attendance summary — today"
          subtitle="Present vs absent across all marked registers"
          data={charts.attendanceSummary}
          centerLabel={`${attendanceToday.marked} marked`}
        />
        <BarList
          title="Faculty by department"
          subtitle="Teaching strength across the college"
          data={charts.facultyByDepartment}
        />
        <BarList
          title="Accounts by role"
          subtitle="Login accounts currently on the system"
          data={Object.entries(accounts).map(([k, v]) => ({ key: k, label: k, value: v }))}
        />
      </section>
    </div>
  );
}
