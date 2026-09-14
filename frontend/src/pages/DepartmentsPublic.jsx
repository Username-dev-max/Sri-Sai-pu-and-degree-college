import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import client from "../api/client";
import Loader from "../components/Loader";
import ErrorState from "../components/ErrorState";
import PublicNav from "../components/home/PublicNav";
import PublicFooter from "../components/home/PublicFooter";

export default function DepartmentsPublic() {
  const navigate = useNavigate();
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

      <section className="pt-32 pb-10 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Departments</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Subjects taught across the college
          </h1>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-14" style={{ background: "var(--color-surface-base)" }}>
        <div className="max-w-7xl mx-auto">
          {error ? (
            <ErrorState message="Couldn't load departments." onRetry={load} />
          ) : !data ? (
            <Loader label="Loading departments…" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {data.departments.map((d, i) => {
                const count = data.faculty.filter((f) => f.department === d.id).length;
                return (
                  <motion.button
                    key={d.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (i % 4) * 0.06, duration: 0.4 }}
                    whileHover={{ y: -3 }}
                    onClick={() => navigate(`/departments/${d.id}`)}
                    className="glow-card rounded-2xl p-6 text-left shadow-sm"
                    style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4">
                      <Building2 size={18} />
                    </div>
                    <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{d.name}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                      {count} faculty member{count === 1 ? "" : "s"}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <PublicFooter college={data?.college || {}} />
    </div>
  );
}
