import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2 } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import CampusImage from "../CampusImage";

// Only the photographs the college has actually supplied. Add another entry
// here and the crossfade and dot controls switch themselves back on.
const SHOTS = [
  { src: "/campus/building-1.jpg", label: "[CAMPUS PHOTO]", caption: "Main campus block" },
];

export default function CampusShowcase() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  // Slow crossfade between the campus photographs. Paused entirely for
  // reduced-motion users, who just see the first frame.
  useEffect(() => {
    if (reduced || SHOTS.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SHOTS.length), 6000);
    return () => clearInterval(t);
  }, [reduced]);

  const shot = SHOTS[index];

  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 relative overflow-hidden" style={{ background: "var(--color-surface-sunken)" }}>
      {/* ambient brand glow */}
      <div
        className="absolute -top-24 left-1/4 w-[30rem] h-[30rem] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.14), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-32 right-0 w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,154,59,0.16), transparent 70%)" }}
      />

      <div className="max-w-7xl mx-auto relative grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-3">Our Campus</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            A campus built for focused learning
          </h2>
          <p className="mt-4 text-base leading-relaxed max-w-lg" style={{ color: "var(--color-text-secondary)" }}>
            Classrooms, laboratories and sports facilities on one campus in Bethamangala, Kolar.
          </p>

          <div className="flex items-center gap-3 mt-8">
            {SHOTS.length > 1 &&
              SHOTS.map((s, i) => (
                <button
                  key={s.src}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${s.caption}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === index ? 34 : 14,
                    background: i === index ? "var(--color-brand-600)" : "var(--color-border-default)",
                  }}
                />
              ))}
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{shot.caption}</span>
          </div>

          <div className="flex items-center gap-2 mt-6 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Building2 size={14} className="text-blue-600" />
            Kottur Village, V. Kotta Main Road, Bethamangala
          </div>
        </div>

        <div className="relative h-[300px] sm:h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={shot.src}
              initial={reduced ? false : { opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? {} : { opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <CampusImage
                src={shot.src}
                alt={`Sri Sai PU and Degree College — ${shot.caption}`}
                label={shot.label}
                className="w-full h-full"
                kenBurns
                glow
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
