import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Users, GraduationCap, Building2, BookOpen } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

function Counter({ value }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    const start = performance.now();
    const duration = 900;
    let raf;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduced]);

  return <span ref={ref}>{display}+</span>;
}

const STAT_META = [
  { key: "students", label: "Students", icon: Users },
  { key: "faculty", label: "Faculty Members", icon: GraduationCap },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "courses", label: "Degree Programs", icon: BookOpen },
];

export default function CollegeIntro({ stats, college = {}, departments = [] }) {
  const reduced = usePrefersReducedMotion();
  const collegeName = college.name;
  const deptList = departments.map((d) => d.name).join(", ");
  return (
    <section id="intro" className="py-20 sm:py-28 px-4 sm:px-6 overflow-hidden" style={{ background: "var(--color-surface-base)" }}>
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={reduced ? false : { opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">About the College</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-5" style={{ color: "var(--color-text-primary)" }}>
            A focused academic community, built for outcomes
          </h2>
          <p className="text-base leading-relaxed mb-4" style={{ color: "var(--color-text-secondary)" }}>
            {college.description || (
              <>
                {collegeName || "Sri Sai PU and Degree College"} offers undergraduate programs
                {deptList ? ` across ${deptList}` : ""}. Every department is led by qualified faculty, with class
                sizes kept small enough for real mentorship.
              </>
            )}
          </p>
          {college.principalName && (
            <p className="text-sm font-medium mb-4" style={{ color: "var(--color-text-primary)" }}>
              Led by {college.principalTitle || "Principal"} {college.principalName}
            </p>
          )}
          <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            The same academic operations that run admissions, attendance, examinations and results behind the
            scenes are the ones this website connects you to — as a prospective student today, and as an
            enrolled student, faculty member, or administrator afterwards.
          </p>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 gap-4 sm:gap-5"
        >
          {STAT_META.map((m, i) => (
            <motion.div
              key={m.key}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="rounded-2xl p-5 sm:p-6 min-w-0"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
            >
              <m.icon size={20} className="text-blue-600 mb-3" />
              <div className="font-display text-3xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
                <Counter value={stats?.[m.key] || 0} />
              </div>
              <div className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>{m.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
