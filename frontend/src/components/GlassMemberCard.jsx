import { motion } from "framer-motion";
import { UserRound, Mail } from "lucide-react";

export default function GlassMemberCard({ member, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ delay, duration: 0.45 }}
      whileHover={{ y: -3 }}
      className="glass glow-card rounded-2xl p-5 text-center shadow-sm"
    >
      {member.photoUrl ? (
        <img src={member.photoUrl} alt={member.name} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
      ) : (
        <div
          className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
        >
          <UserRound size={24} style={{ color: "var(--color-text-muted)" }} />
        </div>
      )}
      <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{member.name || "[MEMBER NAME]"}</div>
      <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>{member.department || "[DEPARTMENT]"}</p>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{member.year || "[YEAR]"}</p>
      <div className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(37,99,235,0.1)", color: "var(--color-brand-600)" }}>
        {member.role || "[ROLE]"}
      </div>
      <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
        {member.email ? (
          <a href={`mailto:${member.email}`} className="flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
            <Mail size={12} /> {member.email}
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Mail size={12} /> [EMAIL]
          </span>
        )}
      </div>
    </motion.div>
  );
}
