import { useState } from "react";
import { GraduationCap } from "lucide-react";

/**
 * Renders the real college crest from /public/campus/logo.png, falling back to
 * a neutral academic mark if the file is ever missing so nothing pretends to be
 * the official crest. The PNG was derived from the supplied artwork: outer
 * margin trimmed so the crest fills its box at small sizes, and the surrounding
 * white flood-filled to transparent so it sits on any theme colour. Interior
 * whites are untouched, so the lamp and ribbon still read on dark surfaces.
 */
export default function CollegeLogo({ size = 36, className = "", glow = false }) {
  const [failed, setFailed] = useState(false);

  const glowStyle = glow ? { boxShadow: "0 6px 22px -8px rgba(37,99,235,0.65)" } : undefined;

  if (failed) {
    return (
      <span
        className={`rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size, ...glowStyle }}
      >
        <GraduationCap size={size * 0.52} className="text-white" />
      </span>
    );
  }

  return (
    <img
      src="/campus/logo.png"
      alt="Sri Sai PU and Degree College crest"
      onError={() => setFailed(true)}
      className={`college-crest object-contain shrink-0 ${className}`}
      style={{ width: size, height: size, ...glowStyle }}
    />
  );
}
