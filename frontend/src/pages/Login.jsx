import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, ShieldCheck, Users, KeyRound, X,
  ClipboardCheck, UserRound, Volume2, VolumeX, Sun, Moon,
} from "lucide-react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import useCatSounds from "../hooks/useCatSounds";
import CollegeLogo from "../components/CollegeLogo";
import AuthFields from "../components/login/AuthFields";
import RunawayButton from "../components/login/RunawayButton";
import AdminStage from "../components/login/AdminStage";
import FacultyStage from "../components/login/FacultyStage";
import StaffStage from "../components/login/StaffStage";
import StudentStage from "../components/login/StudentStage";
import ParentStage from "../components/login/ParentStage";

export const ROLE_HOME = {
  Admin: "/admin",
  Faculty: "/faculty",
  "Attendance Staff": "/attendance-staff",
  Student: "/student",
  Parent: "/parent",
};

const ROLES = [
  { key: "Admin", label: "Admin", slug: "admin", icon: ShieldCheck, hint: "e.g. admin", usernameLabel: "Admin ID / Username", stage: AdminStage, tone: "light" },
  { key: "Faculty", label: "Faculty", slug: "faculty", icon: Users, hint: "e.g. shashi.pv", usernameLabel: "Faculty ID / Username", stage: FacultyStage, tone: "dark" },
  { key: "Attendance Staff", label: "Attendance", slug: "attendance-staff", icon: ClipboardCheck, hint: "e.g. attendance.staff", usernameLabel: "Staff ID / Username", stage: StaffStage, tone: "light" },
  { key: "Student", label: "Student", slug: "student", icon: GraduationCap, hint: "Student ID / username", usernameLabel: "Student ID / Username", stage: StudentStage, tone: "dark" },
  { key: "Parent", label: "Parent", slug: "parent", icon: UserRound, hint: "e.g. demo.parent", usernameLabel: "Parent ID / Username", stage: ParentStage, tone: "dark" },
];

const byKey = (k) => ROLES.find((r) => r.key === k);
const bySlug = (s) => ROLES.find((r) => r.slug === s);

/**
 * One sign-in page, five role experiences.
 *
 * Every role renders its own visual stage but shares ONE set of fields, one
 * submit and one AuthContext.login call, so there is a single authentication
 * path. The role chosen here is sent with the credentials and re-checked by
 * the server, which rejects a mismatch — the selector is convenience, never
 * the access control.
 */
