import { AlertTriangle } from "lucide-react";
import Button from "./Button";

export default function ErrorState({ message = "Something went wrong while loading this page.", onRetry, full = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center px-4 ${full ? "min-h-[60vh]" : "py-16"}`}>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
      >
        <AlertTriangle size={22} />
      </div>
      <p className="text-sm max-w-xs" style={{ color: "var(--color-text-secondary)" }}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
