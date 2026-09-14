import { motion } from "framer-motion";

/**
 * Pill tab switcher with an animated active indicator, extracted from the
 * near-duplicate implementations previously hand-rolled in Academics/Reports.
 * tabs: [{ key, label }]
 */
export default function Tabs({ tabs, active, onChange, layoutId = "tabs-active" }) {
  return (
    <div
      // max-w-full matters: an inline-flex box sizes to its content, so
      // without it `overflow-x-auto` never engages and a long tab row pushes
      // the whole page sideways on narrow screens.
      className="inline-flex max-w-full items-center gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar"
      style={{ background: "var(--color-surface-sunken)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
              isActive ? "text-white" : ""
            }`}
            style={!isActive ? { color: "var(--color-text-secondary)" } : undefined}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-blue-600"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
