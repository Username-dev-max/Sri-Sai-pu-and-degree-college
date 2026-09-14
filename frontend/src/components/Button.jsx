import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:hover:bg-blue-600",
  secondary:
    "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] hover:bg-[var(--color-surface-sunken)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)]",
  danger:
    "bg-[var(--color-danger-strong)] text-white shadow-lg shadow-red-600/20 hover:opacity-90",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-1.5",
  lg: "px-5 py-3 text-sm gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  className = "",
  children,
  ...props
}) {
  return (
    <motion.button
      whileHover={disabled || loading ? {} : { scale: 1.02 }}
      whileTap={disabled || loading ? {} : { scale: 0.97 }}
      disabled={disabled || loading}
      className={`glow-btn inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === "sm" ? 14 : 16} />
      )}
      {children}
    </motion.button>
  );
}
