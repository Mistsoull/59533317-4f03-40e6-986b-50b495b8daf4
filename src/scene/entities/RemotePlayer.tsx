import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { PROFILES, type ProfileId } from '../../config/profiles';
import type { AnimState } from '../../services/supabase/types';
import { playerMotionStore } from '../../store/playerMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { useSessionStore } from '../../store/useSessionStore';
import { ModelSlot } from '../assets/ModelSlot';
import { ChefPlaceholder } from '../assets/placeholders/ChefPlaceholder';

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

/**
 * Renders the remote partner chef interpolated at 60 FPS from ~15 Hz Broadcast packets.
 * Uses SkeletonUtils.clone inside ModelSlot for independent animation mixing.
 */
export function RemotePlayer({ myProfileId }: { myProfileId: ProfileId }) {
  const partnerId: ProfileId = myProfileId === 'p1' ? 'p2' : 'p1';
  const isOnline = useSessionStore((s) => Boolean(s.onlineProfiles[partnerId]));
  const displayName = useGameStore(
    (s) => s.profiles[partnerId]?.displayName ?? PROFILES[partnerId].defaultName,
  );
  const color = PROFILES[partnerId].avatarColor;

  const groupRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState>('Idle');

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const rem = playerMotionStore.remote;
    if (!rem.active && !isOnline) {
      group.visible = false;
      return;
    }

    group.visible = true;
    const dt = Math.min(delta, 0.05);
    const smooth = 1 - Math.exp(-12 * dt);

    rem.x += (rem.targetX - rem.x) * smooth;
    rem.z += (rem.targetZ - rem.z) * smooth;
    rem.rotY = lerpAngle(rem.rotY, rem.targetRotY, smooth);
    animRef.current = rem.anim;

    group.position.set(rem.x, 0, rem.z);
    group.rotation.y = rem.rotY;
  });

  if (!isOnline) {
    return null;
  }

  return (
    <group
      ref={groupRef}
      position={[PROFILES[partnerId].spawnPosition[0], 0, PROFILES[partnerId].spawnPosition[1]]}
    >
      <ModelSlot
        assetId={partnerId === 'p1' ? 'chef_p1' : 'chef_p2'}
        animRef={animRef}
        placeholder={<ChefPlaceholder color={color} animRef={animRef} />}
      />
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.31, 18]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <Html
        position={[0, 1.82, 0]}
        center
        zIndexRange={[5, 0]}
        wrapperClass="pointer-events-none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="rounded-full px-2 py-0.5 text-[11px] font-bold tracking-tight text-white shadow-md whitespace-nowrap border border-white/25"
          style={{ backgroundColor: `${color}dd` }}
        >
          {displayName}
        </div>
      </Html>
    </group>
  );
}
