import { motion } from "framer-motion";
import { UserRound, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isMissing } from "../lib/display";

export default function GlassFacultyCard({ faculty, deptName, delay = 0 }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ delay, duration: 0.45 }}
      whileHover={{ y: -3 }}
      className="glass glow-card rounded-2xl p-5 text-center shadow-sm"
    >
      <div
        className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
        style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
      >
        <UserRound size={24} style={{ color: "var(--color-text-muted)" }} />
      </div>
      <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{faculty.name}</div>
      <div className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(37,99,235,0.1)", color: "var(--color-brand-600)" }}>
        {deptName ? deptName(faculty.department) : faculty.department}
      </div>
      {/* Records whose experience or qualification was never supplied hold
          the internal "[VERIFY]" marker. Omit the line entirely rather than
          printing that, or a row of dashes, to a visitor. */}
      {!isMissing(faculty.experience) && (
        <p className="text-xs mt-2.5" style={{ color: "var(--color-text-muted)" }}>{faculty.experience}</p>
      )}
      {!isMissing(faculty.qualification) && (
        <p className="flex items-center justify-center gap-1 text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
          <BadgeCheck size={12} className="text-blue-600 shrink-0" /> {faculty.qualification}
        </p>
      )}
      <button
        onClick={() => navigate(`/faculty-directory/${faculty.id}`)}
        className="mt-4 w-full text-xs font-semibold pt-3 border-t min-h-[44px] transition-colors hover:text-blue-700"
        style={{ color: "var(--color-brand-600)", borderColor: "var(--color-border-subtle)" }}
      >
        View Profile
      </button>
    </motion.div>
  );
}
