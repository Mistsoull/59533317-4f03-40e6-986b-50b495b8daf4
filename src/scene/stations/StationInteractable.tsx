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
  active: boolean;
  onSelectStation: (stationId: StationId) => void;
  children: ReactNode;
}

export function StationInteractable({
  stationId,
  myProfileId,
  active,
  onSelectStation,
  children,
}: StationInteractableProps) {
  const def = KITCHEN_STATIONS[stationId];
  const stationState = useGameStore((s) => s.stations[stationId]);
  const profiles = useGameStore((s) => s.profiles);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const lockedByOther = isStationLockedByOther(stationState, myProfileId);
  const lockerName =
    stationState.lockedBy
      ? profiles[stationState.lockedBy]?.displayName ?? PROFILES[stationState.lockedBy].defaultName
      : null;

  const [sx, sy, sz] = def.position;
  const [ix, iz] = def.interactionPoint;
  const [hx, hy, hz] = def.hitboxSize;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    downPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
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

  const badgeStyle = lockedByOther
    ? 'bg-rose-600/95 border-rose-200/80 text-white'
    : stationState.status === 'ready'
      ? 'bg-amber-500/95 border-amber-100 text-stone-950'
      : 'ui-card shadow-md';

  return (
    <group>
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
          position={[0, stationId === 'fridge' ? 2.02 : 1.48, 0.35]}
          center
          zIndexRange={[5, 0]}
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-xs whitespace-nowrap ${badgeStyle} ${
              active ? '' : 'hidden'
            }`}
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
        <ringGeometry args={[0.25, 0.35, 24]} />
        <meshBasicMaterial
          color={lockedByOther ? '#e11d48' : '#e07a5f'}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
