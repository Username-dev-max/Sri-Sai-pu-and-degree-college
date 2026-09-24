import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

export default function SportsExcellence({ sportsAchievements = [] }) {
  const navigate = useNavigate();
  if (!sportsAchievements.length) return null;

  return (
    <section id="sports" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-navy-900)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
              <Trophy size={14} /> Sports Excellence
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              State-level sporting achievements
            </h2>
          </div>
          <button onClick={() => navigate("/sports")} className="group text-sm font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1.5 min-h-[44px] px-1 transition-colors">
            View all achievements →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {sportsAchievements.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="rounded-xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="font-display text-xl font-semibold text-amber-400">{s.year}</div>
              <div className="text-white font-semibold text-xs mt-1.5">{s.sport}</div>
              <div className="text-[11px] mt-1" style={{ color: "#9aa3b5" }}>
                {[s.category, s.level].filter(Boolean).join(" · ")}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
