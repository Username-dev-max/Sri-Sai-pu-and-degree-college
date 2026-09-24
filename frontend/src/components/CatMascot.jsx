import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

/**
 * Login mascot. Hand-drawn inline SVG driven by a small state machine —
 * no Rive/Lottie asset, no canvas, no WebGL, so it stays light on
 * low-end devices. Every looping animation is disabled under
 * prefers-reduced-motion; the cat then just holds a static pose per state.
 *
 * states: idle | watching | username | password | peek | thinking | checking | success | error
 */

const EYES_CLOSED = new Set(["password", "checking"]);

export default function CatMascot({ state = "idle", pointer = { x: 0, y: 0 }, size = 360, onPoke }) {
  const reduced = usePrefersReducedMotion();
  // Gradient ids must be unique per instance — duplicated ids across two
  // mounted copies make the second one resolve against a hidden <defs> and
  // render unfilled.
  const uid = useId().replace(/:/g, "");
  const furId = `catFur-${uid}`;
  const bellyId = `catBelly-${uid}`;
  const [blink, setBlink] = useState(false);
  const [glance, setGlance] = useState({ x: 0, y: 0 });
  const [earTwitch, setEarTwitch] = useState(false);
  // Set briefly when the cat is tapped, so it can react before settling.
  const [poked, setPoked] = useState(false);
  const timers = useRef([]);

  // Idle life: irregular blinking, occasional glances and ear twitches.
  // Deliberately randomised so it never reads as one looping animation.
  useEffect(() => {
    if (reduced) return;
    let alive = true;
    const schedule = (fn, min, max) => {
      const t = setTimeout(function run() {
        if (!alive) return;
        fn();
        const next = setTimeout(run, min + Math.random() * (max - min));
        timers.current.push(next);
      }, min + Math.random() * (max - min));
      timers.current.push(t);
    };

    schedule(() => {
      setBlink(true);
      const t = setTimeout(() => setBlink(false), 130);
      timers.current.push(t);
    }, 2200, 5200);

    schedule(() => {
      setEarTwitch(true);
      const t = setTimeout(() => setEarTwitch(false), 320);
      timers.current.push(t);
    }, 3800, 9000);

    schedule(() => {
      // Occasionally glance toward the form (positive x) rather than at random.
      const towardForm = Math.random() > 0.45;
      setGlance(towardForm ? { x: 1, y: 0.15 } : { x: Math.random() * 2 - 1, y: Math.random() * 0.8 - 0.4 });
      const t = setTimeout(() => setGlance({ x: 0, y: 0 }), 1400);
      timers.current.push(t);
    }, 3000, 7000);

    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduced]);

  const isIdleish = state === "idle" || state === "watching";
  // Pointer tracking only matters when the eyes are open and the cat is not busy.
  const track = isIdleish || state === "username";
  const look = track
    ? { x: (pointer.x || 0) * 0.7 + glance.x * 0.5, y: (pointer.y || 0) * 0.7 + glance.y * 0.5 }
    : { x: 0, y: 0 };

  const eyesClosed = EYES_CLOSED.has(state) || blink;
  const leftEyeOpen = state === "peek" ? true : !eyesClosed;
  const rightEyeOpen = state === "peek" ? false : !eyesClosed;

  // Head pose per state (rotation in deg, offsets in svg units)
  const headPose = {
    idle: { rotate: look.x * 4, x: look.x * 3, y: look.y * 2 },
    watching: { rotate: look.x * 4 + 2, x: look.x * 3 + 2, y: look.y * 2 },
    username: { rotate: look.x * 3 + 5, x: look.x * 2 + 4, y: 1 },
    password: { rotate: 0, x: 0, y: 2 },
    peek: { rotate: -9, x: -2, y: 1 },
    thinking: { rotate: 8, x: 3, y: -4 },
    checking: { rotate: 0, x: 0, y: 2 },
    success: { rotate: 0, x: 0, y: -2 },
    error: { rotate: 0, x: 0, y: 0 },
  }[state] || { rotate: 0, x: 0, y: 0 };

  const bodyAnim = reduced
    ? {}
    : state === "success"
      ? { y: [0, -14, 0, -7, 0], transition: { duration: 0.85, times: [0, 0.25, 0.5, 0.72, 1] } }
      : state === "error"
        ? { x: [0, -7, 7, -5, 5, 0], transition: { duration: 0.55 } }
        : { scaleY: [1, 1.022, 1], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } };

  const headAnim = reduced
    ? { rotate: headPose.rotate, x: headPose.x, y: headPose.y }
    : state === "error"
      ? { rotate: [0, -11, 11, -8, 8, 0], x: 0, y: 0, transition: { duration: 0.6 } }
      : state === "thinking"
        ? { rotate: [headPose.rotate, headPose.rotate + 3, headPose.rotate], x: headPose.x, y: [headPose.y, headPose.y - 2, headPose.y], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } }
        : { rotate: headPose.rotate, x: headPose.x, y: headPose.y, transition: { type: "spring", stiffness: 120, damping: 14 } };

  const tailAnim = reduced
    ? {}
    : {
        rotate: state === "success" ? [0, -26, 10, -22, 0] : [0, 9, -5, 7, 0],
        transition: { duration: state === "success" ? 0.8 : 5.5, repeat: Infinity, ease: "easeInOut" },
      };

  // Paw positions: covering eyes (password/checking), one lowered (peek),
  // near the chin (thinking), tucked away otherwise.
  const pawLeft =
    state === "password" || state === "checking"
      ? { x: 0, y: -46, rotate: -8, opacity: 1 }
      : state === "peek"
        ? { x: -10, y: -20, rotate: -34, opacity: 1 }
        : state === "thinking"
          ? { x: 12, y: -28, rotate: -18, opacity: 1 }
          : { x: 0, y: 6, rotate: 0, opacity: 0 };

  const pawRight =
    state === "password" || state === "checking"
      ? { x: 0, y: -46, rotate: 8, opacity: 1 }
      : state === "peek"
        ? { x: 0, y: -46, rotate: 8, opacity: 1 }
        : { x: 0, y: 6, rotate: 0, opacity: 0 };

  const mouth = {
    idle: "M92 128 q8 6 16 0",
    watching: "M92 128 q8 6 16 0",
    username: "M90 127 q10 9 20 0",
    password: "M94 129 q6 3 12 0",
    peek: "M93 128 q7 5 14 0",
    thinking: "M92 130 q8 -4 16 0",
    checking: "M94 129 q6 3 12 0",
    success: "M88 126 q12 13 24 0",
    error: "M90 132 q10 -8 20 0",
  }[state] || "M92 128 q8 6 16 0";

  function handlePoke() {
    if (!onPoke) return;
    onPoke();
    setPoked(true);
    const t = setTimeout(() => setPoked(false), 700);
    timers.current.push(t);
  }

  const interactive = typeof onPoke === "function";

  return (
    <div
      style={{ width: size, maxWidth: "100%" }}
      className={`select-none ${interactive ? "cursor-pointer" : ""}`}
      {...(interactive
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": "Pet the cat",
            title: "Pet the cat",
            onClick: handlePoke,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handlePoke();
              }
            },
          }
        : { "aria-hidden": "true" })}
    >
      <motion.svg
        viewBox="0 0 200 230"
        width="100%"
        style={{ overflow: "visible", display: "block" }}
        animate={reduced || !poked ? {} : { scale: [1, 1.06, 0.98, 1], rotate: [0, -2.5, 2, 0] }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <defs>
          <linearGradient id={furId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d5a8a" />
            <stop offset="100%" stopColor="#24385f" />
          </linearGradient>
          <linearGradient id={bellyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8edf7" />
            <stop offset="100%" stopColor="#cdd8ea" />
          </linearGradient>
        </defs>

        {/* soft ground shadow */}
        <ellipse cx="100" cy="214" rx="52" ry="8" fill="#000" opacity="0.18" />

        <motion.g animate={bodyAnim} style={{ transformOrigin: "100px 214px" }}>
          {/* tail */}
          <motion.g animate={tailAnim} style={{ transformOrigin: "142px 196px" }}>
            <path
              d="M140 198 q34 6 34 -26 q0 -18 -14 -20 q-10 -1 -10 9 q0 8 8 8"
              fill="none"
              stroke={`url(#${furId})`}
              strokeWidth="13"
              strokeLinecap="round"
            />
          </motion.g>

          {/* body */}
          <path d="M62 208 q-6 -62 38 -62 q44 0 38 62 z" fill={`url(#${furId})`} />
          <path d="M84 208 q-4 -40 16 -40 q20 0 16 40 z" fill={`url(#${bellyId})`} opacity="0.9" />

          {/* feet */}
          <ellipse cx="80" cy="206" rx="13" ry="7" fill="#e8edf7" />
          <ellipse cx="120" cy="206" rx="13" ry="7" fill="#e8edf7" />

          {/* head */}
          <motion.g animate={headAnim} style={{ transformOrigin: "100px 120px" }}>
            {/* ears */}
            <motion.path
              d="M64 92 L60 58 L92 76 z"
              fill={`url(#${furId})`}
              animate={reduced ? {} : { rotate: (earTwitch || poked) ? -9 : 0 }}
              style={{ transformOrigin: "72px 84px" }}
              transition={{ type: "spring", stiffness: 320, damping: 12 }}
            />
            <motion.path
              d="M136 92 L140 58 L108 76 z"
              fill={`url(#${furId})`}
              animate={reduced ? {} : { rotate: (earTwitch || poked) ? 9 : 0 }}
              style={{ transformOrigin: "128px 84px" }}
              transition={{ type: "spring", stiffness: 320, damping: 12 }}
            />
            <path d="M68 88 L66 68 L86 79 z" fill="#f0a8b8" opacity="0.75" />
            <path d="M132 88 L134 68 L114 79 z" fill="#f0a8b8" opacity="0.75" />

            {/* face */}
            <ellipse cx="100" cy="112" rx="44" ry="40" fill={`url(#${furId})`} />

            {/* eyes */}
            <g>
              {/* left */}
              {leftEyeOpen ? (
                <>
                  <ellipse cx="84" cy="108" rx="11" ry={state === "success" ? 8 : 12} fill="#fbfdff" />
                  <motion.ellipse
                    cx="84"
                    cy="108"
                    rx="6"
                    ry="7.5"
                    fill="#13213b"
                    animate={{ x: look.x * 3.2, y: look.y * 2.4 }}
                    transition={{ type: "spring", stiffness: 200, damping: 16 }}
                  />
                  <circle cx="86.5" cy="104.5" r="2.2" fill="#fff" opacity="0.9" />
                </>
              ) : (
                <path d="M74 108 q10 7 20 0" fill="none" stroke="#13213b" strokeWidth="3.4" strokeLinecap="round" />
              )}

              {/* right */}
              {rightEyeOpen ? (
                <>
                  <ellipse cx="116" cy="108" rx="11" ry={state === "success" ? 8 : 12} fill="#fbfdff" />
                  <motion.ellipse
                    cx="116"
                    cy="108"
                    rx="6"
                    ry="7.5"
                    fill="#13213b"
                    animate={{ x: look.x * 3.2, y: look.y * 2.4 }}
                    transition={{ type: "spring", stiffness: 200, damping: 16 }}
                  />
                  <circle cx="118.5" cy="104.5" r="2.2" fill="#fff" opacity="0.9" />
                </>
              ) : (
                <path d="M106 108 q10 7 20 0" fill="none" stroke="#13213b" strokeWidth="3.4" strokeLinecap="round" />
              )}
            </g>

            {/* muzzle */}
            <path d="M96 120 l4 4 l4 -4 z" fill="#f0a8b8" />
            <path d={mouth} fill="none" stroke="#13213b" strokeWidth="2.6" strokeLinecap="round" />

            {/* whiskers */}
            <g stroke="#dce4f2" strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
              <path d="M62 116 L42 112" />
              <path d="M62 122 L43 123" />
              <path d="M138 116 L158 112" />
              <path d="M138 122 L157 123" />
            </g>

            {/* success blush */}
            {state === "success" && (
              <>
                <ellipse cx="70" cy="122" rx="7" ry="4" fill="#f0a8b8" opacity="0.6" />
                <ellipse cx="130" cy="122" rx="7" ry="4" fill="#f0a8b8" opacity="0.6" />
              </>
            )}
          </motion.g>

          {/* paws that come up over the eyes */}
          <motion.ellipse
            cx="78"
            cy="150"
            rx="17"
            ry="13"
            fill="#e8edf7"
            stroke="#c3d0e6"
            strokeWidth="1.5"
            animate={pawLeft}
            transition={{ type: "spring", stiffness: 170, damping: 17 }}
          />
          <motion.ellipse
            cx="122"
            cy="150"
            rx="17"
            ry="13"
            fill="#e8edf7"
            stroke="#c3d0e6"
            strokeWidth="1.5"
            animate={pawRight}
            transition={{ type: "spring", stiffness: 170, damping: 17 }}
          />
        </motion.g>

        {/* thumbs up / down */}
        <AnimatePresence>
          {(state === "success" || state === "username") && (
            <motion.g
              key="thumb-up"
              initial={{ opacity: 0, y: 10, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <circle cx="158" cy="150" r="19" fill="#16a34a" />
              <path
                d="M152 152 v9 h4 v-9 z M158 149 v12 h7 q3 0 3 -3 l1 -6 q0 -3 -3 -3 h-4 l1 -5 q1 -4 -2 -4 q-2 0 -3 3 z"
                fill="#fff"
              />
            </motion.g>
          )}
          {state === "error" && (
            <motion.g
              key="thumb-down"
              initial={{ opacity: 0, y: -10, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <circle cx="158" cy="150" r="19" fill="#dc2626" />
              <g transform="rotate(180 160 155)">
                <path
                  d="M152 152 v9 h4 v-9 z M158 149 v12 h7 q3 0 3 -3 l1 -6 q0 -3 -3 -3 h-4 l1 -5 q1 -4 -2 -4 q-2 0 -3 3 z"
                  fill="#fff"
                />
              </g>
            </motion.g>
          )}
        </AnimatePresence>

        {/* thinking bubble */}
        <AnimatePresence>
          {(state === "thinking" || state === "checking") && (
            <motion.g
              key="bubble"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
            >
              <circle cx="150" cy="66" r="6" fill="#fff" opacity="0.92" />
              <circle cx="161" cy="54" r="8.5" fill="#fff" opacity="0.95" />
              <rect x="150" y="16" width="50" height="28" rx="12" fill="#fff" />
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={163 + i * 12}
                  cy="30"
                  r="3.4"
                  fill="#24385f"
                  animate={reduced ? {} : { y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
                  transition={reduced ? {} : { duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* success sparkles */}
        <AnimatePresence>
          {state === "success" &&
            !reduced &&
            [
              { x: 48, y: 70, d: 0 },
              { x: 150, y: 92, d: 0.12 },
              { x: 62, y: 40, d: 0.22 },
              { x: 132, y: 34, d: 0.32 },
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
