import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users2 } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

export default function TeamsPublic() {
  const navigate = useNavigate();
  const [college, setCollege] = useState(null);
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    Promise.all([
      client.get("/public/overview").then(({ data }) => setCollege(data.college)),
      client.get("/public/teams").then(({ data }) => setTeams(data.teams)),
    ]).catch(() => setError(true));
  }

  useEffect(load, []);

  return (
    <div className="relative min-h-screen">
      <PublicNav collegeName={college?.name} search="" onSearch={() => {}} />

      <section className="pt-32 pb-10 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Developed By</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            The teams behind this system
          </h1>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-14" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-7xl mx-auto">
          {error ? (
            <ErrorState message="Couldn't load teams." onRetry={load} />
          ) : !teams ? (
            <Loader label="Loading teams…" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {teams.map((t, i) => (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 4) * 0.06, duration: 0.4 }}
                  whileHover={{ y: -3 }}
                  onClick={() => navigate(`/teams/${t.id}`)}
                  className="glass glow-card rounded-2xl p-6 text-center shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto mb-4">
                    <Users2 size={20} />
                  </div>
                  <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{t.name}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      <PublicFooter college={college || {}} />
    </div>
  );
}
