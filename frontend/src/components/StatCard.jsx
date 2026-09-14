import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import TiltCard from "./TiltCard";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

function CountUp({ value, prefix = "", suffix = "" }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    const duration = 900;
    const start = performance.now();
    const numeric = typeof value === "number" ? value : parseFloat(value) || 0;
    let raf;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(numeric * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduced]);

  const isInt = Number.isInteger(typeof value === "number" ? value : parseFloat(value));
  return (
    <span ref={ref}>
      {prefix}
      {isInt ? Math.round(display).toLocaleString("en-IN") : display.toFixed(1)}
      {suffix}
    </span>
  );
}

export default function StatCard({ label, value, icon: Icon, color = "#2563eb", prefix = "", suffix = "", delay = 0 }) {
  const numeric = typeof value === "number" ? value : parseFloat(value) || 0;
  const isInt = Number.isInteger(numeric);
  const fullText = `${prefix}${isInt ? Math.round(numeric).toLocaleString("en-IN") : numeric.toFixed(1)}${suffix}`;
  return (
    <TiltCard className="relative">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
        className="glass glow-card rounded-2xl p-4 sm:p-5 shadow-sm overflow-hidden relative"
      >
        <div
          className="absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-30"
          style={{ background: color }}
        />
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="text-xs font-medium text-slate-500 min-w-0">{label}</div>
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}1a`, color }}
            >
              <Icon size={16} strokeWidth={2.2} />
            </div>
          )}
        </div>
        <div className="text-2xl font-bold truncate" title={fullText} style={{ color: "var(--color-text-primary)" }}>
          <CountUp value={value} prefix={prefix} suffix={suffix} />
        </div>
      </motion.div>
    </TiltCard>
  );
}
