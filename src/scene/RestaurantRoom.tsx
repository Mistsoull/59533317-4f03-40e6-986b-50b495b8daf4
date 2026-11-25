import { useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RESTAURANT_STREET_ENTRANCE } from '../config/restaurantLayout';
import { useGameStore } from '../store/useGameStore';

interface RestaurantRoomProps {
  onTapFloor: (x: number, z: number) => void;
}

function useBistroParquetTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#e7c9a6';
    ctx.fillRect(0, 0, 256, 256);

    const planks = ['#dfb98d', '#ebd0ae', '#d9b183', '#e8caa4'];
    for (let row = 0; row < 4; row += 1) {
      ctx.fillStyle = planks[row % planks.length];
      ctx.fillRect(0, row * 64, 256, 62);
      ctx.fillStyle = 'rgba(110, 72, 42, 0.16)';
      ctx.fillRect(0, row * 64 + 62, 256, 2);
      const jointX = row % 2 === 0 ? 128 : 64;
      ctx.fillRect(jointX, row * 64, 2, 64);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 12);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * Full-screen enclosed 3-walled interior Bistro Dining Room ("Restoran Salonu").
 * Seamless floor & tall perimeter walls fill 100% of the viewport with zero outer void.
 */
export function RestaurantRoom({ onTapFloor }: RestaurantRoomProps) {
  const floorTexture = useBistroParquetTexture();
  const restaurantOpen = useGameStore((s) => s.restaurantOpen);
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

  const [ex, ey, ez] = RESTAURANT_STREET_ENTRANCE.doorPosition;

  return (
    <group>
      {/* Seamless full-interior parquet floor extending well past camera frustum */}
      <mesh
        position={[0, -0.05, 1.5]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[24, 0.1, 22]} />
        <meshStandardMaterial map={floorTexture} roughness={0.8} />
      </mesh>

      {/* Cozy woven dining area rug accent */}
      <mesh position={[-0.35, 0.004, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.8, 3.8]} />
        <meshStandardMaterial color="#f5e6d3" transparent opacity={0.22} roughness={0.95} />
      </mesh>

      {/* ==================== TALL ENCLOSING BACK WALL (z = -3.15) ==================== */}
      <mesh position={[0, 3.2, -3.15]} receiveShadow>
        <boxGeometry args={[18, 6.4, 0.2]} />
        <meshStandardMaterial color="#fff6e9" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.52, -3.03]} receiveShadow>
        <boxGeometry args={[17.8, 1.04, 0.04]} />
        <meshStandardMaterial color="#d4a373" roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.06, -3.01]}>
        <boxGeometry args={[17.8, 0.07, 0.07]} />
        <meshStandardMaterial color="#8c5a34" roughness={0.68} />
      </mesh>

      {/* ==================== TALL ENCLOSING LEFT WALL (x = -4.18) ==================== */}
      <mesh position={[-4.18, 3.2, 1.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.4, 16]} />
        <meshStandardMaterial color="#f9efe1" roughness={0.88} />
      </mesh>
      <mesh position={[-4.06, 0.52, 1.5]} receiveShadow>
        <boxGeometry args={[0.04, 1.04, 15.8]} />
        <meshStandardMaterial color="#d4a373" roughness={0.78} />
      </mesh>
      <mesh position={[-4.04, 1.06, 1.5]}>
        <boxGeometry args={[0.07, 0.07, 15.8]} />
        <meshStandardMaterial color="#8c5a34" roughness={0.68} />
      </mesh>

      {/* ==================== TALL ENCLOSING RIGHT WALL (x = +4.18) ==================== */}
      <mesh position={[4.18, 3.2, 1.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.4, 16]} />
        <meshStandardMaterial color="#f9efe1" roughness={0.88} />
      </mesh>
      <mesh position={[4.06, 0.52, 1.5]} receiveShadow>
        <boxGeometry args={[0.04, 1.04, 15.8]} />
        <meshStandardMaterial color="#d4a373" roughness={0.78} />
      </mesh>
      <mesh position={[4.04, 1.06, 1.5]}>
        <boxGeometry args={[0.07, 0.07, 15.8]} />
        <meshStandardMaterial color="#8c5a34" roughness={0.68} />
      </mesh>

      {/* Cozy Bistro Wall Art & Warm Sconce on Right Wall */}
      <group position={[4.04, 1.85, 0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.85, 1.1]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.72} />
        </mesh>
        <mesh position={[-0.035, 0, 0]}>
          <boxGeometry args={[0.02, 0.72, 0.96]} />
          <meshStandardMaterial color="#f4d5b2" roughness={0.85} />
        </mesh>
        <mesh position={[-0.048, 0.04, 0]}>
          <boxGeometry args={[0.015, 0.34, 0.42]} />
          <meshStandardMaterial color="#e07a5f" roughness={0.75} />
        </mesh>
        <mesh position={[-0.1, 0.08, -0.82]}>
          <sphereGeometry args={[0.085, 10, 10]} />
          <meshStandardMaterial
            color="#fff3b0"
            emissive="#ffd166"
            emissiveIntensity={0.7}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* Cozy Menu Chalkboard on Back Wall */}
      <group position={[-0.25, 1.82, -2.99]}>
        <mesh castShadow>
          <boxGeometry args={[2.15, 0.98, 0.06]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[1.96, 0.82, 0.02]} />
          <meshStandardMaterial color="#2b3a34" roughness={0.88} />
        </mesh>
        <mesh position={[-1.34, 0.15, 0.12]}>
          <sphereGeometry args={[0.085, 10, 10]} />
          <meshStandardMaterial
            color="#fff3b0"
            emissive="#ffd166"
            emissiveIntensity={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[1.34, 0.15, 0.12]}>
          <sphereGeometry args={[0.085, 10, 10]} />
          <meshStandardMaterial
            color="#fff3b0"
            emissive="#ffd166"
            emissiveIntensity={0.7}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* Decorative Kitchen Pass Window on Left Wall above Service Pass */}
      <group position={[-4.04, 1.62, -2.2]}>
        <mesh>
          <boxGeometry args={[0.08, 0.96, 1.52]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.72} />
        </mesh>
        <mesh position={[0.048, 0, 0]}>
          <boxGeometry args={[0.02, 0.8, 1.36]} />
          <meshStandardMaterial
            color="#ffe8c2"
            emissive="#ffcf87"
            emissiveIntensity={0.42}
            roughness={0.35}
          />
        </mesh>
      </group>

      {/* Street Entrance Door on Back-Right Wall where Customer NPCs enter & exit */}
      <group position={[ex, ey, ez]}>
        <mesh position={[0, 1.05, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[1.26, 2.1, 0.12]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.0, 0.095]} castShadow>
          <boxGeometry args={[1.06, 1.96, 0.05]} />
          <meshStandardMaterial color="#3d5a80" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.34, 0.13]}>
          <boxGeometry args={[0.76, 0.85, 0.02]} />
          <meshStandardMaterial
            color="#cdeeff"
            emissive="#fff6dc"
            emissiveIntensity={0.42}
            roughness={0.2}
          />
        </mesh>
        {/* Glowing OPEN / CLOSED door sign */}
        <mesh position={[0, 1.32, 0.15]}>
          <boxGeometry args={[0.46, 0.2, 0.02]} />
          <meshStandardMaterial
            color={restaurantOpen ? '#22c55e' : '#ef4444'}
            emissive={restaurantOpen ? '#16a34a' : '#dc2626'}
            emissiveIntensity={0.65}
            roughness={0.35}
          />
        </mesh>
        {/* Entrance rug */}
        <mesh position={[0, 0.015, 0.56]} receiveShadow>
          <boxGeometry args={[1.15, 0.024, 0.64]} />
          <meshStandardMaterial color="#b56576" roughness={0.9} />
        </mesh>
      </group>

      {/* Cozy potted plants framing the dining room corners */}
      <group position={[-3.55, 0, 0.55]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 10]} />
          <meshStandardMaterial color="#c86b4b" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <dodecahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#40916c" roughness={0.75} />
        </mesh>
      </group>
      <group position={[3.62, 0, 2.25]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.16, 0.44, 10]} />
          <meshStandardMaterial color="#c86b4b" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow>
          <dodecahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color="#40916c" roughness={0.75} />
        </mesh>
      </group>
    </group>
  );
}
