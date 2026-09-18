import { motion } from "framer-motion";
import { Users2, ShieldCheck } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

/* =========================================================================
   ParentStage — a single premium glass card on a dark academic backdrop,
   with a soft aurora behind it. The playful part is the sign-in button,
   which slides aside until both fields are filled (see RunawayButton).
   ========================================================================= */
export default function ParentStage({ brand, roles, form, uiState }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="w-full max-w-md mx-auto relative">
      {!reduced && (
        <>
          <motion.div
            aria-hidden="true"
            className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl"
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.75, 0.5] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-teal-400/15 blur-3xl"
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.45, 0.7, 0.45] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl p-6 sm:p-8 text-white shadow-2xl"
        style={{
          background: "rgba(8, 24, 20, 0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(16, 185, 129, 0.22)",
        }}
      >
        {brand}
        {roles}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-1">
            <Users2 size={17} className="text-emerald-300" />
            <h3 className="font-display text-xl font-semibold">Parent sign in</h3>
          </div>
          <p className="text-xs text-emerald-100/60 mb-5">
            {uiState === "checking" ? "Checking your credentials…" : "Follow your child's attendance, marks and fees."}
          </p>
          {form}
          <p className="flex items-start gap-1.5 text-[11px] mt-4 text-emerald-100/45">
            <ShieldCheck size={12} className="shrink-0 mt-px" />
            You will only ever see the children linked to your account.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
