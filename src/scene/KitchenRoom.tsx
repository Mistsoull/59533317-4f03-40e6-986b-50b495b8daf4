import { useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface KitchenRoomProps {
  onTapFloor: (x: number, z: number) => void;
}

/**
 * Generates a warm checkered terracotta-and-cream tile texture procedurally
 * (zero external image downloads, crisp pixel density, cached via useMemo).
 */
function useKitchenFloorTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#efe4d4';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#e3d3bc';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    // Subtle grout lines
    ctx.strokeStyle = 'rgba(120, 95, 70, 0.16)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);
    ctx.strokeRect(130, 2, 124, 124);
    ctx.strokeRect(2, 130, 124, 124);
    ctx.strokeRect(130, 130, 124, 124);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 6);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

export function KitchenRoom({ onTapFloor }: KitchenRoomProps) {
  const floorTexture = useKitchenFloorTexture();
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    downPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!downPosRef.current) return;
    const moved = Math.hypot(
      e.clientX - downPosRef.current.x,
      e.clientY - downPosRef.current.y,
    );
    downPosRef.current = null;
    if (moved > 14) return;
    onTapFloor(e.point.x, e.point.z);
  };

  return (
    <group>
      {/* Floor slab (8m x 6m, y = 0 surface) */}
      <mesh
        position={[0, -0.1, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[8, 0.2, 6]} />
        <meshStandardMaterial map={floorTexture} roughness={0.85} />
      </mesh>

      {/* Cozy dark wood plinth under the room */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[8.3, 0.16, 6.3]} />
        <meshStandardMaterial color="#3c2f27" roughness={0.9} />
      </mesh>

      {/* Back Cutaway Wall (z = -3) */}
      <mesh position={[0, 1.35, -3.08]} receiveShadow>
        <boxGeometry args={[8.16, 2.7, 0.16]} />
        <meshStandardMaterial color="#f5ece0" roughness={0.9} />
      </mesh>
      {/* Back tile backsplash strip */}
      <mesh position={[0.45, 1.25, -2.99]} receiveShadow>
        <boxGeometry args={[6.9, 0.72, 0.03]} />
        <meshStandardMaterial color="#d8e3dc" roughness={0.6} />
      </mesh>

      {/* Left Cutaway Wall (x = -4) */}
      <mesh position={[-4.08, 1.35, 0]} receiveShadow>
        <boxGeometry args={[0.16, 2.7, 6.16]} />
        <meshStandardMaterial color="#ede1d1" roughness={0.9} />
      </mesh>

      {/* Sunlit Kitchen Window on Left Wall */}
      <group position={[-3.98, 1.65, -0.35]}>
        <mesh>
          <boxGeometry args={[0.05, 1.05, 1.65]} />
          <meshStandardMaterial color="#6d4c3d" roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.03, 0.9, 1.5]} />
          <meshStandardMaterial
            color="#cde7f0"
            emissive="#fff3d6"
            emissiveIntensity={0.4}
            roughness={0.2}
          />
        </mesh>
        {/* Window muntins */}
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 0.92, 0.05]} />
          <meshStandardMaterial color="#6d4c3d" roughness={0.7} />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 0.05, 1.52]} />
          <meshStandardMaterial color="#6d4c3d" roughness={0.7} />
        </mesh>
      </group>

      {/* Decorative Wall Shelf above back counter */}
      <group position={[0.1, 1.98, -2.84]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.07, 0.28]} />
          <meshStandardMaterial color="#9c6644" roughness={0.7} />
        </mesh>
        {/* Spice jars */}
        {[-0.7, -0.45, -0.2, 0.55, 0.78].map((jx, idx) => (
          <mesh key={idx} position={[jx, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.2, 10]} />
            <meshStandardMaterial
              color={['#e07a5f', '#f2cc8f', '#81b29a', '#e63946', '#457b9d'][idx]}
              roughness={0.45}
            />
          </mesh>
        ))}
      </group>

      {/* Connecting Back Counters (matching back_counter_line AABB) */}
      {/* Between Fridge and Cutting Board */}
      <mesh position={[-1.62, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.98, 0.86, 0.88]} />
        <meshStandardMaterial color="#d7c5b2" roughness={0.78} />
      </mesh>
      <mesh position={[-1.62, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[2.02, 0.07, 0.94]} />
        <meshStandardMaterial color="#f3ebe1" roughness={0.5} />
      </mesh>

      {/* Between Cutting Board and Stove */}
      <mesh position={[1.22, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.86, 0.88]} />
        <meshStandardMaterial color="#d7c5b2" roughness={0.78} />
      </mesh>
      <mesh position={[1.22, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.22, 0.07, 0.94]} />
        <meshStandardMaterial color="#f3ebe1" roughness={0.5} />
      </mesh>

      {/* Far Right Counter Endcap */}
      <mesh position={[3.48, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[0.98, 0.86, 0.88]} />
        <meshStandardMaterial color="#d7c5b2" roughness={0.78} />
      </mesh>
      <mesh position={[3.48, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.02, 0.07, 0.94]} />
        <meshStandardMaterial color="#f3ebe1" roughness={0.5} />
      </mesh>

      {/* Left Side Counter + Decorative Sink (matching left_side_counter AABB) */}
      <group position={[-3.46, 0, -0.38]}>
        <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.96, 0.86, 3.0]} />
          <meshStandardMaterial color="#d7c5b2" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.02, 0.07, 3.04]} />
          <meshStandardMaterial color="#f3ebe1" roughness={0.5} />
        </mesh>
        {/* Sink basin */}
        <mesh position={[0.04, 0.935, 0.05]}>
          <boxGeometry args={[0.52, 0.03, 0.72]} />
          <meshStandardMaterial color="#9aa5b1" roughness={0.3} metalness={0.75} />
        </mesh>
        {/* Faucet */}
        <mesh position={[-0.25, 1.12, 0.05]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
        </mesh>
        <mesh position={[-0.14, 1.28, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.85} />
        </mesh>
      </group>

      {/* Center Compact Breakfast Island (matching center_island AABB: x:-0.85..0.85, z:0.5..1.45) */}
      <group position={[0, 0, 0.975]}>
        <mesh position={[0, 0.41, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.82, 0.86]} />
          <meshStandardMaterial color="#8d6e63" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.855, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.08, 0.95]} />
          <meshStandardMaterial color="#e6ccb2" roughness={0.55} />
        </mesh>
        {/* Cozy centerpiece bowl */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.13, 0.11, 14]} />
          <meshStandardMaterial color="#e07a5f" roughness={0.5} />
        </mesh>
        <mesh position={[-0.05, 1.02, 0.02]}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#f2cc8f" roughness={0.5} />
        </mesh>
        <mesh position={[0.06, 1.01, -0.03]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#81b29a" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
