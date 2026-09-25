import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UserRound, Mail } from "lucide-react";
import { isMissing, publicText } from "../lib/display";

export default function GlassMemberCard({ member, delay = 0 }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{ delay, duration: 0.45 }}
      whileHover={{ y: -3 }}
      onClick={() => navigate(`/members/${member.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/members/${member.id}`); }
      }}
      aria-label={`View the profile of ${member.name || "this member"}`}
      className="glass glow-card rounded-2xl p-5 text-center shadow-sm cursor-pointer"
    >
      {member.photoUrl ? (
        <img
          src={member.photoUrl}
          alt={member.name}
          loading="lazy"
          className="w-[88px] h-[88px] rounded-full mx-auto mb-3 object-cover"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        />
      ) : (
        <div
          className="w-[88px] h-[88px] rounded-full mx-auto mb-3 flex items-center justify-center"
          style={{ background: "var(--color-surface-sunken)", border: "1px dashed var(--color-border-default)" }}
        >
          <UserRound size={34} style={{ color: "var(--color-text-muted)" }} />
        </div>
      )}
      {/* Each detail is shown only when it has actually been recorded. The
          card previously printed "[DEPARTMENT]", "[YEAR]", "[ROLE]" and
          "[EMAIL]" for anything left blank, which read as an unfinished
          page rather than as a member with fewer details on file. */}
      <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{publicText(member.name)}</div>
      {!isMissing(member.departmentName || member.department) && (
        <p className="text-xs mt-1.5" style={{ color: "var(--color-text-secondary)" }}>{member.departmentName || member.department}</p>
      )}
      {!isMissing(member.year) && (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{member.year}</p>
      )}
      {!isMissing(member.role) && (
        <div className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(37,99,235,0.1)", color: "var(--color-brand-600)" }}>
          {member.role}
        </div>
      )}
      {!isMissing(member.email) && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
          <a href={`mailto:${member.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
            <Mail size={12} /> {member.email}
          </a>
        </div>
      )}
      <div
        className="mt-3 pt-3 border-t text-xs font-semibold"
        style={{ color: "var(--color-brand-600)", borderColor: "var(--color-border-subtle)" }}
      >
        View profile and resume
      </div>
    </motion.div>
  );
}
