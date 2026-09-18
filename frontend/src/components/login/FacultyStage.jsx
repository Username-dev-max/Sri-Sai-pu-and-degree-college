import { motion } from "framer-motion";
import FacultyMascot from "./FacultyMascot";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import useIsMobile from "../../hooks/useIsMobile";

const CAPTION = {
  idle: "Your owl is keeping watch.",
  username: "Looking up your staff record…",
  password: "Eyes covered — nobody is watching you type.",
  peek: "…still not looking.",
  checking: "Checking with the office…",
  success: "Welcome back!",
  error: "Let's try that again.",
};

/** Faculty sign-in with an animated owl that reacts to the form. */
export default function FacultyStage({ brand, roles, form, uiState, pointer }) {
  const reduced = usePrefersReducedMotion();
  const compact = useIsMobile(1024);

  return (
    <div className="w-full max-w-5xl mx-auto grid gap-8 lg:grid-cols-2 items-center">
      <motion.div
        initial={reduced ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
        className="order-first flex flex-col items-center justify-center"
      >
        <FacultyMascot state={uiState} pointer={pointer} size={compact ? 210 : 340} />
        <p className="text-center text-blue-100/60 text-xs sm:text-sm mt-3 max-w-xs">{CAPTION[uiState] || CAPTION.idle}</p>
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="glass-dark rounded-2xl shadow-2xl p-6 sm:p-8 text-white w-full"
      >
        {brand}
        {roles}
        {form}
      </motion.div>
    </div>
  );
}
