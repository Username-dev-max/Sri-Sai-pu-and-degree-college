import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Accessible modal dialog.
 *
 * Scrolling rules, which the previous version got wrong:
 *  - While open, the PAGE BEHIND is locked. Without this, scrolling inside a
 *    modal scrolled the document instead, which read as "the profile won't
 *    scroll" — the content moved, just not the content you were looking at.
 *  - The panel is a flex column: the header stays put and only the body
 *    scrolls, so there is exactly one scrollbar, not nested ones.
 *  - The overlay itself scrolls as a fallback, so a panel taller than a short
 *    viewport (a phone in landscape) is still reachable to its last line.
 */
export default function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  const panelRef = useRef(null);

  /**
   * Lock background scroll while the dialog is open — on <body> ONLY.
   *
   * Two approaches were tried and measured before this one, and both lost the
   * reader's place:
   *  - `position: fixed` on body collapses the document height, so the
   *    browser clamps the scroll position before it can be restored.
   *  - `overflow: hidden` on <html> resets scrollTop to 0: <html> is the root
   *    scroller, and Chromium discards its position when its overflow is
   *    hidden. Measured: start 200 -> 0 in the same frame.
   *
   * `overflow: hidden` on <body> alone avoids both. Because <html> stays
   * `visible`, CSS propagates body's overflow to the viewport, so the page
   * still cannot be scrolled — but scroll position survives (measured: 200
   * stays 200). Padding compensates for the vanished scrollbar so the page
   * doesn't jump sideways.
   */
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const barWidth = window.innerWidth - documentElement.clientWidth;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

    body.style.overflow = "hidden";
    if (barWidth > 0) body.style.paddingRight = `${barWidth}px`;

    return () => {
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
    };
  }, [open]);

  // Escape closes, and focus moves into the dialog so keyboard users are not
  // left behind on the page underneath.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    // preventScroll matters: a bare focus() scrolls the focused element into
    // view, which jumped the page underneath to the top every time a dialog
    // opened — so closing it returned the reader to the wrong place.
    const t = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          {/* min-h-full + py centres a short panel but lets a tall one grow
              and scroll the overlay rather than being clipped. */}
          <div className="relative flex min-h-full items-center justify-center p-4 pointer-events-none">
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === "string" ? title : undefined}
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={`pointer-events-auto relative w-full ${width} rounded-2xl shadow-2xl flex flex-col max-h-[88vh] outline-none`}
              style={{ background: "var(--color-surface-overlay)" }}
            >
              <div
                className="flex items-center justify-between px-5 py-4 border-b shrink-0 rounded-t-2xl"
                style={{
                  borderColor: "var(--color-border-subtle)",
                  background: "color-mix(in srgb, var(--color-surface-overlay) 95%, transparent)",
                }}
              >
                <h3 className="font-bold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-1 hover:bg-black/5 shrink-0"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X size={18} />
                </button>
              </div>
              {/* The single scroll region. overscroll-contain stops a flick at
                  the end of this list from scrolling the page behind it. */}
              <div className="p-5 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
