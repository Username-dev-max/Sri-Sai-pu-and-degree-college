import { Inbox } from "lucide-react";

export default function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet.", description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" style={{ color: "var(--color-text-muted)" }}>
      <Icon size={36} className="mb-3" />
      <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>{title}</p>
      {description && <p className="text-xs mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
