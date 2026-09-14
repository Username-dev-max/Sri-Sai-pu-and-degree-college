import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`relative w-full ${width} rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto`}
            style={{ background: "var(--color-surface-overlay)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b sticky top-0 backdrop-blur z-10"
              style={{ borderColor: "var(--color-border-subtle)", background: "color-mix(in srgb, var(--color-surface-overlay) 95%, transparent)" }}
            >
              <h3 className="font-bold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-black/5" style={{ color: "var(--color-text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
