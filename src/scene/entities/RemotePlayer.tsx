import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { CHARACTERS } from '../../config/characters';
import type { RoomId } from '../../config/kitchenLayout';
import { PROFILES, type ProfileId } from '../../config/profiles';
import type { AnimState } from '../../services/supabase/types';
import { playerMotionStore } from '../../store/playerMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { useSessionStore } from '../../store/useSessionStore';
import type { AssetId } from '../assets/assetManifest';
import { ModelSlot } from '../assets/ModelSlot';
import { ChefPlaceholder } from '../assets/placeholders/ChefPlaceholder';

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

/**
 * Renders the remote partner interpolated at 60 FPS from ~15 Hz Broadcast packets
 * (and immediately seeded from Presence so late joiners ALWAYS see already-connected partners!).
 */
export function RemotePlayer({
  myProfileId,
  room,
}: {
  myProfileId: ProfileId;
  room: RoomId;
}) {
  const partnerId: ProfileId = myProfileId === 'p1' ? 'p2' : 'p1';
  const partnerPresence = useSessionStore((s) => s.onlineProfiles[partnerId]);
  const partnerProfile = useGameStore((s) => s.profiles[partnerId]);

  const isOnline = Boolean(partnerPresence);
  const partnerRoom = partnerPresence?.room ?? playerMotionStore.remote.room ?? 'kitchen';
  const inSameRoom = isOnline && partnerRoom === room;

  const displayName =
    partnerProfile?.displayName ??
    partnerPresence?.displayName ??
    PROFILES[partnerId].defaultName;
  const characterId =
    partnerProfile?.characterId ??
    partnerPresence?.characterId ??
    PROFILES[partnerId].defaultCharacter;
  const charDef = CHARACTERS[characterId] ?? CHARACTERS.dudu;
  const assetId = `char_${charDef.id}` as AssetId;

  const groupRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState>('Idle');

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (!inSameRoom) {
      group.visible = false;
      return;
    }

    const rem = playerMotionStore.remote;
    group.visible = true;

    if (!rem.initialized) {
      const [sx, sz] = PROFILES[partnerId].spawnPosition;
      group.position.set(sx, 0, sz);
      group.rotation.y = 0;
      animRef.current = 'Idle';
      return;
    }

    const dt = Math.min(delta, 0.05);
    const smooth = 1 - Math.exp(-12 * dt);

    rem.x += (rem.targetX - rem.x) * smooth;
    rem.z += (rem.targetZ - rem.z) * smooth;
    rem.rotY = lerpAngle(rem.rotY, rem.targetRotY, smooth);
    animRef.current = rem.anim;

    group.position.set(rem.x, 0, rem.z);
    group.rotation.y = rem.rotY;
  });

  if (!inSameRoom) {
    return null;
  }

  const initX = playerMotionStore.remote.initialized
    ? playerMotionStore.remote.x
    : PROFILES[partnerId].spawnPosition[0];
  const initZ = playerMotionStore.remote.initialized
    ? playerMotionStore.remote.z
    : PROFILES[partnerId].spawnPosition[1];

  return (
    <group ref={groupRef} position={[initX, 0, initZ]}>
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
