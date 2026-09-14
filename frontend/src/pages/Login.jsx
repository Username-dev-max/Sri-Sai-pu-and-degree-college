import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, LogIn, GraduationCap, ShieldCheck, Users, KeyRound, X,
  ClipboardCheck, UserRound, Volume2, VolumeX, Sun, Moon,
} from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import useIsMobile from "../hooks/useIsMobile";
import useCatSounds from "../hooks/useCatSounds";
import CatMascot from "../components/CatMascot";
import CollegeLogo from "../components/CollegeLogo";

export const ROLE_HOME = {
  Admin: "/admin",
  Faculty: "/faculty",
  "Attendance Staff": "/attendance-staff",
  Student: "/student",
  Parent: "/parent",
};

const ROLES = [
  { key: "Admin", label: "Admin", icon: ShieldCheck, hint: "e.g. admin" },
  { key: "Faculty", label: "Faculty", icon: Users, hint: "e.g. shashi.pv" },
  { key: "Attendance Staff", label: "Attendance", icon: ClipboardCheck, hint: "e.g. attendance.staff" },
  { key: "Student", label: "Student", icon: GraduationCap, hint: "Student ID / username" },
  { key: "Parent", label: "Parent", icon: UserRound, hint: "e.g. demo.parent" },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, logout, user, updateUser } = useAuth();
  const { push } = useToast();
  const { theme, toggleTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  // The layout switches to a single column at lg, so the mascot shrinks there too.
  const isCompact = useIsMobile(1024);
  const { enabled: soundOn, setEnabled: setSoundOn, sounds } = useCatSounds();

  const [role, setRole] = useState("Student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Off by default: this is often a shared college computer. It keeps the
  // session (never the password) after the browser closes.
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingReset, setPendingReset] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  // True only after a successful sign-in performed on this page.
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // ---- cat state machine -------------------------------------------------
  const [focusField, setFocusField] = useState(null); // 'username' | 'password' | null
  const [catState, setCatState] = useState("idle");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const pauseTimer = useRef(null);
  const resultTimer = useRef(null);
  const showCat = role === "Student";

  const clearPause = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
  };

  // Derive the resting state from focus. Transient states (checking/success/
  // error/peek) are set explicitly and win until they expire.
  const restingState = useCallback(() => {
    if (focusField === "password") return "password";
    if (focusField === "username") return "username";
    return "idle";
  }, [focusField]);

  useEffect(() => {
    if (loading) return;
    setCatState((s) => (s === "success" || s === "error" ? s : restingState()));
  }, [focusField, loading, restingState]);

  useEffect(() => () => {
    clearPause();
    if (resultTimer.current) clearTimeout(resultTimer.current);
  }, []);

  // Peek: password has content and the student paused typing.
  useEffect(() => {
    clearPause();
    if (focusField !== "password" || password.length === 0 || loading) return;
    pauseTimer.current = setTimeout(() => setCatState("peek"), 900);
    return clearPause;
  }, [password, focusField, loading]);

  function onPointerMove(e) {
    if (!showCat || reduced) return;
    const { innerWidth: w, innerHeight: h } = window;
    setPointer({ x: (e.clientX / w) * 2 - 1, y: (e.clientY / h) * 2 - 1 });
  }

  function handleUsernameChange(e) {
    setUsername(e.target.value);
    if (showCat) {
      setCatState("username");
      sounds.type();
    }
  }

  /**
   * Switching role starts a completely fresh attempt. It used to change only
   * the highlighted pill and clear the error, so a username and password typed
   * for Admin stayed in the fields once Student was selected. Everything from
   * the previous attempt is reset here, and the form below is keyed by role so
   * its inputs remount empty — which also discards anything the browser's
   * autofill had painted into the old inputs.
   */
  function selectRole(next) {
    if (next === role) return;
    if (resultTimer.current) clearTimeout(resultTimer.current);
    clearPause();
    setRole(next);
    setUsername("");
    setPassword("");
    setShowPw(false);
    setError("");
    setLoading(false);
    setFocusField(null);
    setCatState("idle");
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
    if (showCat) {
      setCatState("password");
      sounds.type();
    }
  }

  /**
   * Arriving at /login means "I want to sign in", so any session already in
   * the browser is ended here.
   *
   * This page used to redirect an authenticated visitor straight back to
   * their dashboard, which made the form unreachable: after signing in as
   * Admin you could never get to the login screen to sign in as a Student —
   * you were silently returned to the Admin dashboard and appeared stuck in
   * the previous role. Clearing on arrival guarantees the credentials typed
   * below are the ones actually authenticated.
   */
  const clearedOnArrival = useRef(false);
  useEffect(() => {
    if (clearedOnArrival.current) return;
    clearedOnArrival.current = true;
    if (user) logout();
  }, [user, logout]);

  /**
   * Navigate only after a sign-in performed ON THIS PAGE. `justLoggedIn`
   * distinguishes that from a pre-existing session, which the effect above
   * has already ended.
   */
  useEffect(() => {
    if (justLoggedIn && user && !pendingReset) {
      navigate(ROLE_HOME[user.role] || "/student", { replace: true });
    }
  }, [justLoggedIn, user, pendingReset, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setCatState("checking");
    sounds.thinking();
    try {
      // Only what is in THIS form, plus the selected role. The server rejects a
      // role mismatch, so leftover credentials can't sign into another role.
      const u = await login(username.trim(), password, { role, remember });
      setJustLoggedIn(true);
      setCatState("success");
      sounds.success();
      if (u.mustReset) {
        setPendingReset(true);
        setLoading(false);
        return;
      }
      push(`Welcome back, ${(u.name || "").split(" ")[0] || u.username}!`, "success");
      // let the celebration land briefly, then continue
      resultTimer.current = setTimeout(() => {
        navigate(ROLE_HOME[u.role] || "/student", { replace: true });
      }, reduced ? 0 : 700);
    } catch {
      setCatState("error");
      sounds.error();
      setError("Oops! Please check your details.");
      setLoading(false);
      // A rejected password is never left sitting in the field.
      setPassword("");
      resultTimer.current = setTimeout(() => setCatState(restingState()), 1600);
    }
  }

  const activeRole = ROLES.find((r) => r.key === role) || ROLES[3];

  return (
    <div
      onMouseMove={onPointerMove}
      className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#0b1526] via-[#0f1e33] to-[#16294a] flex items-center justify-center p-4 sm:p-6"
    >
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-20 w-[28rem] h-[28rem] bg-blue-500/10 rounded-full blur-3xl" />

      {/* top-right utilities */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2">
        <button
          onClick={() => setSoundOn(!soundOn)}
          aria-label={soundOn ? "Turn sounds off" : "Turn sounds on"}
          title={soundOn ? "Sound on" : "Sound off"}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 border border-white/15 text-white/70 hover:text-white transition-colors"
        >
          {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 border border-white/15 text-white/70 hover:text-white transition-colors"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <div
        className={`relative z-10 w-full grid gap-8 items-center ${
          showCat ? "max-w-5xl lg:grid-cols-2" : "max-w-md"
        }`}
      >
        {/* mascot panel — Student only. Mounted/unmounted outright rather than
            animated out, so the login card never shifts while an exit settles. */}
        {showCat && (
            <motion.div
              key="cat-panel"
              initial={reduced ? false : { opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
              className="order-first flex flex-col items-center justify-center"
            >
              <CatMascot state={catState} pointer={pointer} size={isCompact ? 210 : 400} />
              <p className="text-center text-blue-100/60 text-xs sm:text-sm mt-2 lg:mt-4 max-w-xs">
                {catState === "password" || catState === "checking"
                  ? "Not peeking at your password."
                  : catState === "peek"
                    ? "…okay, maybe one eye."
                    : catState === "success"
                      ? "Welcome back!"
                      : catState === "error"
                        ? "Let's try that again."
                        : "Sign in to your student portal."}
              </p>
            </motion.div>
        )}

        {/* login card */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-dark rounded-2xl shadow-2xl p-6 sm:p-8 text-white w-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <CollegeLogo size={44} glow />
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-semibold leading-tight">Sri Sai PU and Degree College</h1>
              <p className="text-xs text-blue-200/60">
                {pendingReset ? "Set a new password to continue" : "Sign in to continue"}
              </p>
            </div>
          </div>

          {!pendingReset && (
            <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
              {ROLES.map((r) => {
                const active = r.key === role;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => selectRole(r.key)}
                    aria-pressed={active}
                    className={`relative flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                      active ? "text-white" : "text-blue-100/50 hover:text-blue-100/80"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="role-pill"
                        className="absolute inset-0 rounded-lg bg-blue-600"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <r.icon size={15} className="relative z-10" />
                    <span className="relative z-10 leading-none">{r.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {pendingReset ? (
            <ForceResetForm
              currentPassword={password}
              onDone={(patch) => {
                updateUser(patch);
                push("Password updated. Welcome aboard!", "success");
                setPendingReset(false);
              }}
            />
          ) : (
            <form
              key={role}
              name={`login-${role.toLowerCase().replace(/\s+/g, "-")}`}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div>
                <label htmlFor="login-username" className="block text-xs font-medium text-blue-200/70 mb-1.5">
                  {role === "Student" ? "Student ID / Username" : "Username"}
                </label>
                <input
                  id="login-username"
                  value={username}
                  onChange={handleUsernameChange}
                  onFocus={() => setFocusField("username")}
                  onBlur={() => setFocusField(null)}
                  required
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={activeRole.hint}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60 transition-shadow"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-blue-200/70 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    onFocus={() => setFocusField("password")}
                    onBlur={() => setFocusField(null)}
                    required
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white/10 border border-white/15 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60 transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-blue-200/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    title="Stay signed in on this device after the browser closes. Your password is never stored."
                    className="rounded border-white/30 bg-white/10"
                  />
                  Remember me
                </label>
                <button type="button" onClick={() => setForgotOpen(true)} className="text-blue-300 hover:text-blue-200">
                  Forgot password?
                </button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
                >
                  {error}
                </motion.div>
              )}

              <motion.button
                whileHover={reduced ? {} : { scale: 1.015 }}
                whileTap={reduced ? {} : { scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-60"
              >
                <LogIn size={16} />
                {loading ? "Signing in…" : "Login"}
              </motion.button>

              <p className="text-[11px] text-center text-blue-100/40 pt-1">
                Accounts are issued by the college administration.
              </p>
            </form>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setForgotOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Forgot password"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-sm glass-dark rounded-2xl shadow-2xl p-6 text-white"
            >
              <button onClick={() => setForgotOpen(false)} aria-label="Close" className="absolute top-4 right-4 text-white/40 hover:text-white/80">
                <X size={18} />
              </button>
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center mb-4">
                <KeyRound size={20} />
              </div>
              <h3 className="font-bold text-base mb-2">Forgot your password?</h3>
              <p className="text-sm text-blue-100/70 leading-relaxed">
                Self-service reset isn't available yet. Please contact your college administrator with your username — they
                can issue you new login credentials from the management screens.
              </p>
              <button
                onClick={() => setForgotOpen(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ForceResetForm({ currentPassword, onDone }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) return setError("New password must be at least 6 characters.");
    if (newPassword !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await client.post("/auth/change-password", { currentPassword, newPassword });
      onDone({ mustReset: false });
    } catch (err) {
      setError(err.response?.data?.error || "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-blue-200/70 -mt-2">
        This is a temporary password. Choose a new one to secure your account.
      </p>
      <div>
        <label className="block text-xs font-medium text-blue-200/70 mb-1.5">New password</label>
        <input
          type="password"
          name="new-password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60 transition-shadow"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-blue-200/70 mb-1.5">Confirm new password</label>
        <input
          type="password"
          name="confirm-new-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/60 transition-shadow"
        />
      </div>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
        >
          {error}
        </motion.div>
      )}
      <motion.button
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-60"
      >
        <KeyRound size={16} />
        {loading ? "Updating…" : "Set new password"}
      </motion.button>
    </form>
  );
}
