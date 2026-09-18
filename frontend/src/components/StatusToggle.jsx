const OPTIONS = [
  { key: "Present", short: "P", on: "var(--color-success-strong)" },
  { key: "Absent", short: "A", on: "var(--color-danger-strong)" },
  { key: "Leave", short: "L", on: "var(--color-warning-strong)" },
];

/**
 * Present / Absent / Leave segmented control for one student.
 * Large touch targets; the chosen state is announced with aria-pressed.
 */
export default function StatusToggle({ value, onChange, disabled = false, studentName = "student" }) {
  return (
    <div className="flex gap-1.5 w-full sm:w-auto" role="group" aria-label={`Attendance for ${studentName}`}>
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            aria-label={`Mark ${studentName} ${o.key.toLowerCase()}`}
            onClick={() => onChange(o.key)}
            className="flex-1 sm:flex-none sm:w-[5.25rem] min-h-[40px] px-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: active ? o.on : "var(--color-surface-raised)",
              borderColor: active ? o.on : "var(--color-border-default)",
              color: active ? "#ffffff" : "var(--color-text-secondary)",
            }}
          >
            <span className="sm:hidden">{o.short} · </span>
            {o.key}
          </button>
        );
      })}
    </div>
  );
}
