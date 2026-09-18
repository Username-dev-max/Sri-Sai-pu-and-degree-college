import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/* =========================================================================
   AuthFields — the ONE sign-in form, shared by all five role experiences.

   Each role gets its own visual stage around this form, but the fields, the
   validation, the submit and the error handling exist once. That is what
   keeps five designs on a single authentication path: there is no second
   login implementation to drift out of step, and every role posts the same
   credentials to the same endpoint, which enforces the role server-side.

   `tone` only swaps colour classes. It never changes behaviour.
   ========================================================================= */

const TONES = {
  dark: {
    label: "text-blue-200/70",
    input: "bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:ring-blue-400/50 focus:border-blue-400/60",
    muted: "text-blue-200/70",
    link: "text-blue-300 hover:text-blue-200",
    error: "text-red-300 bg-red-500/10 border-red-500/20",
    button: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40",
    note: "text-blue-100/40",
  },
  light: {
    label: "text-slate-500",
    input: "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500/40 focus:border-blue-400",
    muted: "text-slate-500",
    link: "text-blue-600 hover:text-blue-700",
    error: "text-red-700 bg-red-50 border-red-200",
    button: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25",
    note: "text-slate-400",
  },
};

export default function AuthFields({
  role,
  usernameLabel = "Username",
  usernameHint = "",
  username,
  password,
  showPw,
  remember,
  loading,
  error,
  tone = "dark",
  submitLabel = "Login",
  onUsernameChange,
  onPasswordChange,
  onToggleShowPw,
  onRememberChange,
  onForgot,
  onFocusField,
  onSubmit,
  renderSubmit,
}) {
  const t = TONES[tone] || TONES.dark;
  const idPrefix = `login-${String(role).toLowerCase().replace(/\s+/g, "-")}`;

  const submitButton = (
    <motion.button
      whileHover={loading ? {} : { scale: 1.015 }}
      whileTap={loading ? {} : { scale: 0.98 }}
      type="submit"
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm shadow-lg transition-colors disabled:opacity-60 ${t.button}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
      {loading ? "Signing in…" : submitLabel}
    </motion.button>
  );

  return (
    <form
      // Keyed by role by the caller, so switching role remounts these inputs
      // empty — which also discards anything the browser autofilled.
      name={`${idPrefix}-form`}
      onSubmit={onSubmit}
      className="space-y-4"
    >
      <div>
        <label htmlFor={`${idPrefix}-username`} className={`block text-xs font-medium mb-1.5 ${t.label}`}>
          {usernameLabel}
        </label>
        <input
          id={`${idPrefix}-username`}
          value={username}
          onChange={onUsernameChange}
          onFocus={() => onFocusField?.("username")}
          onBlur={() => onFocusField?.(null)}
          required
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={usernameHint}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-shadow ${t.input}`}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-password`} className={`block text-xs font-medium mb-1.5 ${t.label}`}>
          Password
        </label>
        <div className="relative">
          <input
            id={`${idPrefix}-password`}
            type={showPw ? "text" : "password"}
            value={password}
            onChange={onPasswordChange}
            onFocus={() => onFocusField?.("password")}
            onBlur={() => onFocusField?.(null)}
            required
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-shadow ${t.input}`}
          />
          <button
            type="button"
            onClick={onToggleShowPw}
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${tone === "dark" ? "text-white/40 hover:text-white/80" : "text-slate-400 hover:text-slate-600"}`}
            aria-label={showPw ? "Hide password" : "Show password"}
            aria-pressed={showPw}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs gap-3">
        <label className={`flex items-center gap-2 cursor-pointer ${t.muted}`}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => onRememberChange(e.target.checked)}
            title="Stay signed in on this device after the browser closes. Your password is never stored."
            className={tone === "dark" ? "rounded border-white/30 bg-white/10" : "rounded border-slate-300"}
          />
          Remember me
        </label>
        <button type="button" onClick={onForgot} className={t.link}>
          Forgot password?
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          aria-live="polite"
          className={`text-sm border rounded-xl px-3 py-2 ${t.error}`}
        >
          {error}
        </motion.div>
      )}

      {/* The Parent stage replaces the button with its own playful one. */}
      {renderSubmit ? renderSubmit(submitButton) : submitButton}

      <p className={`text-[11px] text-center pt-1 ${t.note}`}>Accounts are issued by the college administration.</p>
    </form>
  );
}
