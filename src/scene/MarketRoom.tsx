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

    // Warm honey-oak grocery plank pattern
    const plankColors = ['#ebd3b0', '#e3c69e', '#edd8b9', '#dfc095'];
    for (let row = 0; row < 4; row += 1) {
      ctx.fillStyle = plankColors[row];
      ctx.fillRect(0, row * 64, 256, 62);
      ctx.fillStyle = 'rgba(130, 88, 52, 0.18)';
      ctx.fillRect(0, row * 64 + 62, 256, 2);
      const seamX = row % 2 === 0 ? 110 : 200;
      ctx.fillRect(seamX, row * 64, 2, 62);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * Walkable 3D Neighborhood Grocery Shop ("Mahalle Marketi").
 * Features real sculpted 3D food items displayed on stalls and center produce table.
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
      {/* Warm wood plank floor (8m x 6m, y = 0) */}
      <mesh
        position={[0, -0.1, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[8, 0.2, 6]} />
        <meshStandardMaterial map={floorTexture} roughness={0.8} />
      </mesh>

      {/* Cozy sage trim plinth */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[8.26, 0.14, 6.26]} />
        <meshStandardMaterial color="#407a5f" roughness={0.85} />
      </mesh>

      {/* Back Cutaway Wall (fresh cream + sage dado rail) */}
      <mesh position={[0, 1.35, -3.08]} receiveShadow>
        <boxGeometry args={[8.16, 2.7, 0.16]} />
        <meshStandardMaterial color="#fff9ee" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.55, -2.99]} receiveShadow>
        <boxGeometry args={[8.0, 1.1, 0.03]} />
        <meshStandardMaterial color="#d8f3dc" roughness={0.75} />
      </mesh>

      {/* Left Cutaway Wall */}
      <mesh position={[-4.08, 1.35, 0]} receiveShadow>
        <boxGeometry args={[0.16, 2.7, 6.16]} />
        <meshStandardMaterial color="#f5f1e4" roughness={0.88} />
      </mesh>

      {/* Big sunny shopfront window on left wall */}
      <group position={[-3.98, 1.55, -0.65]}>
        <mesh>
          <boxGeometry args={[0.06, 1.25, 2.1]} />
          <meshStandardMaterial color="#40916c" roughness={0.65} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.03, 1.1, 1.94]} />
          <meshStandardMaterial
            color="#cdeeff"
            emissive="#fff6da"
            emissiveIntensity={0.45}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 1.12, 0.05]} />
          <meshStandardMaterial color="#40916c" roughness={0.65} />
        </mesh>
      </group>

      {/* Left Checkout Counter + Vintage Scale (matching market_checkout_counter AABB) */}
      <group position={[-3.46, 0, -0.5]}>
        <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.96, 0.86, 2.55]} />
          <meshStandardMaterial color="#52b788" roughness={0.68} />
        </mesh>
        <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.04, 0.07, 2.62]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.5} />
        </mesh>
        {/* Cute grocery cash register */}
        <mesh position={[0.02, 1.06, 0.45]} castShadow>
          <boxGeometry args={[0.38, 0.28, 0.44]} />
          <meshStandardMaterial color="#fff8ee" roughness={0.4} />
        </mesh>
        <mesh position={[0.12, 1.18, 0.45]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.08, 0.14, 0.34]} />
          <meshStandardMaterial color="#2b2d42" roughness={0.3} />
        </mesh>
        {/* Fresh strawberry basket on checkout */}
        <group position={[0.05, 0.925, -0.45]} scale={0.95}>
          <ModelSlot assetId="food_cilek" placeholder={null} />
        </group>
      </group>

      {/* Center Seasonal Fresh Display Table (matching market_center_display AABB) */}
      <group position={[0, 0, 0.975]}>
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.68, 0.72, 0.8]} />
          <meshStandardMaterial color="#c68b59" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.76, 0.07, 0.88]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.55} />
        </mesh>
        {/* Sculpted fresh items on center display */}
        <group position={[-0.55, 0.785, 0.04]} scale={1.05}>
          <ModelSlot assetId="food_domates" placeholder={null} />
        </group>
        <group position={[-0.18, 0.785, -0.02]} scale={1.05}>
          <ModelSlot assetId="food_biber" placeholder={null} />
        </group>
        <group position={[0.18, 0.785, 0.04]} scale={1.05}>
          <ModelSlot assetId="food_cilek" placeholder={null} />
        </group>
        <group position={[0.55, 0.785, -0.02]} scale={1.0}>
          <ModelSlot assetId="food_yumurta" placeholder={null} />
        </group>
      </group>
    </group>
  );
}
