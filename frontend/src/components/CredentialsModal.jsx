import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Check, KeyRound } from "lucide-react";
import Modal from "./Modal";

export default function CredentialsModal({ open, onClose, credentials, personName, mode = "enroll" }) {
  const [copied, setCopied] = useState(false);

  if (!credentials) return null;

  function copyAll() {
    const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "reset" ? "Credentials Reset" : "Enrollment Successful"}>
      <div className="flex flex-col items-center text-center mb-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
          className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-3"
        >
          <CheckCircle2 size={30} />
        </motion.div>
        <h4 className="font-bold text-slate-800">
          {mode === "reset" ? `New credentials issued for ${personName}` : `${personName} has been enrolled`}
        </h4>
        <p className="text-sm text-slate-500 mt-1">
          {mode === "reset"
            ? "Their previous password no longer works. Share these new credentials so they can sign in — they'll be asked to set a new password on first login."
            : "A login account was created automatically. Share these credentials so they can sign in — they'll be asked to set a new password on first login."}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
          <span className="text-xs font-medium text-slate-500">Username</span>
          <span className="font-mono text-sm font-semibold text-slate-800">{credentials.username}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <KeyRound size={13} /> Password
          </span>
          <span className="font-mono text-sm font-semibold text-slate-800">{credentials.password}</span>
        </div>
      </div>

      <button
        onClick={copyAll}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-navy-700 text-white py-2.5 text-sm font-semibold hover:bg-navy-800 transition-colors"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied!" : "Copy Credentials"}
      </button>
      <button onClick={onClose} className="mt-2 w-full text-center text-sm text-slate-500 py-2 hover:text-slate-700">
        Done
      </button>
    </Modal>
  );
}
