import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

/**
 * Wraps its children in a card that tilts subtly in 3D toward the
 * pointer on hover, with a soft spring return. Disabled automatically
 * when the user prefers reduced motion (renders a static card instead).
 */
export default function TiltCard({ children, className = "", intensity = 10, ...rest }) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), { stiffness: 220, damping: 20 });

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  function handleMove(e) {
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
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale: 1.015 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
