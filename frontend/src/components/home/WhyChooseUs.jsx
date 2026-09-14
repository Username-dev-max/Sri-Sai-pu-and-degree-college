import { motion } from "framer-motion";
import { Users2, FlaskConical, LibraryBig, ShieldCheck, Laptop, Trophy } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

const POINTS = [
  { icon: Users2, title: "Small Batch Sizes", desc: "Faculty who know students by name, not roll number — mentorship that actually happens." },
  { icon: FlaskConical, title: "Hands-on Labs", desc: "Computer and science labs used for real coursework, not just demonstrations." },
  { icon: LibraryBig, title: "Structured Curriculum", desc: "Semester-wise subjects, assignments and internal assessments tracked from day one." },
  { icon: Laptop, title: "Digital-first Operations", desc: "Attendance, marks, fees and timetables run on the same system you're using right now." },
  { icon: ShieldCheck, title: "Transparent Records", desc: "Every student and faculty member has a live, accurate academic record — always up to date." },
  { icon: Trophy, title: "Outcome Focused", desc: "Coursework mapped to real semester results, not vague promises." },
];

export default function WhyChooseUs() {
  const reduced = usePrefersReducedMotion();
  return (
    <section id="campus" className="py-20 sm:py-28 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Campus Life</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            Why students choose us
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {POINTS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ delay: (i % 3) * 0.07, duration: 0.5 }}
              whileHover={{ y: -3 }}
              className="glow-card rounded-2xl p-6"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4">
                <p.icon size={19} />
              </div>
              <h3 className="font-semibold text-base mb-1.5" style={{ color: "var(--color-text-primary)" }}>{p.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
