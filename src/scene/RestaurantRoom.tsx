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
    tex.repeat.set(6, 5);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

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
      {/* Warm wood parquet dining room floor (8m x 6m, y = 0) */}
      <mesh
        position={[0, -0.1, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[8, 0.2, 6]} />
        <meshStandardMaterial map={floorTexture} roughness={0.8} />
      </mesh>

      {/* Dark walnut trim plinth */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[8.26, 0.14, 6.26]} />
        <meshStandardMaterial color="#6e472b" roughness={0.85} />
      </mesh>

      {/* Back Wall (z = -3) — Cozy cream stucco + warm wainscoting */}
      <mesh position={[0, 1.35, -3.08]} receiveShadow>
        <boxGeometry args={[8.16, 2.7, 0.16]} />
        <meshStandardMaterial color="#fff6e9" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.45, -2.99]} receiveShadow>
        <boxGeometry args={[8.0, 0.9, 0.03]} />
        <meshStandardMaterial color="#d4a373" roughness={0.78} />
      </mesh>

      {/* Left Wall (x = -4) — connects back to Kitchen */}
      <mesh position={[-4.08, 1.35, 0]} receiveShadow>
        <boxGeometry args={[0.16, 2.7, 6.16]} />
        <meshStandardMaterial color="#f9efe1" roughness={0.88} />
      </mesh>
      <mesh position={[-3.99, 0.45, 0]} receiveShadow>
        <boxGeometry args={[0.03, 0.9, 6.0]} />
        <meshStandardMaterial color="#d4a373" roughness={0.78} />
      </mesh>

      {/* Cozy Menu Chalkboard on Back Wall */}
      <group position={[-0.3, 1.72, -2.96]}>
        <mesh castShadow>
          <boxGeometry args={[2.1, 0.96, 0.06]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[1.92, 0.8, 0.02]} />
          <meshStandardMaterial color="#2b3a34" roughness={0.88} />
        </mesh>
        {/* Warm brass sconce lamps flanking menu board */}
        <mesh position={[-1.32, 0.15, 0.12]}>
          <sphereGeometry args={[0.085, 10, 10]} />
          <meshStandardMaterial
            color="#fff3b0"
            emissive="#ffd166"
            emissiveIntensity={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[1.32, 0.15, 0.12]}>
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
      <group position={[-3.97, 1.55, -2.2]}>
        <mesh>
          <boxGeometry args={[0.08, 0.95, 1.55]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.72} />
        </mesh>
        <mesh position={[0.03, 0, 0]}>
          <boxGeometry args={[0.03, 0.78, 1.38]} />
          <meshStandardMaterial
            color="#ffe8c2"
            emissive="#ffcf87"
            emissiveIntensity={0.4}
            roughness={0.35}
          />
        </mesh>
      </group>

      {/* Street Entrance Door on Back-Right Wall where Customer NPCs enter & exit */}
      <group position={[ex, ey, ez]}>
        <mesh position={[0, 1.05, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[1.26, 2.1, 0.14]} />
          <meshStandardMaterial color="#7f4f24" roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.0, 0.08]} castShadow>
          <boxGeometry args={[1.06, 1.96, 0.06]} />
          <meshStandardMaterial color="#3d5a80" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.34, 0.115]}>
          <boxGeometry args={[0.76, 0.85, 0.02]} />
          <meshStandardMaterial
            color="#cdeeff"
            emissive="#fff6dc"
            emissiveIntensity={0.42}
            roughness={0.2}
          />
        </mesh>
        {/* Glowing OPEN / CLOSED door sign */}
        <mesh position={[0, 1.32, 0.135]}>
          <boxGeometry args={[0.46, 0.2, 0.025]} />
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

      {/* Cozy potted plant in front-left corner */}
      <group position={[-3.45, 0, 0.5]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 10]} />
          <meshStandardMaterial color="#c86b4b" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <dodecahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#40916c" roughness={0.75} />
        </mesh>
      </group>
    </group>
  );
}
