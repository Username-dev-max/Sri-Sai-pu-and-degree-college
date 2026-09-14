import { motion } from "framer-motion";

export default function Loader({ label = "Loading…", full = false }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-400 ${full ? "min-h-[60vh]" : "py-16"}`}>
      <motion.div
        className="w-9 h-9 rounded-full border-2 border-blue-200 border-t-blue-600"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
