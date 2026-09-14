import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";

export default function DepartmentsStrip({ departments = [] }) {
  const navigate = useNavigate();
  if (!departments.length) return null;

  return (
    <section id="departments" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Departments</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Subjects taught across the college
            </h2>
          </div>
          <button onClick={() => navigate("/departments")} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Vision &amp; Mission →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {departments.map((d, i) => (
            <motion.button
              key={d.id}
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ delay: (i % 6) * 0.05, duration: 0.4 }}
              whileHover={{ y: -3 }}
              onClick={() => navigate(`/departments/${d.id}`)}
              className="glow-card rounded-xl p-4 text-center"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
                <Building2 size={16} />
              </div>
              <div className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{d.name}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