export default function Login() {
  const navigate = useNavigate();
  const { role: roleSlug } = useParams();
  const { login, logout, user, updateUser } = useAuth();
  const { push } = useToast();
  const { theme, toggleTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const { enabled: soundOn, setEnabled: setSoundOn, sounds } = useCatSounds();

  const [role, setRole] = useState(() => bySlug(roleSlug)?.key || "Student");
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
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // ---- mascot / stage state machine -------------------------------------
  const [focusField, setFocusField] = useState(null);
  const [uiState, setUiState] = useState("idle");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const pauseTimer = useRef(null);
  const resultTimer = useRef(null);
  const active = byKey(role) || ROLES[3];

  const clearPause = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
  };

  const restingState = useCallback(() => {
    if (focusField === "password") return "password";
    if (focusField === "username") return "username";
    return "idle";
  }, [focusField]);

  useEffect(() => {
    if (loading) return;
    setUiState((s) => (s === "success" || s === "error" ? s : restingState()));
  }, [focusField, loading, restingState]);

  useEffect(() => () => {
    clearPause();
    if (resultTimer.current) clearTimeout(resultTimer.current);
  }, []);

  // Peek: the password has content and the visitor paused typing.
  useEffect(() => {
    clearPause();
    if (focusField !== "password" || password.length === 0 || loading) return undefined;
    pauseTimer.current = setTimeout(() => setUiState("peek"), 900);
    return clearPause;
  }, [password, focusField, loading]);

  // Keep the URL in step so /login/faculty can be linked and reloaded.
  useEffect(() => {
    const slug = byKey(role)?.slug;
    if (slug && roleSlug !== slug) navigate(`/login/${slug}`, { replace: true });
  }, [role, roleSlug, navigate]);

  function onPointerMove(e) {
    if (reduced) return;
    const { innerWidth: w, innerHeight: h } = window;
    setPointer({ x: (e.clientX / w) * 2 - 1, y: (e.clientY / h) * 2 - 1 });
  }

  function handleUsernameChange(e) {
    setUsername(e.target.value);
    setUiState("username");
    sounds.type();
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
    setUiState("password");
    sounds.type();
  }

  /**
   * Switching role starts a completely fresh attempt.
   *
   * This is the fix for credentials "following" a role change: it used to
   * change only the highlighted pill, so a username and password typed for
   * Admin stayed in the fields once Student was selected. Everything from the
   * previous attempt is reset here, and the form is keyed by role so its
   * inputs remount empty — which also discards anything the browser's
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
    setRemember(false);
    setError("");
    setLoading(false);
    setPendingReset(false);
    setFocusField(null);
    setUiState("idle");
  }

  /**
   * Arriving at the login page means "I want to sign in", so any session
   * already in the browser is ended here — tokens, cached user and all
   * per-account caches. Without this the page redirected an authenticated
   * visitor back to their dashboard, so after signing in as Admin you could
   * never reach the form to sign in as a Student.
   */
  const clearedOnArrival = useRef(false);
  useEffect(() => {
    if (clearedOnArrival.current) return;
    clearedOnArrival.current = true;
    if (user) logout();
  }, [user, logout]);

  useEffect(() => {
    if (justLoggedIn && user && !pendingReset) {
      navigate(ROLE_HOME[user.role] || "/student", { replace: true });
    }
  }, [justLoggedIn, user, pendingReset, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setUiState("checking");
    sounds.thinking();
    try {
      // Only what is in THIS form, plus the selected role. The server rejects
      // a role mismatch, so leftover credentials cannot sign into another role.
      const u = await login(username.trim(), password, { role, remember });
      setJustLoggedIn(true);
      setUiState("success");
      sounds.success();
      if (u.mustReset) {
        setPendingReset(true);
        setLoading(false);
        return;
      }
      push(`Welcome back, ${(u.name || "").split(" ")[0] || u.username}!`, "success");
      resultTimer.current = setTimeout(() => {
        navigate(ROLE_HOME[u.role] || "/student", { replace: true });
      }, reduced ? 0 : 700);
    } catch {
      setUiState("error");
      sounds.error();
      // Never say which of the two was wrong.
      setError("Unable to sign in. Please check your credentials.");
      setLoading(false);
      setPassword("");
      resultTimer.current = setTimeout(() => setUiState(restingState()), 1600);
    }
  }

  const light = active.tone === "light";

  const brand = (
    <div className="flex items-center gap-3 mb-5">
      <CollegeLogo size={42} glow={!light} />
      <div className="min-w-0">
        <h1 className={`font-display text-base sm:text-lg font-semibold leading-tight ${light ? "text-slate-900" : ""}`}>
          Sri Sai PU and Degree College
        </h1>
        <p className={`text-xs ${light ? "text-slate-500" : "text-blue-200/60"}`}>
          {pendingReset ? "Set a new password to continue" : `${active.label} portal`}
        </p>
      </div>
    </div>
  );

  const rolePills = pendingReset ? null : (
    <div
      className={`grid grid-cols-5 gap-1 p-1 rounded-xl mb-5 ${light ? "bg-slate-100 border border-slate-200" : "bg-white/5 border border-white/10"}`}
      role="tablist"
      aria-label="Choose your role"
    >
      {ROLES.map((r) => {
        const isActive = r.key === role;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => selectRole(r.key)}
            className={`relative flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-colors ${
              isActive ? "text-white" : light ? "text-slate-500 hover:text-slate-700" : "text-blue-100/50 hover:text-blue-100/80"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="role-pill"
                className={`absolute inset-0 rounded-lg ${light ? "bg-[#0d2a22]" : "bg-blue-600"}`}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <r.icon size={15} className="relative z-10" />
            <span className="relative z-10 leading-none">{r.label}</span>
          </button>
        );
      })}
    </div>
  );

  const form = pendingReset ? (
    <ForceResetForm
      tone={active.tone}
      currentPassword={password}
      onDone={(patch) => {
        updateUser(patch);
        push("Password updated. Welcome aboard!", "success");
        setPendingReset(false);
      }}
    />
  ) : (
    <AuthFields
      // Keyed by role: the inputs remount empty when the role changes.
      key={role}
      role={role}
      tone={active.tone}
      usernameLabel={active.usernameLabel}
      usernameHint={active.hint}
      username={username}
      password={password}
      showPw={showPw}
      remember={remember}
      loading={loading}
      error={error}
      submitLabel={role === "Admin" ? "Sign in to Admin" : "Sign in"}
      onUsernameChange={handleUsernameChange}
      onPasswordChange={handlePasswordChange}
      onToggleShowPw={() => setShowPw((s) => !s)}
      onRememberChange={setRemember}
      onForgot={() => setForgotOpen(true)}
      onFocusField={setFocusField}
      onSubmit={handleSubmit}
      renderSubmit={
        role === "Parent"
          ? () => <RunawayButton ready={!!username.trim() && !!password} loading={loading} />
          : undefined
      }
    />
  );

  const Stage = active.stage;

  return (
    <div
      onMouseMove={onPointerMove}
      className={`relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4 sm:p-6 ${
        light
          ? "bg-gradient-to-br from-[#101c18] via-[#12241d] to-[#0b1713]"
          : "bg-gradient-to-br from-[#0b1526] via-[#0f1e33] to-[#16294a]"
      }`}
    >
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-20 w-[28rem] h-[28rem] bg-blue-500/10 rounded-full blur-3xl" />

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2">
        <button
          onClick={() => setSoundOn(!soundOn)}
          aria-label={soundOn ? "Turn sounds off" : "Turn sounds on"}
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

      {/* The light stages render a white card in both themes, so the real
          light palette is restored inside it (see .light-surface). */}
      <div className={`relative z-10 w-full ${light ? "light-surface" : ""}`}>
        <Stage brand={brand} roles={rolePills} form={form} uiState={uiState} pointer={pointer} />
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

function ForceResetForm({ currentPassword, onDone, tone = "dark" }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const light = tone === "light";
  const field = light
    ? "bg-white border-slate-200 text-slate-900 focus:ring-blue-500/40"
    : "bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:ring-blue-400/50";

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
      <p className={`text-xs -mt-2 ${light ? "text-slate-500" : "text-blue-200/70"}`}>
        This is a temporary password. Choose a new one to secure your account.
      </p>
      {[
        ["New password", newPassword, setNewPassword, "new-password"],
        ["Confirm new password", confirm, setConfirm, "confirm-new-password"],
      ].map(([label, value, setter, name]) => (
        <div key={name}>
          <label htmlFor={name} className={`block text-xs font-medium mb-1.5 ${light ? "text-slate-500" : "text-blue-200/70"}`}>
            {label}
          </label>
          <input
            id={name}
            type="password"
            name={name}
            autoComplete="new-password"
            value={value}
            onChange={(e) => setter(e.target.value)}
            required
            minLength={6}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-shadow ${field}`}
          />
        </div>
      ))}
      {error && (
        <div className={`text-sm border rounded-xl px-3 py-2 ${light ? "text-red-700 bg-red-50 border-red-200" : "text-red-300 bg-red-500/10 border-red-500/20"}`}>
          {error}
        </div>
      )}
      <motion.button
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-60"
      >
        <KeyRound size={16} />
        {loading ? "Updating…" : "Set new password"}
      </motion.button>
    </form>
  );
}
