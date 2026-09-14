import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, ChevronDown, UserCircle2, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ProfileModal from "./ProfileModal";
import GlobalSearch from "./GlobalSearch";

export default function Topbar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function handleLogout() {
    logout();
    // `replace` so Back cannot return to an authenticated screen rendered
    // with the previous account's data.
    navigate("/login", { replace: true });
  }

  return (
    <header
      className="sticky top-0 z-30 glass border-b px-4 sm:px-6 py-3 flex items-center gap-3 print:hidden"
      style={{ borderColor: "var(--color-border-subtle)" }}
    >
      <button onClick={onMenuClick} aria-label="Open menu" className="lg:hidden hover:opacity-80" style={{ color: "var(--color-text-secondary)" }}>
        <Menu size={22} />
      </button>
      <h1 className="text-lg sm:text-xl font-bold truncate shrink-0" style={{ color: "var(--color-text-primary)" }}>{title}</h1>

      {/* Global search is an Admin capability — the endpoint behind it is
          Admin-gated, so it is not offered to roles that cannot use it. */}
      {user?.role === "Admin" && (
        <div className="hidden md:flex flex-1 justify-center min-w-0 px-2">
          <GlobalSearch />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.08 }}
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === "dark" ? (
              <motion.span
                key="sun"
                initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Sun size={18} />
              </motion.span>
            ) : (
              <motion.span
                key="moon"
                initial={{ opacity: 0, rotate: 90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: -90, scale: 0.6 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Moon size={18} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <NotificationBell />

        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full hover:bg-black/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold">
              {user?.name?.[0] || "U"}
            </div>
            <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate" style={{ color: "var(--color-text-secondary)" }}>
              {user?.name}
            </span>
            <ChevronDown size={14} className="hidden sm:block" style={{ color: "var(--color-text-muted)" }} />
          </motion.button>
          <AnimatePresence>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 glass rounded-xl shadow-xl border py-1.5 z-20"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="px-3 py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{user?.name}</div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.role} · {user?.username}</div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); setProfileOpen(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-black/5"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <UserCircle2 size={16} /> My Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}
