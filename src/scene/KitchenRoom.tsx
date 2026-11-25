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
      {/* Bright warm checkered floor (8m x 6m, y = 0) */}
      <mesh
        position={[0, -0.1, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[8, 0.2, 6]} />
        <meshStandardMaterial map={floorTexture} roughness={0.82} />
      </mesh>

      {/* Clean warm oak trim plinth */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[8.26, 0.14, 6.26]} />
        <meshStandardMaterial color="#8c6244" roughness={0.85} />
      </mesh>

      {/* Back Cutaway Wall (z = -3, crisp 2.25m height for clean top-down angled framing) */}
      <mesh position={[0, 1.125, -3.08]} receiveShadow>
        <boxGeometry args={[8.16, 2.25, 0.16]} />
        <meshStandardMaterial color="#fff7ec" roughness={0.88} />
      </mesh>
      {/* Sage mint subway tile backsplash */}
      <mesh position={[-0.45, 1.22, -2.99]} receiveShadow>
        <boxGeometry args={[6.9, 0.68, 0.03]} />
        <meshStandardMaterial color="#cde6da" roughness={0.52} />
      </mesh>

      {/* Left Cutaway Wall (x = -4) */}
      <mesh position={[-4.08, 1.125, 0]} receiveShadow>
        <boxGeometry args={[0.16, 2.25, 6.16]} />
        <meshStandardMaterial color="#f8eee0" roughness={0.88} />
      </mesh>

      {/* Sunlit Kitchen Window on Left Wall */}
      <group position={[-3.98, 1.48, -0.55]}>
        <mesh>
          <boxGeometry args={[0.06, 0.96, 1.65]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.03, 0.82, 1.5]} />
          <meshStandardMaterial
            color="#bce7fb"
            emissive="#fff6da"
            emissiveIntensity={0.45}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 0.84, 0.05]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <boxGeometry args={[0.03, 0.05, 1.52]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.7} />
        </mesh>
      </group>

      {/* Decorative Wall Shelf stocked with REAL sculpted 3D food items (no plain cylinders!) */}
      <group position={[-0.05, 1.76, -2.84]}>
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
      {/* Corner + counter left of Cutting Board (x: -3.96..-1.80) */}
      <mesh position={[-2.88, 0.43, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[2.16, 0.86, 0.88]} />
        <meshStandardMaterial color="#e8d9c5" roughness={0.75} />
      </mesh>
      <mesh position={[-2.88, 0.89, -2.42]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.07, 0.94]} />
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
      {/* Egg carton resting on prep counter next to stove */}
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
      {/* Fresh mushrooms & cream resting next to fridge */}
      <group position={[2.02, 0.925, -2.38]} scale={0.95}>
        <ModelSlot assetId="food_mantar" placeholder={null} />
      </group>
      <group position={[2.32, 0.925, -2.42]} scale={0.95}>
        <ModelSlot assetId="food_krema" placeholder={null} />
      </group>

      {/* Left Side Counter + Sink (joins corner cleanly, ends at z = 0.95 leaving room for Market Door!) */}
      <group position={[-3.46, 0, -0.52]}>
        <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.96, 0.86, 2.92]} />
          <meshStandardMaterial color="#e8d9c5" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.02, 0.07, 2.96]} />
          <meshStandardMaterial color="#fff9f0" roughness={0.45} />
        </mesh>
        {/* Sink basin */}
        <mesh position={[0.04, 0.935, 0]}>
          <boxGeometry args={[0.52, 0.03, 0.72]} />
          <meshStandardMaterial color="#9eb0bf" roughness={0.28} metalness={0.72} />
        </mesh>
        {/* Faucet */}
        <mesh position={[-0.25, 1.12, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
          <meshStandardMaterial color="#dce4ec" roughness={0.22} metalness={0.85} />
        </mesh>
        <mesh position={[-0.14, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
          <meshStandardMaterial color="#dce4ec" roughness={0.22} metalness={0.85} />
        </mesh>
      </group>

      {/* Center Compact Breakfast Island with real sculpted fruit/veg bowl */}
      <group position={[0, 0, 1.0]}>
        <mesh position={[0, 0.41, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.52, 0.82, 0.84]} />
          <meshStandardMaterial color="#a67c52" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.855, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.62, 0.08, 0.92]} />
          <meshStandardMaterial color="#f5e6d3" roughness={0.5} />
        </mesh>
        {/* Ceramic fruit bowl */}
        <mesh position={[0, 0.94, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.18, 0.1, 16]} />
          <meshStandardMaterial color="#e07a5f" roughness={0.45} />
        </mesh>
        {/* Recognizable sculpted tomato, strawberry & green pepper inside bowl */}
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
