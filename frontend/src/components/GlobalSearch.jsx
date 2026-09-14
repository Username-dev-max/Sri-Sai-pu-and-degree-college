import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, UserRound, GraduationCap, Users2, ShieldCheck } from "lucide-react";
import client from "../api/client";

const TYPE_ICON = { student: UserRound, faculty: GraduationCap, parent: Users2, staff: ShieldCheck, admin: ShieldCheck };
const TYPE_LABEL = { student: "Student", faculty: "Faculty", parent: "Parent", staff: "Attendance Staff", admin: "Admin" };

/**
 * Admin-only global search across students, faculty, parents and staff.
 * Results come from GET /api/admin/search, which is itself Admin-gated — so
 * this is a convenience surface, not the access control.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const search = useCallback((term) => {
    if (!term.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    client
      .get(`/admin/search?q=${encodeURIComponent(term)}&pageSize=8`)
      .then(({ data }) => {
        setResults(data.results || []);
        setTotal(data.total || 0);
        setCursor(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Ctrl/Cmd-K focuses the box, the convention users expect.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(r) {
    setOpen(false);
    setQ("");
    navigate(r.href);
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md min-w-0">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search students, faculty, parents…"
        aria-label="Global search"
        className="input pl-9 pr-10 min-w-0"
      />
      <kbd
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded hidden sm:block pointer-events-none"
        style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : "⌘K"}
      </kbd>

      <AnimatePresence>
        {open && q.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 mt-2 glass rounded-xl shadow-xl border z-30 overflow-hidden"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            {results.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                {loading ? "Searching…" : `No matches for "${q}"`}
              </div>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto no-scrollbar">
                  {results.map((r, i) => {
                    const Icon = TYPE_ICON[r.type] || UserRound;
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => go(r)}
                        onMouseEnter={() => setCursor(i)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
                        style={{ background: i === cursor ? "rgba(59,130,246,0.08)" : "transparent" }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(59,130,246,0.12)", color: "var(--color-brand-600)" }}
                        >
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{r.title}</div>
                          <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{r.subtitle}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--color-surface-sunken)", color: "var(--color-text-muted)" }}>
                          {TYPE_LABEL[r.type]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {total > results.length && (
                  <div className="px-3.5 py-2 text-[11px] border-t" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                    Showing {results.length} of {total} matches — refine your search to narrow it.
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
