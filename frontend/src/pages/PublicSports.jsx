import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

export default function PublicSports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    client
      .get("/public/overview")
      .then(({ data }) => setData(data))
      .catch(() => setError(true));
  }

  useEffect(load, []);

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={data?.college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-16 px-4 sm:px-6 text-center bg-gradient-to-br from-[#0b1526] via-[#0f1e33] to-[#16294a]">
        <div className="max-w-3xl mx-auto">
          <Trophy size={32} className="mx-auto mb-4 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Sports Excellence</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            State-level sporting achievements
          </h1>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-16" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-6xl mx-auto">
          {error ? (
            <ErrorState message="Couldn't load sports achievements." onRetry={load} />
          ) : !data ? (
            <Loader label="Loading…" />
          ) : data.sportsAchievements.length === 0 ? (
            <EmptyState icon={Trophy} title="No sports achievements published yet." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {data.sportsAchievements.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="glow-card glow-gold rounded-2xl p-5 text-center shadow-sm"
                  style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
                >
                  <div className="font-display text-2xl font-semibold text-blue-600">{s.year}</div>
                  <div className="text-sm font-semibold mt-2" style={{ color: "var(--color-text-primary)" }}>{s.sport}</div>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                    {s.category && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "var(--color-warning-subtle)", color: "var(--color-warning)" }}>
                        {s.category}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(37,99,235,0.1)", color: "var(--color-brand-600)" }}>
                      {s.level}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <p className="text-xs mt-8 text-center" style={{ color: "var(--color-text-muted)" }}>
            Player names and additional sports statistics were not provided and are not shown.
          </p>
        </div>
      </section>

      <PublicFooter college={data?.college || {}} />
    </div>
  );
}
