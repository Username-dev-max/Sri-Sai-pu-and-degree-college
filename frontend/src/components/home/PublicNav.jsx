import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search, Sun, Moon, LogIn } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import CollegeLogo from "../CollegeLogo";

const LINKS = [
  { href: "#intro", label: "About" },
  { href: "#programs", label: "Academics" },
  { href: "/departments", label: "Departments" },
  { href: "/faculty-directory", label: "Faculty" },
  { href: "/sports", label: "Sports" },
  { href: "/achievements", label: "Achievements" },
  { href: "/gallery", label: "Gallery" },
  { href: "#contact", label: "Contact" },
];

export default function PublicNav({ collegeName, search, onSearch, transparent = false }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  /**
   * Pages other than the home page have nothing to filter, so they used to
   * pass an empty value and a do-nothing handler: the box accepted a
   * keystroke, re-rendered with the same empty value, and looked as though
   * typing did nothing at all. The box now keeps its own text on those pages
   * and carries the term to the home page, where the filtering lives.
   */
  const [ownSearch, setOwnSearch] = useState("");
  const filtersHere = typeof onSearch === "function" && search !== undefined && search !== null;
  const searchValue = filtersHere ? search : ownSearch;

  function handleSearch(value) {
    if (filtersHere) onSearch(value);
    else setOwnSearch(value);
  }

  function submitSearch(e) {
    e.preventDefault();
    if (filtersHere) return;
    const term = ownSearch.trim();
    navigate(term ? `/?q=${encodeURIComponent(term)}` : "/");
    setMobileOpen(false);
  }
  // Only pages with a dark hero at the very top (Home) should get the
  // transparent-then-solid nav treatment; every other page always gets a
  // solid, theme-aware nav so its text stays legible against a light banner.
  const overDark = transparent && !scrolled;

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function goLink(href) {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(href);
    }
  }

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        !overDark ? "backdrop-blur-md shadow-sm" : ""
      }`}
      style={{
        background: overDark ? "transparent" : "var(--color-glass-bg)",
        borderBottom: overDark ? "1px solid transparent" : "1px solid var(--color-glass-border)",
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-4">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label="Scroll to top"
        >
          <CollegeLogo size={36} glow className="group-hover:scale-105 transition-transform" />
          <span
            className="font-display text-base sm:text-lg font-semibold tracking-tight hidden sm:inline"
            style={{ color: overDark ? "#ffffff" : "var(--color-text-primary)" }}
          >
            {collegeName || "Sri Sai PU and Degree College"}
          </span>
        </button>

        <ul className="hidden xl:flex items-center gap-0.5 shrink-0">
          {LINKS.map((l) => (
            <li key={l.href}>
              <button
                onClick={() => goLink(l.href)}
                className="relative px-2.5 py-2 text-sm font-medium rounded-lg transition-colors group whitespace-nowrap"
                style={{ color: overDark ? "rgba(255,255,255,0.85)" : "var(--color-text-secondary)" }}
              >
                {l.label}
                <span className="absolute left-3.5 right-3.5 -bottom-0.5 h-[2px] bg-blue-500 rounded-full scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-200" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 min-w-0">
          <form onSubmit={submitSearch} className="hidden lg:flex items-center relative min-w-0 flex-1 max-w-[180px] xl:max-w-[220px]">
            <Search size={15} className="absolute left-3 pointer-events-none shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search programs…"
              aria-label="Search programs and departments"
              className="w-full min-w-0 pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-shadow"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
            />
          </form>

          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--color-text-secondary)", background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ opacity: 0, rotate: -60 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 60 }}
                transition={{ duration: 0.2 }}
                className="flex"
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </motion.span>
            </AnimatePresence>
          </button>

          <button
            onClick={() => navigate("/login")}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition-colors"
          >
            <LogIn size={15} />
            Login
          </button>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="xl:hidden w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: "var(--color-text-secondary)", background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)" }}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="xl:hidden overflow-hidden border-t"
            style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-subtle)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <div className="px-4 sm:px-6 py-4 flex flex-col gap-1">
              <form onSubmit={submitSearch} className="relative mb-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
                <input
                  value={searchValue}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search programs, departments…"
                  aria-label="Search programs and departments"
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-primary)" }}
                />
              </form>
              {LINKS.map((l) => (
                <button
                  key={l.href}
                  onClick={() => goLink(l.href)}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-medium sidebar-link"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => navigate("/login")}
                className="mt-2 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                <LogIn size={15} />
                Login
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
