import { motion } from "framer-motion";
import { CalendarCheck } from "lucide-react";
import StaffFaces from "./StaffFaces";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

/* =========================================================================
   StaffStage — a clean split card for Attendance Staff: an illustration
   panel on the left, the form on the right. The little shapes look away
   while a password is typed.
   ========================================================================= */
export default function StaffStage({ brand, roles, form, uiState }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl bg-white">
        {/* illustration panel */}
        <div className="relative hidden md:flex flex-col items-center justify-center gap-6 p-10 bg-gradient-to-br from-slate-100 to-slate-200">
          <StaffFaces state={uiState} size={280} />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">
              {uiState === "password" || uiState === "checking" ? "They're looking away." : "Ready for today's register."}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-[16rem]">
              Mark present, absent or leave for each class, period by period.
            </p>
          </div>
        </div>

        {/* form panel */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="p-6 sm:p-9 text-slate-900"
        >
          {brand}
          {roles}
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck size={17} className="text-blue-600" />
              <h3 className="font-display text-xl font-semibold">Attendance staff</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">Sign in to take and review class registers.</p>
            {form}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
