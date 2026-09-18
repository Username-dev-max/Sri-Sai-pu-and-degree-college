import { motion } from "framer-motion";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

/* =========================================================================
   StaffFaces — three friendly shapes standing in for a class being marked.

   They watch the username field, and turn away and shut their eyes the
   moment the password field is focused, so nobody is "looking" while a
   password is typed. Original artwork: plain SVG shapes, no external asset.
   ========================================================================= */

const SHAPES = [
  { key: "a", x: 20, w: 58, h: 92, r: 29, fill: "#f59e0b", delay: 0 },
  { key: "b", x: 86, w: 46, h: 120, r: 23, fill: "#1f2937", delay: 0.08 },
  { key: "c", x: 140, w: 50, h: 100, r: 25, fill: "#7c3aed", delay: 0.16 },
];

export default function StaffFaces({ state = "idle", size = 300 }) {
  const reduced = usePrefersReducedMotion();
  const shy = state === "password" || state === "checking";
  const happy = state === "success";
  const sad = state === "error";

  return (
    <div style={{ width: size, maxWidth: "100%" }} className="select-none" aria-hidden="true">
      <svg viewBox="0 0 210 170" width="100%" style={{ display: "block", overflow: "visible" }}>
        <ellipse cx="105" cy="152" rx="82" ry="9" fill="#0f172a" opacity="0.12" />
        {SHAPES.map((s, i) => {
          const top = 150 - s.h;
          const eyeY = top + s.h * 0.34;
          return (
            <motion.g
              key={s.key}
              initial={reduced ? false : { y: 16, opacity: 0 }}
              animate={
                reduced
                  ? { y: 0, opacity: 1 }
                  : {
                      y: happy ? [0, -10, 0] : 0,
                      opacity: 1,
                      rotate: sad ? [0, -4, 4, 0] : shy ? (i === 0 ? -8 : i === 1 ? 6 : -5) : 0,
                    }
              }
              transition={{ delay: s.delay, type: "spring", stiffness: 180, damping: 16 }}
              style={{ transformOrigin: `${s.x + s.w / 2}px 150px` }}
            >
              {/* body: a rounded "tombstone" shape */}
              <path
                d={`M${s.x} 150 L${s.x} ${top + s.r} a${s.r} ${s.r} 0 0 1 ${s.w} 0 L${s.x + s.w} 150 z`}
                fill={s.fill}
              />
              {shy ? (
                // eyes shut, turned away
                <>
                  <path
                    d={`M${s.x + s.w * 0.26} ${eyeY} q${s.w * 0.1} ${s.h * 0.05} ${s.w * 0.2} 0`}
                    stroke="#fff"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M${s.x + s.w * 0.56} ${eyeY} q${s.w * 0.1} ${s.h * 0.05} ${s.w * 0.2} 0`}
                    stroke="#fff"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <circle cx={s.x + s.w * 0.34} cy={eyeY} r="3.6" fill="#fff" />
                  <circle cx={s.x + s.w * 0.66} cy={eyeY} r="3.6" fill="#fff" />
                </>
              )}
              {/* mouth */}
              <path
                d={
                  happy
                    ? `M${s.x + s.w * 0.32} ${eyeY + 14} q${s.w * 0.18} ${s.h * 0.1} ${s.w * 0.36} 0`
                    : sad
                      ? `M${s.x + s.w * 0.32} ${eyeY + 18} q${s.w * 0.18} -${s.h * 0.08} ${s.w * 0.36} 0`
                      : `M${s.x + s.w * 0.36} ${eyeY + 15} q${s.w * 0.14} ${s.h * 0.04} ${s.w * 0.28} 0`
                }
                stroke="#fff"
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
                opacity="0.9"
              />
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
