import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import usePrefersReducedMotion from "../../hooks/usePrefersReducedMotion";
import useIsMobile from "../../hooks/useIsMobile";
import CampusScene from "./CampusScene";

/**
 * Canvas wrapper for the homepage hero's architectural 3D scene (see
 * CampusScene.jsx). Same reduced-motion/mobile-gating and lazy-loading
 * contract as Scene3D.jsx, but with dusk-toned lighting and framing suited
 * to a building composition rather than abstract floating shapes.
 */
export default function CampusHero({ className = "" }) {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  if (reduced) return null;

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        camera={{ position: [0, 1.1, 7.5], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <fog attach="fog" args={["#0b1526", 9, 18]} />
        <hemisphereLight args={["#fbbf24", "#0b1526", 0.4]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 8]} intensity={1.7} color="#ffb877" />
        <directionalLight position={[-6, 2, -4]} intensity={0.45} color="#3b82f6" />
        <pointLight position={[0, 1.4, 6]} intensity={2.2} color="#ffd9a8" distance={14} decay={2} />
        <pointLight position={[0, -1.6, 2]} intensity={0.4} color="#3b82f6" distance={8} decay={2} />
        <Suspense fallback={null}>
          <CampusScene isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
