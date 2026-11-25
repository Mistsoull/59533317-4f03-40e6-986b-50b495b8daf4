import { useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ModelSlot } from './assets/ModelSlot';

interface MarketRoomProps {
  onTapFloor: (x: number, z: number) => void;
}

function useMarketFloorTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#e9cfa9';
    ctx.fillRect(0, 0, 256, 256);

    const plankColors = ['#ecd5b3', '#e4c79f', '#eed9bc', '#e0c197'];
    for (let row = 0; row < 4; row += 1) {
      ctx.fillStyle = plankColors[row];
      ctx.fillRect(0, row * 64, 256, 62);
      ctx.fillStyle = 'rgba(130, 88, 52, 0.17)';
      ctx.fillRect(0, row * 64 + 62, 256, 2);
      const seamX = row % 2 === 0 ? 110 : 200;
      ctx.fillRect(seamX, row * 64, 2, 62);
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
 * Full-screen enclosed 3-walled interior Neighborhood Grocery Shop ("Mahalle Marketi").
 * Designed so the camera sits inside the store with zero outer void or cutaway slab edges.
 */
export function MarketRoom({ onTapFloor }: MarketRoomProps) {
  const floorTexture = useMarketFloorTexture();
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
      {/* Seamless full-interior wooden plank floor extending well past camera frustum */}
      <mesh
        position={[0, -0.05, 1.5]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[24, 0.1, 22]} />
        <meshStandardMaterial map={floorTexture} roughness={0.82} />
      </mesh>

      {/* Subtle decorative wooden floor runner bordering the cozy center shop aisle */}
      <mesh position={[0, 0.004, 0.35]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.6, 4.4]} />
        <meshStandardMaterial color="#f6e9d5" transparent opacity={0.28} roughness={0.95} />
      </mesh>

      {/* ==================== TALL ENCLOSING BACK WALL (z = -3.12) ==================== */}
      <mesh position={[0, 3.2, -3.15]} receiveShadow>
        <boxGeometry args={[18, 6.4, 0.2]} />
        <meshStandardMaterial color="#fff8eb" roughness={0.88} />
      </mesh>
      {/* Mint grocery wainscoting & oak chair rail along back wall */}
      <mesh position={[0, 0.62, -3.03]} receiveShadow>
        <boxGeometry args={[17.8, 1.24, 0.04]} />
        <meshStandardMaterial color="#d4efe0" roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.26, -3.01]}>
        <boxGeometry args={[17.8, 0.08, 0.07]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.68} />
      </mesh>

      {/* Warm decorative grocery valance banner across upper back wall */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} position={[-4.55 + i * 0.7, 2.72, -2.92]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.7, 0.36, 0.08]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#e07a5f' : '#fff8ee'}
            roughness={0.65}
          />
        </mesh>
      ))}

      {/* ==================== TALL ENCLOSING LEFT WALL (x = -4.15) ==================== */}
      <mesh position={[-4.18, 3.2, 1.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.4, 16]} />
        <meshStandardMaterial color="#f8f2e4" roughness={0.88} />
      </mesh>
      <mesh position={[-4.06, 0.62, 1.5]} receiveShadow>
        <boxGeometry args={[0.04, 1.24, 15.8]} />
        <meshStandardMaterial color="#d4efe0" roughness={0.78} />
      </mesh>
      <mesh position={[-4.04, 1.26, 1.5]}>
        <boxGeometry args={[0.07, 0.08, 15.8]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.68} />
      </mesh>

      {/* Big sunlit shopfront window on left wall */}
      <group position={[-4.04, 1.85, -0.65]}>
        <mesh>
          <boxGeometry args={[0.07, 1.35, 2.2]} />
          <meshStandardMaterial color="#40916c" roughness={0.65} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.03, 1.2, 2.02]} />
          <meshStandardMaterial
            color="#cdeeff"
            emissive="#fff6da"
            emissiveIntensity={0.48}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 1.22, 0.05]} />
          <meshStandardMaterial color="#40916c" roughness={0.65} />
        </mesh>
      </group>

      {/* ==================== TALL ENCLOSING RIGHT WALL (x = +4.25) ==================== */}
      <mesh position={[4.28, 3.2, 1.5]} receiveShadow>
        <boxGeometry args={[0.2, 6.4, 16]} />
        <meshStandardMaterial color="#f8f2e4" roughness={0.88} />
      </mesh>
      <mesh position={[4.16, 0.62, 1.5]} receiveShadow>
        <boxGeometry args={[0.04, 1.24, 15.8]} />
        <meshStandardMaterial color="#d4efe0" roughness={0.78} />
      </mesh>
      <mesh position={[4.14, 1.26, 1.5]}>
        <boxGeometry args={[0.07, 0.08, 15.8]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.68} />
      </mesh>

      {/* Right wall decorative grocery wooden display shelves stocked with sculpted foods */}
      <group position={[3.95, 0, 0.35]}>
        <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.38, 0.07, 2.4]} />
          <meshStandardMaterial color="#b07d4f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.38, 0.07, 2.4]} />
          <meshStandardMaterial color="#b07d4f" roughness={0.7} />
        </mesh>
        <group position={[0, 1.59, -0.75]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_makarna" placeholder={null} />
        </group>
        <group position={[0, 1.59, -0.25]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_un" placeholder={null} />
        </group>
        <group position={[0, 1.59, 0.25]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_sut" placeholder={null} />
        </group>
        <group position={[0, 1.59, 0.75]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_krema" placeholder={null} />
        </group>
        <group position={[0, 2.19, -0.55]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_domates" placeholder={null} />
        </group>
        <group position={[0, 2.19, 0.05]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_cilek" placeholder={null} />
        </group>
        <group position={[0, 2.19, 0.65]} rotation={[0, -Math.PI / 2, 0]} scale={1.0}>
          <ModelSlot assetId="food_mantar" placeholder={null} />
        </group>
      </group>

      {/* Cozy potted shop plant in front-right corner */}
      <group position={[3.85, 0, 2.4]}>
        <mesh position={[0, 0.24, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.17, 0.48, 12]} />
          <meshStandardMaterial color="#d47255" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.68, 0]} castShadow>
          <sphereGeometry args={[0.32, 10, 10]} />
          <meshStandardMaterial color="#40916c" roughness={0.8} />
        </mesh>
        <mesh position={[0.14, 0.92, -0.06]} castShadow>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshStandardMaterial color="#52b788" roughness={0.8} />
        </mesh>
      </group>

      {/* ==================== LEFT CHECKOUT COUNTER (AABB matches market_checkout_counter) ==================== */}
      <group position={[-3.48, 0, 0.58]}>
        <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.92, 0.86, 2.25]} />
          <meshStandardMaterial color="#52b788" roughness={0.68} />
        </mesh>
        <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.07, 2.32]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.5} />
        </mesh>
        <mesh position={[0.02, 1.06, 0.35]} castShadow>
          <boxGeometry args={[0.38, 0.28, 0.44]} />
          <meshStandardMaterial color="#fff8ee" roughness={0.4} />
        </mesh>
        <mesh position={[0.12, 1.18, 0.35]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.08, 0.14, 0.34]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.3} />
        </mesh>
        <group position={[0.05, 0.925, -0.45]} scale={0.95}>
          <ModelSlot assetId="food_cilek" placeholder={null} />
        </group>
      </group>

      {/* ==================== CENTER SEASONAL PRODUCE TABLE (AABB matches market_center_display) ==================== */}
      <group position={[0, 0, 1.06]}>
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.68, 0.72, 0.8]} />
          <meshStandardMaterial color="#c68b59" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.76, 0.07, 0.88]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.55} />
        </mesh>
        <group position={[-0.55, 0.785, 0.04]} scale={1.08}>
          <ModelSlot assetId="food_domates" placeholder={null} />
        </group>
        <group position={[-0.18, 0.785, -0.02]} scale={1.08}>
          <ModelSlot assetId="food_biber" placeholder={null} />
        </group>
        <group position={[0.18, 0.785, 0.04]} scale={1.08}>
          <ModelSlot assetId="food_cilek" placeholder={null} />
        </group>
        <group position={[0.55, 0.785, -0.02]} scale={1.02}>
          <ModelSlot assetId="food_yumurta" placeholder={null} />
        </group>
      </group>
    </group>
  );
}
