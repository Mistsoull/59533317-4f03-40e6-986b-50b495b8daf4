import { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { RoomDoorDef } from '../config/kitchenLayout';

interface RoomDoorProps {
  door: RoomDoorDef;
  accentColor: string;
  active: boolean;
  onSelectDoor: () => void;
}

/**
 * Walkable 3D doorway connecting the Kitchen and the Neighborhood Market.
 */
export function RoomDoor({ door, accentColor, active, onSelectDoor }: RoomDoorProps) {
  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const [dx, dy, dz] = door.position;
  const [ix, iz] = door.interactionPoint;

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    downPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    if (!downPosRef.current) return;
    const moved = Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y);
    downPosRef.current = null;
    if (moved > 14) return;
    onSelectDoor();
  };

  return (
    <group>
      {/* Door frame mounted cleanly on left wall */}
      <group
        position={[dx, dy, dz]}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
      >
        {/* Outer wood frame */}
        <mesh position={[0.04, 1.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, 2.04, 1.12]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.72} />
        </mesh>
        {/* Painted door leaf */}
        <mesh position={[0.09, 0.98, 0]} castShadow>
          <boxGeometry args={[0.08, 1.9, 0.94]} />
          <meshStandardMaterial color={accentColor} roughness={0.55} />
        </mesh>
        {/* Upper glass pane */}
        <mesh position={[0.135, 1.42, 0]}>
          <boxGeometry args={[0.02, 0.62, 0.62]} />
          <meshStandardMaterial
            color="#d8f3ff"
            emissive="#fff6df"
            emissiveIntensity={0.35}
            roughness={0.2}
          />
        </mesh>
        {/* Brass doorknob */}
        <mesh position={[0.16, 0.92, 0.34]}>
          <sphereGeometry args={[0.048, 10, 10]} />
          <meshStandardMaterial color="#f2cc8f" roughness={0.25} metalness={0.8} />
        </mesh>

        {/* Floating door sign */}
        <Html
          position={[0.25, 2.05, 0]}
          center
          zIndexRange={[5, 0]}
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`rounded-full border border-emerald-400/50 bg-emerald-700/90 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md whitespace-nowrap ${
              active ? '' : 'hidden'
            }`}
          >
            {door.icon} {door.label}
          </div>
        </Html>
      </group>

      {/* Cozy welcome mat on floor at doorway */}
      <mesh
        position={[ix + 0.1, 0.014, iz]}
        receiveShadow
        onPointerDown={handleDown}
        onPointerUp={handleUp}
      >
        <boxGeometry args={[0.68, 0.024, 1.05]} />
        <meshStandardMaterial color="#d4a373" roughness={0.9} />
      </mesh>
      <mesh
        position={[ix, 0.028, iz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
      >
        <ringGeometry args={[0.22, 0.3, 24]} />
        <meshBasicMaterial color="#40916c" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}
