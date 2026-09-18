import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";

/* =========================================================================
   FacultyMascot — an owl that keeps watch over the faculty sign-in.

   Original artwork: inline SVG driven by the same small state machine the
   student cat uses, so there is no new dependency, no Lottie/Rive asset and
   no WebGL. Every loop stops under prefers-reduced-motion.

   states: idle | username | password | peek | checking | success | error
   The owl never displays anything typed: on password focus it closes its
   eyes behind its wings and stays that way while typing.
   ========================================================================= */
export default function FacultyMascot({ state = "idle", pointer = { x: 0, y: 0 }, size = 300 }) {
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, "");
  const bodyId = `owlBody-${uid}`;
  const faceId = `owlFace-${uid}`;
  const [blink, setBlink] = useState(false);
  const timers = useRef([]);

  useEffect(() => {
    if (reduced) return undefined;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setBlink(true);
      const off = setTimeout(() => setBlink(false), 140);
      const next = setTimeout(loop, 2600 + Math.random() * 3600);
      timers.current.push(off, next);
    };
    const first = setTimeout(loop, 1800 + Math.random() * 2200);
    timers.current.push(first);
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduced]);

  const hidden = state === "password" || state === "checking";
  const look = state === "idle" || state === "username" ? { x: (pointer.x || 0) * 0.8, y: (pointer.y || 0) * 0.6 } : { x: 0, y: 0 };
  const eyesOpen = !hidden && !blink;
  const leftOpen = state === "peek" ? true : eyesOpen;

  const headAnim = reduced
    ? {}
    : state === "error"
      ? { rotate: [0, -10, 10, -7, 0], transition: { duration: 0.6 } }
      : state === "checking"
        ? { rotate: [0, 4, -4, 0], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }
        : { rotate: look.x * 5, x: look.x * 3, transition: { type: "spring", stiffness: 120, damping: 14 } };

  const bodyAnim = reduced
    ? {}
    : state === "success"
      ? { y: [0, -12, 0, -6, 0], transition: { duration: 0.8 } }
      : { scaleY: [1, 1.02, 1], transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" } };

  // Wings come up over the eyes while a password is being typed.
  const wingLeft = hidden ? { x: 16, y: -34, rotate: 28 } : state === "peek" ? { x: 6, y: -14, rotate: 12 } : { x: 0, y: 0, rotate: 0 };
  const wingRight = hidden || state === "peek" ? { x: -16, y: -34, rotate: -28 } : { x: 0, y: 0, rotate: 0 };

  const beak = {
    idle: "M100 118 l7 9 l-14 0 z",
    username: "M100 117 l8 10 l-16 0 z",
    password: "M100 119 l6 8 l-12 0 z",
    peek: "M100 118 l7 9 l-14 0 z",
    checking: "M100 119 l6 8 l-12 0 z",
    success: "M100 116 l9 11 l-18 0 z",
    error: "M100 120 l6 7 l-12 0 z",
  }[state] || "M100 118 l7 9 l-14 0 z";

  return (
    <div style={{ width: size, maxWidth: "100%" }} className="select-none" aria-hidden="true">
      <motion.svg viewBox="0 0 200 220" width="100%" style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f5c8d" />
            <stop offset="100%" stopColor="#22365c" />
          </linearGradient>
          <linearGradient id={faceId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eaf0fa" />
            <stop offset="100%" stopColor="#cfdcef" />
          </linearGradient>
        </defs>

        <ellipse cx="100" cy="206" rx="50" ry="8" fill="#000" opacity="0.18" />

        {/* perch */}
        <rect x="46" y="192" width="108" height="7" rx="3.5" fill="#1b2a47" opacity="0.85" />

        <motion.g animate={bodyAnim} style={{ transformOrigin: "100px 200px" }}>
          {/* body */}
          <path d="M58 190 q-4 -78 42 -78 q46 0 42 78 z" fill={`url(#${bodyId})`} />
          <path d="M80 190 q-3 -52 20 -52 q23 0 20 52 z" fill={`url(#${faceId})`} opacity="0.55" />

          {/* talons */}
          <path d="M88 190 l0 8 m-6 0 l6 -4 m6 4 l-6 -4" stroke="#f0b95b" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M112 190 l0 8 m-6 0 l6 -4 m6 4 l-6 -4" stroke="#f0b95b" strokeWidth="3" strokeLinecap="round" fill="none" />

          <motion.g animate={headAnim} style={{ transformOrigin: "100px 110px" }}>
            {/* ear tufts */}
            <path d="M66 74 L60 44 L86 64 z" fill={`url(#${bodyId})`} />
            <path d="M134 74 L140 44 L114 64 z" fill={`url(#${bodyId})`} />
            {/* head */}
            <ellipse cx="100" cy="100" rx="46" ry="42" fill={`url(#${bodyId})`} />
            {/* face disc */}
            <ellipse cx="100" cy="103" rx="38" ry="34" fill={`url(#${faceId})`} />

            {/* eyes */}
            {leftOpen ? (
              <g>
                <circle cx="84" cy="98" r="13" fill="#fbfdff" />
                <motion.circle cx="84" cy="98" r="6.5" fill="#13213b" animate={{ x: look.x * 3, y: look.y * 2 }} transition={{ type: "spring", stiffness: 200, damping: 16 }} />
                <circle cx="86.5" cy="94.5" r="2.2" fill="#fff" opacity="0.9" />
              </g>
            ) : (
              <path d="M73 98 q11 7 22 0" fill="none" stroke="#13213b" strokeWidth="3.2" strokeLinecap="round" />
            )}
            {eyesOpen ? (
              <g>
                <circle cx="116" cy="98" r="13" fill="#fbfdff" />
                <motion.circle cx="116" cy="98" r="6.5" fill="#13213b" animate={{ x: look.x * 3, y: look.y * 2 }} transition={{ type: "spring", stiffness: 200, damping: 16 }} />
                <circle cx="118.5" cy="94.5" r="2.2" fill="#fff" opacity="0.9" />
              </g>
            ) : (
              <path d="M105 98 q11 7 22 0" fill="none" stroke="#13213b" strokeWidth="3.2" strokeLinecap="round" />
            )}

            <path d={beak} fill="#f0b95b" />

            {state === "success" && (
              <>
                <ellipse cx="70" cy="112" rx="7" ry="4" fill="#f2a1b4" opacity="0.6" />
                <ellipse cx="130" cy="112" rx="7" ry="4" fill="#f2a1b4" opacity="0.6" />
              </>
            )}
          </motion.g>

          {/* wings */}
          <motion.path
            d="M60 128 q-14 26 2 46 q10 12 18 -2 q6 -22 2 -44 z"
            fill={`url(#${bodyId})`}
            animate={wingLeft}
            transition={{ type: "spring", stiffness: 170, damping: 17 }}
            style={{ transformOrigin: "70px 130px" }}
          />
          <motion.path
            d="M140 128 q14 26 -2 46 q-10 12 -18 -2 q-6 -22 -2 -44 z"
            fill={`url(#${bodyId})`}
            animate={wingRight}
            transition={{ type: "spring", stiffness: 170, damping: 17 }}
            style={{ transformOrigin: "130px 130px" }}
          />
        </motion.g>

        {/* graduation cap — sits ON TOP of the head, clear of the eyes */}
        <g>
          <path d="M100 26 L142 40 L100 54 L58 40 z" fill="#14213d" />
          <path d="M126 45 v11 q-26 9 -52 0 v-11" fill="none" stroke="#14213d" strokeWidth="4" strokeLinecap="round" />
          <motion.g
            animate={reduced ? {} : { rotate: state === "success" ? [0, 12, -6, 0] : [0, 3, -3, 0] }}
            transition={{ duration: state === "success" ? 0.8 : 5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "142px 40px" }}
          >
            <path d="M142 40 v18" stroke="#c99a3b" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="142" cy="60" r="4.5" fill="#c99a3b" />
          </motion.g>
        </g>

        <AnimatePresence>
          {(state === "checking") && (
            <motion.g key="think" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <rect x="146" y="22" width="48" height="26" rx="12" fill="#fff" />
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={159 + i * 11}
                  cy="35"
                  r="3.2"
                  fill="#24385f"
                  animate={reduced ? {} : { y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
                  transition={reduced ? {} : { duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </motion.g>
          )}
          {state === "success" &&
            !reduced &&
            [
              { x: 46, y: 62, d: 0 },
              { x: 152, y: 100, d: 0.14 },
              { x: 60, y: 34, d: 0.26 },
            ].map((s, i) => (
              <motion.path
                key={i}
                d={`M${s.x} ${s.y} l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z`}
                fill="#f5c451"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1.15, 0.5] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, delay: s.d, repeat: 1 }}
              />
            ))}
        </AnimatePresence>
      </motion.svg>
    </div>
  );
}
