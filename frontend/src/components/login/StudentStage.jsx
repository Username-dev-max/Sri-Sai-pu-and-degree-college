import { motion } from "framer-motion";
import CatMascot from "../CatMascot";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import useIsMobile from "../../hooks/useIsMobile";

const CAPTION = {
  idle: "Sign in to your student portal.",
  watching: "Sign in to your student portal.",
  username: "Let's find your record…",
  password: "Not peeking at your password.",
  peek: "…okay, maybe one eye.",
  thinking: "Thinking…",
  checking: "Checking with the office…",
  success: "Welcome back!",
  error: "Let's try that again.",
};

/**
 * Student sign-in: the cat is the point of this page, so it gets its own
 * half of the layout — roughly 40% of the visual area on desktop and a
 * 210px band above the form on mobile, never overlapping the fields.
 */
export default function StudentStage({ brand, roles, form, uiState, pointer }) {
  const reduced = usePrefersReducedMotion();
  const compact = useIsMobile(1024);

  return (
    <div className="w-full max-w-5xl mx-auto grid gap-8 lg:grid-cols-2 items-center">
      <motion.div
        initial={reduced ? false : { opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
        className="order-first flex flex-col items-center justify-center"
      >
        <CatMascot state={uiState} pointer={pointer} size={compact ? 220 : 400} />
        <p className="text-center text-blue-100/60 text-xs sm:text-sm mt-2 lg:mt-4 max-w-xs">
          {CAPTION[uiState] || CAPTION.idle}
        </p>
      </motion.div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-dark rounded-2xl shadow-2xl p-6 sm:p-8 text-white w-full"
      >
        {brand}
        {roles}
        {form}
      </motion.div>
    </div>
  );
}
