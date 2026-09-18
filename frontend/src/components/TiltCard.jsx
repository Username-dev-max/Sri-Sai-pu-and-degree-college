import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

/** Content that must never move under the pointer. */
const INTERACTIVE = "input, select, textarea, table, form, [contenteditable='true']";

/**
 * Wraps its children in a card that tilts subtly in 3D toward the
 * pointer on hover, with a soft spring return. Disabled automatically
 * when the user prefers reduced motion (renders a static card instead).
 *
 * A card that contains form controls or a table does NOT tilt or scale.
 * That motion was the cause of "dropdowns overlapping the page": a native
 * <select> opens its option list at the position the control had when it was
 * clicked, and the card then kept rotating and scaling as the pointer moved
 * towards the options, so the control slid away from its own list and the
 * list appeared on top of unrelated content. Tilting also moved inputs while
 * people were typing. The element type never changes, so toggling this does
 * not remount the children (which would lose focus and typed values).
 */
export default function TiltCard({ children, className = "", intensity = 10, ...rest }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef(null);
  const [interactive, setInteractive] = useState(false);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), { stiffness: 220, damping: 20 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => {
      const has = !!el.querySelector(INTERACTIVE);
      setInteractive((prev) => (prev === has ? prev : has));
      if (has) {
        x.set(0.5);
        y.set(0.5);
      }
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [reduced, x, y]);

  if (reduced) {
    return (
      <div ref={ref} className={className} {...rest}>
        {children}
      </div>
    );
  }

  function handleMove(e) {
    if (interactive) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  }
  function handleLeave() {
    x.set(0.5);
    y.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={interactive ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      whileHover={interactive ? undefined : { scale: 1.015 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
