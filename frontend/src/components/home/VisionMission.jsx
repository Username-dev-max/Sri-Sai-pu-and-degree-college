import { motion } from "framer-motion";
import { Eye, Target } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

export default function VisionMission({ vision, mission }) {
  const reduced = usePrefersReducedMotion();
  if (!vision && !mission) return null;

  const items = [
    vision && { icon: Eye, title: "Vision", text: vision },
    mission && { icon: Target, title: "Mission", text: mission },
  ].filter(Boolean);

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6" style={{ background: "var(--color-surface-base)" }}>
      <div className={`max-w-5xl mx-auto grid gap-6 ${items.length === 2 ? "sm:grid-cols-2" : ""}`}>
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="glow-card rounded-2xl p-6 sm:p-8"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div className="w-11 h-11 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-4">
              <it.icon size={19} />
            </div>
            <h3 className="font-display text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>{it.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{it.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
