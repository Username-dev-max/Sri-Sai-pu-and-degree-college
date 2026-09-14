/**
 * Thin, theme-aware table primitives with one standardized cell padding,
 * replacing the several slightly-different paddings hand-rolled per page.
 */
export function Table({ children, className = "" }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }) {
  return (
    <thead>
      <tr className="text-left border-b border-[var(--color-border-subtle)]" style={{ color: "var(--color-text-muted)" }}>
        {children}
      </tr>
    </thead>
  );
}

export function TableTh({ children, className = "", align = "left" }) {
  return (
    <th
      className={`px-4 py-3 font-semibold whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = "", ...props }) {
  return (
    <tr
      className={`border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-blue-500/5 transition-colors ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableTd({ children, className = "", align = "left" }) {
  return (
    <td
      className={`px-4 py-3 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${className}`}
      style={{ color: "var(--color-text-secondary)" }}
    >
      {children}
    </td>
  );
}

export default Table;
