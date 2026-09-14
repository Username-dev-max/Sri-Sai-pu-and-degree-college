import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import useIsMobile from "../../hooks/useIsMobile";
import FloatingShapes from "./FloatingShapes";
import ParticleField from "./ParticleField";

/**
 * Drop-in animated 3D backdrop. Renders nothing (falls back to a plain
 * gradient handled by the parent's CSS) when the user prefers reduced
 * motion, and scales particle count down on small screens to stay fast.
 */
export default function Scene3D({ shapes = true, particles = true, variant = "login", className = "", fogColor = "#0b1526" }) {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  if (reduced) return null;

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        {fogColor && <fog attach="fog" args={[fogColor, 6, 15]} />}
        <hemisphereLight args={["#60a5fa", "#0b1526", 0.4]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.1} color="#ffffff" />
        <pointLight position={[-5, -3, -2]} intensity={0.6} color="#3b82f6" />
        <Suspense fallback={null}>
          {particles && <ParticleField count={isMobile ? 350 : 900} />}
          {shapes && <FloatingShapes variant={variant} />}
        </Suspense>
      </Canvas>
    </div>
  );
}
