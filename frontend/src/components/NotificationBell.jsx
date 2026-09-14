import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Megaphone, UserCog, FileText, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const ICONS = { announcement: Megaphone, account: UserCog, document: FileText, info: Info };

/** Where a notification's "related record" lives, per role. */
const ANNOUNCEMENT_PATH = {
  Admin: "/admin/announcements",
  Faculty: "/faculty/announcements",
  Student: "/student/announcements",
  Parent: "/parent/announcements",
  "Attendance Staff": "/attendance-staff/announcements",
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Server-backed notification feed. Read state lives in the database against
 * the user's own account, so it follows them across devices — the previous
 * localStorage approach only worked on one browser.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    client
      .get("/notifications?limit=12")
      .then(({ data }) => {
        setItems(data.notifications || []);
        setUnread(data.unreadCount || 0);
      })
      .catch(() => {
        // A failed poll must not break the page chrome.
        setItems([]);
        setUnread(0);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    // Light poll so a newly published announcement shows up without a reload.
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user, load]);

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await client.post("/notifications/read-all");
    } catch {
      load(); // put the real state back if it failed
    }
  }

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      client.patch(`/notifications/${n.id}/read`).catch(() => load());
    }
    if (n.relatedType === "announcement") {
      navigate(ANNOUNCEMENT_PATH[user?.role] || "/student/announcements");
    }
  }

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.08 }}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: "var(--color-danger-strong)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
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
              className="absolute right-0 mt-2 w-80 max-w-[85vw] glass rounded-xl shadow-xl border z-20 overflow-hidden"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto no-scrollbar">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Nothing yet.
                  </div>
                ) : (
                  items.map((n) => {
                    const Icon = ICONS[n.type] || Info;
                    return (
                      <button
                        key={n.id}
                        onClick={() => openItem(n)}
                        className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-blue-500/5 transition-colors"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: "rgba(59,130,246,0.12)", color: "var(--color-brand-600)" }}
                        >
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{n.title}</p>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-brand-600)" }} />}
                          </div>
                          {n.message && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{n.message}</p>
                          )}
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
