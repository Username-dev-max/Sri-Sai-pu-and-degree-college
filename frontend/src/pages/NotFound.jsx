import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-[#f4f7fb]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-6xl font-extrabold text-slate-200">404</h1>
        <p className="text-slate-500 mt-2 mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/login" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          Back to Login
        </Link>
      </motion.div>
    </div>
  );
}
