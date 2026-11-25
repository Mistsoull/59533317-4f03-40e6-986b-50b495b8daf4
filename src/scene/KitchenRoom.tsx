import { useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ModelSlot } from './assets/ModelSlot';

interface KitchenRoomProps {
  onTapFloor: (x: number, z: number) => void;
}

function useKitchenFloorTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fbf3e7';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#eedcc6';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    ctx.strokeStyle = 'rgba(140, 105, 72, 0.14)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);
    ctx.strokeRect(130, 2, 124, 124);
    ctx.strokeRect(2, 130, 124, 124);
    ctx.strokeRect(130, 130, 124, 124);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 22);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * Full-screen enclosed 3-walled interior Kitchen ("Bizim Mutfak").
 * Seamless floor & tall perimeter walls fill 100% of the viewport with zero outer void.
 */
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
      {/* Seamless full-interior checkered tile floor extending well past camera frustum */}
      <mesh
        position={[0, -0.05, 1.5]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[24, 0.1, 22]} />
        <meshStandardMaterial map={floorTexture} roughness={0.82} />
      </mesh>

      {/* ==================== TALL ENCLOSING BACK WALL (z = -3.15) ==================== */}
      <mesh position={[0, 3.2, -3.15]} receiveShadow>
        <boxGeometry args={[18, 6.4, 0.2]} />
        <meshStandardMaterial color="#fff7ec" roughness={0.88} />
      </mesh>
      {/* Sage mint subway tile backsplash along back wall */}
      <mesh position={[-0.4, 1.25, -3.03]} receiveShadow>
        <boxGeometry args={[7.4, 0.78, 0.04]} />
        <meshStandardMaterial color="#cde6da" roughness={0.52} />
      </mesh>
      {/* Warm oak upper picture rail */}
      <mesh position={[0, 2.55, -3.02]}>
        <boxGeometry args={[17.8, 0.08, 0.06]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.68} />
      </mesh>

      {/* ==================== TALL ENCLOSING LEFT WALL (x = -4.18) ==================== */}
      <mesh position={[-4.18, 3.2, 1.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.4, 16]} />
        <meshStandardMaterial color="#f8eee0" roughness={0.88} />
      </mesh>
      <mesh position={[-4.06, 0.45, 1.5]} receiveShadow>
        <boxGeometry args={[0.04, 0.9, 15.8]} />
        <meshStandardMaterial color="#e8d9c5" roughness={0.78} />
      </mesh>
      <mesh position={[-4.04, 2.55, 1.5]}>
        <boxGeometry args={[0.06, 0.08, 15.8]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.68} />
      </mesh>

      {/* ==================== TALL ENCLOSING RIGHT WALL (x = +4.18) ==================== */}
      <mesh position={[4.18, 3.2, 1.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.4, 16]} />
        <meshStandardMaterial color="#f8eee0" roughness={0.88} />
      </mesh>
      <mesh position={[4.06, 0.45, 1.5]} receiveShadow>
        <boxGeometry args={[0.04, 0.9, 15.8]} />
        <meshStandardMaterial color="#e8d9c5" roughness={0.78} />
      </mesh>
      <mesh position={[4.04, 2.55, 1.5]}>
        <boxGeometry args={[0.06, 0.08, 15.8]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.68} />
      </mesh>

      {/* Kitchen-to-Restaurant Pass-Through Window on Right Wall above Service Pass */}
      <group position={[4.05, 1.62, 0.38]}>
        <mesh>
          <boxGeometry args={[0.08, 0.96, 1.38]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
        <mesh position={[-0.048, 0, 0]}>
          <boxGeometry args={[0.02, 0.8, 1.22]} />
          <meshStandardMaterial
            color="#ffe9c7"
            emissive="#ffd28a"
            emissiveIntensity={0.42}
            roughness={0.32}
          />
        </mesh>
      </group>

      {/* Sunlit Kitchen Window on Left Wall */}
      <group position={[-4.05, 1.72, -0.55]}>
        <mesh>
          <boxGeometry args={[0.07, 1.15, 1.82]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
        <mesh position={[0.044, 0, 0]}>
          <boxGeometry args={[0.02, 1.0, 1.66]} />
          <meshStandardMaterial
            color="#bce7fb"
            emissive="#fff6da"
            emissiveIntensity={0.45}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0.062, 0, 0]}>
          <boxGeometry args={[0.02, 1.02, 0.05]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
        <mesh position={[0.062, 0, 0]}>
          <boxGeometry args={[0.02, 0.05, 1.68]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
      </group>

      {/* Decorative Wall Shelf stocked with sculpted 3D food items */}
      <group position={[-0.05, 1.94, -2.84]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.35, 0.07, 0.32]} />
          <meshStandardMaterial color="#b07d4f" roughness={0.68} />
        </mesh>
        <group position={[-0.85, 0.035, 0.02]} scale={0.9}>
          <ModelSlot assetId="food_sut" placeholder={null} />
        </group>
        <group position={[-0.45, 0.035, 0.02]} scale={0.9}>
          <ModelSlot assetId="food_un" placeholder={null} />
        </group>
        <group position={[0.0, 0.035, 0.02]} scale={0.95}>
          <ModelSlot assetId="food_makarna" placeholder={null} />
        </group>
        <group position={[0.45, 0.035, 0.02]} scale={0.9}>
          <ModelSlot assetId="food_krema" placeholder={null} />
        </group>
        <group position={[0.85, 0.035, 0.02]} scale={0.85}>
          <ModelSlot assetId="food_domates" placeholder={null} />
        </group>
      </group>

      {/* Seamless Connecting Back Counters (Left Corner -> Cutting Board -> Stove -> Space for Fridge) */}
      <mesh position={[-2.92, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[2.24, 0.86, 0.88]} />
        <meshStandardMaterial color="#e8d9c5" roughness={0.75} />
      </mesh>
      <mesh position={[-2.92, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[2.28, 0.07, 0.94]} />
        <meshStandardMaterial color="#fff9f0" roughness={0.45} />
      </mesh>

      {/* Counter between Cutting Board (-1.15) and Stove (1.05) */}
      <mesh position={[-0.04, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[0.98, 0.86, 0.88]} />
        <meshStandardMaterial color="#e8d9c5" roughness={0.75} />
      </mesh>
      <mesh position={[-0.04, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.02, 0.07, 0.94]} />
        <meshStandardMaterial color="#fff9f0" roughness={0.45} />
      </mesh>
      <group position={[-0.05, 0.925, -2.38]} rotation={[0, 0.25, 0]} scale={1.1}>
        <ModelSlot assetId="food_yumurta" placeholder={null} />
      </group>

      {/* Counter between Stove (1.05) and Freestanding Fridge (3.22) */}
      <mesh position={[2.18, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.02, 0.86, 0.88]} />
        <meshStandardMaterial color="#e8d9c5" roughness={0.75} />
      </mesh>
      <mesh position={[2.18, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[1.06, 0.07, 0.94]} />
        <meshStandardMaterial color="#fff9f0" roughness={0.45} />
      </mesh>
      <group position={[2.02, 0.925, -2.38]} scale={0.95}>
        <ModelSlot assetId="food_mantar" placeholder={null} />
      </group>
      <group position={[2.32, 0.925, -2.42]} scale={0.95}>
        <ModelSlot assetId="food_krema" placeholder={null} />
      </group>

      {/* Left Side Counter + Sink (ends at z = 0.95 leaving wide clearance for Market Door) */}
      <group position={[-3.48, 0, -0.52]}>
        <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.98, 0.86, 2.92]} />
          <meshStandardMaterial color="#e8d9c5" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.04, 0.07, 2.96]} />
          <meshStandardMaterial color="#fff9f0" roughness={0.45} />
        </mesh>
        <mesh position={[0.04, 0.935, 0]}>
          <boxGeometry args={[0.52, 0.03, 0.72]} />
          <meshStandardMaterial color="#9eb0bf" roughness={0.28} metalness={0.72} />
        </mesh>
        <mesh position={[-0.25, 1.12, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
          <meshStandardMaterial color="#dce4ec" roughness={0.22} metalness={0.85} />
        </mesh>
        <mesh position={[-0.14, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
          <meshStandardMaterial color="#dce4ec" roughness={0.22} metalness={0.85} />
        </mesh>
      </group>

      {/* Center Compact Breakfast Island with sculpted fruit/veg bowl */}
      <group position={[0, 0, 1.0]}>
        <mesh position={[0, 0.41, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.52, 0.82, 0.84]} />
          <meshStandardMaterial color="#a67c52" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.855, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.62, 0.08, 0.92]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.94, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.18, 0.1, 16]} />
          <meshStandardMaterial color="#e07a5f" roughness={0.45} />
        </mesh>
        <group position={[-0.08, 0.95, 0.04]} scale={0.75}>
          <ModelSlot assetId="food_domates" placeholder={null} />
        </group>
        <group position={[0.09, 0.95, 0.04]} scale={0.78}>
          <ModelSlot assetId="food_cilek" placeholder={null} />
        </group>
        <group position={[0.0, 0.95, -0.07]} scale={0.7}>
          <ModelSlot assetId="food_biber" placeholder={null} />
        </group>
      </group>
    </group>
  );
}
