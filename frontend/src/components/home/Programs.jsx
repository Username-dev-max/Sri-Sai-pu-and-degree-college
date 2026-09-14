import { motion } from "framer-motion";
import { BookOpen, Clock, Layers, Building2, SearchX } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

const DEPT_ICON_COLORS = ["#2563eb", "#9333ea", "#16a34a", "#d97706", "#0891b2"];

export default function Programs({ courses = [], departments = [], search = "" }) {
  const reduced = usePrefersReducedMotion();
  const q = search.trim().toLowerCase();

  const deptName = (id) => departments.find((d) => d.id === id)?.name || id;

  const filteredCourses = q
    ? courses.filter((c) => c.name.toLowerCase().includes(q) || deptName(c.department).toLowerCase().includes(q))
    : courses;
  const filteredDepts = q
    ? departments.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
    : departments;

  return (
    <section id="programs" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Academics</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Degree programs built around real outcomes
          </h2>
        </div>

        {q && filteredCourses.length === 0 && filteredDepts.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14" style={{ color: "var(--color-text-muted)" }}>
            <SearchX size={28} className="mb-3" />
            <p className="text-sm">No programs or departments match "{search}".</p>
          </div>
        ) : (
          <>
            {filteredCourses.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
                {filteredCourses.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={reduced ? false : { opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-8%" }}
                    transition={{ delay: (i % 3) * 0.06, duration: 0.5 }}
                    className="group glow-card relative rounded-2xl p-6 overflow-hidden"
                    style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
                  >
                    <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:-translate-y-0.5">
                      <BookOpen size={19} />
                    </div>
                    <h3 className="font-semibold text-base leading-snug mb-1" style={{ color: "var(--color-text-primary)" }}>{c.name}</h3>
                    <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>{deptName(c.department)}</p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      <span className="flex items-center gap-1.5"><Clock size={13} /> {c.duration}</span>
                      <span className="flex items-center gap-1.5"><Layers size={13} /> {c.semesters} Semesters</span>
                    </div>
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                  </motion.div>
                ))}
              </div>
            )}

            {filteredDepts.length > 0 && (
              <div id="departments">
                <h3 className="text-center font-display text-xl font-semibold mb-8" style={{ color: "var(--color-text-primary)" }}>
                  Explore by Department
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {filteredDepts.map((d, i) => (
                    <motion.div
                      key={d.id}
                      initial={reduced ? false : { opacity: 0, scale: 0.94 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-8%" }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      whileHover={{ y: -4 }}
                      className="glow-card rounded-xl p-4 text-center"
                      style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2.5"
                        style={{ background: `${DEPT_ICON_COLORS[i % DEPT_ICON_COLORS.length]}1a`, color: DEPT_ICON_COLORS[i % DEPT_ICON_COLORS.length] }}
                      >
                        <Building2 size={16} />
                      </div>
                      <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{d.code}</div>
                      <div className="text-xs mt-0.5 leading-snug" style={{ color: "var(--color-text-muted)" }}>{d.name}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
