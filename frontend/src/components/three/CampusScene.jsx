import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

/**
 * Stylized, low-poly academic building — the homepage hero's 3D identity.
 * Deliberately architectural (not abstract shapes/particles): a central
 * glass-fronted tower flanked by two lower wings, entrance columns, and a
 * grid of warm emissive "window light" accents at dusk. Camera parallax is
 * pointer-driven only (no spin, no orbiting) to stay elegant rather than
 * game-like.
 */

function WindowGrid({ rows = 5, cols = 6, width, height, z, color = "#fbbf24" }) {
  const positions = useMemo(() => {
    const list = [];
    const padX = width * 0.14;
    const padY = height * 0.1;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -usableW / 2 + (c + 0.5) * (usableW / cols);
        const y = -usableH / 2 + (r + 0.5) * (usableH / rows) + padY * 0.4;
        const lit = Math.random() > 0.45;
        list.push({ x, y, lit });
      }
    }
    return list;
  }, [rows, cols, width, height]);

  return (
    <group position={[0, 0, z]}>
      {positions.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0]}>
          <planeGeometry args={[width / cols * 0.42, height / rows * 0.5]} />
          <meshStandardMaterial
            color={p.lit ? color : "#1e293b"}
            emissive={p.lit ? color : "#000000"}
            emissiveIntensity={p.lit ? 1.4 : 0}
            roughness={0.4}
            metalness={0.1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Building({ isMobile }) {
  const windowRows = isMobile ? 4 : 6;
  const windowCols = isMobile ? 3 : 5;

  return (
    <group position={[0, -0.4, 0]}>
      {/* ground plaza — oversized so its edge falls outside the frame/fog */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.55, 0]} receiveShadow={false}>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color="#152238" roughness={0.75} metalness={0.15} />
      </mesh>

      {/* brand accent plinth */}
      <RoundedBox args={[5.4, 0.18, 2.4]} radius={0.05} smoothness={2} position={[0, -1.44, 0.4]}>
        <meshStandardMaterial color="#2563eb" roughness={0.5} metalness={0.3} />
      </RoundedBox>

      {/* central tower */}
      <group position={[0, 0.75, 0]}>
        <RoundedBox args={[2.2, 3.6, 1.7]} radius={0.09} smoothness={4}>
          <meshPhysicalMaterial color="#1e3a5f" roughness={0.28} metalness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} reflectivity={0.5} />
        </RoundedBox>
        <WindowGrid rows={windowRows + 1} cols={windowCols} width={2.2} height={3.6} z={0.87} />
      </group>

      {/* left wing */}
      <group position={[-2.75, -0.05, -0.3]}>
        <RoundedBox args={[2.1, 2.1, 1.5]} radius={0.07} smoothness={4}>
          <meshStandardMaterial color="#24395c" roughness={0.35} metalness={0.4} />
        </RoundedBox>
        <WindowGrid rows={windowRows - 2} cols={windowCols - 1} width={2.1} height={2.1} z={0.77} color="#93c5fd" />
      </group>

      {/* right wing */}
      <group position={[2.75, -0.25, -0.15]}>
        <RoundedBox args={[2.1, 1.7, 1.5]} radius={0.07} smoothness={4}>
          <meshStandardMaterial color="#24395c" roughness={0.35} metalness={0.4} />
        </RoundedBox>
        <WindowGrid rows={windowRows - 3} cols={windowCols - 1} width={2.1} height={1.7} z={0.77} color="#93c5fd" />
      </group>

      {/* entrance columns */}
      {[-0.85, -0.3, 0.3, 0.85].map((x, i) => (
        <mesh key={i} position={[x, -1.0, 1.15]}>
          <cylinderGeometry args={[0.07, 0.07, 1.1, 12]} />
          <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* entrance canopy */}
      <RoundedBox args={[2.4, 0.1, 1.0]} radius={0.03} smoothness={2} position={[0, -0.42, 1.1]}>
        <meshStandardMaterial color="#2563eb" roughness={0.4} metalness={0.4} emissive="#1d4ed8" emissiveIntensity={0.25} toneMapped={false} />
      </RoundedBox>
    </group>
  );
}

export default function CampusScene({ isMobile = false }) {
  const group = useRef(null);

  useFrame((state) => {
    const targetX = state.pointer.x * 0.5;
    const targetY = 0.15 + state.pointer.y * 0.2;
    state.camera.position.x += (targetX - state.camera.position.x) * 0.025;
    state.camera.position.y += (targetY + 1.1 - state.camera.position.y) * 0.025;
    state.camera.lookAt(0, 0.3, 0);

    if (group.current) {
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.3) * 0.03;
    }
  });

  return (
    <group ref={group} position={[2.6, -0.3, -1.2]} scale={0.78}>
      <Building isMobile={isMobile} />
    </group>
  );
}
