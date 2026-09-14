import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

/* =========================================================================
   Charts.jsx — plain-SVG charts.

   Deliberately no charting library: recharts/chart.js would add ~150-400 KB
   of JavaScript for a handful of bars, and this has to stay responsive on
   low-end laptops and phones. Everything here is SVG plus a CSS transition,
   with animation dropped entirely under prefers-reduced-motion.

   Every component renders an honest empty state rather than a fake baseline
   when it is handed no data.
   ========================================================================= */

const PALETTE = ["#2563eb", "#c99a3b", "#0ea5e9", "#7c3aed", "#059669", "#dc2626", "#db2777", "#ea580c"];

function ChartFrame({ title, subtitle, children, empty, action }) {
  return (
    <div className="glass glow-card rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <BarChart3 size={22} style={{ color: "var(--color-text-muted)" }} />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No data yet. This chart fills in as records are added.
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Horizontal bars — best for category comparisons with readable labels. */
export function BarList({ title, subtitle, data = [], valueLabel = "", formatValue }) {
  const reduced = usePrefersReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = formatValue || ((v) => v.toLocaleString("en-IN"));

  return (
    <ChartFrame title={title} subtitle={subtitle} empty={data.length === 0}>
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={d.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-xs font-medium truncate" style={{ color: "var(--color-text-secondary)" }}>{d.label}</span>
              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: "var(--color-text-primary)" }}>
                {fmt(d.value)}{valueLabel}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-sunken)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${(d.value / max) * 100}%` }}
                transition={{ duration: 0.6, delay: reduced ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

/** Donut — for a two-to-five slice split of one whole. */
export function Donut({ title, subtitle, data = [], centerLabel, formatValue }) {
  const reduced = usePrefersReducedMotion();
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = formatValue || ((v) => v.toLocaleString("en-IN"));

  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <ChartFrame title={title} subtitle={subtitle} empty={total === 0}>
      <div className="flex items-center gap-5 flex-wrap">
        <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0 -rotate-90">
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * C;
            const el = (
              <motion.circle
                key={d.key}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="16"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: reduced ? 0 : i * 0.08 }}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="min-w-0 flex-1 space-y-1.5">
          {centerLabel && (
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {centerLabel}
            </div>
          )}
          {data.map((d, i) => (
            <div key={d.key} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate" style={{ color: "var(--color-text-secondary)" }}>{d.label}</span>
              <span className="ml-auto font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                {fmt(d.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}

/** Line/area trend — for a value over ordered periods (admissions by year). */
export function Trend({ title, subtitle, data = [], formatValue }) {
  const reduced = usePrefersReducedMotion();
  const fmt = formatValue || ((v) => v.toLocaleString("en-IN"));
  if (data.length === 0) return <ChartFrame title={title} subtitle={subtitle} empty />;

  const W = 320;
  const H = 120;
  const PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  // A single data point has no line to draw — centre it instead of dividing by zero.
  const x = (i) => (data.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (data.length - 1));
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `${x(0)},${H - PAD} ${points} ${x(data.length - 1)},${H - PAD}`;

  return (
    <ChartFrame title={title} subtitle={subtitle}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.polygon
          points={area}
          fill="url(#trendFill)"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {data.map((d, i) => (
          <circle key={d.key} cx={x(i)} cy={y(d.value)} r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex justify-between mt-2 gap-1">
        {data.map((d) => (
          <div key={d.key} className="text-center min-w-0 flex-1">
            <div className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {fmt(d.value)}
            </div>
            <div className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{d.label}</div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
