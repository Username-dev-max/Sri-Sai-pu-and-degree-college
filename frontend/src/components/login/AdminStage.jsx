import { motion } from "framer-motion";
import CatMascot from "../CatMascot";
import { ShieldCheck, Landmark, ScrollText } from "lucide-react";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

/* =========================================================================
   AdminStage — a split-screen sign-in: a deep-green editorial panel on one
   side, the form on a warm paper panel on the other, with a single lit
   "blade" that sweeps across the seam as the page settles.

   Inspired by the split-screen reference, rebuilt from scratch with the
   college's own navy/gold identity and its own copy. One transform drives
   the blade, so it stays cheap.
   ========================================================================= */
export default function AdminStage({ brand, roles, form, uiState, pointer, onPoke }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* The college mascot. Every sign-in page shows it, and on a phone it
          sits above the card where the illustration panels cannot fit. */}
      <div className="flex flex-col items-center mb-5">
        <CatMascot state={uiState} pointer={pointer} size={150} onPoke={onPoke} />
      </div>

      <div className="relative grid lg:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl bg-[#f7f4ee]">
        {/* left: editorial panel */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0d2a22] via-[#103128] to-[#0a1f19] text-white overflow-hidden">
          {!reduced && (
            <motion.span
              aria-hidden="true"
              initial={{ x: "-120%" }}
              animate={{ x: "140%" }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-300/15 to-transparent skew-x-12"
            />
          )}
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Administration</p>
            <h2 className="font-display text-3xl leading-tight mt-4">
              Run the college
              <span className="block italic text-emerald-200">from one desk.</span>
            </h2>
            <p className="text-sm text-emerald-100/60 mt-4 max-w-xs leading-relaxed">
              Enrolment, faculty, attendance, internal marks, fees and announcements — every record in one place, with an
              audit trail behind each change.
            </p>
          </div>
          <ul className="relative z-10 space-y-3 text-sm text-emerald-100/75">
            {[
              [Landmark, "Students, faculty and accounts"],
              [ShieldCheck, "Role-based access, enforced server-side"],
              [ScrollText, "Every administrative action is logged"],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-2.5">
                <Icon size={15} className="text-emerald-300 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* right: the form on paper */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: reduced ? 0 : 0.15 }}
          className="p-6 sm:p-10 text-slate-900"
        >
          {brand}
          {roles}
          <div className="mt-6">
            <h3 className="font-display text-xl font-semibold text-[#0d2a22]">Admin sign in</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              {uiState === "checking" ? "Checking your credentials…" : "Use the administrator account issued to you."}
            </p>
            {form}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
