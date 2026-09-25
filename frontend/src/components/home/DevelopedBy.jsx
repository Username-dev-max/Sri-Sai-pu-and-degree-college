import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users2, Briefcase, ArrowRight } from "lucide-react";
import client from "../../api/client";

export default function DevelopedBy() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);

  useEffect(() => {
    client.get("/public/teams").then(({ data }) => setTeams(data.teams)).catch(() => setTeams([]));
  }, []);

  if (!teams || teams.length === 0) return null;

  return (
    <section id="developed-by" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Developed By</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            The teams behind this system
          </h2>
          <p className="text-sm mt-3" style={{ color: "var(--color-text-secondary)" }}>
            Every member has a profile with their department, year and resume.
          </p>
          <button
            onClick={() => navigate("/teams")}
            className="group inline-flex items-center gap-2 mt-5 px-5 min-h-[44px] rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "#1d4ed8" }}
          >
            <Briefcase size={16} />
            Hire from our teams
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {teams.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ delay: (i % 4) * 0.06, duration: 0.4 }}
              whileHover={{ y: -3, scale: 1.015 }}
              onClick={() => navigate(`/teams/${t.id}`)}
              className="glass glow-card group rounded-2xl p-6 text-center shadow-sm"
              style={{ border: "1px solid var(--color-border-subtle)" }}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Users2 size={20} />
              </div>
              <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{t.name}</div>
              <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
              </div>
              <div
                className="text-xs font-semibold mt-4 pt-3 border-t transition-colors group-hover:text-blue-600"
                style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border-subtle)" }}
              >
                View Team Members
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
