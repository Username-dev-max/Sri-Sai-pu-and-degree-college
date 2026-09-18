import { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, Loader2 } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

/* =========================================================================
   RunawayButton — the Parent sign-in button that slides aside while the
   form is still incomplete, then settles once both fields are filled.

   Deliberately safe, unlike the playful original this is modelled on:
     - it only moves for a fine pointer (mouse), never for touch;
     - it never moves for the keyboard: Tab reaches it and Enter submits;
     - it stops after a few dodges, and never moves once the form is ready;
     - prefers-reduced-motion disables it completely.
   So it is a bit of character, never a barrier to signing in.
   ========================================================================= */
const MAX_DODGES = 4;

export default function RunawayButton({ ready, loading, label = "Sign in" }) {
  const reduced = usePrefersReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dodges, setDodges] = useState(0);

  const settled = ready || loading || reduced || dodges >= MAX_DODGES;

  function dodge(e) {
    if (settled) return;
    // Touch and pen leave the button where it is.
    if (e.pointerType && e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fromLeft = e.clientX - rect.left < rect.width / 2;
    setDodges((n) => {
      setOffset({ x: fromLeft ? 64 : -64, y: (n + 1) % 2 ? -10 : 10 });
      return n + 1;
    });
  }

  return (
    <div className="relative">
      <motion.button
        type="submit"
        disabled={loading}
        onPointerEnter={dodge}
        animate={settled ? { x: 0, y: 0 } : { x: offset.x, y: offset.y }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        whileHover={settled && !loading ? { scale: 1.015 } : {}}
        whileTap={loading ? {} : { scale: 0.98 }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm shadow-lg shadow-emerald-900/30 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {loading ? "Signing in…" : label}
      </motion.button>
      {!settled && (
        <p className="text-[11px] text-center mt-2 text-emerald-200/60">
          Fill both fields and it will hold still — or press Tab, then Enter.
        </p>
      )}
    </div>
  );
}
