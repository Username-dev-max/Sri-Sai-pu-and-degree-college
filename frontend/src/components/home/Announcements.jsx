import { motion } from "framer-motion";
import { Megaphone, CalendarDays } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import StatusBadge from "../StatusBadge";
import { CATEGORY_TONE } from "../../pages/NoticesView";

export default function Announcements({ notices = [], exams = [], search = "" }) {
  const reduced = usePrefersReducedMotion();
  const q = search.trim().toLowerCase();
  const filtered = q ? notices.filter((n) => n.title.toLowerCase().includes(q)) : notices;

  return (
    <section id="announcements" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">News & Announcements</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-8" style={{ color: "var(--color-text-primary)" }}>
            What's happening on campus
          </h2>
          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="text-sm py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                {q ? `No announcements match "${search}".` : "No announcements right now — check back soon."}
              </p>
            )}
            {filtered.map((n, i) => (
              <motion.div
                key={n.id}
                initial={reduced ? false : { opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-8%" }}
                transition={{ delay: i * 0.06, duration: 0.45 }}
                className="glow-card flex items-start gap-4 rounded-xl p-4 sm:p-5"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Megaphone size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge tone={CATEGORY_TONE[n.category] || "neutral"}>{n.category}</StatusBadge>
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{n.date} · {n.postedBy}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug" style={{ color: "var(--color-text-primary)" }}>{n.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-2xl p-6" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="flex items-center gap-2 mb-5">
              <CalendarDays size={16} className="text-blue-600" />
              <h3 className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>Academic Calendar</h3>
            </div>
            <div className="space-y-4">
              {exams.length === 0 && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No upcoming examinations scheduled.</p>
              )}
              {exams.map((e) => (
                <div key={e.id} className="pb-4 border-b last:border-0 last:pb-0" style={{ borderColor: "var(--color-border-subtle)" }}>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{e.type}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{e.subject} · {e.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
