import { useRef, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { KITCHEN_STATIONS, type StationId } from '../../config/kitchenLayout';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { isStationLockedByOther } from '../../domain/stationRules';
import { useGameStore } from '../../store/useGameStore';

interface StationInteractableProps {
  stationId: StationId;
  myProfileId: ProfileId;
  onSelectStation: (stationId: StationId) => void;
  children: ReactNode;
}

export function StationInteractable({
  stationId,
  myProfileId,
  onSelectStation,
  children,
}: StationInteractableProps) {
  const def = KITCHEN_STATIONS[stationId];
  const stationState = useGameStore((s) => s.stations[stationId]);
  const profiles = useGameStore((s) => s.profiles);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const lockedByOther = isStationLockedByOther(stationState, myProfileId);
  const lockerName =
    stationState.lockedBy ? profiles[stationState.lockedBy]?.displayName ?? PROFILES[stationState.lockedBy].defaultName : null;

  const [sx, sy, sz] = def.position;
  const [ix, iz] = def.interactionPoint;
  const [hx, hy, hz] = def.hitboxSize;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    downPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!downPosRef.current) return;
    const moved = Math.hypot(
      e.clientX - downPosRef.current.x,
      e.clientY - downPosRef.current.y,
    );
    downPosRef.current = null;
    if (moved > 14) return;
    onSelectStation(stationId);
  };

  const badgeColor = lockedByOther
    ? 'bg-rose-900/90 border-rose-400/50 text-rose-100'
    : stationState.status === 'ready'
      ? 'bg-amber-600/95 border-amber-200/70 text-white'
      : 'bg-stone-900/80 border-amber-200/25 text-amber-50';

  return (
    <group>
      {/* Station 3D Model positioned on floor y = 0 */}
      <group position={[sx, sy, sz]}>
        {children}
        {/* Generous invisible touch hitbox for Tap-to-Interact */}
        <mesh
          position={[0, hy * 0.5, 0]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <boxGeometry args={[hx, hy, hz]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Station floating label & lock badge */}
        <Html
          position={[0, Math.min(hy + 0.28, 1.85), stationId === 'fridge' ? 0.45 : 0]}
          center
          zIndexRange={[5, 0]}
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-lg backdrop-blur-xs whitespace-nowrap ${badgeColor}`}
          >
            {lockedByOther ? (
              <span>🔒 {lockerName} kullanıyor</span>
            ) : (
              <span>
                {def.icon} {def.label}
              </span>
            )}
          </div>
        </Html>
      </group>

      {/* Subtle floor interaction tile indicator */}
      <mesh
        position={[ix, 0.018, iz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <ringGeometry args={[0.26, 0.36, 24]} />
        <meshBasicMaterial
          color={lockedByOther ? '#fb7185' : '#f2cc8f'}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
