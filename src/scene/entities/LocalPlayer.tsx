import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { CHARACTERS } from '../../config/characters';
import {
  KITCHEN_BOUNDS,
  KITCHEN_STATIONS,
  KITCHEN_TO_MARKET_DOOR,
  PLAYER_HALF_EXTENT,
  PLAYER_SPEED,
  type Aabb2D,
  type RoomId,
} from '../../config/kitchenLayout';
import { MARKET_STALLS, MARKET_TO_KITCHEN_DOOR } from '../../config/marketLayout';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { kitchenAudio } from '../../domain/audio';
import { resolveMovement2D } from '../../domain/collision2d';
import { kitchenRealtime } from '../../services/supabase/realtimeSync';
import type { AnimState } from '../../services/supabase/types';
import { playerMotionStore, type PendingDestination } from '../../store/playerMotionStore';
import { useGameStore } from '../../store/useGameStore';
import type { AssetId } from '../assets/assetManifest';
import { ModelSlot } from '../assets/ModelSlot';
import { ChefPlaceholder } from '../assets/placeholders/ChefPlaceholder';

interface LocalPlayerProps {
  profileId: ProfileId;
  room: RoomId;
  obstacles: readonly Aabb2D[];
  onArriveDestination: (dest: NonNullable<PendingDestination>) => void;
}

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

export function LocalPlayer({
  profileId,
  room,
  obstacles,
  onArriveDestination,
}: LocalPlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState>('Idle');
  const profile = useGameStore((s) => s.profiles[profileId]);
  const displayName = profile?.displayName ?? PROFILES[profileId].defaultName;
  const characterId = profile?.characterId ?? PROFILES[profileId].defaultCharacter;
  const charDef = CHARACTERS[characterId] ?? CHARACTERS.bubu;
  const assetId = `char_${charDef.id}` as AssetId;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const loc = playerMotionStore.local;
    loc.room = room;

    if (loc.waypoints.length > 0 && !loc.isInteracting) {
      const target = loc.waypoints[0];
      const dx = target.x - loc.x;
      const dz = target.z - loc.z;
      const dist = Math.hypot(dx, dz);
      const stepDist = PLAYER_SPEED * dt;

      if (dist <= stepDist + 0.03) {
        const resolved = resolveMovement2D(
          { x: loc.x, z: loc.z },
          target,
          PLAYER_HALF_EXTENT,
          obstacles,
          KITCHEN_BOUNDS,
        );
        loc.x = resolved.x;
        loc.z = resolved.z;
        loc.waypoints.shift();

        if (loc.waypoints.length === 0) {
          loc.anim = 'Idle';
          const arrived = loc.pendingDest;
          if (arrived) {
            loc.pendingDest = null;
            if (arrived.type === 'station') {
              loc.facingGoal = KITCHEN_STATIONS[arrived.stationId].facingAngle;
            } else if (arrived.type === 'market_stall') {
              loc.facingGoal = MARKET_STALLS[arrived.stallId].facingAngle;
            } else if (arrived.type === 'door') {
              loc.facingGoal =
                arrived.targetRoom === 'market'
                  ? KITCHEN_TO_MARKET_DOOR.facingAngle
                  : MARKET_TO_KITCHEN_DOOR.facingAngle;
            }
            kitchenRealtime.maybeBroadcastMotion(room, loc.x, loc.z, loc.rotY, 'Idle', true);
            onArriveDestination(arrived);
          } else {
            kitchenRealtime.maybeBroadcastMotion(room, loc.x, loc.z, loc.rotY, 'Idle', true);
          }
        }
      } else {
        const dirX = dx / dist;
        const dirZ = dz / dist;
        const desired = {
          x: loc.x + dirX * stepDist,
          z: loc.z + dirZ * stepDist,
        };
        const resolved = resolveMovement2D(
          { x: loc.x, z: loc.z },
          desired,
          PLAYER_HALF_EXTENT,
          obstacles,
          KITCHEN_BOUNDS,
        );
        loc.x = resolved.x;
        loc.z = resolved.z;
        const targetAngle = Math.atan2(dirX, dirZ);
        loc.rotY = lerpAngle(loc.rotY, targetAngle, 1 - Math.exp(-14 * dt));
        loc.anim = 'Walk';

        loc.stepTimer += dt;
        if (loc.stepTimer >= 0.34) {
          loc.stepTimer = 0;
          kitchenAudio.playStep();
        }
      }
    } else if (loc.facingGoal !== null) {
      loc.rotY = lerpAngle(loc.rotY, loc.facingGoal, 1 - Math.exp(-12 * dt));
    }

    animRef.current = loc.anim;

    if (groupRef.current) {
      groupRef.current.position.set(loc.x, 0, loc.z);
      groupRef.current.rotation.y = loc.rotY;
    }

    // Throttled ~15 Hz Broadcast (NEVER writes to Postgres)
    kitchenRealtime.maybeBroadcastMotion(room, loc.x, loc.z, loc.rotY, loc.anim);
  });

  return (
    <group ref={groupRef} position={[playerMotionStore.local.x, 0, playerMotionStore.local.z]}>
      <ModelSlot
        key={assetId}
        assetId={assetId}
        animRef={animRef}
        placeholder={<ChefPlaceholder color={charDef.accentColor} animRef={animRef} />}
      />
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 18]} />
        <meshBasicMaterial color={charDef.accentColor} transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <Html
        position={[0, 1.56, 0]}
        center
        zIndexRange={[5, 0]}
        wrapperClass="pointer-events-none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight text-white shadow-md whitespace-nowrap border border-white/40"
          style={{ backgroundColor: `${charDef.accentColor}eb` }}
        >
          {charDef.emoji} {displayName}
        </div>
      </Html>
    </group>
  );
}
