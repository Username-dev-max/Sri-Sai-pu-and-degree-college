import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";

function Shape({ position, geometry, color, speed = 1, distort = 0.3, scale = 1 }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.15 * speed;
    ref.current.rotation.y = t * 0.1 * speed;
  });
  return (
    <Float speed={1.4 * speed} rotationIntensity={0.6} floatIntensity={1.4}>
      <mesh ref={ref} position={position} scale={scale}>
        {geometry}
        <MeshDistortMaterial
          color={color}
          distort={distort}
          speed={1.5}
          roughness={0.15}
          metalness={0.6}
        />
      </mesh>
    </Float>
  );
}

/**
 * A small cluster of floating, distorting 3D shapes used as decoration
 * on the login screen / dashboard hero. Camera gently parallaxes toward
 * the pointer for a subtle depth effect.
 */
export default function FloatingShapes({ variant = "login" }) {
  useFrame((state) => {
    const targetX = state.pointer.x * 0.6;
    const targetY = state.pointer.y * 0.3;
    state.camera.position.x += (targetX - state.camera.position.x) * 0.03;
    state.camera.position.y += (targetY - state.camera.position.y) * 0.03;
    state.camera.lookAt(0, 0, 0);
  });

  if (variant === "compact") {
    return (
      <group>
        <Shape position={[1.6, 0.4, 0]} geometry={<icosahedronGeometry args={[0.9, 1]} />} color="#3b82f6" speed={1} scale={1} />
        <Shape position={[-1.6, -0.4, -1]} geometry={<torusGeometry args={[0.55, 0.22, 24, 64]} />} color="#8b5cf6" speed={0.8} distort={0.2} scale={1} />
      </group>
    );
  }

  return (
    <group>
      <Shape position={[2.6, 1, -1]} geometry={<icosahedronGeometry args={[1.1, 1]} />} color="#3b82f6" speed={1} scale={1} />
      <Shape position={[-2.6, -0.6, -2]} geometry={<torusGeometry args={[0.7, 0.28, 24, 64]} />} color="#8b5cf6" speed={0.7} distort={0.25} scale={1} />
      <Shape position={[0.2, -1.6, -1.5]} geometry={<octahedronGeometry args={[0.75, 0]} />} color="#06b6d4" speed={1.2} distort={0.35} scale={1} />
      <Shape position={[-1.2, 1.8, -2.5]} geometry={<dodecahedronGeometry args={[0.5, 0]} />} color="#60a5fa" speed={0.9} distort={0.15} scale={0.9} />
    </group>
  );
}
