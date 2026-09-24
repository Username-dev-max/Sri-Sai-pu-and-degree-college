import { useNavigate } from "react-router-dom";
import { Award } from "lucide-react";

export default function AchievementsTeaser({ academicMerit = [] }) {
  const navigate = useNavigate();
  if (!academicMerit.length) return null;
  const top = academicMerit.slice(0, 4);
  const examLabel = academicMerit[0]?.examLabel;

  return (
    <section id="achievements" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="glow-card glow-gold rounded-2xl overflow-hidden grid lg:grid-cols-2 shadow-sm" style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}>
          <div className="p-10 sm:p-12 bg-gradient-to-br from-[#0b1526] via-[#0f1e33] to-[#16294a]">
            <Award size={26} className="text-amber-400 mb-4" />
            {examLabel && <div className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">{examLabel}</div>}
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">1st Place in K.G.F. Taluk</h2>
            <p className="text-sm text-blue-100/70 mt-3">Academic Achievement</p>
            <button onClick={() => navigate("/achievements")} className="group text-sm font-semibold text-amber-400 hover:text-amber-300 mt-4 inline-flex items-center gap-1.5 min-h-[44px] px-1 transition-colors">
              View all meritorious students →
            </button>
          </div>
          <div className="p-8 sm:p-10">
            <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--color-text-muted)" }}>Top Rankers</div>
            <div className="space-y-0">
              {top.map((m, i) => (
                <div key={m.id} className={`flex justify-between py-3 ${i < top.length - 1 ? "border-b" : ""}`} style={{ borderColor: "var(--color-border-subtle)" }}>
                  <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{m.name}</span>
                  <span className="text-sm font-bold text-blue-600">{m.marks}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
