const TONES = {
  success: { bg: "var(--color-success-subtle)", text: "var(--color-success)" },
  danger: { bg: "var(--color-danger-subtle)", text: "var(--color-danger)" },
  warning: { bg: "var(--color-warning-subtle)", text: "var(--color-warning)" },
  info: { bg: "rgba(59,130,246,0.12)", text: "var(--color-brand-600)" },
  accent: { bg: "rgba(168,85,247,0.14)", text: "#a855f7" },
  neutral: { bg: "var(--color-surface-sunken)", text: "var(--color-text-secondary)" },
};

/**
 * Generic status/category chip. Replaces the STATUS_STYLE (Fees/StudentFees)
 * and CATEGORY_COLOR (NoticesView) maps that were duplicated per-file.
 */
export default function StatusBadge({ tone = "neutral", children }) {
  const { bg, text } = TONES[tone] || TONES.neutral;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: bg, color: text }}
    >
      {children}
    </span>
  );
}
