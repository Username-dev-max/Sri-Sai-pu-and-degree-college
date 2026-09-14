import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, GraduationCap, Building2, BookOpen, CalendarCheck,
  ClipboardList, Award, Wallet, CalendarDays, FileText, Megaphone, BarChart3,
  X, UserPlus, Landmark, Trophy, Images, Users2, KeyRound, Layers, ScrollText, Bell,
} from "lucide-react";
import CollegeLogo from "./CollegeLogo";

const MENUS = {
  Admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { section: "People" },
    { to: "/admin/students", label: "Students", icon: Users },
    { to: "/admin/enroll", label: "Enroll Student", icon: UserPlus },
    { to: "/admin/faculty", label: "Faculty", icon: GraduationCap },
    { to: "/admin/users", label: "Login Accounts", icon: KeyRound },
    { section: "Academics" },
    { to: "/admin/academic-setup", label: "Academic Setup", icon: Layers },
    { to: "/admin/departments", label: "Departments", icon: Building2 },
    { to: "/admin/academics", label: "Courses & Subjects", icon: BookOpen },
    { to: "/admin/timetable", label: "Timetable", icon: CalendarDays },
    { to: "/admin/exams", label: "Examinations", icon: ClipboardList },
    { to: "/admin/assignments", label: "Assignments", icon: FileText },
    { to: "/admin/fees", label: "Fees", icon: Wallet },
    { section: "Communication" },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { to: "/admin/notices", label: "Notices", icon: Bell },
    { to: "/admin/admissions", label: "Admissions Inquiries", icon: UserPlus },
    { section: "Website" },
    { to: "/admin/sports-achievements", label: "Sports Achievements", icon: Trophy },
    { to: "/admin/academic-merit", label: "Academic Merit List", icon: Award },
    { to: "/admin/gallery", label: "Gallery", icon: Images },
    { to: "/admin/teams", label: "Teams", icon: Users2 },
    { to: "/admin/team-members", label: "Team Members", icon: UserPlus },
    { to: "/admin/college-profile", label: "College Profile", icon: Landmark },
    { section: "System" },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  ],
  Faculty: [
    { to: "/faculty", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/faculty/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/faculty/marks", label: "Marks Entry", icon: Award },
    { to: "/faculty/assignments", label: "Assignments", icon: FileText },
    { to: "/faculty/timetable", label: "Timetable", icon: CalendarDays },
    { to: "/faculty/announcements", label: "Announcements", icon: Megaphone },
    { to: "/faculty/notices", label: "Notices", icon: Bell },
  ],
  "Attendance Staff": [
    { to: "/attendance-staff", label: "Mark Attendance", icon: CalendarCheck, end: true },
    { to: "/attendance-staff/announcements", label: "Announcements", icon: Megaphone },
  ],
  Parent: [
    { to: "/parent", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/parent/announcements", label: "Announcements", icon: Megaphone },
  ],
  Student: [
    { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/student/profile", label: "My Profile", icon: Users },
    { to: "/student/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/student/results", label: "Marks & Results", icon: Award },
    { to: "/student/fees", label: "Fee Status", icon: Wallet },
    { to: "/student/timetable", label: "Timetable", icon: CalendarDays },
    { to: "/student/assignments", label: "Assignments", icon: FileText },
    { to: "/student/announcements", label: "Announcements", icon: Megaphone },
    { to: "/student/notices", label: "Notices", icon: Bell },
  ],
};

export default function Sidebar({ role, open, onClose }) {
  const items = MENUS[role] || [];

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const content = (
    <div
      className="h-full flex flex-col transition-colors"
      style={{ background: "var(--color-sidebar-bg)", borderRight: "1px solid var(--color-sidebar-border)" }}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <CollegeLogo size={36} glow />
        <div className="min-w-0">
          <div className="font-display font-semibold leading-tight tracking-tight text-sm" style={{ color: "var(--color-sidebar-text-hover)" }}>Sri Sai PU &amp; Degree College</div>
          <div className="text-[11px] leading-tight" style={{ color: "var(--color-sidebar-muted)" }}>{role} Panel</div>
        </div>
        <button onClick={onClose} aria-label="Close menu" className="ml-auto lg:hidden hover:opacity-100 opacity-70" style={{ color: "var(--color-sidebar-text-hover)" }}>
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-6 space-y-1">
        {items.map((item) =>
          // A `section` entry is a group heading, not a link. The admin menu is
          // long enough that it needs grouping to stay scannable.
          item.section ? (
            <div
              key={`section-${item.section}`}
              className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--color-sidebar-muted)" }}
            >
              {item.section}
            </div>
          ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 sidebar-link"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-900/40"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon
                  size={17}
                  strokeWidth={2}
                  className="relative z-10 shrink-0"
                  style={{ color: isActive ? "#ffffff" : "var(--color-sidebar-text)" }}
                />
                <span className="relative z-10 font-medium" style={{ color: isActive ? "#ffffff" : "var(--color-sidebar-text)" }}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
          )
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop / tablet: fixed column */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 print:hidden">{content}</aside>

      {/* Mobile: slide-over drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="fixed inset-y-0 left-0 w-72 z-50 lg:hidden shadow-2xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
