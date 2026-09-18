import { useState } from "react";
import { motion } from "framer-motion";
import { ImageOff } from "lucide-react";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

/**
 * Real campus photograph with a graceful fallback: if the file hasn't been
 * added to /public/campus yet, the labelled placeholder is shown instead of a
 * broken image. Optional slow Ken-Burns drift and a soft brand glow, both
 * disabled under prefers-reduced-motion.
 */
/**
 * Callers historically passed developer shorthand such as "[CAMPUS PHOTO]".
 * That bracketed, shouted form leaked onto the public site and read as an
 * unfinished page, so it is normalised to ordinary sentence case here — one
 * place, rather than hunting every caller. Nothing is invented: the tile
 * still says plainly that the photograph has not been added.
 */
function tidyLabel(raw) {
  const inner = String(raw).replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!inner) return "Photograph coming soon";
  if (/^[A-Z0-9 ./-]+$/.test(inner)) {
    return inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase();
  }
  return inner;
}

export default function CampusImage({
  src,
  alt,
  label = "Photograph coming soon",
  className = "",
  kenBurns = false,
  glow = false,
  rounded = "rounded-2xl",
  // "cover" crops to fill — right for photographs. "contain" shows the whole
  // image — right for posters and notices, where a crop would cut off text.
  fit = "cover",
}) {
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);

  const glowStyle = glow
    ? { boxShadow: "0 0 0 1px var(--color-border-subtle), 0 24px 60px -24px rgba(37,99,235,0.45)" }
    : undefined;

  if (failed || !src) {
    return (
      <div
        className={`${rounded} flex flex-col items-center justify-center gap-3 ${className}`}
        style={{
          background:
            "repeating-linear-gradient(135deg, var(--color-surface-sunken), var(--color-surface-sunken) 10px, var(--color-surface-raised) 10px, var(--color-surface-raised) 20px)",
          border: "1px dashed var(--color-border-default)",
          color: "var(--color-text-muted)",
          ...glowStyle,
        }}
      >
        <ImageOff size={26} />
        <span className="text-xs font-semibold tracking-wide text-center px-3">{tidyLabel(label)}</span>
      </div>
    );
  }

  return (
    <div
      className={`${rounded} overflow-hidden ${className}`}
      style={{ ...glowStyle, ...(fit === "contain" ? { background: "var(--color-surface-sunken)" } : null) }}
    >
      <motion.img
        src={src}
        alt={alt || label}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        animate={kenBurns && !reduced ? { scale: [1, 1.07, 1], x: [0, -8, 0] } : {}}
        transition={kenBurns && !reduced ? { duration: 22, repeat: Infinity, ease: "easeInOut" } : {}}
      />
    </div>
  );
}
