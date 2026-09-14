import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

function Block({ className = "", style = {} }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className={`rounded-lg ${reduced ? "" : "animate-pulse"} ${className}`}
      style={{ background: "var(--color-surface-sunken)", ...style }}
    />
  );
}

export function SkeletonText({ width = "100%", className = "" }) {
  return <Block className={`h-3.5 ${className}`} style={{ width }} />;
}

export function SkeletonRow({ columns = 4 }) {
  return (
    <tr className="border-b border-[var(--color-border-subtle)] last:border-0">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Block className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </tbody>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`rounded-card p-5 space-y-3 ${className}`} style={{ background: "var(--color-surface-raised)" }}>
      <Block className="h-4 w-1/2" />
      <Block className="h-7 w-1/3" />
    </div>
  );
}

export default Block;
